import { useMemo, useState } from 'react'
import type { AssembledElement } from '../api/types'

interface Props {
  assembled: AssembledElement[]
  selectedGuid: string | null
  onSelectGuid: (guid: string | null) => void
}

type ViewMode = 'matched' | 'unmatched'

function fmt(n: number | null, d = 2): string {
  if (n === null) return '—'
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: d })
}

function distinct(values: (string | null | undefined)[]): string {
  const s = [...new Set(values.filter(Boolean) as string[])].sort()
  return s.length ? s.join(', ') : '—'
}

// ── Unmatched view — grouped by IFC type ─────────────────────────────────────

interface UnmatchedGroup {
  ifc_type: string
  count: number
  typeNames: string
  materials: string
  externalCount: number
  internalCount: number
  elements: AssembledElement[]
}

function UnmatchedView({
  elements,
  search,
  selectedGuid,
  onSelectGuid,
}: {
  elements: AssembledElement[]
  search: string
  selectedGuid: string | null
  onSelectGuid: (guid: string | null) => void
}) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return elements
    return elements.filter(el =>
      el.ifc_type.toLowerCase().includes(q) ||
      el.name.toLowerCase().includes(q) ||
      (el.type_name ?? '').toLowerCase().includes(q) ||
      (el.material ?? '').toLowerCase().includes(q) ||
      el.storey.toLowerCase().includes(q)
    )
  }, [elements, search])

  const groups = useMemo((): UnmatchedGroup[] => {
    const map = new Map<string, AssembledElement[]>()
    for (const el of filtered) {
      const arr = map.get(el.ifc_type) ?? []
      arr.push(el)
      map.set(el.ifc_type, arr)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ifc_type, els]) => ({
        ifc_type,
        count: els.length,
        typeNames: distinct(els.map(e => e.type_name)),
        materials: distinct(els.map(e => e.material)),
        externalCount: els.filter(e => e.is_external).length,
        internalCount: els.filter(e => !e.is_external).length,
        elements: els,
      }))
  }, [filtered])

  const toggle = (type: string) =>
    setExpandedTypes(prev => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-gray-400">
        {search ? 'No unmatched elements match that search.' : 'Every element has at least one matching assembly recipe.'}
      </div>
    )
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead className="sticky top-0 bg-gray-50 z-10 text-xs text-gray-500 font-medium">
        <tr>
          <th className="text-left px-4 py-2 w-7" />
          <th className="text-left px-3 py-2">IFC Type</th>
          <th className="text-left px-3 py-2">Count</th>
          <th className="text-left px-3 py-2">Type Names in model</th>
          <th className="text-left px-3 py-2">Materials in model</th>
          <th className="text-left px-3 py-2">Ext / Int</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {groups.map(group => {
          const expanded = expandedTypes.has(group.ifc_type)
          return (
            <>
              {/* Group header row */}
              <tr
                key={`g-${group.ifc_type}`}
                onClick={() => toggle(group.ifc_type)}
                className="cursor-pointer bg-orange-50/60 hover:bg-orange-100/60 transition-colors select-none"
              >
                <td className="px-4 py-2.5 text-orange-400 text-xs">
                  <span className="inline-block transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : '' }}>▶</span>
                </td>
                <td className="px-3 py-2.5 font-semibold text-orange-800 text-xs whitespace-nowrap">{group.ifc_type}</td>
                <td className="px-3 py-2.5 text-orange-700 font-medium">{group.count}</td>
                <td className="px-3 py-2.5 text-gray-600 text-xs max-w-[220px] truncate" title={group.typeNames}>
                  {group.typeNames}
                </td>
                <td className="px-3 py-2.5 text-gray-600 text-xs max-w-[180px] truncate" title={group.materials}>
                  {group.materials}
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-500">
                  {group.externalCount > 0 && (
                    <span className="mr-1.5 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{group.externalCount} ext</span>
                  )}
                  {group.internalCount > 0 && (
                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{group.internalCount} int</span>
                  )}
                </td>
              </tr>

              {/* Individual elements within this type */}
              {expanded && group.elements.map(el => {
                const isSelected = selectedGuid === el.guid
                return (
                  <tr
                    key={`u-${el.guid}`}
                    onClick={() => onSelectGuid(isSelected ? null : el.guid)}
                    className={`cursor-pointer text-xs transition-colors ${
                      isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-1.5" />
                    <td className="px-3 py-1.5 text-gray-400 pl-7">↳</td>
                    <td className="px-3 py-1.5 text-gray-500" />
                    <td className="px-3 py-1.5 text-gray-700 max-w-[220px] truncate" title={el.name}>
                      {el.type_name || el.name || '—'}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500">{el.material || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-400">
                      {el.storey}
                      {el.is_external && (
                        <span className="ml-1.5 bg-amber-100 text-amber-700 px-1 py-0.5 rounded">ext</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ComponentsTable({ assembled, selectedGuid, onSelectGuid }: Props) {
  const [search, setSearch]           = useState('')
  const [mode, setMode]               = useState<ViewMode>('matched')
  const [expandedGuids, setExpandedGuids] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded]     = useState(false)

  const withComponents = useMemo(() => assembled.filter(el => el.components.length > 0), [assembled])
  const noComponents   = useMemo(() => assembled.filter(el => el.components.length === 0), [assembled])

  const filteredMatched = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return withComponents
    return withComponents.filter(el =>
      el.ifc_type.toLowerCase().includes(q) ||
      el.name.toLowerCase().includes(q) ||
      (el.type_name ?? '').toLowerCase().includes(q) ||
      el.storey.toLowerCase().includes(q) ||
      el.components.some(
        c => c.name.toLowerCase().includes(q) || (c.code ?? '').toLowerCase().includes(q)
      )
    )
  }, [withComponents, search])

  const totalComponents = useMemo(
    () => assembled.reduce((s, el) => s + el.components.length, 0),
    [assembled]
  )

  const toggleExpand = (guid: string) => {
    setExpandedGuids(prev => {
      const next = new Set(prev)
      next.has(guid) ? next.delete(guid) : next.add(guid)
      return next
    })
  }

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedGuids(new Set())
      setAllExpanded(false)
    } else {
      setExpandedGuids(new Set(filteredMatched.map(el => el.guid)))
      setAllExpanded(true)
    }
  }

  const isExpanded = (guid: string) => allExpanded || expandedGuids.has(guid)

  const modeBtnCls = (m: ViewMode) =>
    `px-3 py-1 text-xs font-medium rounded transition-colors ${
      mode === m
        ? m === 'unmatched'
          ? 'bg-orange-500 text-white'
          : 'bg-blue-600 text-white'
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`

  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded-lg border border-gray-200">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
        {/* Mode toggle */}
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => setMode('matched')} className={modeBtnCls('matched')}>
            Matched ({withComponents.length})
          </button>
          <button onClick={() => setMode('unmatched')} className={modeBtnCls('unmatched')}>
            No recipe ({noComponents.length})
            {noComponents.length > 0 && mode !== 'unmatched' && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-orange-400 inline-block align-middle" />
            )}
          </button>
        </div>

        <input
          type="text"
          placeholder={mode === 'matched' ? 'Search elements or components…' : 'Search unmatched elements…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />

        {mode === 'matched' && (
          <>
            <button
              onClick={toggleAll}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
            >
              {allExpanded ? 'Collapse all' : 'Expand all'}
            </button>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {filteredMatched.length} elements · {totalComponents} components
            </span>
          </>
        )}

        {mode === 'unmatched' && (
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {noComponents.length} elements need recipes
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {mode === 'unmatched' ? (
          <UnmatchedView
            elements={noComponents}
            search={search}
            selectedGuid={selectedGuid}
            onSelectGuid={onSelectGuid}
          />
        ) : (
          <>
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="text-xs text-gray-500 font-medium">
                  <th className="text-left px-4 py-2 w-7" />
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Element</th>
                  <th className="text-left px-3 py-2">Storey</th>
                  <th className="text-left px-3 py-2">Assembly</th>
                  <th className="text-left px-3 py-2">Code</th>
                  <th className="text-left px-3 py-2">Component</th>
                  <th className="text-right px-3 py-2">Qty</th>
                  <th className="text-left px-3 py-2">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredMatched.map(el => {
                  const expanded = isExpanded(el.guid)
                  const isSelected = selectedGuid === el.guid
                  return (
                    <>
                      <tr
                        key={`el-${el.guid}`}
                        onClick={() => { onSelectGuid(isSelected ? null : el.guid); toggleExpand(el.guid) }}
                        className={`cursor-pointer select-none transition-colors ${
                          isSelected ? 'bg-blue-50' : 'bg-gray-50/80 hover:bg-gray-100'
                        }`}
                      >
                        <td className="px-4 py-2 text-gray-400 text-xs">
                          <span className="inline-block transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : '' }}>▶</span>
                        </td>
                        <td className="px-3 py-2 font-medium text-blue-700 text-xs whitespace-nowrap">{el.ifc_type}</td>
                        <td className="px-3 py-2 text-gray-800 max-w-[200px] truncate" title={el.name}>
                          {el.name || '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{el.storey}</td>
                        <td className="px-3 py-2" colSpan={4}>
                          <span className="text-xs text-gray-400">
                            {el.components.length} component{el.components.length !== 1 ? 's' : ''}
                            {el.is_external && (
                              <span className="ml-2 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px]">external</span>
                            )}
                          </span>
                        </td>
                      </tr>

                      {expanded && el.components.map((comp, i) => (
                        <tr
                          key={`comp-${el.guid}-${i}`}
                          className={`text-xs ${isSelected ? 'bg-blue-50/50' : 'bg-white hover:bg-gray-50'}`}
                        >
                          <td className="px-4 py-1.5" />
                          <td className="px-3 py-1.5 text-gray-400 text-[10px] italic">{comp.assembly_label}</td>
                          <td className="px-3 py-1.5 text-gray-500" colSpan={2} />
                          <td className="px-3 py-1.5 text-gray-500">{comp.assembly_label}</td>
                          <td className="px-3 py-1.5 font-mono text-gray-500">{comp.code ?? '—'}</td>
                          <td className="px-3 py-1.5 text-gray-700">
                            {comp.name}
                            {comp.notes && (
                              <span className="ml-1 text-gray-400 italic" title={comp.notes}>ⓘ</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right font-medium tabular-nums text-gray-900">
                            {fmt(comp.quantity)}
                          </td>
                          <td className="px-3 py-1.5 text-gray-500">{comp.unit}</td>
                        </tr>
                      ))}
                    </>
                  )
                })}
              </tbody>
            </table>

            {filteredMatched.length === 0 && (
              <div className="flex items-center justify-center h-32 text-sm text-gray-400">
                {search ? 'No matched elements found.' : 'No assembly recipes matched any elements in this model.'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
