import axios from 'axios'
import React, { useCallback, useState } from 'react'
import { uploadFile } from '../api/endpoints'

interface DuplicateInfo {
  file_id: string
  filename: string
}

interface Props {
  onUploaded: (fileId: string, fileName: string) => void
  onDuplicate: (fileId: string) => void
}

export function FileUpload({ onUploaded, onDuplicate }: Props) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.ifc')) {
        setError('Only .ifc files are accepted')
        return
      }
      setError(null)
      setDuplicate(null)
      setUploadPct(0)
      setLoading(true)
      try {
        const { file_id } = await uploadFile(file, setUploadPct)
        onUploaded(file_id, file.name)
      } catch (e: unknown) {
        if (axios.isAxiosError(e) && e.response?.status === 409) {
          const detail = e.response.data?.detail
          setDuplicate({ file_id: detail.file_id, filename: detail.filename })
        } else {
          setError(e instanceof Error ? e.message : 'Upload failed')
        }
        setLoading(false)
      }
    },
    [onUploaded]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-lg">
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 cursor-pointer transition-colors ${
          dragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <input type="file" accept=".ifc" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        {loading ? (
          <div className="w-full flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-blue-600">
              {uploadPct < 100 ? `Uploading… ${uploadPct}%` : 'Processing…'}
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-200"
                style={{
                  width: `${uploadPct}%`,
                  background: uploadPct < 100
                    ? 'linear-gradient(90deg, #3b82f6, #6366f1)'
                    : '#22c55e',
                }}
              />
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700">Drop an IFC file here, or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Supports IFC2x3 and IFC4</p>
          </>
        )}
      </label>

      {/* Duplicate warning */}
      {duplicate && (
        <div className="w-full bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">This file has already been uploaded</p>
            <p className="text-xs text-amber-600 truncate mt-0.5">{duplicate.filename}</p>
          </div>
          <button
            onClick={() => onDuplicate(duplicate.file_id)}
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            Open existing
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-2 w-full">{error}</p>
      )}
    </div>
  )
}
