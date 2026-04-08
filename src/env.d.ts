/// <reference types="electron-vite/client" />

interface DownloadProgress {
  percent: number
  stage: 'downloading' | 'converting' | 'uploading' | 'done'
  message: string
}

interface Window {
  api: {
    downloadAudio: (url: string) => Promise<{ success: boolean; track?: any; error?: string }>
    onDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void
    importFiles: (filePaths: string[]) => Promise<{ imported: any[]; errors: string[] }>
    openFileDialog: () => Promise<string[]>
    getCachePath: (trackId: string) => Promise<string>
    checkYtDlp: () => Promise<{ available: boolean; path: string | null }>
    onImportProgress: (callback: (progress: { current: number; total: number; name: string; stage: string }) => void) => () => void
    deleteCache: (trackId: string) => Promise<boolean>
    getCacheDir: () => Promise<string>
    getPathForFile: (file: File) => string
    processAudio: (trackId: string, options: {
      startTime: number | null
      endTime: number | null
      volume: number | null
      fadeIn: number | null
      fadeOut: number | null
      playbackSpeed: number | null
      preservePitch: boolean
    }) => Promise<{ success: boolean; processedStoragePath?: string; error?: string }>
    onProcessProgress: (callback: (progress: { trackId: string; stage: string; message: string }) => void) => () => void
    measureLoudness: (trackId: string) => Promise<{ success: boolean; loudnessDb?: number; error?: string }>
    normalizeTrack: (trackId: string, currentLoudnessDb: number, targetLoudnessDb: number, trackAdjustments: {
      startTime: number | null
      endTime: number | null
      volume: number | null
      fadeIn: number | null
      fadeOut: number | null
      playbackSpeed: number | null
      preservePitch: boolean
    }) => Promise<{ success: boolean; noChange?: boolean; processedStoragePath?: string; error?: string }>
    getProcessedCachePath: (trackId: string) => Promise<string | null>
  }
}
