import { useState } from 'react'
import { Track } from '@/types'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import TrackEditor from './TrackEditor'
import ArtworkImage from './ArtworkImage'

interface TrackRowProps {
  track: Track
  index: number
  onPlay: () => void
  onRemove?: () => void
  isArchived?: boolean
  selected?: boolean
  onSelect?: () => void
  onEdit?: () => void
}

function formatDuration(seconds: number | null, start?: number | null, end?: number | null): string {
  if (!seconds && !end) return '--:--'
  const effective = (end || seconds || 0) - (start || 0)
  const mins = Math.floor(effective / 60)
  const secs = Math.floor(effective % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function TrackRow({ track, index, onPlay, onRemove, isArchived, selected, onSelect, onEdit }: TrackRowProps) {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const addToQueue = usePlayerStore((s) => s.addToQueue)
  const playNext = usePlayerStore((s) => s.playNext)
  const playlists = useLibraryStore((s) => s.playlists)
  const addTrackToPlaylist = useLibraryStore((s) => s.addTrackToPlaylist)
  const deleteTrack = useLibraryStore((s) => s.deleteTrack)
  const archiveTrack = useLibraryStore((s) => s.archiveTrack)
  const unarchiveTrack = useLibraryStore((s) => s.unarchiveTrack)
  const [showMenu, setShowMenu] = useState(false)
  // Fallback editor state for when no parent onEdit is provided (e.g. PlaylistView)
  const [showFallbackEditor, setShowFallbackEditor] = useState(false)

  const openEditor = () => {
    if (onEdit) onEdit()
    else setShowFallbackEditor(true)
  }

  const isCurrent = currentTrack?.id === track.id
  return (
    <>
      <div
        className={`group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer ${
          selected ? 'bg-surface-2 ring-1 ring-accent/30' : isCurrent ? 'bg-surface-2' : ''
        }`}
        onClick={onSelect}
        onDoubleClick={onPlay}
        onContextMenu={(e) => {
          e.preventDefault()
          setShowMenu(!showMenu)
        }}
      >
        <div className="w-8 text-center text-sm text-white/30 group-hover:hidden">
          {isCurrent && isPlaying ? '♪' : index + 1}
        </div>
        <button
          onClick={onPlay}
          className="w-8 text-center text-sm text-white hidden group-hover:block"
        >
          ▶
        </button>

        {track.artwork_url ? (
          <ArtworkImage src={track.artwork_url} className="w-10 h-10 rounded" />
        ) : (
          <div className="w-10 h-10 rounded bg-surface-3 flex items-center justify-center">
            <span className="text-white/20">♪</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm truncate ${isCurrent ? 'text-accent' : 'text-white'}`}>
              {track.title}
            </p>
          </div>
          <p className="text-xs text-white/40 truncate">{track.artist || 'Unknown'}</p>
        </div>

        <span className="text-xs text-white/30">
          {formatDuration(track.duration, track.start_time, track.end_time)}
        </span>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="text-white/0 group-hover:text-white/40 hover:!text-white px-1 transition-colors"
          >
            ···
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-8 z-20 bg-surface-3 rounded-lg shadow-xl border border-white/10 py-1 min-w-[160px]">
                <MenuItem onClick={() => { playNext(track); setShowMenu(false) }}>
                  Play next
                </MenuItem>
                <MenuItem onClick={() => { addToQueue(track); setShowMenu(false) }}>
                  Add to queue
                </MenuItem>
                <div className="border-t border-white/5 my-1" />
                <MenuItem onClick={() => { openEditor(); setShowMenu(false) }}>
                  Edit track
                </MenuItem>
                {playlists.length > 0 && (
                  <>
                    <div className="border-t border-white/5 my-1" />
                    {playlists.map((p) => (
                      <MenuItem
                        key={p.id}
                        onClick={() => {
                          addTrackToPlaylist(p.id, track.id)
                          setShowMenu(false)
                        }}
                      >
                        Add to {p.name}
                      </MenuItem>
                    ))}
                  </>
                )}
                <div className="border-t border-white/5 my-1" />
                {isArchived ? (
                  <MenuItem onClick={() => { unarchiveTrack(track.id); setShowMenu(false) }}>
                    Unarchive
                  </MenuItem>
                ) : (
                  <MenuItem onClick={() => { archiveTrack(track.id); setShowMenu(false) }}>
                    Archive
                  </MenuItem>
                )}
                {onRemove && (
                  <MenuItem onClick={() => { onRemove(); setShowMenu(false) }} danger>
                    Remove from playlist
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => { deleteTrack(track.id); setShowMenu(false) }}
                  danger
                >
                  Delete track
                </MenuItem>
              </div>
            </>
          )}
        </div>
      </div>

      {showFallbackEditor && (
        <TrackEditor track={track} onClose={() => setShowFallbackEditor(false)} />
      )}
    </>
  )
}

function MenuItem({
  children,
  onClick,
  danger
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-sm px-3 py-1.5 hover:bg-surface-4 transition-colors ${
        danger ? 'text-red-400' : 'text-white/80'
      }`}
    >
      {children}
    </button>
  )
}
