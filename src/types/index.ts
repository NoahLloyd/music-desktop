export interface Track {
  id: string
  title: string
  artist: string | null
  duration: number | null
  youtube_url: string | null
  storage_path: string
  artwork_url: string | null
  start_time: number | null
  end_time: number | null
  volume: number | null
  bpm: number | null
  playback_speed: number | null
  preserve_pitch: boolean | null
  fade_in: number | null
  fade_out: number | null
  key: string | null
  archived_at: string | null
  created_at: string
}

export interface Playlist {
  id: string
  name: string
  cover_url: string | null
  created_at: string
  updated_at: string
}

export interface PlaylistTrack {
  id: string
  playlist_id: string
  track_id: string
  position: number
  added_at: string
  track?: Track
}
