import { create } from 'zustand'
import { Track, Playlist, PlaylistTrack } from '@/types'
import { supabase } from '@/lib/supabase'

interface LibraryState {
  tracks: Track[]
  playlists: Playlist[]
  loading: boolean
  searchQuery: string
  lastError: string | null

  fetchTracks: () => Promise<void>
  fetchPlaylists: () => Promise<void>
  updateTrack: (id: string, updates: Partial<Track>) => Promise<void>
  deleteTrack: (id: string) => Promise<void>
  createPlaylist: (name: string) => Promise<Playlist>
  deletePlaylist: (id: string) => Promise<void>
  renamePlaylist: (id: string, name: string) => Promise<void>
  getPlaylistTracks: (playlistId: string) => Promise<Track[]>
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<void>
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>
  setSearchQuery: (query: string) => void
  downloadAndAddTrack: (url: string) => Promise<Track | null>
  importFiles: (filePaths: string[]) => Promise<Track[]>
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  tracks: [],
  playlists: [],
  loading: false,
  searchQuery: '',
  lastError: null,

  fetchTracks: async () => {
    const { data, error } = await supabase
      .from('tracks')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) set({ tracks: data })
  },

  fetchPlaylists: async () => {
    const { data, error } = await supabase
      .from('playlists')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) set({ playlists: data })
  },

  updateTrack: async (id, updates) => {
    const { error } = await supabase.from('tracks').update(updates).eq('id', id)
    if (error) throw error
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === id ? { ...t, ...updates } : t))
    }))
  },

  deleteTrack: async (id) => {
    await supabase.from('tracks').delete().eq('id', id)
    set((state) => ({ tracks: state.tracks.filter((t) => t.id !== id) }))
  },

  createPlaylist: async (name) => {
    const { data, error } = await supabase
      .from('playlists')
      .insert({ name })
      .select()
      .single()
    if (error) throw error
    set((state) => ({ playlists: [data, ...state.playlists] }))
    return data
  },

  deletePlaylist: async (id) => {
    await supabase.from('playlists').delete().eq('id', id)
    set((state) => ({ playlists: state.playlists.filter((p) => p.id !== id) }))
  },

  renamePlaylist: async (id, name) => {
    await supabase
      .from('playlists')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id)
    set((state) => ({
      playlists: state.playlists.map((p) => (p.id === id ? { ...p, name } : p))
    }))
  },

  getPlaylistTracks: async (playlistId) => {
    const { data, error } = await supabase
      .from('playlist_tracks')
      .select('*, track:tracks(*)')
      .eq('playlist_id', playlistId)
      .order('position')
    if (error) throw error
    return (data as (PlaylistTrack & { track: Track })[]).map((pt) => pt.track)
  },

  addTrackToPlaylist: async (playlistId, trackId) => {
    const { data: existing } = await supabase
      .from('playlist_tracks')
      .select('position')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: false })
      .limit(1)
    const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0
    await supabase.from('playlist_tracks').insert({
      playlist_id: playlistId,
      track_id: trackId,
      position: nextPosition
    })
  },

  removeTrackFromPlaylist: async (playlistId, trackId) => {
    await supabase
      .from('playlist_tracks')
      .delete()
      .eq('playlist_id', playlistId)
      .eq('track_id', trackId)
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  // Main process handles: yt-dlp download → Supabase upload → DB insert → local cache
  downloadAndAddTrack: async (url) => {
    set({ loading: true, lastError: null })
    try {
      const result = await window.api.downloadAudio(url)
      if (!result.success || !result.track) {
        throw new Error(result.error || 'Download failed')
      }
      // Add to local state
      set((state) => ({ tracks: [result.track, ...state.tracks] }))
      return result.track
    } catch (error: any) {
      const msg = error.message || String(error)
      console.error('Download failed:', msg)
      set({ lastError: msg })
      return null
    } finally {
      set({ loading: false })
    }
  },

  // Main process handles: read file → Supabase upload → DB insert → local cache
  importFiles: async (filePaths: string[]) => {
    set({ loading: true, lastError: null })
    try {
      const result = await window.api.importFiles(filePaths)
      if (result.imported.length > 0) {
        set((state) => ({ tracks: [...result.imported, ...state.tracks] }))
      }
      if (result.errors.length > 0) {
        set({ lastError: result.errors.join(', ') })
      }
      return result.imported
    } catch (error: any) {
      set({ lastError: error.message || String(error) })
      return []
    } finally {
      set({ loading: false })
    }
  }
}))
