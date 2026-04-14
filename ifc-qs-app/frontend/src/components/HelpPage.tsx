/**
 * HelpPage — full documentation for QS Tavern.
 * Rendered when the URL hash is "#help" (opened in a new browser tab).
 */

import { useEffect, useState } from 'react'

// ── Section data ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'overview',        label: 'Overview' },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'dashboard',       label: 'Dashboard' },
  { id: 'schedule',        label: 'Schedule' },
  { id: 'assemblies',      label: 'Assemblies' },
  { id: 'assembly-library',label: '↳ Assembly Library' },
  { id: 'assembly-ref',    label: '↳ Match & Formula Ref' },
  { id: 'ifc-tree',        label: 'IFC Tree' },
  { id: 'viewer',          label: '3D Viewer' },
  { id: 'export',          label: 'Export' },
]

// ── Typography helpers ────────────────────────────────────────────────────────

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-2xl font-bold text-gray-900 mt-12 mb-4 pb-2 border-b border-gray-200 scroll-mt-6">
      {children}
    </h2>
  )
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-gray-800 mt-6 mb-2">{children}</h3>
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-600 leading-relaxed mb-3">{children}</p>
}
function Code({ children }: { children: React.ReactNode }) {
  return <code className="bg-gray-100 text-blue-700 rounded px-1.5 py-0.5 text-sm font-mono">{children}</code>
}
function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-gray-900 text-green-300 rounded-lg p-4 text-sm font-mono overflow-x-auto mb-4 leading-relaxed">
      {children}
    </pre>
  )
}
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 px-4 py-3 rounded-r mb-4 text-sm text-blue-800">
      <span className="font-semibold">Tip: </span>{children}
    </div>
  )
}
function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 px-4 py-3 rounded-r mb-4 text-sm text-amber-800">
      <span className="font-semibold">Note: </span>{children}
    </div>
  )
}

