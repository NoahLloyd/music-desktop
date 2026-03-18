import { useEffect, useState } from 'react'
import { useLibraryStore } from '@/stores/libraryStore'
import Sidebar from '@/components/layout/Sidebar'
import PlayerBar from '@/components/layout/PlayerBar'
import Library from '@/components/library/Library'
import PlaylistView from '@/components/playlist/PlaylistView'
import DownloadView from '@/components/download/DownloadView'
import QueueView from '@/components/queue/QueueView'

type View = 'library' | 'playlist' | 'download' | 'queue'

export default function App() {
  const [view, setView] = useState<View>('library')
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)
  const fetchTracks = useLibraryStore((s) => s.fetchTracks)
  const fetchPlaylists = useLibraryStore((s) => s.fetchPlaylists)

  useEffect(() => {
    fetchTracks()
    fetchPlaylists()
  }, [])

  const handlePlaylistSelect = (id: string) => {
    setSelectedPlaylistId(id)
    setView('playlist')
  }

  return (
    <div className="flex flex-col h-screen bg-surface-0">
      <div className="flex flex-1 min-h-0">
        <Sidebar
          currentView={view}
          onNavigate={setView}
          onPlaylistSelect={handlePlaylistSelect}
          selectedPlaylistId={selectedPlaylistId}
        />
        <div className="flex-1 flex flex-col min-h-0">
          {/* Drag region for title bar - spans content area only */}
          <div className="drag-region h-10 flex-shrink-0" />
          <main className="flex-1 overflow-y-auto px-6 pb-6">
            {view === 'library' && <Library />}
            {view === 'playlist' && selectedPlaylistId && (
              <PlaylistView playlistId={selectedPlaylistId} />
            )}
            {view === 'download' && <DownloadView />}
            {view === 'queue' && <QueueView />}
          </main>
        </div>
      </div>

      <PlayerBar onQueueClick={() => setView('queue')} />
    </div>
  )
}
