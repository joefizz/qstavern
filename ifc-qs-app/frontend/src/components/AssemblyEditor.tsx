import { useEffect, useState } from 'react'
import { getAssemblyLibrary, saveAssemblyLibrary } from '../api/endpoints'
import type { AssemblyLibrary, AssemblyRecipe, LibraryComponent, MatchCriteria, MatchRule } from '../api/types'

const IFC_TYPES = [
  'IfcWall', 'IfcWallStandardCase', 'IfcSlab', 'IfcRoof',
  'IfcBeam', 'IfcColumn', 'IfcDoor', 'IfcWindow',
  'IfcStair', 'IfcStairFlight', 'IfcRailing', 'IfcCovering', 'IfcCurtainWall',
  'IfcPlate', 'IfcMember', 'IfcFooting', 'IfcPile',
]

const UNITS = ['m²', 'm³', 'lm', 'nr', 'kg', 'set', 'bag', 'tonne', 'hr']

// ── Field / operator metadata ─────────────────────────────────────────────────

const FIELD_OPTIONS = [
  { group: 'Element',     value: 'ifc_type',          label: 'IFC Type',        type: 'string'  },
  { group: 'Element',     value: 'name',               label: 'Name',            type: 'string'  },
  { group: 'Element',     value: 'type_name',          label: 'Type Name',       type: 'string'  },
  { group: 'Element',     value: 'type_class',         label: 'Type Class',      type: 'string'  },
  { group: 'Element',     value: 'material',           label: 'Material',        type: 'string'  },
  { group: 'Element',     value: 'storey',             label: 'Storey',          type: 'string'  },
  { group: 'Element',     value: 'is_external',        label: 'Is External',     type: 'boolean' },
  { group: 'Quantities',  value: 'quantities.area',    label: 'Area (m²)',       type: 'number'  },
  { group: 'Quantities',  value: 'quantities.length',  label: 'Length (m)',      type: 'number'  },
  { group: 'Quantities',  value: 'quantities.volume',  label: 'Volume (m³)',     type: 'number'  },
  { group: 'Quantities',  value: 'quantities.count',   label: 'Count',           type: 'number'  },
  { group: 'Quantities',  value: 'quantities.weight',  label: 'Weight (kg)',     type: 'number'  },
  { group: 'Property',    value: '__property__',        label: 'Property…',       type: 'property'},
] as const

type FieldType = 'string' | 'number' | 'boolean' | 'property'

const OPS: Record<FieldType, { value: string; label: string }[]> = {
  string: [
    { value: 'contains',     label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'equals',       label: 'equals' },
    { value: 'not_equals',   label: 'does not equal' },
    { value: 'starts_with',  label: 'starts with' },
    { value: 'ends_with',    label: 'ends with' },
  ],
  number: [
    { value: 'equals',    label: '=' },
    { value: 'not_equals',label: '≠' },
    { value: 'gt',        label: '>' },
    { value: 'gte',       label: '≥' },
    { value: 'lt',        label: '<' },
    { value: 'lte',       label: '≤' },
  ],
  boolean: [
    { value: 'equals',     label: 'is' },
    { value: 'not_equals', label: 'is not' },
  ],
  property: [
    { value: 'contains',     label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'equals',       label: 'equals' },
    { value: 'not_equals',   label: 'does not equal' },
  ],
}

function fieldType(fieldValue: string): FieldType {
  const f = FIELD_OPTIONS.find(o => o.value === fieldValue)
  return (f?.type ?? 'string') as FieldType
}

function defaultOp(ft: FieldType): string {
  return OPS[ft][0].value
}

