import { usePlayerStore } from '@/stores/playerStore'
import TrackRow from '@/components/ui/TrackRow'

export default function QueueView() {
  const manualQueue = usePlayerStore((s) => s.manualQueue)
  const playlistSource = usePlayerStore((s) => s.playlistSource)
  const playlistSourceIndex = usePlayerStore((s) => s.playlistSourceIndex)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const play = usePlayerStore((s) => s.play)
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue)

  const upcomingPlaylist = playlistSource.slice(playlistSourceIndex)
  const hasAnyUpcoming = manualQueue.length > 0 || upcomingPlaylist.length > 0

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Queue</h1>

      {currentTrack && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
            Now Playing
          </h2>
          <TrackRow
            track={currentTrack}
            index={0}
            onPlay={() => {}}
          />
        </div>
      )}

      {manualQueue.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
            Next Up ({manualQueue.length})
          </h2>
          <div className="space-y-0.5">
            {manualQueue.map((track, i) => (
              <TrackRow
                key={`manual-${track.id}-${i}`}
                track={track}
                index={i}
                onPlay={() => play(track)}
                onRemove={() => removeFromQueue(i)}
              />
            ))}
          </div>
        </div>
      )}

      {upcomingPlaylist.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
            Playing From {manualQueue.length > 0 ? 'After Queue' : 'Playlist'} ({upcomingPlaylist.length})
          </h2>
          <div className="space-y-0.5">
            {upcomingPlaylist.map((track, i) => (
              <TrackRow
                key={`playlist-${track.id}-${i}`}
                track={track}
                index={i}
                onPlay={() => play(track)}
              />
            ))}
          </div>
        </div>
      )}

      {!hasAnyUpcoming && (
        <div>
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
            Up Next
          </h2>
          <p className="text-white/30 text-sm mt-4">
            {currentTrack
              ? 'Auto-pick will choose the next song from your library'
              : 'Queue is empty'}
          </p>
        </div>
      )}
    </div>
  )
}
