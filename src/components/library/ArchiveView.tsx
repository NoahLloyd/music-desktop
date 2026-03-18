import { useEffect, useState, useCallback } from 'react'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import TrackRow from '@/components/ui/TrackRow'
import TrackEditor from '@/components/ui/TrackEditor'

export default function ArchiveView() {
  const archivedTracks = useLibraryStore((s) => s.archivedTracks)
  const fetchArchivedTracks = useLibraryStore((s) => s.fetchArchivedTracks)
  const unarchiveTrack = useLibraryStore((s) => s.unarchiveTrack)
  const deleteTrack = useLibraryStore((s) => s.deleteTrack)
  const setQueue = usePlayerStore((s) => s.setQueue)

  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null)

  useEffect(() => {
    fetchArchivedTracks()
  }, [])

  useEffect(() => {
    setSelectedIndex((prev) => (prev >= archivedTracks.length ? archivedTracks.length - 1 : prev))
  }, [archivedTracks.length])

  const selectedTrack = selectedIndex >= 0 && selectedIndex < archivedTracks.length ? archivedTracks[selectedIndex] : null

  const handlePlay = (index: number) => {
    setQueue(archivedTracks, index)
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, archivedTracks.length - 1))
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
          unarchiveTrack(selectedTrack.id)
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
    [archivedTracks, selectedIndex, selectedTrack]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (selectedIndex >= 0) {
      const el = document.querySelector(`[data-track-index="${selectedIndex}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Archive</h1>
        <span className="text-sm text-white/30">{archivedTracks.length} tracks</span>
      </div>

      {archivedTracks.length === 0 ? (
        <div className="text-center text-white/30 mt-20">
          <p className="text-lg mb-2">No archived tracks</p>
          <p className="text-sm">Archived tracks will appear here. They won't show in your library or search.</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {archivedTracks.map((track, i) => (
            <div key={track.id} data-track-index={i}>
              <TrackRow
                track={track}
                index={i}
                onPlay={() => handlePlay(i)}
                isArchived
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
          track={archivedTracks.find((t) => t.id === editingTrackId)!}
          onClose={() => setEditingTrackId(null)}
        />
      )}
    </div>
  )
}
