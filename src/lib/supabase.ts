import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getAudioUrl(storagePath: string): Promise<string> {
  const { data } = supabase.storage.from('audio-files').getPublicUrl(storagePath)
  return data.publicUrl
}
