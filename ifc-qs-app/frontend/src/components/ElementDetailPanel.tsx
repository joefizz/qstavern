import { useEffect, useState } from 'react'
import { getElement } from '../api/endpoints'
import type { QuantityRecord } from '../api/types'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-800 text-right truncate" title={value}>{value}</span>
    </div>
  )
}

function fmt(n: number | null | undefined, digits = 3) {
  return n != null ? n.toFixed(digits) : '—'
}

interface Props {
  fileId: string
  guid: string
  onClose: () => void
}

export function ElementDetailPanel({ fileId, guid, onClose }: Props) {
  const [record, setRecord] = useState<QuantityRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setRecord(null)
    getElement(fileId, guid)
      .then(setRecord)
      .finally(() => setLoading(false))
  }, [fileId, guid])

  return (
    <div className="w-full bg-white border border-gray-200 rounded-lg overflow-y-auto h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
        <span className="text-sm font-semibold text-gray-800">Element Details</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          ×
        </button>
      </div>

      {loading && <p className="text-sm text-gray-400 p-4">Loading…</p>}

      {record && (
        <div className="divide-y divide-gray-100">
          {/* Identity */}
          <div className="px-4 py-3 space-y-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Identity</p>
            <p className="text-sm font-medium text-gray-900">{record.name || '—'}</p>
            <p className="text-xs text-gray-500">{record.ifc_type}</p>
            {record.type_name && (
              <div className="mt-1.5 bg-blue-50 border border-blue-100 rounded px-2 py-1.5">
                <p className="text-xs text-blue-500 uppercase tracking-wide mb-0.5">Product Type</p>
                <p className="text-sm font-semibold text-blue-900">{record.type_name}</p>
                {record.type_class && (
                  <p className="text-xs text-blue-400">{record.type_class}</p>
                )}
              </div>
            )}
            <p className="text-xs text-gray-400 font-mono break-all pt-1">{record.guid}</p>
          </div>

          {/* Location */}
          <div className="px-4 py-3 space-y-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Location</p>
            <Row label="Storey"   value={record.storey} />
            <Row label="External" value={record.is_external ? 'Yes' : 'No'} />
            <Row label="Material" value={record.material ?? '—'} />
          </div>

          {/* Quantities */}
          <div className="px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Quantities</p>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  record.quantities.source === 'authored'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {record.quantities.source}
              </span>
            </div>
            {Object.keys(record.quantities.all_quantities).length > 0
              ? Object.entries(record.quantities.all_quantities).map(([name, val]) => (
                  <Row key={name} label={name} value={fmt(val, 3)} />
                ))
              : <>
                  {record.quantities.length != null && <Row label="Length" value={`${fmt(record.quantities.length)} m`} />}
                  {record.quantities.area   != null && <Row label="Area"   value={`${fmt(record.quantities.area, 2)} m²`} />}
                  {record.quantities.volume != null && <Row label="Volume" value={`${fmt(record.quantities.volume, 3)} m³`} />}
                  {record.quantities.weight != null && <Row label="Weight" value={`${fmt(record.quantities.weight, 1)} kg`} />}
                </>
            }
          </div>

          {/* Properties */}
          {Object.keys(record.properties).length > 0 && (
            <div className="px-4 py-3 space-y-1">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Properties</p>
              {Object.entries(record.properties).map(([k, v]) => (
                <Row key={k} label={k} value={String(v)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
