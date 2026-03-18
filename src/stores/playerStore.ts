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
        set({ progress: currentTime })
      })
      audioElement.addEventListener('loadedmetadata', () => {
        const track = get().currentTrack
        // Use end_time as effective duration if set
        const effectiveDuration = track?.end_time || audioElement!.duration
        set({ duration: effectiveDuration })
        // Seek to start_time if set
        if (track?.start_time && audioElement!.currentTime < track.start_time) {
          audioElement!.currentTime = track.start_time
        }
      })
      audioElement.addEventListener('ended', () => {
        get().next()
      })
    }
    return audioElement
  }

  async function loadAndPlay(track: Track): Promise<void> {
    const audio = getOrCreateAudio()
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
    set({ isPlaying: true })
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
      if (audioElement) audioElement.currentTime = time
    },

    setVolume: (volume) => {
      if (audioElement) audioElement.volume = volume
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
