import { useEffect, useState } from 'react'
import { getTree } from '../api/endpoints'
import type { ModelSummary, TreeNode } from '../api/types'
import { ElementDetailPanel } from './ElementDetailPanel'

interface Props {
  summary: ModelSummary
  selectedGuid?: string | null
  onSelectGuid?: (guid: string | null) => void
  showDetailPanel?: boolean
}

// ── Colours / icons ───────────────────────────────────────────────────────────

const TYPE_COLOURS: Record<string, string> = {
  IfcProject:          'text-violet-700 font-semibold',
  IfcSite:             'text-slate-600 font-medium',
  IfcBuilding:         'text-slate-700 font-medium',
  IfcBuildingStorey:   'text-blue-700 font-semibold',
  IfcSpace:            'text-sky-600',
  IfcWall:             'text-orange-700',
  IfcWallStandardCase: 'text-orange-700',
  IfcSlab:             'text-amber-700',
  IfcRoof:             'text-red-700',
  IfcBeam:             'text-yellow-700',
  IfcColumn:           'text-lime-700',
  IfcDoor:             'text-teal-700',
  IfcWindow:           'text-cyan-700',
  IfcStair:            'text-indigo-700',
  IfcRailing:          'text-purple-700',
  IfcCovering:         'text-pink-700',
  IfcCurtainWall:      'text-rose-700',
}

const TYPE_ICONS: Record<string, string> = {
  IfcProject:          '📐',
  IfcSite:             '🌍',
  IfcBuilding:         '🏢',
  IfcBuildingStorey:   '📊',
  IfcSpace:            '⬜',
  IfcWall:             '🧱',
  IfcWallStandardCase: '🧱',
  IfcSlab:             '▬',
  IfcRoof:             '🏠',
  IfcBeam:             '━',
  IfcColumn:           '|',
  IfcDoor:             '🚪',
  IfcWindow:           '🪟',
  IfcStair:            '🪜',
}

const SPATIAL_TYPES = new Set([
  'IfcProject', 'IfcSite', 'IfcBuilding', 'IfcBuildingStorey', 'IfcSpace',
])

function isSpatial(type: string) { return SPATIAL_TYPES.has(type) }

// ── Tree nodes ────────────────────────────────────────────────────────────────

