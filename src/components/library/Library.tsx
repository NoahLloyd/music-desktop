import { useMemo, useState, useEffect, useCallback, RefObject } from 'react'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import TrackRow from '@/components/ui/TrackRow'
import TrackEditor from '@/components/ui/TrackEditor'
import VolumeNormalizer from '@/components/ui/VolumeNormalizer'

interface LibraryProps {
  searchRef: RefObject<HTMLInputElement | null>
}

export default function Library({ searchRef }: LibraryProps) {
  const tracks = useLibraryStore((s) => s.tracks)
  const searchQuery = useLibraryStore((s) => s.searchQuery)
  const setSearchQuery = useLibraryStore((s) => s.setSearchQuery)
  const archiveTrack = useLibraryStore((s) => s.archiveTrack)
  const deleteTrack = useLibraryStore((s) => s.deleteTrack)
  const setQueue = usePlayerStore((s) => s.setQueue)

  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null)
  const [showNormalizer, setShowNormalizer] = useState(false)

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return tracks
    const q = searchQuery.toLowerCase()
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.artist && t.artist.toLowerCase().includes(q))
    )
  }, [tracks, searchQuery])

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex((prev) => (prev >= filtered.length ? filtered.length - 1 : prev))
  }, [filtered.length])

  const selectedTrack = selectedIndex >= 0 && selectedIndex < filtered.length ? filtered[selectedIndex] : null

  const handlePlay = (index: number) => {
    setQueue(filtered, index)
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // Allow arrow keys even in search (to navigate results), but not other shortcuts
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        return
      }

      if (inInput) return
      if (!selectedTrack) return

      switch (e.key) {
        case 'Enter':
          e.preventDefault()
          handlePlay(selectedIndex)
          break
        case 'e':
          e.preventDefault()
          setEditingTrackId(selectedTrack.id)
          break
        case 'a':
          e.preventDefault()
          archiveTrack(selectedTrack.id)
          break
        case 'Backspace':
        case 'Delete':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            deleteTrack(selectedTrack.id)
          }
          break
      }
    },
    [filtered, selectedIndex, selectedTrack]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Scroll selected row into view
  useEffect(() => {
    if (selectedIndex >= 0) {
      const el = document.querySelector(`[data-track-index="${selectedIndex}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Library</h1>
        <div className="flex items-center gap-3">
          {tracks.length > 0 && (
            <button
              onClick={() => setShowNormalizer(true)}
              className="bg-surface-2 hover:bg-surface-3 text-white/50 hover:text-white text-[12px] px-3 py-2 rounded-full transition-colors"
            >
              Normalize Volume
            </button>
          )}
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracks..."
            className="bg-surface-2 text-white text-sm rounded-full px-4 py-2 w-64 outline-none focus:ring-1 focus:ring-accent placeholder:text-white/30"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-white/30 mt-20">
          <p className="text-lg mb-2">No tracks yet</p>
          <p className="text-sm">Download some music to get started</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {filtered.map((track, i) => (
            <div key={track.id} data-track-index={i}>
              <TrackRow
                track={track}
                index={i}
                onPlay={() => handlePlay(i)}
                selected={i === selectedIndex}
                onSelect={() => setSelectedIndex(i)}
                onEdit={() => setEditingTrackId(track.id)}
              />
            </div>
          ))}
        </div>
      )}

      {editingTrackId && (
        <TrackEditor
          track={filtered.find((t) => t.id === editingTrackId) || tracks.find((t) => t.id === editingTrackId)!}
          onClose={() => setEditingTrackId(null)}
        />
      )}

      {showNormalizer && (
        <VolumeNormalizer
          tracks={tracks}
          onClose={() => setShowNormalizer(false)}
        />
      )}
    </div>
  )
}
