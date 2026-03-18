import { useMemo, useState } from 'react'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import TrackRow from '@/components/ui/TrackRow'

export default function Library() {
  const tracks = useLibraryStore((s) => s.tracks)
  const searchQuery = useLibraryStore((s) => s.searchQuery)
  const setSearchQuery = useLibraryStore((s) => s.setSearchQuery)
  const setQueue = usePlayerStore((s) => s.setQueue)

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return tracks
    const q = searchQuery.toLowerCase()
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.artist && t.artist.toLowerCase().includes(q))
    )
  }, [tracks, searchQuery])

  const handlePlay = (index: number) => {
    setQueue(filtered, index)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Library</h1>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tracks..."
          className="bg-surface-2 text-white text-sm rounded-full px-4 py-2 w-64 outline-none focus:ring-1 focus:ring-accent placeholder:text-white/30"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-white/30 mt-20">
          <p className="text-lg mb-2">No tracks yet</p>
          <p className="text-sm">Download some music to get started</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {filtered.map((track, i) => (
            <TrackRow key={track.id} track={track} index={i} onPlay={() => handlePlay(i)} />
          ))}
        </div>
      )}
    </div>
  )
}
