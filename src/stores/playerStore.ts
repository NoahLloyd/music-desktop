import { create } from 'zustand'
import { Track } from '@/types'
import { getAudioUrl } from '@/lib/supabase'

interface PlayerState {
  currentTrack: Track | null
  isPlaying: boolean
  progress: number
  duration: number
  volume: number

  // Smart queue: manual queue > playlist source > auto-pick
  manualQueue: Track[]
  playlistSource: Track[]
  playlistSourceIndex: number
  playHistory: string[] // last 50 played track IDs
  allTracks: Track[] // reference to all library tracks for auto-pick

  play: (track?: Track) => void
  pause: () => void
  resume: () => void
  next: () => void
  previous: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  addToQueue: (track: Track) => void
  playNext: (track: Track) => void
  removeFromQueue: (index: number) => void
  playPlaylist: (tracks: Track[], startIndex?: number) => void
  setAllTracks: (tracks: Track[]) => void
  setProgress: (progress: number) => void
  setDuration: (duration: number) => void

  // Legacy compat — maps to playPlaylist
  setQueue: (tracks: Track[], startIndex?: number) => void
}

function addToHistory(history: string[], trackId: string): string[] {
  const filtered = history.filter((id) => id !== trackId)
  return [trackId, ...filtered].slice(0, 50)
}

function pickAutoTrack(allTracks: Track[], history: string[], currentId?: string): Track | null {
  if (allTracks.length === 0) return null

  const candidates = allTracks.filter((t) => t.id !== currentId)
  if (candidates.length === 0) return allTracks[0]

  // Score by recency in history — lower index = more recent = higher penalty
  const scored = candidates.map((track) => {
    const histIndex = history.indexOf(track.id)
    const score = histIndex === -1 ? 100 : Math.min(histIndex, 50)
    return { track, score: score + Math.random() * 10 }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0].track
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
    manualQueue: [],
    playlistSource: [],
    playlistSourceIndex: 0,
    playHistory: [],
    allTracks: [],

    play: (track) => {
      if (track) {
        const history = addToHistory(get().playHistory, track.id)
        set({ playHistory: history })
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
      const { manualQueue, playlistSource, playlistSourceIndex, allTracks, playHistory, currentTrack } = get()

      // Priority 1: manual queue (user explicitly added)
      if (manualQueue.length > 0) {
        const [nextTrack, ...rest] = manualQueue
        const history = addToHistory(playHistory, nextTrack.id)
        set({ manualQueue: rest, playHistory: history })
        loadAndPlay(nextTrack)
        return
      }

      // Priority 2: playlist source (background playlist)
      if (playlistSource.length > 0 && playlistSourceIndex < playlistSource.length) {
        const nextTrack = playlistSource[playlistSourceIndex]
        const history = addToHistory(playHistory, nextTrack.id)
        set({ playlistSourceIndex: playlistSourceIndex + 1, playHistory: history })
        loadAndPlay(nextTrack)
        return
      }

      // Priority 3: auto-pick from library (weighted random, avoids recently played)
      const autoTrack = pickAutoTrack(allTracks, playHistory, currentTrack?.id)
      if (autoTrack) {
        const history = addToHistory(playHistory, autoTrack.id)
        set({
          playHistory: history,
          playlistSource: [],
          playlistSourceIndex: 0,
        })
        loadAndPlay(autoTrack)
      } else {
        audioElement?.pause()
        set({ isPlaying: false })
      }
    },

    previous: () => {
      const { progress, currentTrack, playHistory, allTracks } = get()
      const audio = getOrCreateAudio()
      const startTime = currentTrack?.start_time || 0

      // If more than 3 seconds in, restart current track
      if (progress > 3) {
        audio.currentTime = startTime
        return
      }

      // Go to actual previous track from play history
      if (playHistory.length > 1) {
        const prevId = playHistory[1]
        const prevTrack = allTracks.find((t) => t.id === prevId)
        if (prevTrack) {
          set({ isPlaying: true })
          loadAndPlay(prevTrack)
          return
        }
      }

      // Fallback: restart current
      audio.currentTime = startTime
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

    addToQueue: (track) => {
      set((state) => ({ manualQueue: [...state.manualQueue, track] }))
    },

    playNext: (track) => {
      set((state) => ({ manualQueue: [track, ...state.manualQueue] }))
    },

    removeFromQueue: (index) => {
      set((state) => {
        const newQueue = [...state.manualQueue]
        newQueue.splice(index, 1)
        return { manualQueue: newQueue }
      })
    },

    playPlaylist: (tracks, startIndex = 0) => {
      if (tracks.length === 0) return
      const track = tracks[startIndex]
      const history = addToHistory(get().playHistory, track.id)
      set({
        playlistSource: tracks,
        playlistSourceIndex: startIndex + 1,
        playHistory: history,
      })
      loadAndPlay(track)
    },

    // Legacy compat — setQueue now maps to playPlaylist
    setQueue: (tracks, startIndex = 0) => {
      get().playPlaylist(tracks, startIndex)
    },

    setAllTracks: (tracks) => set({ allTracks: tracks }),
    setProgress: (progress) => set({ progress }),
    setDuration: (duration) => set({ duration }),
  }
})
