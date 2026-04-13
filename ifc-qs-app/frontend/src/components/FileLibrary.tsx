import { useEffect, useState } from 'react'
import { deleteFile, getFiles, getSummary } from '../api/endpoints'
import type { FileRecord, ModelSummary } from '../api/types'

interface Props {
  onLoad: (summary: ModelSummary) => void
  onUploadNew: () => void
}

function fmt(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function FileLibrary({ onLoad, onUploadNew }: Props) {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getFiles()
      .then(setFiles)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleLoad = async (file: FileRecord) => {
    setLoadingId(file.file_id)
    setError(null)
    try {
      const summary = await getSummary(file.file_id)
      onLoad(summary)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load file')
      setLoadingId(null)
    }
  }

  const handleDelete = async (file: FileRecord) => {
    setDeletingId(file.file_id)
    try {
      await deleteFile(file.file_id)
      setFiles(prev => prev.filter(f => f.file_id !== file.file_id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete file')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <span className="text-sm text-gray-400">Loading saved files…</span>
      </div>
    )
  }

  if (files.length === 0 && !error) {
    return null  // nothing to show — caller renders upload UI directly
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Saved files</h2>
        <button
          onClick={onUploadNew}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          + Upload new
        </button>
      </div>

      <div className="space-y-2">
        {files.map(file => (
          <div
            key={file.file_id}
            className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-blue-300 transition-colors"
          >
            {/* IFC file icon */}
            <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{file.filename}</p>
              <p className="text-xs text-gray-400">
                {fmt(file.size_bytes)} · {fmtDate(file.uploaded_at)}
                {file.is_processed && (
                  <span className="ml-2 text-green-600 font-medium">● cached</span>
                )}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleLoad(file)}
                disabled={loadingId === file.file_id}
                className="text-xs font-medium px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loadingId === file.file_id ? 'Loading…' : 'Open'}
              </button>
              <button
                onClick={() => handleDelete(file)}
                disabled={deletingId === file.file_id}
                className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors px-1"
                title="Delete file"
              >
                {deletingId === file.file_id ? '…' : '✕'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