function Table({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border-collapse border border-gray-200 rounded">
        <thead>
          <tr className="bg-gray-50">
            {head.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 border border-gray-200 font-semibold text-gray-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-t border-gray-100 hover:bg-gray-50">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 border border-gray-100 text-gray-600">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function HelpPage() {
  const [activeSection, setActiveSection] = useState('overview')

  // Highlight active nav item as user scrolls
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar nav */}
      <nav className="w-52 flex-shrink-0 sticky top-0 h-screen overflow-y-auto bg-white border-r border-gray-200 py-8 px-4">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">QS Tavern</p>
          <p className="text-xs text-gray-400">Documentation</p>
        </div>
        <ul className="space-y-0.5">
          {SECTIONS.map(s => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={`block px-3 py-1.5 rounded text-sm transition-colors ${
                  s.label.startsWith('↳') ? 'pl-6 text-xs' : ''
                } ${
                  activeSection === s.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {s.label.replace('↳ ', '')}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-3xl mx-auto px-10 py-10">

        {/* ── Overview ── */}
        <H2 id="overview">Overview</H2>
        <P>
          QS Tavern is a quantity surveying tool for IFC (Industry Foundation Classes) building models.
          Upload an IFC file, extract element quantities automatically, then build out a full Bill of Materials
          by attaching assembly recipes that calculate derived components — screws, fixings, cladding, linings,
          and anything else not captured directly in the model.
        </P>
        <P>
          The workflow is: <strong>Upload → Process → Review quantities → Build assembly recipes → Export BOM.</strong>
        </P>
        <Table
          head={['Tab', 'Purpose']}
          rows={[
            ['Dashboard',   'Stat cards and charts — area by type, volume by storey'],
            ['Schedule',    'Filterable element table with full quantity and property data'],
            ['Assemblies',  'Component breakdown per element, Bill of Materials, and Library editor'],
            ['IFC Tree',    'Spatial hierarchy — Project → Site → Building → Storey → Elements'],
            ['3D View',     'Interactive 3D model with element selection and ghost mode'],
          ]}
        />

        {/* ── Getting Started ── */}
        <H2 id="getting-started">Getting Started</H2>
        <H3>Uploading a file</H3>
        <P>
          Drag and drop an <Code>.ifc</Code> file onto the upload zone, or click to browse.
          Files up to 200 MB are accepted. The app detects duplicate files by SHA-256 hash
          and will offer to open the existing copy rather than re-process.
        </P>
        <H3>Processing</H3>
        <P>
          Processing streams progress via Server-Sent Events. The backend:
        </P>
        <ul className="list-disc pl-6 mb-4 text-gray-600 text-sm space-y-1">
          <li>Reads the spatial structure (project → storeys)</li>
          <li>Extracts element quantities from <Code>IfcElementQuantity</Code> (BaseQuantities) where available</li>
          <li>Falls back to bounding-box geometry estimation where BaseQuantities are absent</li>
          <li>Reads material associations, type names, and all Pset properties</li>
          <li>Caches results to disk — subsequent opens load instantly</li>
        </ul>
        <Note>
          Quantity source is shown as a badge on each element: <strong>green = authored</strong> (from IFC
          BaseQuantities), <strong>amber = estimated</strong> (from geometry bounding box). Estimated values
          are less precise and should be treated as indicative only.
        </Note>
        <H3>Supported IFC types</H3>
        <P>
          IfcWall, IfcWallStandardCase, IfcSlab, IfcRoof, IfcBeam, IfcColumn, IfcDoor, IfcWindow,
          IfcStair, IfcStairFlight, IfcRailing, IfcCovering, IfcCurtainWall, IfcPlate, IfcMember,
          IfcFooting, IfcPile, and more. Both IFC2x3 and IFC4 schemas are handled.
        </P>

        {/* ── Dashboard ── */}
        <H2 id="dashboard">Dashboard</H2>
        <P>
          Shows four stat cards (total elements, storeys, total area, total volume) and two bar charts:
          area summed by IFC type, and volume summed by storey. Use the dashboard for a quick sanity
          check that the model has been read correctly before diving into the schedule.
        </P>

        {/* ── Schedule ── */}
        <H2 id="schedule">Schedule</H2>
        <P>
          A sortable, filterable table of all extracted elements. Each row represents one IFC element.
        </P>
        <H3>Columns</H3>
        <Table
          head={['Column', 'Description']}
          rows={[
            ['IFC Type',    'IFC class — e.g. IfcWall, IfcDoor'],
            ['Name',        'Element name from the IFC file'],
            ['Product Type','Type name from IfcRelDefinesByType (e.g. "200mm Concrete")'],
            ['Storey',      'Containing building storey'],
            ['Material',    'Material name(s) from IfcRelAssociatesMaterial'],
            ['Area (m²)',   'Net area in square metres'],
            ['Volume (m³)', 'Net volume in cubic metres'],
            ['Length (m)',  'Length or height in metres'],
            ['Source',      '"authored" = from IFC BaseQuantities; "estimated" = bounding box'],
            ['External',    'Whether the element is marked as external in the model'],
          ]}
        />
        <H3>Filters</H3>
        <P>
          Use the filter bar above the table to narrow by name/type search, IFC class, storey, material,
          source, or external flag. Multiple filters combine with AND logic. A count shows how many elements
          pass the current filters. Click <strong>Clear filters</strong> to reset.
        </P>
        <H3>Element detail panel</H3>
        <P>
          Click any row to open the detail panel on the right. It shows identity, location, all quantity
          values with their source badge, and every Pset property extracted from the model.
          Click the row again or press <Code>×</Code> to close it.
        </P>
        <Tip>
          Enable <strong>Show 3D</strong> (top right of the tab bar) to open the 3D viewer alongside the
          schedule. Selecting an element in either panel highlights it in the other.
        </Tip>

        {/* ── Assemblies ── */}
        <H2 id="assemblies">Assemblies</H2>
        <P>
          The Assemblies tab extends the raw IFC quantities with <em>assembly recipes</em>: rules that
          match elements and calculate derived sub-components. For example, a wall might yield
          cladding boards, screws, building wrap, and battens — none of which are in the IFC file itself.
        </P>
        <P>
          The tab has three sub-views:
        </P>

        <H3>Components</H3>
        <P>
          Shows every element grouped with its matched sub-components. Click an element row to expand its
          component list. Use the search box to filter by element or component name.
        </P>
        <P>
          Toggle between <strong>Matched</strong> and <strong>No recipe</strong> using the buttons in the toolbar:
        </P>
        <ul className="list-disc pl-6 mb-4 text-gray-600 text-sm space-y-1">
          <li><strong>Matched</strong> — elements that have at least one matching assembly recipe, with their derived components</li>
          <li>
            <strong>No recipe</strong> — elements with no matching recipe, grouped by IFC type.
            Each type group shows the distinct type names, materials, and external/internal split present
            in the model — exactly the information you need to write a new recipe.
          </li>
        </ul>
        <Tip>
          Start by switching to <strong>No recipe</strong> to see what still needs assembly coverage.
          The grouped view shows distinct type names and materials, making it easy to write precise match criteria.
        </Tip>

        <H3>Bill of Materials</H3>
        <P>
          Rolls up all component quantities across the entire model into a single table sorted by item code.
          Each row shows the total quantity of that component across all matched elements.
          A per-unit totals footer appears at the bottom.
          Click any column header to sort. Use the search box to filter by name, code, unit, or assembly.
        </P>

        <H3>Assembly Library</H3>
        <P>See the <a href="#assembly-library" className="text-blue-600 hover:underline">Assembly Library</a> section below.</P>

        {/* ── Assembly Library ── */}
        <H2 id="assembly-library">Assembly Library</H2>
        <P>
          The library is a set of <em>assembly recipes</em> stored in <Code>assembly_library.json</Code> on
          the server. Each recipe defines match criteria (which elements it applies to) and a list of
          components with quantity formulas.
        </P>
        <H3>Editing recipes</H3>
        <P>
          Go to <strong>Assemblies → Assembly Library</strong>. Each recipe is shown as a card.
          Click <strong>Edit</strong> to open the inline editor. When done, click <strong>Save</strong>
          on the card, then <strong>Save to server</strong> in the top bar to persist and hot-reload.
          The server reloads the library immediately — no container restart required.
        </P>
        <H3>Creating a new recipe</H3>
        <ol className="list-decimal pl-6 mb-4 text-gray-600 text-sm space-y-1">
          <li>Click <strong>+ New assembly</strong> in the top bar</li>
          <li>Give it a label (display name) and a unique ID (snake_case, no spaces)</li>
          <li>Set the IFC type and Is External filters</li>
          <li>Add any extra conditions (material, name, quantities, Pset properties)</li>
          <li>Add component rows — each with a code, name, unit, and formula</li>
          <li>Click <strong>Save</strong> on the card, then <strong>Save to server</strong></li>
        </ol>
        <H3>Match criteria</H3>
        <P>
          Every condition in a recipe must be satisfied for the recipe to apply to an element (AND logic).
          Conditions are split into two areas:
        </P>
        <ul className="list-disc pl-6 mb-4 text-gray-600 text-sm space-y-1">
          <li><strong>IFC Type</strong> — select one type or multiple types from the dropdown</li>
          <li><strong>Is External</strong> — Any / External only / Internal only</li>
          <li><strong>Conditions table</strong> — one row per additional condition: Field → Operator → Value</li>
        </ul>
        <Note>
          Design recipes to be non-overlapping where needed. For example, use two recipes for doors
          (one with "Is External = External only", one with "Internal only") rather than one recipe
          that matches all doors, so you can have different component lists.
        </Note>

        {/* ── Assembly Reference ── */}
        <H2 id="assembly-ref">Match &amp; Formula Reference</H2>

        <H3>Match fields</H3>
        <Table
          head={['Field', 'Type', 'Description', 'Example value']}
          rows={[
            [<Code>ifc_type</Code>,           'string',  'IFC class (exact)', 'IfcWall'],
            [<Code>name</Code>,               'string',  'Element name from IFC', 'Basic Wall:200mm Concrete'],
            [<Code>type_name</Code>,          'string',  'Product type name from IfcRelDefinesByType', '150mm Weatherboard'],
            [<Code>type_class</Code>,         'string',  'Product type class', 'IfcWallType'],
            [<Code>material</Code>,           'string',  'Material name(s)', 'Concrete, Insulation'],
            [<Code>storey</Code>,             'string',  'Building storey name', 'Level 1'],
            [<Code>is_external</Code>,        'boolean', 'External element flag', 'true / false'],
            [<Code>quantities.area</Code>,    'number',  'Net area in m²', '12.5'],
            [<Code>quantities.length</Code>,  'number',  'Length/height in m', '3.0'],
            [<Code>quantities.volume</Code>,  'number',  'Net volume in m³', '1.25'],
            [<Code>quantities.count</Code>,   'number',  'Always 1 per element', '1'],
            [<Code>quantities.weight</Code>,  'number',  'Weight in kg (if authored)', '450.0'],
            [<Code>properties.&lt;key&gt;</Code>, 'any', 'Any Pset property — use the exact key name from the IFC', 'LoadBearing → true'],
          ]}
        />

        <H3>Match operators</H3>
        <Table
          head={['Operator', 'Applies to', 'Description']}
          rows={[
            ['contains',       'string, property', 'Value is a substring (case-insensitive)'],
            ['does not contain','string, property', 'Value is NOT a substring (case-insensitive)'],
            ['equals',         'string, number, boolean', 'Exact match (strings: case-insensitive)'],
            ['does not equal', 'string, number, boolean', 'Not an exact match'],
            ['starts with',    'string', 'Field starts with the given prefix (case-insensitive)'],
            ['ends with',      'string', 'Field ends with the given suffix (case-insensitive)'],
            ['> (gt)',         'number', 'Field is strictly greater than value'],
            ['≥ (gte)',        'number', 'Field is greater than or equal to value'],
            ['< (lt)',         'number', 'Field is strictly less than value'],
            ['≤ (lte)',        'number', 'Field is less than or equal to value'],
          ]}
        />

        <H3>Formula variables</H3>
        <P>
          Component quantities are calculated by evaluating a formula against the matched element's
          quantity values. The following variables are available:
        </P>
        <Table
          head={['Variable', 'Unit', 'Description']}
          rows={[
            [<Code>area</Code>,   'm²', 'Net area (0 if not available)'],
            [<Code>length</Code>, 'm',  'Length or height (0 if not available)'],
            [<Code>volume</Code>, 'm³', 'Net volume (0 if not available)'],
            [<Code>count</Code>,  'nr', 'Always 1 (one formula run per element)'],
            [<Code>weight</Code>, 'kg', 'Weight (0 if not available)'],
          ]}
        />
        <H3>Formula functions</H3>
        <Table
          head={['Function', 'Example', 'Description']}
          rows={[
            [<Code>round(x)</Code>,     'round(area * 12)',       'Round to nearest integer'],
            [<Code>ceil(x)</Code>,      'ceil(length / 1.2)',     'Round up to next integer'],
            [<Code>floor(x)</Code>,     'floor(volume * 10)',     'Round down to next integer'],
            [<Code>max(a, b)</Code>,    'max(count, 1)',          'Larger of two values'],
            [<Code>min(a, b)</Code>,    'min(area * 3, 50)',      'Smaller of two values'],
          ]}
        />
        <H3>Example formulas</H3>
        <Pre>{`area * 1.10          # area with 10% waste factor
round(area * 12)     # 12 per m², rounded to whole number
count * 3            # 3 per element
count * 3 * 4        # 4 screws per hinge × 3 hinges per door
length * count * 1.05  # length with 5% waste
round(area / 0.64)   # one item per 0.64 m² (e.g. bar chairs at 800mm grid)
ceil(length / 1.2) + 1  # posts at 1200mm centres plus one end post`}</Pre>

        <H3>Example recipe (JSON)</H3>
        <P>
          This is what a recipe looks like in the JSON file. You can also edit the JSON directly
          if you prefer — the server hot-reloads it via the <Code>POST /api/assembly-library/reload</Code> endpoint.
        </P>
        <Pre>{`{
  "id": "ext_wall_weatherboard",
  "label": "External Weatherboard Wall",
  "match": {
    "ifc_type_in": ["IfcWall", "IfcWallStandardCase"],
    "is_external": true,
    "rules": [
      { "field": "material", "op": "contains", "value": "weatherboard" },
      { "field": "quantities.area", "op": "gte", "value": 2.0 }
    ]
  },
  "components": [
    { "code": "CLG-WB-150", "name": "Weatherboard 150mm",
      "unit": "m²", "formula": "area * 1.10", "notes": "10% waste" },
    { "code": "SCW-50-8G",  "name": "Cladding screw 50mm 8g SS",
      "unit": "nr", "formula": "round(area * 12)" },
    { "code": "BLD-WRP",    "name": "Building wrap",
      "unit": "m²", "formula": "area * 1.05" }
  ]
}`}</Pre>

        {/* ── IFC Tree ── */}
        <H2 id="ifc-tree">IFC Tree</H2>
        <P>
          Shows the full spatial hierarchy extracted from the IFC file:
          Project → Site → Building → Building Storey → Elements.
          Expand any node by clicking it. Use the search box to filter by name or type —
          all ancestor nodes of a matching element are automatically expanded.
        </P>
        <P>
          Clicking a leaf element (an actual building element) selects it and opens the detail panel,
          the same way row selection works in the Schedule tab.
          Element type icons help distinguish walls, doors, windows, slabs, and so on at a glance.
        </P>
        <Tip>
          Enable <strong>Show 3D</strong> to see the selected element highlighted in the 3D viewer
          alongside the tree.
        </Tip>

        {/* ── 3D Viewer ── */}
        <H2 id="viewer">3D Viewer</H2>
        <P>
          An interactive Three.js 3D view of the building model. The viewer can be used standalone
          (the <strong>3D View</strong> tab) or as a split panel alongside the Schedule and IFC Tree tabs.
        </P>
        <H3>Controls</H3>
        <Table
          head={['Action', 'Control']}
          rows={[
            ['Orbit (rotate)',  'Left mouse drag'],
            ['Pan',            'Right mouse drag  or  Middle mouse drag'],
            ['Zoom',           'Scroll wheel'],
            ['Select element', 'Left click on a mesh'],
            ['Deselect',       'Click on empty space'],
          ]}
        />
        <H3>Ghost mode</H3>
        <P>
          When an element is selected, the <strong>Ghost mode</strong> button appears (top right of the viewer).
          While active, all non-selected elements are dimmed to 8% opacity so you can focus on the
          selected element in context. Toggle it off to see all elements at full opacity while keeping the selection.
          Ghost mode resets to on whenever the selection is cleared.
        </P>
        <H3>Element colours</H3>
        <P>
          Each IFC type is assigned a distinct colour — walls are cream, roofs are terracotta, beams are blue,
          columns are green, doors are brown, and so on. Windows and curtain walls are semi-transparent (35% opacity)
          to show depth. Selected elements turn bright blue.
        </P>
        <Note>
          Geometry is extracted and cached on first load. For large models this may take a minute.
          Subsequent loads use the disk cache and are near-instant.
        </Note>

        {/* ── Export ── */}
        <H2 id="export">Export</H2>
        <P>
          Three export formats are available from the header bar:
        </P>
        <Table
          head={['Button', 'Format', 'Contents']}
          rows={[
            ['CSV',       '.csv',  'All elements — one row per element with quantity columns'],
            ['XLSX',      '.xlsx', '3 sheets: Schedule (all elements) · By Type (totals) · By Storey (totals)'],
            ['Full XLSX', '.xlsx', '5 sheets: all of the above plus Components (per-element breakdown) · Bill of Materials (rolled-up BOM)'],
          ]}
        />
        <H3>XLSX columns (Schedule sheet)</H3>
        <Table
          head={['Column', 'Description']}
          rows={[
            ['guid',        'IFC GlobalId'],
            ['ifc_type',    'IFC class'],
            ['name',        'Element name'],
            ['type_name',   'Product type name'],
            ['storey',      'Building storey'],
            ['is_external', 'Boolean'],
            ['material',    'Material name(s)'],
            ['length_m',    'Length in metres'],
            ['area_m2',     'Area in m²'],
            ['volume_m3',   'Volume in m³'],
            ['count',       'Always 1'],
            ['weight_kg',   'Weight in kg (blank if not available)'],
            ['qty_source',  '"authored" or "estimated"'],
          ]}
        />
        <H3>Components sheet (Full XLSX only)</H3>
        <P>
          One row per component per element — links back to the element via <Code>element_guid</Code>.
          Columns: element_guid, element_type, element_name, storey, assembly, code, component, unit, quantity, notes.
        </P>
        <H3>Bill of Materials sheet (Full XLSX only)</H3>
        <P>
          One row per distinct component (by code + unit), with the total quantity summed across all matched elements.
          Columns: code, name, unit, total_quantity, assemblies.
        </P>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-gray-200 text-center text-xs text-gray-400">
          QS Tavern — IFC Quantity Surveying App
        </div>
      </main>
    </div>
  )
}
