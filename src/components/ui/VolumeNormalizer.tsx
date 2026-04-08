import { useState } from 'react'
import { Track } from '@/types'
import { useLibraryStore } from '@/stores/libraryStore'

interface VolumeNormalizerProps {
  tracks: Track[]
  onClose: () => void
}

export default function VolumeNormalizer({ tracks, onClose }: VolumeNormalizerProps) {
  const [targetDb, setTargetDb] = useState(-14)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, currentTrack: '' })
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const updateTrack = useLibraryStore((s) => s.updateTrack)
  const fetchTracks = useLibraryStore((s) => s.fetchTracks)

  const handleNormalize = async () => {
    setRunning(true)
    setErrors([])
    setDone(false)
    const total = tracks.length
    const newErrors: string[] = []

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i]
      setProgress({ current: i + 1, total, currentTrack: track.title })

      try {
        // Step 1: Measure current loudness
        const measurement = await window.api.measureLoudness(track.id)
        if (!measurement.success) {
          newErrors.push(`${track.title}: ${measurement.error}`)
          continue
        }

        const currentDb = measurement.loudnessDb

        // Store the measured loudness
        await updateTrack(track.id, { loudness_db: currentDb })

        // Step 2: Normalize if difference is significant
        if (Math.abs(currentDb - targetDb) < 0.5) continue

        // Pass existing adjustments so they get baked in alongside normalization
        const result = await window.api.normalizeTrack(track.id, currentDb, targetDb, {
          startTime: track.start_time,
          endTime: track.end_time,
          volume: track.volume,
          fadeIn: track.fade_in,
          fadeOut: track.fade_out,
          playbackSpeed: track.playback_speed,
          preservePitch: track.preserve_pitch ?? true
        })
        if (!result.success) {
          newErrors.push(`${track.title}: ${result.error}`)
          continue
        }

        if (!result.noChange && result.processedStoragePath) {
          await updateTrack(track.id, {
            processed_storage_path: result.processedStoragePath,
            loudness_db: targetDb
          })
        }
      } catch (err: any) {
        newErrors.push(`${track.title}: ${err.message}`)
      }
    }

    setErrors(newErrors)
    setDone(true)
    setRunning(false)
    await fetchTracks()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-2 rounded-2xl p-6 w-[480px] max-w-[90vw] shadow-2xl border border-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold mb-4">Normalize Volume</h2>
        <p className="text-[13px] text-white/50 mb-5">
          Analyze all tracks and create processed versions at a consistent volume level.
          This bakes the volume adjustment into a separate audio file so it works everywhere, including mobile.
        </p>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] text-white/40 uppercase tracking-wider font-medium">
              Target Loudness
            </label>
            <span className="text-[12px] text-white/50 tabular-nums">{targetDb} dB RMS</span>
          </div>
          <input
            type="range"
            min={-30}
            max={-6}
            step={1}
            value={targetDb}
            onChange={(e) => setTargetDb(parseInt(e.target.value))}
            className="range-control w-full"
            disabled={running}
          />
          <div className="flex justify-between text-[10px] text-white/20 mt-0.5">
            <span>-30 dB (quiet)</span>
            <span>-14 dB (standard)</span>
            <span>-6 dB (loud)</span>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {[-18, -16, -14, -12, -10].map((db) => (
            <button
              key={db}
              onClick={() => setTargetDb(db)}
              disabled={running}
              className={`text-[11px] px-2.5 py-1 rounded transition-colors ${
                targetDb === db
                  ? 'bg-accent text-black font-medium'
                  : 'bg-surface-3 text-white/50 hover:text-white'
              }`}
            >
              {db} dB
            </button>
          ))}
        </div>

        {running && (
          <div className="bg-surface-3 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-white/60">
                Processing {progress.current} / {progress.total}
              </span>
              <span className="text-[12px] text-white/40">
                {Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%
              </span>
            </div>
            <div className="h-1.5 bg-surface-1 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-white/35 truncate">{progress.currentTrack}</p>
          </div>
        )}

        {done && (
          <div className="bg-surface-3 rounded-lg p-3 mb-4">
            <p className="text-[12px] text-green-400">
              Normalized {tracks.length - errors.length} of {tracks.length} tracks
            </p>
            {errors.length > 0 && (
              <div className="mt-2 max-h-24 overflow-y-auto">
                {errors.map((err, i) => (
                  <p key={i} className="text-[11px] text-red-400/70">{err}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
          <span className="text-[11px] text-white/25 flex-1">
            {tracks.length} tracks will be processed
          </span>
          <button
            onClick={onClose}
            disabled={running}
            className="text-white/35 hover:text-white text-[13px] px-4 py-2 transition-colors disabled:opacity-30"
          >
            {done ? 'Close' : 'Cancel'}
          </button>
          {!done && (
            <button
              onClick={handleNormalize}
              disabled={running}
              className="bg-accent hover:bg-accent-hover text-black font-semibold text-[13px] px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {running ? 'Normalizing...' : 'Normalize All'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
