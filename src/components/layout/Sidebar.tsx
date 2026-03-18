import { useState } from 'react'
import { useLibraryStore } from '@/stores/libraryStore'

interface SidebarProps {
  currentView: string
  onNavigate: (view: 'library' | 'download' | 'queue') => void
  onPlaylistSelect: (id: string) => void
  selectedPlaylistId: string | null
}

export default function Sidebar({
  currentView,
  onNavigate,
  onPlaylistSelect,
  selectedPlaylistId
}: SidebarProps) {
  const playlists = useLibraryStore((s) => s.playlists)
  const createPlaylist = useLibraryStore((s) => s.createPlaylist)
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const handleCreate = async () => {
    if (newName.trim()) {
      const playlist = await createPlaylist(newName.trim())
      setNewName('')
      setIsCreating(false)
      onPlaylistSelect(playlist.id)
    }
  }

  return (
    <aside className="w-56 flex-shrink-0 bg-surface-1 flex flex-col border-r border-white/5">
      {/* Draggable area at top of sidebar for window controls */}
      <div className="drag-region h-10 flex-shrink-0" />

      <nav className="px-3 space-y-1">
        <NavItem
          icon="◉"
          label="Library"
          active={currentView === 'library'}
          onClick={() => onNavigate('library')}
        />
        <NavItem
          icon="↓"
          label="Add Music"
          active={currentView === 'download'}
          onClick={() => onNavigate('download')}
        />
        <NavItem
          icon="☰"
          label="Queue"
          active={currentView === 'queue'}
          onClick={() => onNavigate('queue')}
        />
      </nav>

      <div className="border-t border-white/5 mt-3 pt-3 px-3 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
            Playlists
          </span>
          <button
            onClick={() => setIsCreating(true)}
            className="text-white/40 hover:text-white text-lg leading-none no-drag"
          >
            +
          </button>
        </div>

        {isCreating && (
          <div className="mb-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setIsCreating(false)
              }}
              autoFocus
              placeholder="Playlist name"
              className="w-full bg-surface-3 text-white text-sm rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent no-drag"
            />
          </div>
        )}

        <div className="space-y-0.5">
          {playlists.map((playlist) => (
            <div key={playlist.id} className="group flex items-center">
              <button
                onClick={() => onPlaylistSelect(playlist.id)}
                className={`flex-1 text-left text-sm px-2 py-1.5 rounded truncate transition-colors no-drag ${
                  currentView === 'playlist' && selectedPlaylistId === playlist.id
                    ? 'bg-surface-3 text-white'
                    : 'text-white/60 hover:text-white hover:bg-surface-2'
                }`}
              >
                {playlist.name}
              </button>
              <button
                onClick={() => deletePlaylist(playlist.id)}
                className="text-white/0 group-hover:text-white/40 hover:!text-red-400 text-xs px-1 transition-colors no-drag"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

function NavItem({
  icon,
  label,
  active,
  onClick
}: {
  icon: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 text-sm px-2.5 py-2 rounded transition-colors no-drag ${
        active ? 'bg-surface-3 text-white' : 'text-white/60 hover:text-white hover:bg-surface-2'
      }`}
    >
      <span className="text-base">{icon}</span>
      {label}
    </button>
  )
}
