import { app } from 'electron'
import { join } from 'path'
import { mkdir, writeFile, access, readdir } from 'fs/promises'
import { existsSync } from 'fs'

let cachePath: string

export function getCachePath(): string {
  if (!cachePath) {
    cachePath = join(app.getPath('userData'), 'cache')
  }
  return cachePath
}

export function getCachedFilePath(trackId: string, ext?: string): string {
  return join(getCachePath(), `${trackId}${ext || '.audio'}`)
}

export async function findCachedFile(trackId: string): Promise<string | null> {
  const dir = getCachePath()
  if (!existsSync(dir)) return null
  try {
    const files = await readdir(dir)
    const match = files.find((f) => f.startsWith(trackId + '.'))
    return match ? join(dir, match) : null
  } catch {
    return null
  }
}

export async function ensureCacheDir(): Promise<void> {
  const dir = getCachePath()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

export async function isCached(trackId: string): Promise<boolean> {
  return (await findCachedFile(trackId)) !== null
}

export async function cacheFileFromBuffer(trackId: string, buffer: Buffer): Promise<void> {
  await ensureCacheDir()
  await writeFile(getCachedFilePath(trackId), buffer)
}
