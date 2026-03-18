import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, basename, extname } from 'path'
import { copyFile, readFile, unlink } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { downloadAudio, getYtDlpPath } from './downloader'
import { getCachePath, getCachedFilePath, findCachedFile, ensureCacheDir } from './cache'
import { uploadAudioFile, insertTrack } from './supabase'
import { config } from 'dotenv'

// Load .env so process.env has VITE_SUPABASE_URL etc.
// Try multiple locations since app path differs between dev and packaged
config({ path: join(process.resourcesPath, '.env') })
config({ path: join(app.getAppPath(), '.env') })
config({ path: join(process.cwd(), '.env') })

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.music.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC: Download audio from YouTube → cache locally + upload to Supabase → return track metadata
  ipcMain.handle('download-audio', async (event, url: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    try {
      const result = await downloadAudio(url, (progress) => {
        window?.webContents.send('download-progress', progress)
      })

      window?.webContents.send('download-progress', {
        percent: 90,
        stage: 'uploading',
        message: 'Uploading to cloud...'
      })

      // Upload to Supabase Storage (preserve original extension from yt-dlp)
      const dlExt = extname(result.filePath) || '.opus'
      const fileName = `${Date.now()}-${result.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50)}${dlExt}`
      const storagePath = await uploadAudioFile(fileName, result.filePath)

      // Insert track into DB
      const track = await insertTrack({
        title: result.title,
        artist: result.artist,
        duration: result.duration,
        youtube_url: result.youtubeUrl,
        storage_path: storagePath,
        artwork_url: result.thumbnailUrl,
        start_time: null,
        end_time: null
      })

      // Cache locally (preserve original extension)
      await ensureCacheDir()
      await copyFile(result.filePath, getCachedFilePath(track.id, dlExt))

      // Clean up temp file
      await unlink(result.filePath).catch(() => {})

      window?.webContents.send('download-progress', {
        percent: 100,
        stage: 'done',
        message: 'Done!'
      })

      return { success: true, track }
    } catch (error: any) {
      console.error('Download error:', error)
      return { success: false, error: error.message || String(error) }
    }
  })

  // IPC: Import local audio files → cache + upload to Supabase → return tracks
  ipcMain.handle('import-files', async (event, filePaths: string[]) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const imported: any[] = []
    const errors: string[] = []

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i]
      try {
        const name = basename(filePath)
        const ext = extname(name)
        const title = name.slice(0, name.length - ext.length)

        console.log(`[import] Processing ${i + 1}/${filePaths.length}: ${name}`)
        window?.webContents.send('import-progress', {
          current: i + 1,
          total: filePaths.length,
          name: title,
          stage: 'uploading'
        })

        // Upload to Supabase Storage
        const fileName = `${Date.now()}-${title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50)}${ext || '.mp3'}`
        const storagePath = await uploadAudioFile(fileName, filePath)

        window?.webContents.send('import-progress', {
          current: i + 1,
          total: filePaths.length,
          name: title,
          stage: 'saving'
        })

        // Insert track into DB
        const track = await insertTrack({
          title,
          artist: null,
          duration: null,
          youtube_url: null,
          storage_path: storagePath,
          artwork_url: null,
          start_time: null,
          end_time: null
        })

        // Cache locally
        await ensureCacheDir()
        await copyFile(filePath, getCachedFilePath(track.id))

        imported.push(track)
        console.log(`[import] Done: ${name} → ${track.id}`)
      } catch (err: any) {
        console.error(`[import] Failed: ${basename(filePath)}:`, err)
        errors.push(`${basename(filePath)}: ${err.message}`)
      }
    }

    return { imported, errors }
  })

  // IPC: Open file dialog
  ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Audio', extensions: ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus', 'webm', 'aac', 'wma'] }
      ]
    })
    return result.canceled ? [] : result.filePaths
  })

  // IPC: Get local cache path for a track (finds whatever extension is cached)
  ipcMain.handle('get-cache-path', async (_event, trackId: string) => {
    return await findCachedFile(trackId) || getCachedFilePath(trackId)
  })

  // IPC: Check if yt-dlp is available
  ipcMain.handle('check-ytdlp', async () => {
    try {
      const path = await getYtDlpPath()
      return { available: true, path }
    } catch {
      return { available: false, path: null }
    }
  })

  // IPC: Delete cached file for a track
  ipcMain.handle('delete-cache', async (_event, trackId: string) => {
    const cached = await findCachedFile(trackId)
    if (cached) {
      await unlink(cached).catch(() => {})
      return true
    }
    return false
  })

  // IPC: Get app cache directory
  ipcMain.handle('get-cache-dir', () => {
    return getCachePath()
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
