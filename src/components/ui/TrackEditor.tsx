import { useState, useRef, useEffect } from 'react'
import { Track } from '@/types'
import { useLibraryStore } from '@/stores/libraryStore'
import { getAudioUrl } from '@/lib/supabase'

interface TrackEditorProps {
  track: Track
  onClose: () => void
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function TrackEditor({ track, onClose }: TrackEditorProps) {
  const updateTrack = useLibraryStore((s) => s.updateTrack)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Metadata fields
  const [title, setTitle] = useState(track.title)
  const [artist, setArtist] = useState(track.artist || '')
  const [artworkUrl, setArtworkUrl] = useState(track.artwork_url || '')

  // Trim fields
  const [duration, setDuration] = useState(track.duration || 0)
  const [startTime, setStartTime] = useState(track.start_time || 0)
  const [endTime, setEndTime] = useState(track.end_time || track.duration || 0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    const onLoaded = () => {
      const dur = audio.duration
      setDuration(dur)
      if (!track.end_time) setEndTime(dur)
      setLoaded(true)
    }

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const onError = async () => {
      // file:// failed, try Supabase URL
      if (!audio.src.startsWith('http')) {
        const url = await getAudioUrl(track.storage_path)
        audio.src = url
        audio.load()
      }
    }

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('error', onError)

    // Try loading: first from cache, with error handler falling back to remote
    const loadAudio = async () => {
      const cachePath = await window.api.getCachePath(track.id)
      audio.src = `file://${cachePath}`
      audio.load()

      // Fallback timeout: if loadedmetadata hasn't fired in 2s, try remote
      setTimeout(async () => {
        if (!audio.duration || isNaN(audio.duration)) {
          const url = await getAudioUrl(track.storage_path)
          audio.src = url
          audio.load()
        }
      }, 2000)
    }

    loadAudio()

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('error', onError)
      audio.pause()
      audio.src = ''
    }
  }, [track.id])

  // Stop playback at end trim point
  useEffect(() => {
    if (isPlaying && currentTime >= endTime) {
      audioRef.current?.pause()
      setIsPlaying(false)
    }
  }, [currentTime, endTime, isPlaying])

  const handlePreview = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.currentTime = startTime
      audio.play()
      setIsPlaying(true)
    }
  }

  const handleSave = async () => {
    await updateTrack(track.id, {
      title: title.trim() || track.title,
      artist: artist.trim() || null,
      artwork_url: artworkUrl.trim() || null,
      start_time: startTime > 0 ? startTime : null,
      end_time: endTime < duration ? endTime : null
    })
    onClose()
  }

  const startPct = duration > 0 ? (startTime / duration) * 100 : 0
  const endPct = duration > 0 ? (endTime / duration) * 100 : 100
  const currentPct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-2 rounded-2xl p-6 w-[520px] max-w-[90vw] max-h-[90vh] overflow-y-auto shadow-2xl border border-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold mb-5">Edit Track</h2>

        {/* Metadata section */}
        <div className="space-y-3 mb-6">
          <div>
            <label className="text-[11px] text-white/40 uppercase tracking-wider font-medium block mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-surface-3 text-white text-[13px] rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent/50"
            />
          </div>
          <div>
            <label className="text-[11px] text-white/40 uppercase tracking-wider font-medium block mb-1">
              Artist
            </label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Unknown"
              className="w-full bg-surface-3 text-white text-[13px] rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent/50 placeholder:text-white/20"
            />
          </div>
          <div>
            <label className="text-[11px] text-white/40 uppercase tracking-wider font-medium block mb-1">
              Artwork URL
            </label>
            <div className="flex gap-3 items-start">
              <input
                type="text"
                value={artworkUrl}
                onChange={(e) => setArtworkUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 bg-surface-3 text-white text-[13px] rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent/50 placeholder:text-white/20"
              />
              {artworkUrl && (
                <img
                  src={artworkUrl}
                  alt=""
                  className="w-10 h-10 rounded object-cover flex-shrink-0 bg-surface-3"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              )}
            </div>
          </div>
        </div>

        {/* Trim section */}
        <div className="border-t border-white/5 pt-5">
          <h3 className="text-[11px] text-white/40 uppercase tracking-wider font-medium mb-3">
            Trim
          </h3>

          {/* Timeline */}
          <div className="relative h-12 bg-surface-3 rounded-lg mb-5 overflow-hidden">
            <div
              className="absolute top-0 h-full bg-black/40"
              style={{ left: 0, width: `${startPct}%` }}
            />
            <div
              className="absolute top-0 h-full bg-black/40"
              style={{ left: `${endPct}%`, width: `${100 - endPct}%` }}
            />
            <div
              className="absolute top-0 h-full bg-accent/15"
              style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
            />
            {isPlaying && (
              <div
                className="absolute top-0 h-full w-0.5 bg-white/80 z-10"
                style={{ left: `${currentPct}%` }}
              />
            )}
            <div
              className="absolute top-0 h-full w-[3px] bg-accent rounded-full z-10"
              style={{ left: `${startPct}%` }}
            />
            <div
              className="absolute top-0 h-full w-[3px] bg-accent rounded-full z-10"
              style={{ left: `calc(${endPct}% - 3px)` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] text-white/25 tabular-nums">
                {loaded ? formatTime(endTime - startTime) : 'Loading audio...'}
              </span>
            </div>
          </div>

          {/* Start */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-white/35">Start</label>
              <span className="text-[12px] text-white/50 tabular-nums">{formatTime(startTime)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={startTime}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                setStartTime(Math.min(v, endTime - 1))
              }}
              className="range-control w-full"
              disabled={!loaded}
            />
          </div>

          {/* End */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-white/35">End</label>
              <span className="text-[12px] text-white/50 tabular-nums">{formatTime(endTime)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={endTime}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                setEndTime(Math.max(v, startTime + 1))
              }}
              className="range-control w-full"
              disabled={!loaded}
            />
          </div>

          <button
            onClick={handlePreview}
            disabled={!loaded}
            className="bg-surface-3 hover:bg-surface-4 text-white text-[13px] px-4 py-2 rounded-lg transition-colors disabled:opacity-30"
          >
            {isPlaying ? '⏸ Stop Preview' : '▶ Preview Trim'}
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-white/5">
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="text-white/35 hover:text-white text-[13px] px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="bg-accent hover:bg-accent-hover text-black font-semibold text-[13px] px-6 py-2 rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
