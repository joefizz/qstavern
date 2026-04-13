export interface UploadResponse {
  file_id: string
  filename: string
  size_bytes: number
}

export interface ModelSummary {
  file_id: string
  project_name: string
  ifc_schema: string
  storeys: string[]
  element_count: number
}

export interface QuantityValues {
  length: number | null
  area: number | null
  volume: number | null
  count: number
  weight: number | null
  source: 'authored' | 'estimated'
}

export interface QuantityRecord {
  guid: string
  ifc_type: string
  name: string
  type_name: string | null
  type_class: string | null
  storey: string
  is_external: boolean
  material: string | null
  quantities: QuantityValues
  properties: Record<string, unknown>
}

export interface TreeNode {
  guid: string | null
  type: string
  name: string
  children: TreeNode[]
}

export interface GeometryMesh {
  guid: string
  type: string
  name: string
  verts: number[]   // flat [x,y,z, x,y,z, ...]
  faces: number[]   // flat triangle indices [i,j,k, ...]
  color: [number, number, number]  // RGB 0–1
  opacity: number
}

export interface FileRecord {
  file_id: string
  filename: string
  size_bytes: number
  uploaded_at: string   // ISO-8601
  is_processed: boolean // true if element cache exists (fast reload)
}

export interface AggregateRow {
  group_by: string
  group_value: string
  total_area: number | null
  total_volume: number | null
  total_length: number | null
  count: number
}

// ── Assembly Library ──────────────────────────────────────────────────────────

export interface AssemblyComponentResult {
  assembly_id: string
  assembly_label: string
  code: string | null
  name: string
  unit: string
  quantity: number
  notes: string | null
}

export interface AssembledElement extends QuantityRecord {
  components: AssemblyComponentResult[]
}

export interface BomRow {
  code: string
  name: string
  unit: string
  total_quantity: number
  assemblies: string
}

// Library editor types
export interface LibraryComponent {
  code?: string
  name: string
  unit: string
  formula: string
  notes?: string
}

export interface MatchCriteria {
  ifc_type?: string
  ifc_type_in?: string[]
  is_external?: boolean
  material_contains?: string
  type_name_contains?: string
}

export interface AssemblyRecipe {
  id: string
  label: string
  match: MatchCriteria
  components: LibraryComponent[]
}

export interface AssemblyLibrary {
  version: number
  notes?: string[]
  assemblies: AssemblyRecipe[]
}
