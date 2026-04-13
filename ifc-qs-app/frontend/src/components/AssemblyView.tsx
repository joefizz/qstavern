import { useEffect, useMemo, useState } from 'react'
import { getAssembledSchedule } from '../api/endpoints'
import type { AssembledElement, BomRow, ModelSummary } from '../api/types'
import { AssemblyEditor } from './AssemblyEditor'
import { BomTable } from './BomTable'
import { ComponentsTable } from './ComponentsTable'

type SubTab = 'components' | 'bom' | 'library'

const SUB_TABS: { key: SubTab; label: string; title: string }[] = [
  { key: 'components', label: 'Components', title: 'Derived components per element — click a row to expand' },
  { key: 'bom',       label: 'Bill of Materials', title: 'All components rolled up by item across the whole model' },
  { key: 'library',   label: 'Assembly Library', title: 'View and edit assembly recipes' },
]

/** Derive a BOM from assembled elements on the client side (avoids a second API call). */
function deriveBom(assembled: AssembledElement[]): BomRow[] {
  const totals: Map<string, BomRow & { labels: Set<string> }> = new Map()
  for (const el of assembled) {
    for (const comp of el.components) {
      const key = `${comp.code ?? comp.name}||${comp.unit}`
      if (!totals.has(key)) {
        totals.set(key, {
          code: comp.code ?? '',
          name: comp.name,
          unit: comp.unit,
          total_quantity: 0,
          assemblies: '',
          labels: new Set(),
        })
      }
      const row = totals.get(key)!
      row.total_quantity += comp.quantity
      row.labels.add(comp.assembly_label)
    }
  }
  return Array.from(totals.values())
    .sort((a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name))
    .map(({ labels, ...rest }) => ({
      ...rest,
      total_quantity: Math.round(rest.total_quantity * 10000) / 10000,
      assemblies: [...labels].sort().join(', '),
    }))
}

interface Props {
  summary: ModelSummary
  selectedGuid: string | null
  onSelectGuid: (guid: string | null) => void
}

export function AssemblyView({ summary, selectedGuid, onSelectGuid }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('components')
  const [assembled, setAssembled] = useState<AssembledElement[] | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // Fetch assembled schedule once when this view first mounts (or file changes)
  useEffect(() => {
    setLoading(true)
    setError(null)
    getAssembledSchedule(summary.file_id)
      .then(data => { setAssembled(data); setLoading(false) })
      .catch(e  => { setError(String(e)); setLoading(false) })
  }, [summary.file_id])

  const bom = useMemo(
    () => assembled ? deriveBom(assembled) : [],
    [assembled]
  )

  const matchedCount = useMemo(
    () => assembled ? assembled.filter(el => el.components.length > 0).length : 0,
    [assembled]
  )

  const currentTitle = SUB_TABS.find(t => t.key === subTab)?.title ?? ''

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 14rem)' }}>
      {/* Sub-tab bar */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {SUB_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                subTab === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {assembled && subTab !== 'library' && (
          <div className="text-xs text-gray-400">
            {matchedCount} of {assembled.length} elements matched · {bom.length} BOM line items
          </div>
        )}
      </div>

      {/* Sub-tab hint */}
      <p className="text-xs text-gray-400 mb-3 flex-shrink-0">{currentTitle}</p>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {subTab === 'library' ? (
          <AssemblyEditor />
        ) : loading ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              Applying assembly recipes…
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-sm text-red-500">
            {error}
          </div>
        ) : assembled ? (
          <>
            {subTab === 'components' && (
              <ComponentsTable
                assembled={assembled}
                selectedGuid={selectedGuid}
                onSelectGuid={onSelectGuid}
              />
            )}
            {subTab === 'bom' && <BomTable rows={bom} />}
          </>
        ) : null}
      </div>
    </div>
  )
}
