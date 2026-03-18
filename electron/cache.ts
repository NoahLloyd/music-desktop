import { app } from 'electron'
import { join } from 'path'
import { mkdir, writeFile, access } from 'fs/promises'
import { existsSync } from 'fs'

let cachePath: string

export function getCachePath(): string {
  if (!cachePath) {
    cachePath = join(app.getPath('userData'), 'cache')
  }
  return cachePath
}

export function getCachedFilePath(trackId: string): string {
  return join(getCachePath(), `${trackId}.mp3`)
}

export async function ensureCacheDir(): Promise<void> {
  const dir = getCachePath()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

export async function isCached(trackId: string): Promise<boolean> {
  try {
    await access(getCachedFilePath(trackId))
    return true
  } catch {
    return false
  }
}

export async function cacheFileFromBuffer(trackId: string, buffer: Buffer): Promise<void> {
  await ensureCacheDir()
  await writeFile(getCachedFilePath(trackId), buffer)
}
