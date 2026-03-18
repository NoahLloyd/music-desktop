import { useState, useRef, useEffect } from 'react'
import { Track } from '@/types'
import { useLibraryStore } from '@/stores/libraryStore'
import { getAudioUrl } from '@/lib/supabase'
import { analyzeAudio, AudioAnalysis } from '@/lib/audioAnalysis'

interface TrackEditorProps {
  track: Track
  onClose: () => void
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}

function linearToDb(linear: number): number {
  return 20 * Math.log10(Math.max(linear, 0.001))
}

export default function TrackEditor({ track, onClose }: TrackEditorProps) {
  const updateTrack = useLibraryStore((s) => s.updateTrack)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Metadata fields
  const [title, setTitle] = useState(track.title)
  const [artist, setArtist] = useState(track.artist || '')
  const [artworkUrl, setArtworkUrl] = useState(track.artwork_url || '')

  // Volume
  const [volumeDb, setVolumeDb] = useState(linearToDb(track.volume ?? 1))

  // BPM / Speed
  const [detectedBpm, setDetectedBpm] = useState<number | null>(track.bpm ?? null)
  const [bpmOverride, setBpmOverride] = useState<string>(track.bpm ? String(track.bpm) : '')
  const [playbackSpeed, setPlaybackSpeed] = useState(track.playback_speed ?? 1)
  const [preservePitch, setPreservePitch] = useState(track.preserve_pitch ?? true)
  const [targetBpm, setTargetBpm] = useState<string>('')

  // Fade
  const [fadeIn, setFadeIn] = useState(track.fade_in ?? 0)
  const [fadeOut, setFadeOut] = useState(track.fade_out ?? 0)

  // Key
  const [detectedKey, setDetectedKey] = useState<string | null>(track.key ?? null)

  // Trim fields
  const [duration, setDuration] = useState(track.duration || 0)
  const [startTime, setStartTime] = useState(track.start_time || 0)
  const [endTime, setEndTime] = useState(track.end_time || track.duration || 0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Analysis state
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const audioSrcRef = useRef<string>('')

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
      if (!audio.src.startsWith('http')) {
        const url = await getAudioUrl(track.storage_path)
        audioSrcRef.current = url
        audio.src = url
        audio.load()
      }
    }

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('error', onError)

    const loadAudio = async () => {
      const cachePath = await window.api.getCachePath(track.id)
      const fileSrc = `file://${cachePath}`
      audioSrcRef.current = fileSrc
      audio.src = fileSrc
      audio.load()

      setTimeout(async () => {
        if (!audio.duration || isNaN(audio.duration)) {
          const url = await getAudioUrl(track.storage_path)
          audioSrcRef.current = url
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

  // Apply speed/pitch to preview audio
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = playbackSpeed
    ;(audio as any).preservesPitch = preservePitch
  }, [playbackSpeed, preservePitch])

  const handleAnalyze = async () => {
    if (!audioSrcRef.current) return
    setAnalyzing(true)
    try {
      const result = await analyzeAudio(audioSrcRef.current)
      setAnalysis(result)
      if (result.bpm && !bpmOverride) {
        setDetectedBpm(result.bpm)
        setBpmOverride(String(result.bpm))
      }
      if (result.key) {
        setDetectedKey(result.key)
      }
    } finally {
      setAnalyzing(false)
    }
  }

  // When target BPM changes, compute required speed
  const handleTargetBpmChange = (value: string) => {
    setTargetBpm(value)
    const target = parseFloat(value)
    const base = parseFloat(bpmOverride) || detectedBpm
    if (target > 0 && base && base > 0) {
      const speed = Math.round((target / base) * 1000) / 1000
      setPlaybackSpeed(Math.max(0.1, Math.min(speed, 10)))
    }
  }

  // When speed changes, update target BPM display
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed)
    const base = parseFloat(bpmOverride) || detectedBpm
    if (base && base > 0) {
      setTargetBpm(String(Math.round(base * speed * 10) / 10))
    }
  }

  const handlePreview = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.currentTime = startTime
      audio.volume = dbToLinear(volumeDb)
      audio.play()
      setIsPlaying(true)
    }
  }

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const bpmVal = parseFloat(bpmOverride) || detectedBpm
      await updateTrack(track.id, {
        title: title.trim() || track.title,
        artist: artist.trim() || null,
        artwork_url: artworkUrl.trim() || null,
        start_time: startTime > 0 ? startTime : null,
        end_time: endTime < duration ? endTime : null,
        volume: Math.round(dbToLinear(volumeDb) * 1000) / 1000,
        bpm: bpmVal || null,
        playback_speed: playbackSpeed !== 1 ? playbackSpeed : null,
        preserve_pitch: preservePitch,
        fade_in: fadeIn > 0 ? fadeIn : null,
        fade_out: fadeOut > 0 ? fadeOut : null,
        key: detectedKey || null
      })
      onClose()
    } catch (err: any) {
      console.error('Save failed:', err)
      setSaveError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // Cmd+Enter to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const startPct = duration > 0 ? (startTime / duration) * 100 : 0
  const endPct = duration > 0 ? (endTime / duration) * 100 : 100
  const currentPct = duration > 0 ? (currentTime / duration) * 100 : 0

  const sectionHeader = (text: string) => (
    <h3 className="text-[11px] text-white/40 uppercase tracking-wider font-medium mb-3">{text}</h3>
  )

  const sectionDivider = <div className="border-t border-white/5 pt-5 mt-5" />

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-2 rounded-2xl p-6 w-[560px] max-w-[90vw] max-h-[90vh] overflow-y-auto shadow-2xl border border-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold mb-5">Edit Track</h2>

        {/* Metadata section */}
        <div className="space-y-3 mb-5">
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

        {/* Volume section */}
        {sectionDivider}
        {sectionHeader('Volume')}
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-white/35">Track Volume</label>
                <span className="text-[12px] text-white/50 tabular-nums">
                  {volumeDb > 0 ? '+' : ''}{volumeDb.toFixed(1)} dB
                </span>
              </div>
              <input
                type="range"
                min={-24}
                max={12}
                step={0.5}
                value={volumeDb}
                onChange={(e) => setVolumeDb(parseFloat(e.target.value))}
                className="range-control w-full"
              />
              <div className="flex justify-between text-[10px] text-white/20 mt-0.5">
                <span>-24 dB</span>
                <span>0 dB</span>
                <span>+12 dB</span>
              </div>
            </div>
          </div>
          {analysis && (
            <div className="flex items-center gap-3 bg-surface-3 rounded-lg px-3 py-2">
              <span className="text-[11px] text-white/35">Loudness:</span>
              <span className="text-[12px] text-white/60 tabular-nums">
                {analysis.loudnessDb.toFixed(1)} dB RMS
              </span>
              <div className="flex-1 h-1.5 bg-surface-1 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(0, Math.min(100, ((analysis.loudnessDb + 60) / 60) * 100))}%`,
                    backgroundColor: analysis.loudnessDb > -6 ? '#ef4444' : analysis.loudnessDb > -12 ? '#f59e0b' : '#1db954'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* BPM / Speed section */}
        {sectionDivider}
        {sectionHeader('Speed & BPM')}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !loaded}
              className="bg-surface-3 hover:bg-surface-4 text-white text-[12px] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30 flex-shrink-0"
            >
              {analyzing ? 'Analyzing...' : 'Detect BPM & Key'}
            </button>
            {detectedKey && (
              <span className="text-[12px] text-white/50 bg-surface-3 px-2 py-1 rounded">
                Key: {detectedKey}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-white/35 block mb-1">BPM</label>
              <input
                type="text"
                value={bpmOverride}
                onChange={(e) => {
                  setBpmOverride(e.target.value)
                  const val = parseFloat(e.target.value)
                  if (val > 0) setDetectedBpm(val)
                }}
                placeholder={detectedBpm ? `Detected: ${detectedBpm}` : 'Unknown'}
                className="w-full bg-surface-3 text-white text-[13px] rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent/50 placeholder:text-white/20 tabular-nums"
              />
            </div>
            <div>
              <label className="text-[11px] text-white/35 block mb-1">Target BPM</label>
              <input
                type="text"
                value={targetBpm}
                onChange={(e) => handleTargetBpmChange(e.target.value)}
                placeholder="Enter target..."
                className="w-full bg-surface-3 text-white text-[13px] rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent/50 placeholder:text-white/20 tabular-nums"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-white/35">Playback Speed</label>
              <span className="text-[12px] text-white/50 tabular-nums">{playbackSpeed.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.25}
              max={4}
              step={0.01}
              value={playbackSpeed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className="range-control w-full"
            />
            <div className="flex justify-between text-[10px] text-white/20 mt-0.5">
              <span>0.25x</span>
              <span>1x</span>
              <span>4x</span>
            </div>
          </div>

          {/* Speed presets + custom input */}
          <div className="flex items-center gap-2">
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                className={`text-[11px] px-2 py-1 rounded transition-colors ${
                  Math.abs(playbackSpeed - s) < 0.01
                    ? 'bg-accent text-black font-medium'
                    : 'bg-surface-3 text-white/50 hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
            <input
              type="number"
              value={playbackSpeed}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (v > 0 && v <= 10) handleSpeedChange(v)
              }}
              step={0.01}
              min={0.1}
              max={10}
              className="w-16 bg-surface-3 text-white text-[12px] rounded px-2 py-1 outline-none focus:ring-1 focus:ring-accent/50 tabular-nums"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={preservePitch}
              onChange={(e) => setPreservePitch(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-surface-3 border-0 accent-accent"
            />
            <span className="text-[12px] text-white/50">Preserve pitch (keep key the same)</span>
          </label>
        </div>

        {/* Fade section */}
        {sectionDivider}
        {sectionHeader('Fade')}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-white/35">Fade In</label>
              <span className="text-[12px] text-white/50 tabular-nums">{fadeIn.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={30}
              step={0.5}
              value={fadeIn}
              onChange={(e) => setFadeIn(parseFloat(e.target.value))}
              className="range-control w-full"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-white/35">Fade Out</label>
              <span className="text-[12px] text-white/50 tabular-nums">{fadeOut.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={30}
              step={0.5}
              value={fadeOut}
              onChange={(e) => setFadeOut(parseFloat(e.target.value))}
              className="range-control w-full"
            />
          </div>
        </div>

        {/* Trim section */}
        {sectionDivider}
        {sectionHeader('Trim')}

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
          {/* Fade in indicator */}
          {fadeIn > 0 && duration > 0 && (
            <div
              className="absolute top-0 h-full opacity-30"
              style={{
                left: `${startPct}%`,
                width: `${(fadeIn / duration) * 100}%`,
                background: 'linear-gradient(to right, transparent, rgba(29, 185, 84, 0.4))'
              }}
            />
          )}
          {/* Fade out indicator */}
          {fadeOut > 0 && duration > 0 && (
            <div
              className="absolute top-0 h-full opacity-30"
              style={{
                right: `${100 - endPct}%`,
                width: `${(fadeOut / duration) * 100}%`,
                background: 'linear-gradient(to left, transparent, rgba(29, 185, 84, 0.4))'
              }}
            />
          )}
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
          {isPlaying ? '⏸ Stop Preview' : '▶ Preview'}
        </button>

        {/* Footer */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-white/5">
          {saveError && (
            <span className="text-red-400 text-[12px] truncate flex-1">{saveError}</span>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="text-white/35 hover:text-white text-[13px] px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-accent hover:bg-accent-hover text-black font-semibold text-[13px] px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