function newRule(): MatchRule {
  return { field: 'material', op: 'contains', value: '' }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchSummary(match: MatchCriteria): string {
  const parts: string[] = []
  if (match.ifc_type)            parts.push(match.ifc_type)
  if (match.ifc_type_in?.length) parts.push(match.ifc_type_in.join(' or '))
  if (match.is_external === true)  parts.push('external')
  if (match.is_external === false) parts.push('internal')
  if (match.material_contains)   parts.push(`material contains "${match.material_contains}"`)
  if (match.type_name_contains)  parts.push(`type name contains "${match.type_name_contains}"`)
  for (const r of match.rules ?? []) {
    const fl = FIELD_OPTIONS.find(o => o.value === r.field || (o.value === '__property__' && r.field.startsWith('properties.')))
    const fieldLabel = r.field.startsWith('properties.') ? r.field.replace('properties.', 'prop: ') : (fl?.label ?? r.field)
    const opLabel = OPS[fieldType(r.field)]?.find(o => o.value === r.op)?.label ?? r.op
    parts.push(`${fieldLabel} ${opLabel} "${r.value}"`)
  }
  return parts.join(' · ') || 'matches all'
}

function newComponent(): LibraryComponent {
  return { code: '', name: '', unit: 'nr', formula: 'count', notes: '' }
}

function newRecipe(): AssemblyRecipe {
  return {
    id: `assembly_${Date.now()}`,
    label: 'New Assembly',
    match: { ifc_type: 'IfcWall' },
    components: [newComponent()],
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ComponentRow({
  comp,
  onChange,
  onDelete,
}: {
  comp: LibraryComponent
  onChange: (c: LibraryComponent) => void
  onDelete: () => void
}) {
  const inp = 'border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 w-full'
  return (
    <tr className="group">
      <td className="p-1">
        <input className={inp} value={comp.code ?? ''} placeholder="Code"
          onChange={e => onChange({ ...comp, code: e.target.value })} />
      </td>
      <td className="p-1">
        <input className={inp} value={comp.name} placeholder="Component name *"
          onChange={e => onChange({ ...comp, name: e.target.value })} />
      </td>
      <td className="p-1 w-24">
        <input className={inp} list="unit-list" value={comp.unit} placeholder="Unit"
          onChange={e => onChange({ ...comp, unit: e.target.value })} />
        <datalist id="unit-list">
          {UNITS.map(u => <option key={u} value={u} />)}
        </datalist>
      </td>
      <td className="p-1">
        <input className={`${inp} font-mono`} value={comp.formula} placeholder="e.g. area * 1.1"
          onChange={e => onChange({ ...comp, formula: e.target.value })} />
      </td>
      <td className="p-1">
        <input className={inp} value={comp.notes ?? ''} placeholder="Optional notes"
          onChange={e => onChange({ ...comp, notes: e.target.value })} />
      </td>
      <td className="p-1 w-8 text-center">
        <button onClick={onDelete}
          className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none"
          title="Delete component"
        >×</button>
      </td>
    </tr>
  )
}

function RuleRow({
  rule,
  onChange,
  onDelete,
}: {
  rule: MatchRule
  onChange: (r: MatchRule) => void
  onDelete: () => void
}) {
  const inp = 'border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 w-full'

  // Detect if it's a properties.* field
  const isProperty = rule.field.startsWith('properties.')
  const propKey = isProperty ? rule.field.replace('properties.', '') : ''
  const displayField = isProperty ? '__property__' : rule.field
  const ft = fieldType(rule.field)
  const ops = OPS[ft]

  const handleFieldChange = (val: string) => {
    if (val === '__property__') {
      onChange({ field: 'properties.', op: 'contains', value: '' })
    } else {
      const newFt = fieldType(val)
      onChange({ field: val, op: defaultOp(newFt), value: newFt === 'boolean' ? 'true' : '' })
    }
  }

  const handlePropKeyChange = (key: string) => {
    onChange({ ...rule, field: `properties.${key}` })
  }

  return (
    <tr className="group">
      {/* Field selector */}
      <td className="p-1 w-44">
        <select className={inp} value={displayField} onChange={e => handleFieldChange(e.target.value)}>
          {(['Element', 'Quantities', 'Property'] as const).map(group => (
            <optgroup key={group} label={group}>
              {FIELD_OPTIONS.filter(o => o.group === group).map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </td>

      {/* Property key input (only shown for properties.* fields) */}
      {isProperty && (
        <td className="p-1 w-32">
          <input
            className={inp}
            value={propKey}
            placeholder="property key"
            onChange={e => handlePropKeyChange(e.target.value)}
          />
        </td>
      )}

      {/* Operator */}
      <td className={`p-1 ${isProperty ? 'w-36' : 'w-44'}`}>
        <select className={inp} value={rule.op} onChange={e => onChange({ ...rule, op: e.target.value })}>
          {ops.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>

      {/* Value */}
      <td className="p-1">
        {ft === 'boolean' ? (
          <select className={inp} value={String(rule.value)} onChange={e => onChange({ ...rule, value: e.target.value === 'true' })}>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : ft === 'number' ? (
          <input
            type="number"
            step="any"
            className={inp}
            value={rule.value as number}
            onChange={e => onChange({ ...rule, value: parseFloat(e.target.value) || 0 })}
          />
        ) : (
          <input
            className={inp}
            value={rule.value as string}
            placeholder="value"
            onChange={e => onChange({ ...rule, value: e.target.value })}
          />
        )}
      </td>

      {/* Delete */}
      <td className="p-1 w-7 text-center">
        <button
          onClick={onDelete}
          className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-base leading-none"
        >×</button>
      </td>
    </tr>
  )
}

function MatchEditor({
  match,
  onChange,
}: {
  match: MatchCriteria
  onChange: (m: MatchCriteria) => void
}) {
  const inp = 'border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 w-full'

  const multiMode = !!match.ifc_type_in
  const toggleMode = () => {
    if (multiMode) {
      onChange({ ...match, ifc_type: match.ifc_type_in?.[0] ?? 'IfcWall', ifc_type_in: undefined })
    } else {
      onChange({ ...match, ifc_type_in: match.ifc_type ? [match.ifc_type] : ['IfcWall'], ifc_type: undefined })
    }
  }

  const rules = match.rules ?? []
  const setRules = (r: MatchRule[]) => onChange({ ...match, rules: r.length ? r : undefined })
  const addRule    = () => setRules([...rules, newRule()])
  const updateRule = (i: number, r: MatchRule) => setRules(rules.map((x, j) => j === i ? r : x))
  const deleteRule = (i: number) => setRules(rules.filter((_, j) => j !== i))

  return (
    <div className="space-y-3 text-sm">
      {/* Row 1 — IFC type + is_external */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">IFC Type</span>
            <button onClick={toggleMode} className="text-[10px] text-blue-500 hover:underline">
              {multiMode ? 'single type' : 'multiple types'}
            </button>
          </div>
          {multiMode ? (
            <div className="space-y-1">
              {(match.ifc_type_in ?? []).map((t, i) => (
                <div key={i} className="flex gap-1">
                  <select className={inp} value={t} onChange={e => {
                    const u = [...(match.ifc_type_in ?? [])]
                    u[i] = e.target.value
                    onChange({ ...match, ifc_type_in: u })
                  }}>
                    {IFC_TYPES.map(type => <option key={type}>{type}</option>)}
                  </select>
                  <button onClick={() => {
                    const u = (match.ifc_type_in ?? []).filter((_, j) => j !== i)
                    onChange({ ...match, ifc_type_in: u.length ? u : ['IfcWall'] })
                  }} className="text-red-400 hover:text-red-600 px-1">×</button>
                </div>
              ))}
              <button onClick={() => onChange({ ...match, ifc_type_in: [...(match.ifc_type_in ?? []), 'IfcWall'] })}
                className="text-xs text-blue-500 hover:underline">+ add type</button>
            </div>
          ) : (
            <select className={inp} value={match.ifc_type ?? ''}
              onChange={e => onChange({ ...match, ifc_type: e.target.value || undefined })}>
              <option value="">(any type)</option>
              {IFC_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          )}
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Is External</label>
          <select className={inp}
            value={match.is_external === undefined ? '' : String(match.is_external)}
            onChange={e => {
              const v = e.target.value
              onChange({ ...match, is_external: v === '' ? undefined : v === 'true' })
            }}>
            <option value="">Any</option>
            <option value="true">External only</option>
            <option value="false">Internal only</option>
          </select>
        </div>
      </div>

      {/* Conditions table */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-gray-600">Conditions</span>
          <span className="text-[10px] text-gray-400">All conditions must match (AND logic)</span>
        </div>

        {rules.length > 0 && (
          <div className="border border-gray-200 rounded overflow-x-auto mb-1.5">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left p-1.5 font-medium">Field</th>
                  <th className="text-left p-1.5 font-medium">Operator</th>
                  <th className="text-left p-1.5 font-medium">Value</th>
                  <th className="w-7" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map((rule, i) => (
                  <RuleRow
                    key={i}
                    rule={rule}
                    onChange={r => updateRule(i, r)}
                    onDelete={() => deleteRule(i)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={addRule} className="text-xs text-blue-600 hover:underline">
          + Add condition
        </button>

        {rules.length === 0 && (
          <p className="text-[10px] text-gray-400 ml-3 inline">
            — no extra conditions, matches on IFC type and Is External only
          </p>
        )}
      </div>
    </div>
  )
}

function RecipeCard({
  recipe,
  onUpdate,
  onDelete,
}: {
  recipe: AssemblyRecipe
  onUpdate: (r: AssemblyRecipe) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState<AssemblyRecipe>(recipe)

  const save = () => { onUpdate(draft); setEditing(false) }
  const cancel = () => { setDraft(recipe); setEditing(false) }

  const updateComp = (i: number, comp: LibraryComponent) => {
    const comps = [...draft.components]
    comps[i] = comp
    setDraft({ ...draft, components: comps })
  }
  const deleteComp = (i: number) => {
    setDraft({ ...draft, components: draft.components.filter((_, j) => j !== i) })
  }
  const addComp = () => {
    setDraft({ ...draft, components: [...draft.components, newComponent()] })
  }

  if (!editing) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
          <div>
            <span className="font-semibold text-gray-800">{recipe.label}</span>
            <span className="ml-2 text-xs font-mono text-gray-400">{recipe.id}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)}
              className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 transition-colors">
              Edit
            </button>
            <button onClick={onDelete}
              className="text-xs px-3 py-1 border border-red-200 text-red-500 rounded hover:bg-red-50 transition-colors">
              Delete
            </button>
          </div>
        </div>

        {/* Match criteria */}
        <div className="px-4 py-2 border-b border-gray-50">
          <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-2">Matches</span>
          <span className="text-xs text-gray-600">{matchSummary(recipe.match)}</span>
        </div>

        {/* Components preview */}
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 bg-gray-50/50">
              <th className="text-left px-4 py-1.5 font-medium">Code</th>
              <th className="text-left px-3 py-1.5 font-medium">Component</th>
              <th className="text-left px-3 py-1.5 font-medium">Unit</th>
              <th className="text-left px-3 py-1.5 font-mono font-medium">Formula</th>
              <th className="text-left px-3 py-1.5 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {recipe.components.map((comp, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-1.5 font-mono text-gray-500">{comp.code || '—'}</td>
                <td className="px-3 py-1.5 text-gray-700">{comp.name}</td>
                <td className="px-3 py-1.5 text-gray-500">{comp.unit}</td>
                <td className="px-3 py-1.5 font-mono text-blue-600">{comp.formula}</td>
                <td className="px-3 py-1.5 text-gray-400 italic">{comp.notes || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Edit mode
  return (
    <div className="bg-white border-2 border-blue-300 rounded-lg overflow-hidden shadow-md">
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
        <span className="font-semibold text-blue-800">Editing assembly</span>
        <div className="flex gap-2">
          <button onClick={save}
            className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
            Save
          </button>
          <button onClick={cancel}
            className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 transition-colors">
            Cancel
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Label & ID */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Label (display name)</label>
            <input
              className="border border-gray-200 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
              value={draft.label}
              onChange={e => setDraft({ ...draft, label: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">ID (unique key)</label>
            <input
              className="border border-gray-200 rounded px-2 py-1 text-sm w-full font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
              value={draft.id}
              onChange={e => setDraft({ ...draft, id: e.target.value })}
            />
          </div>
        </div>

        {/* Match criteria */}
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Match criteria</p>
          <MatchEditor match={draft.match} onChange={m => setDraft({ ...draft, match: m })} />
        </div>

        {/* Components table */}
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Components</p>
          <div className="border border-gray-200 rounded overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left p-2 w-28">Code</th>
                  <th className="text-left p-2">Name *</th>
                  <th className="text-left p-2 w-24">Unit</th>
                  <th className="text-left p-2">Formula *</th>
                  <th className="text-left p-2">Notes</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {draft.components.map((comp, i) => (
                  <ComponentRow
                    key={i}
                    comp={comp}
                    onChange={c => updateComp(i, c)}
                    onDelete={() => deleteComp(i)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addComp}
            className="mt-2 text-xs text-blue-600 hover:underline">
            + Add component
          </button>
          <p className="mt-1 text-[10px] text-gray-400">
            Formula variables: <code>area</code> (m²) · <code>length</code> (m) · <code>volume</code> (m³) · <code>count</code> · <code>weight</code> (kg)
            · Functions: <code>round()</code> <code>ceil()</code> <code>floor()</code>
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function AssemblyEditor() {
  const [library, setLibrary] = useState<AssemblyLibrary | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [dirty, setDirty]     = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [saved, setSaved]     = useState(false)

  useEffect(() => {
    setLoading(true)
    getAssemblyLibrary()
      .then(lib => { setLibrary(lib); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  const updateLibrary = (lib: AssemblyLibrary) => {
    setLibrary(lib)
    setDirty(true)
    setSaved(false)
  }

  const updateRecipe = (id: string, updated: AssemblyRecipe) => {
    if (!library) return
    updateLibrary({
      ...library,
      assemblies: library.assemblies.map(a => a.id === id ? updated : a),
    })
  }

  const deleteRecipe = (id: string) => {
    if (!library) return
    if (!confirm('Delete this assembly?')) return
    updateLibrary({ ...library, assemblies: library.assemblies.filter(a => a.id !== id) })
  }

  const addRecipe = () => {
    if (!library) return
    updateLibrary({ ...library, assemblies: [...library.assemblies, newRecipe()] })
  }

  const handleSave = async () => {
    if (!library) return
    setSaving(true)
    setError(null)
    try {
      await saveAssemblyLibrary(library)
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(`Save failed: ${e}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">
        Loading assembly library…
      </div>
    )
  }

  if (!library) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-red-500">
        {error ?? 'Failed to load library'}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg mb-4 flex-shrink-0">
        <div>
          <span className="font-semibold text-gray-800">Assembly Library</span>
          <span className="ml-2 text-xs text-gray-400">{library.assemblies.length} recipes</span>
          {dirty && <span className="ml-2 text-xs text-amber-500">· unsaved changes</span>}
          {saved && <span className="ml-2 text-xs text-green-600">· saved</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={addRecipe}
            className="text-sm px-4 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors">
            + New assembly
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save to server'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex-shrink-0">
          {error}
        </div>
      )}

      {/* Assembly list */}
      <div className="flex-1 overflow-auto min-h-0 space-y-3 pb-4">
        {library.assemblies.map(recipe => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onUpdate={updated => updateRecipe(recipe.id, updated)}
            onDelete={() => deleteRecipe(recipe.id)}
          />
        ))}
      </div>
    </div>
  )
}
