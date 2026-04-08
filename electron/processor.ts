import { execFile, spawn } from 'child_process'
import { join } from 'path'
import { tmpdir } from 'os'
import { existsSync } from 'fs'
import { unlink } from 'fs/promises'

// Ensure common tool locations are on PATH
const extraPaths = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
const shellPath = (process.env.PATH || '').split(':')
const fullPath = [...new Set([...extraPaths, ...shellPath])].join(':')
const envWithPath = { ...process.env, PATH: fullPath }

export interface ProcessOptions {
  inputPath: string
  startTime: number | null
  endTime: number | null
  volume: number | null // linear multiplier (1.0 = no change)
  fadeIn: number | null
  fadeOut: number | null
  playbackSpeed: number | null
  preservePitch: boolean
}

export interface NormalizeOptions {
  inputPath: string
  currentLoudnessDb: number
  targetLoudnessDb: number
}

async function findFfmpeg(): Promise<string> {
  const commonPaths = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg']
  for (const p of commonPaths) {
    if (existsSync(p)) return p
  }
  return new Promise((resolve, reject) => {
    execFile('/bin/sh', ['-c', 'which ffmpeg'], { env: envWithPath }, (error, stdout) => {
      if (error) reject(new Error('ffmpeg not found. Install with: brew install ffmpeg'))
      else resolve(stdout.trim())
    })
  })
}

/** Measure RMS loudness of an audio file using ffmpeg */
export async function measureLoudness(inputPath: string): Promise<number> {
  const ffmpegPath = await findFfmpeg()
  return new Promise((resolve, reject) => {
    // Use volumedetect filter to get RMS volume
    const proc = spawn(ffmpegPath, [
      '-i', inputPath,
      '-af', 'volumedetect',
      '-f', 'null',
      '-'
    ], { env: envWithPath })

    let stderr = ''
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })
    proc.on('close', (code) => {
      // Parse mean_volume from ffmpeg output
      const match = stderr.match(/mean_volume:\s*([-\d.]+)\s*dB/)
      if (match) {
        resolve(parseFloat(match[1]))
      } else {
        // Fallback: couldn't parse, return a quiet default
        resolve(-30)
      }
    })
    proc.on('error', reject)
  })
}

/**
 * Process an audio file with ffmpeg, baking in all adjustments.
 * Returns path to the processed file (m4a format for broad compatibility).
 */
export async function processAudio(opts: ProcessOptions): Promise<string> {
  const ffmpegPath = await findFfmpeg()
  const outputPath = join(tmpdir(), `processed-${Date.now()}.m4a`)

  const args: string[] = ['-y']

  // Input with optional start time
  if (opts.startTime && opts.startTime > 0) {
    args.push('-ss', String(opts.startTime))
  }
  args.push('-i', opts.inputPath)

  // End time (relative to input, so if we used -ss, adjust)
  if (opts.endTime) {
    const duration = opts.endTime - (opts.startTime || 0)
    if (duration > 0) {
      args.push('-t', String(duration))
    }
  }

  // Build audio filter chain
  const filters: string[] = []

  // Volume adjustment
  const vol = opts.volume ?? 1
  if (Math.abs(vol - 1) > 0.001) {
    filters.push(`volume=${vol}`)
  }

  // Speed adjustment
  const speed = opts.playbackSpeed ?? 1
  if (Math.abs(speed - 1) > 0.001) {
    if (opts.preservePitch) {
      // Use rubberband for pitch-preserving speed change (requires librubberband)
      // Fall back to atempo if rubberband is unavailable
      filters.push(`rubberband=tempo=${speed}`)
    } else {
      // atempo only supports 0.5-100, chain for extreme values
      let remaining = speed
      while (remaining > 2) {
        filters.push('atempo=2.0')
        remaining /= 2
      }
      while (remaining < 0.5) {
        filters.push('atempo=0.5')
        remaining /= 0.5
      }
      filters.push(`atempo=${remaining}`)
    }
  }

  // Compute effective duration after trim for fade calculations
  const effectiveDuration = opts.endTime
    ? (opts.endTime - (opts.startTime || 0)) / (speed || 1)
    : null

  // Fade in
  const fadeIn = opts.fadeIn ?? 0
  if (fadeIn > 0) {
    filters.push(`afade=t=in:st=0:d=${fadeIn}`)
  }

  // Fade out
  const fadeOut = opts.fadeOut ?? 0
  if (fadeOut > 0 && effectiveDuration && effectiveDuration > fadeOut) {
    const fadeStart = effectiveDuration - fadeOut
    filters.push(`afade=t=out:st=${fadeStart}:d=${fadeOut}`)
  }

  if (filters.length > 0) {
    args.push('-af', filters.join(','))
  }

  // Output as AAC in m4a container (broad compatibility: iOS, Android, web)
  args.push('-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart')
  args.push(outputPath)

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { env: envWithPath })
    let stderr = ''
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })
    proc.on('close', (code) => {
      if (code === 0 && existsSync(outputPath)) {
        resolve(outputPath)
      } else {
        // If rubberband failed, retry without pitch preservation
        if (stderr.includes('rubberband') && opts.preservePitch) {
          processAudio({ ...opts, preservePitch: false })
            .then(resolve)
            .catch(reject)
        } else {
          reject(new Error(`ffmpeg failed (code ${code}): ${stderr.slice(-500)}`))
        }
      }
    })
    proc.on('error', reject)
  })
}

/**
 * Normalize an audio file to a target loudness level.
 * Returns path to the normalized file.
 */
export async function normalizeAudio(opts: NormalizeOptions): Promise<string> {
  const gainDb = opts.targetLoudnessDb - opts.currentLoudnessDb
  if (Math.abs(gainDb) < 0.5) {
    // Already close enough, no processing needed
    return opts.inputPath
  }

  const ffmpegPath = await findFfmpeg()
  const outputPath = join(tmpdir(), `normalized-${Date.now()}.m4a`)

  const args = [
    '-y',
    '-i', opts.inputPath,
    '-af', `volume=${gainDb}dB`,
    '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart',
    outputPath
  ]

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { env: envWithPath })
    let stderr = ''
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })
    proc.on('close', (code) => {
      if (code === 0 && existsSync(outputPath)) {
        resolve(outputPath)
      } else {
        reject(new Error(`ffmpeg normalize failed (code ${code}): ${stderr.slice(-500)}`))
      }
    })
    proc.on('error', reject)
  })
}

export async function cleanupTempFile(filePath: string): Promise<void> {
  if (filePath.startsWith(tmpdir())) {
    await unlink(filePath).catch(() => {})
  }
}
