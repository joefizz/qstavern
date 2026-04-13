import { useState } from 'react'
import { downloadCsv, downloadXlsx, downloadXlsxFull } from '../api/endpoints'

interface Props {
  fileId: string
}

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const SheetIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

export function ExportBar({ fileId }: Props) {
  const [busy, setBusy] = useState<'csv' | 'xlsx' | 'xlsx-full' | null>(null)

  const handle = (type: 'csv' | 'xlsx' | 'xlsx-full') => async () => {
    setBusy(type)
    try {
      if (type === 'csv')       await downloadCsv(fileId)
      else if (type === 'xlsx') await downloadXlsx(fileId)
      else                      await downloadXlsxFull(fileId)
    } finally {
      setBusy(null)
    }
  }

  const btnBase = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-60'

  return (
    <div className="flex gap-2">
      <button
        onClick={handle('csv')}
        disabled={!!busy}
        className={`${btnBase} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
      >
        <DownloadIcon />
        {busy === 'csv' ? 'Exporting…' : 'CSV'}
      </button>
      <button
        onClick={handle('xlsx')}
        disabled={!!busy}
        className={`${btnBase} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
      >
        <SheetIcon />
        {busy === 'xlsx' ? 'Exporting…' : 'XLSX'}
      </button>
      <button
        onClick={handle('xlsx-full')}
        disabled={!!busy}
        className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700`}
        title="Exports Schedule + By Type + By Storey + Components + Bill of Materials"
      >
        <SheetIcon />
        {busy === 'xlsx-full' ? 'Exporting…' : 'Full XLSX'}
      </button>
    </div>
  )
}
