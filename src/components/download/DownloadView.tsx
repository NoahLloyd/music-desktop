import { useState, useEffect, useCallback } from 'react'
import { useLibraryStore } from '@/stores/libraryStore'

export default function DownloadView() {
  const [url, setUrl] = useState('')
  const [progress, setProgress] = useState<{
    percent: number
    stage: string
    message: string
  } | null>(null)
  const [ytdlpAvailable, setYtdlpAvailable] = useState<boolean | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const downloadAndAddTrack = useLibraryStore((s) => s.downloadAndAddTrack)
  const importFiles = useLibraryStore((s) => s.importFiles)
  const loading = useLibraryStore((s) => s.loading)
  const lastError = useLibraryStore((s) => s.lastError)

  useEffect(() => {
    window.api.checkYtDlp().then((result) => setYtdlpAvailable(result.available))
  }, [])

  useEffect(() => {
    const unsub = window.api.onDownloadProgress((p) => setProgress(p))
    return unsub
  }, [])

  useEffect(() => {
    const unsub = window.api.onImportProgress((p) => {
      setImportStatus(`Uploading ${p.name}... (${p.current}/${p.total})`)
    })
    return unsub
  }, [])

  const handleDownload = async () => {
    if (!url.trim()) return
    setProgress({ percent: 0, stage: 'downloading', message: 'Starting...' })
    const track = await downloadAndAddTrack(url.trim())
    if (track) setUrl('')
    setProgress(null)
  }

  const doImport = async (paths: string[]) => {
    setImportStatus(`Importing ${paths.length} file(s)...`)
    const imported = await importFiles(paths)
    if (imported.length > 0) {
      setImportStatus(`Imported ${imported.length} track(s)`)
    } else {
      setImportStatus(null)
    }
    setTimeout(() => setImportStatus(null), 3000)
  }

  const handleFileDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files)
      const audioFiles = files.filter((f) =>
        /\.(mp3|m4a|wav|flac|ogg|aac|wma)$/i.test(f.name)
      )
      if (audioFiles.length === 0) {
        setImportStatus('No supported audio files found')
        setTimeout(() => setImportStatus(null), 3000)
        return
      }
      const paths = audioFiles.map((f) => window.api.getPathForFile(f))
      await doImport(paths)
    },
    [importFiles]
  )

  const handleBrowse = async () => {
    const paths = await window.api.openFileDialog()
    if (paths.length === 0) return
    await doImport(paths)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Add Music</h1>

      {ytdlpAvailable === false && (
        <div className="bg-yellow-500/8 border border-yellow-500/15 rounded-xl p-4 mb-8">
          <p className="text-yellow-400/90 text-[13px] font-medium">yt-dlp not installed</p>
          <p className="text-yellow-400/50 text-[12px] mt-1">
            YouTube downloading needs yt-dlp:{' '}
            <code className="bg-surface-3 px-1.5 py-0.5 rounded text-yellow-400/70">
              brew install yt-dlp
            </code>
          </p>
        </div>
      )}

      {/* YouTube download */}
      <section className="mb-10">
        <h2 className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-3">
          From YouTube
        </h2>
        <div className="bg-surface-1 rounded-xl p-5 border border-white/5">
          <div className="flex gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
              placeholder="Paste a YouTube URL..."
              className="flex-1 bg-surface-3 text-white text-[13px] rounded-lg px-4 py-2.5 outline-none focus:ring-1 focus:ring-accent/50 placeholder:text-white/25 transition-shadow"
              disabled={loading}
            />
            <button
              onClick={handleDownload}
              disabled={loading || !url.trim() || ytdlpAvailable === false}
              className="bg-accent hover:bg-accent-hover text-black font-semibold text-[13px] px-5 py-2.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading && progress ? 'Downloading...' : 'Download'}
            </button>
          </div>

          {progress && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-[12px] mb-1.5">
                <span className="text-white/50">{progress.message}</span>
                <span className="text-white/30 tabular-nums">{Math.round(progress.percent)}%</span>
              </div>
              <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {lastError && !progress && (
            <div className="mt-4 bg-red-500/8 border border-red-500/15 rounded-lg p-3">
              <p className="text-red-400/80 text-[12px]">{lastError}</p>
            </div>
          )}
        </div>
      </section>

      {/* File import */}
      <section>
        <h2 className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-3">
          Import Files
        </h2>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFileDrop}
          onClick={handleBrowse}
          className={`border border-dashed rounded-xl py-14 px-6 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-accent bg-accent/5 scale-[1.01]'
              : 'border-white/10 hover:border-white/20 hover:bg-surface-1/50'
          }`}
        >
          <div className="text-3xl mb-3 opacity-20">♪</div>
          <p className="text-white/40 text-[13px]">
            {isDragging ? (
              <span className="text-accent">Drop files here</span>
            ) : (
              <>
                Drop audio files here or{' '}
                <span className="text-accent hover:text-accent-hover">browse</span>
              </>
            )}
          </p>
          <p className="text-white/15 text-[11px] mt-1.5">mp3, m4a, wav, flac, ogg, aac</p>
        </div>

        {importStatus && (
          <p className="mt-3 text-[12px] text-white/40">{importStatus}</p>
        )}

        {lastError && !progress && importStatus && (
          <div className="mt-2 bg-red-500/8 border border-red-500/15 rounded-lg p-3">
            <p className="text-red-400/80 text-[12px]">{lastError}</p>
          </div>
        )}
      </section>
    </div>
  )
}
