import { useMemo, useState } from 'react'
import type { BomRow } from '../api/types'

interface Props {
  rows: BomRow[]
}

type SortKey = keyof BomRow
type SortDir = 'asc' | 'desc'

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })
}

export function BomTable({ rows }: Props) {
  const [search, setSearch]   = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('code')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return rows
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q) ||
      r.unit.toLowerCase().includes(q) ||
      r.assemblies.toLowerCase().includes(q)
    )
  }, [rows, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number')
        return sortDir === 'asc' ? av - bv : bv - av
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
  }, [filtered, sortKey, sortDir])

  const totalsByUnit = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of filtered) {
      map[r.unit] = (map[r.unit] ?? 0) + r.total_quantity
    }
    return map
  }, [filtered])

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? <span className="opacity-20">↕</span> :
    sortDir === 'asc' ? <span>↑</span> : <span>↓</span>

  const thCls = (k: SortKey) =>
    `text-left px-3 py-2 cursor-pointer select-none hover:text-gray-700 ${sortKey === k ? 'text-blue-600' : ''}`

  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded-lg border border-gray-200">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <input
          type="text"
          placeholder="Search items…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {filtered.length} line item{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">
            {search ? 'No items match that search.' : 'No assembly components were matched for this model.'}
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10 text-xs text-gray-500 font-medium">
              <tr>
                <th className={thCls('code')} onClick={() => handleSort('code')}>
                  Code <SortIcon k="code" />
                </th>
                <th className={thCls('name')} onClick={() => handleSort('name')}>
                  Component <SortIcon k="name" />
                </th>
                <th className={thCls('unit')} onClick={() => handleSort('unit')}>
                  Unit <SortIcon k="unit" />
                </th>
                <th
                  className={`text-right px-3 py-2 cursor-pointer select-none hover:text-gray-700 ${sortKey === 'total_quantity' ? 'text-blue-600' : ''}`}
                  onClick={() => handleSort('total_quantity')}
                >
                  Total Qty <SortIcon k="total_quantity" />
                </th>
                <th className={thCls('assemblies')} onClick={() => handleSort('assemblies')}>
                  Assembly <SortIcon k="assemblies" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{row.code || '—'}</td>
                  <td className="px-3 py-2 text-gray-800 font-medium">{row.name}</td>
                  <td className="px-3 py-2 text-gray-500">{row.unit}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">
                    {fmt(row.total_quantity)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400">{row.assemblies}</td>
                </tr>
              ))}
            </tbody>

            {/* Totals footer */}
            <tfoot className="sticky bottom-0 bg-gray-50 border-t-2 border-gray-200">
              {Object.entries(totalsByUnit).map(([unit, total]) => (
                <tr key={unit} className="text-xs font-semibold text-gray-600">
                  <td colSpan={2} className="px-3 py-1.5 text-right text-gray-400">
                    Total ({unit})
                  </td>
                  <td className="px-3 py-1.5">{unit}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmt(total)}</td>
                  <td />
                </tr>
              ))}
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
