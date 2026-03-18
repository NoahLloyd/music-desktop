import { useEffect, useState, useCallback, useRef } from 'react'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import Sidebar from '@/components/layout/Sidebar'
import PlayerBar from '@/components/layout/PlayerBar'
import Library from '@/components/library/Library'
import PlaylistView from '@/components/playlist/PlaylistView'
import DownloadView from '@/components/download/DownloadView'
import QueueView from '@/components/queue/QueueView'
import ArtistsView from '@/components/library/ArtistsView'
import ArchiveView from '@/components/library/ArchiveView'
import ShortcutHelp from '@/components/ui/ShortcutHelp'

type View = 'library' | 'artists' | 'playlist' | 'download' | 'queue' | 'archive'

export default function App() {
  const [view, setView] = useState<View>('library')
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const fetchTracks = useLibraryStore((s) => s.fetchTracks)
  const fetchPlaylists = useLibraryStore((s) => s.fetchPlaylists)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchTracks()
    fetchPlaylists()
  }, [])

  const handlePlaylistSelect = (id: string) => {
    setSelectedPlaylistId(id)
    setView('playlist')
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

    if (e.key === 'Escape') {
      if (showShortcuts) { setShowShortcuts(false); return }
      if (inInput) { (target as HTMLInputElement).blur(); return }
      return
    }

    if (inInput) return

    const { isPlaying, pause, resume, currentTrack, next, previous, volume, setVolume } = usePlayerStore.getState()

    switch (e.key) {
      case ' ':
        e.preventDefault()
        if (isPlaying) pause()
        else if (currentTrack) resume()
        break
      case 'n':
        next()
        break
      case 'p':
        previous()
        break
      case 'm':
        setVolume(volume > 0 ? 0 : 1)
        break
      case '1':
        setView('library')
        break
      case '2':
        setView('artists')
        break
      case '3':
        setView('download')
        break
      case '4':
        setView('queue')
        break
      case '5':
        setView('archive')
        break
      case 's':
        e.preventDefault()
        setView('library')
        setTimeout(() => searchRef.current?.focus(), 50)
        break
      case '?':
        setShowShortcuts((v) => !v)
        break
    }
  }, [showShortcuts])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])


  return (
    <>
      <div className="flex flex-col h-screen bg-surface-0">
        <div className="flex flex-1 min-h-0">
          <Sidebar
            currentView={view}
            onNavigate={setView}
            onPlaylistSelect={handlePlaylistSelect}
            selectedPlaylistId={selectedPlaylistId}
          />
          <div className="flex-1 flex flex-col min-h-0">
            <div className="drag-region h-10 flex-shrink-0" />
            <main className="flex-1 overflow-y-auto px-6 pt-2 pb-6">
              {view === 'library' && <Library searchRef={searchRef} />}
              {view === 'artists' && <ArtistsView />}
              {view === 'playlist' && selectedPlaylistId && (
                <PlaylistView playlistId={selectedPlaylistId} />
              )}
              {view === 'download' && <DownloadView />}
              {view === 'queue' && <QueueView />}
              {view === 'archive' && <ArchiveView />}
            </main>
          </div>
        </div>

        <PlayerBar onQueueClick={() => setView('queue')} />
      </div>

      {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}
    </>
  )
}
