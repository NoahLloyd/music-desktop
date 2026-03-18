import { useEffect, useState } from 'react'
import { Track } from '@/types'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import TrackRow from '@/components/ui/TrackRow'

interface PlaylistViewProps {
  playlistId: string
}

export default function PlaylistView({ playlistId }: PlaylistViewProps) {
  const [tracks, setTracks] = useState<Track[]>([])
  const playlists = useLibraryStore((s) => s.playlists)
  const getPlaylistTracks = useLibraryStore((s) => s.getPlaylistTracks)
  const removeTrackFromPlaylist = useLibraryStore((s) => s.removeTrackFromPlaylist)
  const renamePlaylist = useLibraryStore((s) => s.renamePlaylist)
  const setQueue = usePlayerStore((s) => s.setQueue)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')

  const playlist = playlists.find((p) => p.id === playlistId)

  useEffect(() => {
    loadTracks()
  }, [playlistId])

  const loadTracks = async () => {
    const t = await getPlaylistTracks(playlistId)
    setTracks(t)
  }

  const handlePlay = (index: number) => {
    setQueue(tracks, index)
  }

  const handleRemove = async (trackId: string) => {
    await removeTrackFromPlaylist(playlistId, trackId)
    loadTracks()
  }

  const handleRename = async () => {
    if (editName.trim()) {
      await renamePlaylist(playlistId, editName.trim())
    }
    setEditing(false)
  }

  if (!playlist) return null

  return (
    <div>
      <div className="mb-6">
        {editing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename()
              if (e.key === 'Escape') setEditing(false)
            }}
            onBlur={handleRename}
            autoFocus
            className="text-2xl font-bold bg-transparent outline-none border-b border-accent"
          />
        ) : (
          <h1
            className="text-2xl font-bold cursor-pointer hover:text-accent transition-colors"
            onDoubleClick={() => {
              setEditName(playlist.name)
              setEditing(true)
            }}
          >
            {playlist.name}
          </h1>
        )}
        <p className="text-sm text-white/30 mt-1">{tracks.length} tracks</p>
      </div>

      {tracks.length > 0 && (
        <button
          onClick={() => handlePlay(0)}
          className="mb-4 bg-accent hover:bg-accent-hover text-black font-medium text-sm px-6 py-2 rounded-full transition-colors"
        >
          ▶ Play all
        </button>
      )}

      {tracks.length === 0 ? (
        <p className="text-white/30 mt-8">
          No tracks yet. Right-click a track in your library to add it here.
        </p>
      ) : (
        <div className="space-y-0.5">
          {tracks.map((track, i) => (
            <TrackRow
              key={track.id}
              track={track}
              index={i}
              onPlay={() => handlePlay(i)}
              onRemove={() => handleRemove(track.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
