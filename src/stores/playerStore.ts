import { create } from 'zustand'
import { Track } from '@/types'
import { getAudioUrl } from '@/lib/supabase'

interface PlayerState {
  currentTrack: Track | null
  isPlaying: boolean
  progress: number
  duration: number
  volume: number
  queue: Track[]
  queueIndex: number

  play: (track?: Track) => void
  pause: () => void
  resume: () => void
  next: () => void
  previous: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  setQueue: (tracks: Track[], startIndex?: number) => void
  addToQueue: (track: Track) => void
  playNext: (track: Track) => void
  removeFromQueue: (index: number) => void
  setProgress: (progress: number) => void
  setDuration: (duration: number) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => {
  let audioElement: HTMLAudioElement | null = null

  function getOrCreateAudio(): HTMLAudioElement {
    if (!audioElement) {
      audioElement = new Audio()
      audioElement.addEventListener('timeupdate', () => {
        const track = get().currentTrack
        const currentTime = audioElement!.currentTime
        // Respect end_time trim point
        if (track?.end_time && currentTime >= track.end_time) {
          get().next()
          return
        }
        // Fade-out: ramp volume down approaching end
        const fadeOut = track?.fade_out ?? 0
        if (fadeOut > 0 && track) {
          const effectiveEnd = track.end_time ?? audioElement!.duration
          const fadeStart = effectiveEnd - fadeOut
          if (currentTime >= fadeStart && currentTime < effectiveEnd) {
            const globalVolume = get().volume
            const trackVolume = track.volume ?? 1
            const targetVolume = globalVolume * Math.min(trackVolume, 2)
            const fadeProgress = (effectiveEnd - currentTime) / fadeOut
            audioElement!.volume = targetVolume * Math.max(fadeProgress, 0)
          }
        }
        const startOffset = track?.start_time ?? 0
        set({ progress: currentTime - startOffset })
      })
      audioElement.addEventListener('loadedmetadata', () => {
        const track = get().currentTrack
        const startOffset = track?.start_time ?? 0
        const effectiveEnd = track?.end_time || audioElement!.duration
        set({ duration: effectiveEnd - startOffset })
        // Seek to start_time if set
        if (track?.start_time && audioElement!.currentTime < track.start_time) {
          audioElement!.currentTime = track.start_time
        }
      })
      audioElement.addEventListener('ended', () => {
        get().next()
      })

      // Set up Media Session handlers for OS media keys (F7/F8/F9)
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => get().resume())
        navigator.mediaSession.setActionHandler('pause', () => get().pause())
        navigator.mediaSession.setActionHandler('previoustrack', () => get().previous())
        navigator.mediaSession.setActionHandler('nexttrack', () => get().next())
      }
    }
    return audioElement
  }

  // Apply per-track audio settings (volume, speed, pitch preservation)
  function applyTrackSettings(track: Track) {
    if (!audioElement) return
    const globalVolume = get().volume
    const trackVolume = track.volume ?? 1
    audioElement.volume = globalVolume * Math.min(trackVolume, 2)
    audioElement.playbackRate = track.playback_speed ?? 1
    // preservesPitch is supported in Chromium/Electron
    ;(audioElement as any).preservesPitch = track.preserve_pitch ?? true
  }

  // Fade-in effect using volume ramping
  let fadeInterval: ReturnType<typeof setInterval> | null = null
  function startFadeIn(track: Track) {
    const fadeIn = track.fade_in ?? 0
    if (fadeIn <= 0 || !audioElement) return
    const globalVolume = get().volume
    const trackVolume = track.volume ?? 1
    const targetVolume = globalVolume * Math.min(trackVolume, 2)
    audioElement.volume = 0
    const steps = Math.max(fadeIn * 20, 1) // 20 steps per second
    const stepDuration = (fadeIn * 1000) / steps
    let step = 0
    if (fadeInterval) clearInterval(fadeInterval)
    fadeInterval = setInterval(() => {
      step++
      if (!audioElement || step >= steps) {
        if (audioElement) audioElement.volume = targetVolume
        if (fadeInterval) clearInterval(fadeInterval)
        fadeInterval = null
        return
      }
      audioElement.volume = targetVolume * (step / steps)
    }, stepDuration)
  }

  async function loadAndPlay(track: Track): Promise<void> {
    const audio = getOrCreateAudio()
    if (fadeInterval) { clearInterval(fadeInterval); fadeInterval = null }
    set({ currentTrack: track, isPlaying: false })

    try {
      const cachePath = await window.api.getCachePath(track.id)
      audio.src = `file://${cachePath}`
      await audio.play().catch(async () => {
        // Cache miss - load from Supabase
        const url = await getAudioUrl(track.storage_path)
        audio.src = url
        await audio.play()
      })
    } catch {
      const url = await getAudioUrl(track.storage_path)
      audio.src = url
      await audio.play()
    }

    // Seek to start_time if set
    if (track.start_time) {
      audio.currentTime = track.start_time
    }

    // Apply per-track settings
    applyTrackSettings(track)
    startFadeIn(track)

    set({ isPlaying: true })

    // Update Media Session metadata so OS knows what's playing
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || 'Unknown',
        ...(track.artwork_url ? { artwork: [{ src: track.artwork_url }] } : {})
      })
    }
  }

  return {
    currentTrack: null,
    isPlaying: false,
    progress: 0,
    duration: 0,
    volume: 1,
    queue: [],
    queueIndex: -1,

    play: (track) => {
      if (track) {
        const { queue } = get()
        const index = queue.findIndex((t) => t.id === track.id)
        if (index >= 0) {
          set({ queueIndex: index })
        }
        loadAndPlay(track)
      } else {
        get().resume()
      }
    },

    pause: () => {
      audioElement?.pause()
      set({ isPlaying: false })
    },

    resume: () => {
      audioElement?.play()
      set({ isPlaying: true })
    },

    next: () => {
      const { queue, queueIndex } = get()
      if (queueIndex < queue.length - 1) {
        const nextIndex = queueIndex + 1
        set({ queueIndex: nextIndex })
        loadAndPlay(queue[nextIndex])
      } else {
        audioElement?.pause()
        set({ isPlaying: false })
      }
    },

    previous: () => {
      const { queue, queueIndex, currentTrack } = get()
      const audio = getOrCreateAudio()
      const startTime = currentTrack?.start_time || 0
      // If more than 3 seconds past start, restart the track
      if (audio.currentTime - startTime > 3) {
        audio.currentTime = startTime
        return
      }
      if (queueIndex > 0) {
        const prevIndex = queueIndex - 1
        set({ queueIndex: prevIndex })
        loadAndPlay(queue[prevIndex])
      }
    },

    seek: (time) => {
      if (audioElement) {
        const startOffset = get().currentTrack?.start_time ?? 0
        audioElement.currentTime = time + startOffset
      }
    },

    setVolume: (volume) => {
      const track = get().currentTrack
      const trackVolume = track?.volume ?? 1
      if (audioElement) audioElement.volume = volume * Math.min(trackVolume, 2)
      set({ volume })
    },

    setQueue: (tracks, startIndex = 0) => {
      set({ queue: tracks, queueIndex: startIndex })
      if (tracks.length > 0) {
        loadAndPlay(tracks[startIndex])
      }
    },

    addToQueue: (track) => {
      set((state) => ({ queue: [...state.queue, track] }))
    },

    playNext: (track) => {
      set((state) => {
        const newQueue = [...state.queue]
        newQueue.splice(state.queueIndex + 1, 0, track)
        return { queue: newQueue }
      })
    },

    removeFromQueue: (index) => {
      set((state) => {
        const newQueue = [...state.queue]
        newQueue.splice(index, 1)
        const newIndex = index < state.queueIndex ? state.queueIndex - 1 : state.queueIndex
        return { queue: newQueue, queueIndex: newIndex }
      })
    },

    setProgress: (progress) => set({ progress }),
    setDuration: (duration) => set({ duration })
  }
})