function NodeRow({
  node,
  depth,
  defaultOpen,
  selectedGuid,
  onSelect,
}: {
  node: TreeNode
  depth: number
  defaultOpen: boolean
  selectedGuid: string | null
  onSelect: (guid: string) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const hasChildren = node.children.length > 0
  const colourClass = TYPE_COLOURS[node.type] ?? 'text-gray-700'
  const icon = TYPE_ICONS[node.type] ?? '◾'
  const label = node.name || node.type
  const spatial = isSpatial(node.type)
  const isSelected = node.guid === selectedGuid

  const spatialChildren = node.children.filter(c => isSpatial(c.type))
  const elementChildren = node.children.filter(c => !isSpatial(c.type))
  const elementGroups = elementChildren.reduce<Record<string, TreeNode[]>>((acc, c) => {
    ;(acc[c.type] ??= []).push(c)
    return acc
  }, {})

  const handleClick = () => {
    if (!spatial && node.guid) {
      onSelect(node.guid)
    } else if (hasChildren) {
      setOpen(o => !o)
    }
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-0.5 rounded cursor-pointer select-none ${
          isSelected ? 'bg-blue-50' : 'hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={handleClick}
      >
        <span
          className="w-4 text-xs text-gray-400 shrink-0"
          onClick={e => { e.stopPropagation(); if (hasChildren) setOpen(o => !o) }}
        >
          {hasChildren ? (open ? '▾' : '▸') : ''}
        </span>
        <span className="text-sm shrink-0">{icon}</span>
        <span className={`text-sm ${colourClass} truncate`}>{label}</span>
        {!spatial && (
          <span className="ml-1 text-xs text-gray-400 shrink-0">{node.type}</span>
        )}
        {spatial && hasChildren && (
          <span className="ml-auto mr-2 text-xs text-gray-400 shrink-0">
            {node.children.length}
          </span>
        )}
      </div>

      {open && hasChildren && (
        <div>
          {spatialChildren.map(child => (
            <NodeRow
              key={child.guid ?? child.type + child.name}
              node={child}
              depth={depth + 1}
              defaultOpen={depth < 2}
              selectedGuid={selectedGuid}
              onSelect={onSelect}
            />
          ))}
          {Object.entries(elementGroups).map(([type, items]) => (
            <GroupRow
              key={type}
              type={type}
              items={items}
              depth={depth + 1}
              selectedGuid={selectedGuid}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GroupRow({
  type,
  items,
  depth,
  selectedGuid,
  onSelect,
}: {
  type: string
  items: TreeNode[]
  depth: number
  selectedGuid: string | null
  onSelect: (guid: string) => void
}) {
  const [open, setOpen] = useState(false)
  const colourClass = TYPE_COLOURS[type] ?? 'text-gray-700'
  const icon = TYPE_ICONS[type] ?? '◾'

  return (
    <div>
      <div
        className="flex items-center gap-1 py-0.5 rounded hover:bg-gray-100 cursor-pointer select-none"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => setOpen(o => !o)}
      >
        <span className="w-4 text-xs text-gray-400 shrink-0">{open ? '▾' : '▸'}</span>
        <span className="text-sm shrink-0">{icon}</span>
        <span className={`text-sm font-medium ${colourClass}`}>{type}</span>
        <span className="ml-2 text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 shrink-0">
          {items.length}
        </span>
      </div>
      {open && items.map(item => (
        <NodeRow
          key={item.guid ?? item.type + item.name}
          node={item}
          depth={depth + 1}
          defaultOpen={false}
          selectedGuid={selectedGuid}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function IFCTree({
  summary,
  selectedGuid: externalGuid,
  onSelectGuid: externalOnSelect,
  showDetailPanel = true,
}: Props) {
  const [root, setRoot] = useState<TreeNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [internalGuid, setInternalGuid] = useState<string | null>(null)

  const selectedGuid  = externalGuid      !== undefined ? externalGuid      : internalGuid
  const setSelectedGuid = externalOnSelect !== undefined ? externalOnSelect  : setInternalGuid

  useEffect(() => {
    setLoading(true)
    getTree(summary.file_id)
      .then(setRoot)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [summary.file_id])

  function filterTree(node: TreeNode): TreeNode | null {
    if (!search) return node
    const q = search.toLowerCase()
    const filteredChildren = node.children.map(filterTree).filter(Boolean) as TreeNode[]
    const self = node.name.toLowerCase().includes(q) || node.type.toLowerCase().includes(q)
    return (self || filteredChildren.length > 0) ? { ...node, children: filteredChildren } : null
  }

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="text-sm text-gray-500">Loading IFC tree…</div>
    </div>
  )

  if (error || !root) return (
    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-2">
      Failed to load tree: {error}
    </p>
  )

  const displayRoot = filterTree(root)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by name or type…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-sm border border-gray-300 rounded px-3 py-1.5 w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-xs text-gray-400 hover:text-gray-600">
            Clear
          </button>
        )}
        {selectedGuid && (
          <p className="text-xs text-gray-400 ml-auto">Click an element to inspect it</p>
        )}
        {!selectedGuid && (
          <p className="text-xs text-gray-400 ml-auto">Click an element to inspect it</p>
        )}
      </div>

      <div className="flex gap-4 items-start">
        {/* Tree */}
        <div className="flex-1 bg-white border border-gray-200 rounded-lg p-3 font-mono text-sm overflow-auto max-h-[70vh]">
          {displayRoot ? (
            <NodeRow
              node={displayRoot}
              depth={0}
              defaultOpen={true}
              selectedGuid={selectedGuid}
              onSelect={setSelectedGuid}
            />
          ) : (
            <p className="text-gray-400 text-sm py-4 text-center">No matches</p>
          )}
        </div>

        {/* Detail panel — suppressed when 3D panel handles it */}
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
