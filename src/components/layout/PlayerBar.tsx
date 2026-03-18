import { usePlayerStore } from '@/stores/playerStore'

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

interface PlayerBarProps {
  onQueueClick: () => void
}

export default function PlayerBar({ onQueueClick }: PlayerBarProps) {
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    volume,
    pause,
    resume,
    next,
    previous,
    seek,
    setVolume
  } = usePlayerStore()

  return (
    <div className="h-[72px] bg-surface-1 border-t border-white/[0.04] px-4 flex-shrink-0 grid grid-cols-[1fr_2fr_1fr] items-center gap-4">
      {/* Track info - left */}
      <div className="flex items-center gap-3 min-w-0">
        {currentTrack ? (
          <>
            {currentTrack.artwork_url ? (
              <img
                src={currentTrack.artwork_url}
                alt=""
                className="w-10 h-10 rounded object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded bg-surface-3 flex items-center justify-center flex-shrink-0">
                <span className="text-white/15 text-lg">♪</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[13px] text-white truncate leading-tight">
                {currentTrack.title}
              </p>
              <p className="text-[11px] text-white/35 truncate leading-tight mt-0.5">
                {currentTrack.artist || 'Unknown'}
              </p>
            </div>
          </>
        ) : (
          <p className="text-[13px] text-white/20">Not playing</p>
        )}
      </div>

      {/* Controls + progress - center */}
      <div className="flex flex-col items-center gap-1 max-w-[600px] mx-auto w-full">
        <div className="flex items-center gap-5">
          <button
            onClick={previous}
            className="text-white/40 hover:text-white transition-colors text-xs disabled:opacity-20"
            disabled={!currentTrack}
          >
            ⏮
          </button>
          <button
            onClick={() => (isPlaying ? pause() : currentTrack ? resume() : null)}
            className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-20"
            disabled={!currentTrack}
          >
            <span className="text-black text-xs leading-none pl-[1px]">
              {isPlaying ? '⏸' : '▶'}
            </span>
          </button>
          <button
            onClick={next}
            className="text-white/40 hover:text-white transition-colors text-xs disabled:opacity-20"
            disabled={!currentTrack}
          >
            ⏭
          </button>
        </div>

        <div className="w-full flex items-center gap-2 text-[10px] text-white/30">
          <span className="w-8 text-right tabular-nums">{formatTime(progress)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={progress}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="range-player flex-1"
            style={{
              background: duration
                ? `linear-gradient(to right, #1db954 ${(progress / duration) * 100}%, #333 ${(progress / duration) * 100}%)`
                : '#333'
            }}
          />
          <span className="w-8 tabular-nums">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume + queue - right */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onQueueClick}
          className="text-white/30 hover:text-white text-xs transition-colors"
          title="Queue"
        >
          ☰
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-white/25 text-[10px]">♪</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="range-player w-24"
          />
        </div>
      </div>
    </div>
  )
}
