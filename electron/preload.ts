import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface DownloadProgress {
  percent: number
  stage: 'downloading' | 'converting' | 'uploading' | 'done'
  message: string
}

const api = {
  // YouTube download - returns { success, track } or { success: false, error }
  downloadAudio: (url: string) => ipcRenderer.invoke('download-audio', url),
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: DownloadProgress) =>
      callback(progress)
    ipcRenderer.on('download-progress', handler)
    return () => ipcRenderer.removeListener('download-progress', handler)
  },
  // File import - pass file paths, returns { imported, errors }
  importFiles: (filePaths: string[]) => ipcRenderer.invoke('import-files', filePaths),
  // Open native file picker
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  // Get local cache path for a track
  getCachePath: (trackId: string) => ipcRenderer.invoke('get-cache-path', trackId),
  // Check if yt-dlp is installed
  checkYtDlp: () => ipcRenderer.invoke('check-ytdlp'),
  // Import progress events
  onImportProgress: (callback: (progress: { current: number; total: number; name: string; stage: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: any) => callback(progress)
    ipcRenderer.on('import-progress', handler)
    return () => ipcRenderer.removeListener('import-progress', handler)
  },
  // Get cache directory
  getCacheDir: () => ipcRenderer.invoke('get-cache-dir'),
  // Get real file path from a dropped File object
  getPathForFile: (file: File) => webUtils.getPathForFile(file)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
