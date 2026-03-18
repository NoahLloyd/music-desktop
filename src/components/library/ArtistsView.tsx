import { useMemo, useState, useEffect, useCallback } from 'react'
import { Track } from '@/types'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import TrackRow from '@/components/ui/TrackRow'
import TrackEditor from '@/components/ui/TrackEditor'
import ArtworkImage from '@/components/ui/ArtworkImage'

interface ArtistInfo {
  name: string
  tracks: Track[]
  artworks: string[]
  totalDuration: number
}

function formatTotalDuration(seconds: number): string {
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    return `${mins} min`
  }
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours} hr ${mins} min`
}

/** Mosaic of up to 4 artworks for an artist card */
function ArtistArt({ artworks, name }: { artworks: string[]; name: string }) {
  const unique = [...new Set(artworks)].slice(0, 4)

  if (unique.length === 0) {
    // Generate a color from the artist name
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    const hue = ((hash % 360) + 360) % 360
    return (
      <div
        className="w-full aspect-square rounded-xl flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, hsl(${hue}, 40%, 20%), hsl(${hue}, 50%, 12%))` }}
      >
        <span className="text-4xl text-white/20 font-bold select-none">
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
    )
  }

  if (unique.length === 1) {
    return (
      <ArtworkImage
        src={unique[0]}
        className="w-full aspect-square rounded-xl"
      />
    )
  }

  // 2x2 mosaic grid
  const filled = [...unique]
  while (filled.length < 4) filled.push(filled[filled.length - 1])

  return (
    <div className="w-full aspect-square rounded-xl overflow-hidden grid grid-cols-2 grid-rows-2 gap-[1px] bg-surface-3">
      {filled.map((url, i) => (
        <ArtworkImage key={i} src={url} className="w-full h-full" />
      ))}
    </div>
  )
}

