import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import { getQuantities } from '../api/endpoints'
import type { ModelSummary, QuantityRecord } from '../api/types'
import { ElementDetailPanel } from './ElementDetailPanel'

interface Props {
  summary: ModelSummary
  selectedGuid?: string | null
  onSelectGuid?: (guid: string | null) => void
  showDetailPanel?: boolean
}

const col = createColumnHelper<QuantityRecord>()

const COLUMNS = [
  col.accessor('ifc_type',  { header: 'IFC Type' }),
  col.accessor('name',      { header: 'Name' }),
  col.accessor('type_name', {
    header: 'Product Type',
    cell: (i) => i.getValue()
      ? <span className="font-medium text-gray-800">{i.getValue()}</span>
      : <span className="text-gray-300">—</span>,
  }),
  col.accessor('storey',   { header: 'Storey' }),
  col.accessor('material', {
    header: 'Material',
    cell: (i) => i.getValue() ?? '—',
  }),
  col.accessor((r) => r.quantities.area, {
    id: 'area', header: 'Area (m²)',
    cell: (i) => i.getValue() != null ? i.getValue()!.toFixed(2) : '—',
  }),
  col.accessor((r) => r.quantities.volume, {
    id: 'volume', header: 'Volume (m³)',
    cell: (i) => i.getValue() != null ? i.getValue()!.toFixed(2) : '—',
  }),
  col.accessor((r) => r.quantities.length, {
    id: 'length', header: 'Length (m)',
    cell: (i) => i.getValue() != null ? i.getValue()!.toFixed(2) : '—',
  }),
  col.accessor((r) => r.quantities.source, {
    id: 'source', header: 'Source',
    cell: (i) => {
      const src = i.getValue()
      return (
        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
          src === 'authored' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>{src}</span>
      )
    },
  }),
  col.accessor('is_external', {
    header: 'Ext.',
    cell: (i) => i.getValue() ? 'Yes' : 'No',
  }),
]

const SEL = 'text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300'

export function QuantityTable({
  summary,
  selectedGuid: externalGuid,
  onSelectGuid: externalOnSelect,
  showDetailPanel = true,
}: Props) {
  const [records,  setRecords]  = useState<QuantityRecord[]>([])
  const [loading,  setLoading]  = useState(true)
  const [sorting,  setSorting]  = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [internalGuid, setInternalGuid] = useState<string | null>(null)

  const selectedGuid    = externalGuid      !== undefined ? externalGuid      : internalGuid
  const setSelectedGuid = externalOnSelect  !== undefined ? externalOnSelect  : setInternalGuid

  // Filter state
  const [nameSearch,    setNameSearch]    = useState('')
  const [typeFilter,    setTypeFilter]    = useState('')
  const [storeyFilter,  setStoreyFilter]  = useState('')
  const [materialFilter,setMaterialFilter]= useState('')
  const [sourceFilter,  setSourceFilter]  = useState('')
  const [externalOnly,  setExternalOnly]  = useState(false)

  useEffect(() => {
    setLoading(true)
    getQuantities(summary.file_id).then((data) => {
      setRecords(data)
      setLoading(false)
    })
  }, [summary.file_id])

  const filtered = useMemo(() => {
    let data = records
    if (nameSearch)     data = data.filter((r) =>
      r.name.toLowerCase().includes(nameSearch.toLowerCase()) ||
      r.ifc_type.toLowerCase().includes(nameSearch.toLowerCase()) ||
      (r.type_name ?? '').toLowerCase().includes(nameSearch.toLowerCase()))
    if (typeFilter)     data = data.filter((r) => r.ifc_type === typeFilter)
    if (storeyFilter)   data = data.filter((r) => r.storey === storeyFilter)
    if (materialFilter) data = data.filter((r) => r.material === materialFilter)
    if (sourceFilter)   data = data.filter((r) => r.quantities.source === sourceFilter)
    if (externalOnly)   data = data.filter((r) => r.is_external)
    return data
  }, [records, nameSearch, typeFilter, storeyFilter, materialFilter, sourceFilter, externalOnly])

  const ifcTypes  = useMemo(() => [...new Set(records.map((r) => r.ifc_type))].sort(),  [records])
  const materials = useMemo(() => [...new Set(records.map((r) => r.material).filter(Boolean))].sort() as string[], [records])

  const table = useReactTable({
    data: filtered,
    columns: COLUMNS,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const hasActiveFilter = nameSearch || typeFilter || storeyFilter || materialFilter || sourceFilter || externalOnly

  const clearFilters = () => {
    setNameSearch(''); setTypeFilter(''); setStoreyFilter('')
    setMaterialFilter(''); setSourceFilter(''); setExternalOnly(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-sm text-gray-500">Loading elements…</div>
      </div>
    )
  }

  // When embedded in split panel, fill the column height
  const wrapClass = showDetailPanel
    ? 'space-y-3'
    : 'h-full flex flex-col gap-2'

  const tableWrapStyle = showDetailPanel
    ? { maxHeight: 'calc(100vh - 16rem)' }
    : undefined

  return (
    <div className={wrapClass}>
      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        {/* Text search — full width */}
        <input
          type="text"
          placeholder="Search name, type or product…"
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
          className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300"
        />

        {/* Dropdowns — horizontal scroll so they never wrap */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <select className={SEL} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {ifcTypes.map((t) => <option key={t} value={t}>{t.replace('Ifc', '')}</option>)}
          </select>

          <select className={SEL} value={storeyFilter} onChange={(e) => setStoreyFilter(e.target.value)}>
            <option value="">All storeys</option>
            {summary.storeys.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {materials.length > 0 && (
            <select className={SEL} value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)}>
              <option value="">All materials</option>
              {materials.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}

          <select className={SEL} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="">All sources</option>
            <option value="authored">Authored</option>
            <option value="estimated">Estimated</option>
          </select>

          <label className="flex items-center gap-1 text-xs text-gray-700 whitespace-nowrap cursor-pointer">
            <input type="checkbox" checked={externalOnly} onChange={(e) => setExternalOnly(e.target.checked)} className="rounded" />
            External
          </label>
        </div>

        {/* Count + clear */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {filtered.length} of {records.length} element{records.length !== 1 ? 's' : ''}
          </span>
          {hasActiveFilter && (
            <button onClick={clearFilters} className="text-xs text-blue-500 hover:text-blue-700">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className={showDetailPanel ? 'flex gap-4 items-start' : 'flex-1 min-h-0 overflow-hidden'}>
        <div
          className={`overflow-auto rounded-lg border border-gray-200 w-full ${showDetailPanel ? '' : 'h-full'}`}
          style={tableWrapStyle}
        >
          <table className="divide-y divide-gray-200 text-sm" style={{ minWidth: 'max-content', width: '100%' }}>
            <thead className="bg-gray-50 sticky top-0 z-10">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide select-none cursor-pointer whitespace-nowrap hover:bg-gray-100"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {table.getRowModel().rows.map((row) => {
                const isSelected = row.original.guid === selectedGuid
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedGuid(isSelected ? null : row.original.guid)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-sm text-gray-400">
                    No elements match the current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {showDetailPanel && selectedGuid && (
          <ElementDetailPanel
            fileId={summary.file_id}
            guid={selectedGuid}
            onClose={() => setSelectedGuid(null)}
          />
        )}
      </div>
    </div>
  )
}
