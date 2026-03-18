import { usePlayerStore } from '@/stores/playerStore'
import TrackRow from '@/components/ui/TrackRow'

export default function QueueView() {
  const queue = usePlayerStore((s) => s.queue)
  const queueIndex = usePlayerStore((s) => s.queueIndex)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const play = usePlayerStore((s) => s.play)
  const setQueue = usePlayerStore((s) => s.setQueue)
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue)

  const upcoming = queue.slice(queueIndex + 1)

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

      <div>
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
          Up Next {upcoming.length > 0 && `(${upcoming.length})`}
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-white/30 text-sm mt-4">Queue is empty</p>
        ) : (
          <div className="space-y-0.5">
            {upcoming.map((track, i) => (
              <TrackRow
                key={`${track.id}-${i}`}
                track={track}
                index={i}
                onPlay={() => {
                  setQueue(queue, queueIndex + 1 + i)
                }}
                onRemove={() => removeFromQueue(queueIndex + 1 + i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