export default function ArtistsView() {
  const tracks = useLibraryStore((s) => s.tracks)
  const setQueue = usePlayerStore((s) => s.setQueue)
  const archiveTrack = useLibraryStore((s) => s.archiveTrack)
  const deleteTrack = useLibraryStore((s) => s.deleteTrack)

  const [selectedArtist, setSelectedArtist] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null)

  const artists = useMemo(() => {
    const map = new Map<string, ArtistInfo>()
    for (const track of tracks) {
      const name = track.artist || 'Unknown'
      if (!map.has(name)) {
        map.set(name, { name, tracks: [], artworks: [], totalDuration: 0 })
      }
      const info = map.get(name)!
      info.tracks.push(track)
      if (track.artwork_url) info.artworks.push(track.artwork_url)
      const dur = track.end_time ?? track.duration ?? 0
      const start = track.start_time ?? 0
      info.totalDuration += Math.max(0, dur - start)
    }
    // Sort by track count descending, then alphabetically
    return [...map.values()].sort((a, b) => b.tracks.length - a.tracks.length || a.name.localeCompare(b.name))
  }, [tracks])

  const currentArtist = selectedArtist ? artists.find((a) => a.name === selectedArtist) : null

  // Reset selection when switching views
  useEffect(() => {
    setSelectedIndex(-1)
  }, [selectedArtist])

  const handlePlayAll = (artistTracks: Track[], startIndex = 0) => {
    setQueue(artistTracks, startIndex)
  }

  // Keyboard nav for artist detail view
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!currentArtist) return
      const target = e.target as HTMLElement
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, currentArtist.tracks.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Escape') {
        setSelectedArtist(null)
        return
      }

      if (inInput) return

      const selectedTrack = selectedIndex >= 0 && selectedIndex < currentArtist.tracks.length
        ? currentArtist.tracks[selectedIndex] : null
      if (!selectedTrack) return

      switch (e.key) {
        case 'Enter':
          e.preventDefault()
          handlePlayAll(currentArtist.tracks, selectedIndex)
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
    [currentArtist, selectedIndex]
  )

  useEffect(() => {
    if (currentArtist) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, currentArtist])

  useEffect(() => {
    if (selectedIndex >= 0) {
      const el = document.querySelector(`[data-track-index="${selectedIndex}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Artist detail view
  if (currentArtist) {
    const heroArt = currentArtist.artworks[0]
    return (
      <div>
        {/* Hero header */}
        <div className="relative mb-8 pt-2">
          {/* Background blur */}
          {heroArt && (
            <div className="absolute inset-0 -mx-6 overflow-hidden rounded-b-2xl">
              <img
                src={heroArt}
                alt=""
                className="w-full h-full object-cover opacity-15 blur-3xl scale-125"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-surface-0/30 via-transparent to-surface-0" />
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => setSelectedArtist(null)}
              className="text-[11px] text-white/30 hover:text-white uppercase tracking-wider mb-4 transition-colors block"
            >
              ← All Artists
            </button>
            <div className="flex items-end gap-6">
              <div className="w-40 h-40 flex-shrink-0 shadow-2xl rounded-xl overflow-hidden">
                <ArtistArt artworks={currentArtist.artworks} name={currentArtist.name} />
              </div>
              <div className="min-w-0 pb-1">
                <h1 className="text-3xl font-bold truncate">{currentArtist.name}</h1>
                <p className="text-sm text-white/40 mt-1.5">
                  {currentArtist.tracks.length} {currentArtist.tracks.length === 1 ? 'song' : 'songs'} · {formatTotalDuration(currentArtist.totalDuration)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Play all + shuffle */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => handlePlayAll(currentArtist.tracks)}
            className="bg-accent hover:bg-accent-hover text-black font-medium text-sm px-6 py-2 rounded-full transition-colors"
          >
            ▶ Play All
          </button>
          <button
            onClick={() => {
              const shuffled = [...currentArtist.tracks].sort(() => Math.random() - 0.5)
              handlePlayAll(shuffled)
            }}
            className="bg-surface-3 hover:bg-surface-4 text-white/70 font-medium text-sm px-5 py-2 rounded-full transition-colors"
          >
            ⤮ Shuffle
          </button>
        </div>

        {/* Track list */}
        <div className="space-y-0.5">
          {currentArtist.tracks.map((track, i) => (
            <div key={track.id} data-track-index={i}>
              <TrackRow
                track={track}
                index={i}
                onPlay={() => handlePlayAll(currentArtist.tracks, i)}
                selected={i === selectedIndex}
                onSelect={() => setSelectedIndex(i)}
                onEdit={() => setEditingTrackId(track.id)}
              />
            </div>
          ))}
        </div>

        {editingTrackId && (
          <TrackEditor
            track={currentArtist.tracks.find((t) => t.id === editingTrackId)!}
            onClose={() => setEditingTrackId(null)}
          />
        )}
      </div>
    )
  }

  // Artists grid overview
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Artists</h1>
        <span className="text-sm text-white/30">{artists.length} artists</span>
      </div>

      {artists.length === 0 ? (
        <div className="text-center text-white/30 mt-20">
          <p className="text-lg mb-2">No artists yet</p>
          <p className="text-sm">Add some music and they'll appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {artists.map((artist) => (
            <button
              key={artist.name}
              onClick={() => setSelectedArtist(artist.name)}
              className="group text-left bg-surface-1 hover:bg-surface-2 rounded-xl p-3 transition-all duration-200 hover:shadow-lg hover:shadow-black/20"
            >
              <div className="mb-3 shadow-md group-hover:shadow-xl transition-shadow duration-200">
                <ArtistArt artworks={artist.artworks} name={artist.name} />
              </div>
              <p className="text-sm font-medium text-white truncate">{artist.name}</p>
              <p className="text-[11px] text-white/35 mt-0.5">
                {artist.tracks.length} {artist.tracks.length === 1 ? 'song' : 'songs'}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
