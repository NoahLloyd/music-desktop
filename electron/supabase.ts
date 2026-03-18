import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { readFile, stat } from 'fs/promises'
import { extname } from 'path'

let client: SupabaseClient | null = null

const MIME_MAP: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.webm': 'audio/webm',
  '.aac': 'audio/aac',
  '.wma': 'audio/x-ms-wma'
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.VITE_SUPABASE_URL || ''
    const key = process.env.VITE_SUPABASE_ANON_KEY || ''
    if (!url || !key) {
      throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
    }
    client = createClient(url, key)
  }
  return client
}

export async function uploadAudioFile(fileName: string, filePath: string): Promise<string> {
  const supabase = getSupabase()

  // Verify file exists and get size
  const fileStat = await stat(filePath)
  console.log(`[upload] Reading ${filePath} (${(fileStat.size / 1024 / 1024).toFixed(1)}MB)`)

  const buffer = await readFile(filePath)
  const ext = extname(filePath).toLowerCase()
  const contentType = MIME_MAP[ext] || 'audio/mpeg'
  const storagePath = `tracks/${fileName}`

  console.log(`[upload] Uploading to Supabase: ${storagePath} (${contentType})`)

  const { error } = await supabase.storage
    .from('audio-files')
    .upload(storagePath, buffer, {
      contentType,
      upsert: true
    })

  if (error) {
    console.error('[upload] Supabase upload error:', error)
    throw new Error(`Supabase upload failed: ${error.message}`)
  }

  console.log(`[upload] Upload complete: ${storagePath}`)
  return storagePath
}

export async function insertTrack(track: {
  title: string
  artist: string | null
  duration: number | null
  youtube_url: string | null
  storage_path: string
  artwork_url: string | null
  start_time: number | null
  end_time: number | null
}): Promise<any> {
  const supabase = getSupabase()
  console.log(`[db] Inserting track: ${track.title}`)
  const { data, error } = await supabase
    .from('tracks')
    .insert(track)
    .select()
    .single()
  if (error) {
    console.error('[db] Insert error:', error)
    throw new Error(`DB insert failed: ${error.message}`)
  }
  console.log(`[db] Inserted: ${data.id}`)
  return data
}
