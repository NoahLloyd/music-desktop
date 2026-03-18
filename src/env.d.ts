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
    getCacheDir: () => Promise<string>
    getPathForFile: (file: File) => string
  }
}
