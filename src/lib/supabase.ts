import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Avoid crashing when env vars aren't set (packaged app without .env at build time)
export const supabase: SupabaseClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder')

export async function getAudioUrl(storagePath: string): Promise<string> {
  const { data } = supabase.storage.from('audio-files').getPublicUrl(storagePath)
  return data.publicUrl
}
