import { spawn, execFile, ExecFileOptions, SpawnOptions } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import { tmpdir } from 'os'
import { readFile, unlink, readdir } from 'fs/promises'
import { existsSync } from 'fs'

// Packaged Electron apps don't inherit the user's shell PATH.
// Ensure common tool locations are on PATH so yt-dlp can find ffmpeg, deno, etc.
const extraPaths = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
const shellPath = (process.env.PATH || '').split(':')
const fullPath = [...new Set([...extraPaths, ...shellPath])].join(':')
const envWithPath = { ...process.env, PATH: fullPath }

export interface DownloadResult {
  title: string
  artist: string
  duration: number
  thumbnailUrl: string
  filePath: string
  youtubeUrl: string
}

export interface DownloadProgress {
  percent: number
  stage: 'downloading' | 'converting' | 'uploading' | 'done'
  message: string
}

export async function getYtDlpPath(): Promise<string> {
  const bundledPath = join(
    app.isPackaged ? process.resourcesPath : join(__dirname, '../../resources'),
    'yt-dlp'
  )
  if (existsSync(bundledPath)) return bundledPath

  // Check common homebrew paths
  const commonPaths = ['/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp']
  for (const p of commonPaths) {
    if (existsSync(p)) return p
  }

  return new Promise((resolve, reject) => {
    execFile('/bin/sh', ['-c', 'which yt-dlp'], { env: envWithPath }, (error, stdout) => {
      if (error) reject(new Error('yt-dlp not found. Install with: brew install yt-dlp'))
      else resolve(stdout.trim())
    })
  })
}

export async function downloadAudio(
  url: string,
  onProgress: (progress: DownloadProgress) => void
): Promise<DownloadResult> {
  const ytDlpPath = await getYtDlpPath()
  const tempBase = join(tmpdir(), `music-dl-${Date.now()}`)
  // Use %(ext)s so yt-dlp controls the extension
  const outputTemplate = `${tempBase}.%(ext)s`

  onProgress({ percent: 0, stage: 'downloading', message: 'Fetching metadata...' })
  const metadata = await getMetadata(ytDlpPath, url)

  // Download and convert, capturing the final file path from yt-dlp
  const filePath = await new Promise<string>((resolve, reject) => {
    let lastLine = ''
    let stderrOutput = ''

    const proc = spawn(ytDlpPath, [
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '-o', outputTemplate,
      '--no-playlist',
      '--newline',
      '--print', 'after_move:filepath',
      url
    ], { env: envWithPath })

    proc.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        lastLine = line.trim()
        const match = line.match(/(\d+\.?\d*)%/)
        if (match) {
          onProgress({
            percent: parseFloat(match[1]),
            stage: 'downloading',
            message: `Downloading... ${match[1]}%`
          })
        }
      }
    })

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString()
      stderrOutput += text
      if (text.includes('Extracting') || text.includes('Converting')) {
        onProgress({ percent: 95, stage: 'converting', message: 'Converting to MP3...' })
      }
    })

    proc.on('close', (code) => {
      if (code === 0 && lastLine && existsSync(lastLine)) {
        resolve(lastLine)
      } else if (code === 0) {
        // Fallback: find the file by the temp base name
        const mp3Path = `${tempBase}.mp3`
        if (existsSync(mp3Path)) {
          resolve(mp3Path)
        } else {
          reject(new Error(`Download completed but output file not found. Last output: ${lastLine}`))
        }
      } else {
        reject(new Error(`yt-dlp failed (code ${code}): ${stderrOutput.slice(-500)}`))
      }
    })

    proc.on('error', (err) => reject(new Error(`Failed to spawn yt-dlp: ${err.message}`)))
  })

  onProgress({ percent: 100, stage: 'done', message: 'Download complete!' })

  return {
    title: metadata.title || 'Unknown Title',
    artist: metadata.artist || metadata.uploader || metadata.channel || 'Unknown Artist',
    duration: Math.round(metadata.duration || 0),
    thumbnailUrl: metadata.thumbnail || '',
    filePath,
    youtubeUrl: url
  }
}

export async function readAndCleanup(filePath: string): Promise<Buffer> {
  const buffer = await readFile(filePath)
  await unlink(filePath).catch(() => {})
  return buffer
}

async function getMetadata(ytDlpPath: string, url: string): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    execFile(
      ytDlpPath,
      ['--dump-json', '--no-download', '--no-playlist', url],
      { maxBuffer: 10 * 1024 * 1024, env: envWithPath },
      (error, stdout, stderr) => {
        if (error) return reject(new Error(`Metadata fetch failed: ${stderr || error.message}`))
        try {
          resolve(JSON.parse(stdout))
        } catch {
          reject(new Error('Failed to parse metadata JSON'))
        }
      }
    )
  })
}
