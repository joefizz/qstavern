import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { getGeometry } from '../api/endpoints'
import type { GeometryMesh, ModelSummary } from '../api/types'
import { ElementDetailPanel } from './ElementDetailPanel'

interface Props {
  summary: ModelSummary
  /** Controlled selection — lifted to parent for cross-tab sync */
  selectedGuid?: string | null
  onSelectGuid?: (guid: string | null) => void
  /** Compact panel mode: fills parent height, no full-viewport loading spinner */
  panelMode?: boolean
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function buildBufferGeometry(verts: number[], faces: number[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(verts), 3))
  geo.setIndex(new THREE.Uint32BufferAttribute(new Uint32Array(faces), 1))
  geo.computeVertexNormals()
  return geo
}

// ── Single element mesh ───────────────────────────────────────────────────────

function ElementMesh({
  mesh,
  isSelected,
  onClick,
}: {
  mesh: GeometryMesh
  isSelected: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  const geo = useMemo(
    () => buildBufferGeometry(mesh.verts, mesh.faces),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mesh.guid]
  )

  useEffect(() => () => { geo.dispose() }, [geo])

  const color = useMemo(() => {
    if (isSelected) return new THREE.Color(0.2, 0.55, 1.0)
    if (hovered) {
      return new THREE.Color(
        Math.min(1, mesh.color[0] * 1.25),
        Math.min(1, mesh.color[1] * 1.25),
        Math.min(1, mesh.color[2] * 1.25),
      )
    }
    return new THREE.Color(mesh.color[0], mesh.color[1], mesh.color[2])
  }, [isSelected, hovered, mesh.color])

  return (
    <mesh
      geometry={geo}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      <meshStandardMaterial
        color={color}
        opacity={isSelected ? 1 : mesh.opacity}
        transparent={!isSelected && mesh.opacity < 1}
        side={THREE.DoubleSide}
        depthWrite={isSelected || mesh.opacity >= 1}
      />
    </mesh>
  )
}

// ── Camera auto-setup ─────────────────────────────────────────────────────────

function CameraSetup({ dist }: { dist: number }) {
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(dist * 0.8, dist * 0.6, dist * 0.8)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, dist])
  return null
}

// ── Scene ─────────────────────────────────────────────────────────────────────

function Scene({
  meshes,
  selectedGuid,
  onSelect,
}: {
  meshes: GeometryMesh[]
  selectedGuid: string | null
  onSelect: (guid: string) => void
}) {
  const { groupPos, groupScale, camDist } = useMemo(() => {
    if (!meshes.length) return { groupPos: [0, 0, 0] as [number, number, number], groupScale: 1, camDist: 20 }

    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

    for (const m of meshes) {
      for (let i = 0; i < m.verts.length; i += 3) {
        const x = m.verts[i], y = m.verts[i + 1], z = m.verts[i + 2]
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
      }
    }

    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const cz = (minZ + maxZ) / 2
    const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1
    const s = 20 / size

    return {
      groupPos:   [-cx * s, -cz * s, cy * s] as [number, number, number],
      groupScale: s,
      camDist:    25,
    }
  }, [meshes])

  const opaque      = meshes.filter(m => m.opacity >= 1)
  const transparent = meshes.filter(m => m.opacity  < 1)

  return (
    <>
      <CameraSetup dist={camDist} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[15, 25, 10]} intensity={0.9} castShadow />
      <directionalLight position={[-10, -8, -6]} intensity={0.25} />

      {/* IFC is Z-up; rotate -90° around X → Three.js Y-up */}
      <group position={groupPos} scale={groupScale} rotation={[-Math.PI / 2, 0, 0]}>
        {opaque.map((m) => (
          <ElementMesh
            key={m.guid}
            mesh={m}
            isSelected={m.guid === selectedGuid}
            onClick={() => onSelect(m.guid)}
          />
        ))}
        {transparent.map((m) => (
          <ElementMesh
            key={m.guid}
            mesh={m}
            isSelected={m.guid === selectedGuid}
            onClick={() => onSelect(m.guid)}
          />
        ))}
      </group>

      <OrbitControls makeDefault />
    </>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────

const TYPE_LABEL_COLORS: Record<string, string> = {
  IfcWall:             'bg-[#dbd4c1]',
  IfcWallStandardCase: 'bg-[#dbd4c1]',
  IfcSlab:             'bg-[#b8b8b3]',
  IfcRoof:             'bg-[#b76151]',
  IfcBeam:             'bg-[#8cb3d9]',
  IfcColumn:           'bg-[#80b380]',
  IfcDoor:             'bg-[#9e744c]',
  IfcWindow:           'bg-[#a6d0f0]',
  IfcStair:            'bg-[#c7c796]',
  IfcRailing:          'bg-[#85859e]',
  IfcCovering:         'bg-[#d1cebe]',
  IfcCurtainWall:      'bg-[#a6d0f0]',
}

function Legend({ types }: { types: string[] }) {
  if (!types.length) return null
  return (
    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg p-2 shadow-sm max-h-40 overflow-y-auto">
      <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Legend</p>
      <div className="space-y-1">
        {types.map((t) => (
          <div key={t} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm shrink-0 ${TYPE_LABEL_COLORS[t] ?? 'bg-gray-300'}`} />
            <span className="text-xs text-gray-700">{t}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Shared canvas area ────────────────────────────────────────────────────────

function ViewerCanvas({
  meshes,
  selectedGuid,
  onSelectGuid,
  presentTypes,
  showHint,
}: {
  meshes: GeometryMesh[]
  selectedGuid: string | null
  onSelectGuid: (guid: string | null) => void
  presentTypes: string[]
  showHint: boolean
}) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-[#1a1f2e] flex-1">
      <Canvas
        gl={{ antialias: true }}
        camera={{ fov: 45, near: 0.1, far: 1000 }}
        style={{ width: '100%', height: '100%' }}
        onPointerMissed={() => onSelectGuid(null)}
      >
        <Scene
          meshes={meshes}
          selectedGuid={selectedGuid}
          onSelect={onSelectGuid}
        />
      </Canvas>

      {showHint && (
        <div className="absolute top-3 right-3 text-xs text-white/40 text-right space-y-0.5 pointer-events-none">
          <p>Left drag — orbit</p>
          <p>Right drag — pan</p>
          <p>Scroll — zoom</p>
          <p>Click element — inspect</p>
        </div>
      )}

      <Legend types={presentTypes} />
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function IFCViewer({ summary, selectedGuid: externalGuid, onSelectGuid: externalOnSelect, panelMode }: Props) {
  const [meshes,      setMeshes]      = useState<GeometryMesh[]>([])
  const [loading,     setLoading]     = useState(true)
  const [loadingPct,  setLoadingPct]  = useState(0)
  const [loadingMsg,  setLoadingMsg]  = useState('Connecting…')
  const [error,       setError]       = useState<string | null>(null)
  const [internalGuid, setInternalGuid] = useState<string | null>(null)

  const selectedGuid = externalGuid        !== undefined ? externalGuid        : internalGuid
  const onSelectGuid = externalOnSelect    !== undefined
    ? (guid: string | null) => externalOnSelect(guid)
    : (guid: string | null) => setInternalGuid(guid)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setLoadingPct(0)
    setLoadingMsg('Connecting…')

    const source = new EventSource(`/api/files/${summary.file_id}/geometry/extract`)

    source.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (typeof data.percent === 'number' && data.percent >= 0) setLoadingPct(data.percent)
      if (data.message) setLoadingMsg(data.message)

      if (data.stage === 'complete' || data.stage === 'cached') {
        source.close()
        getGeometry(summary.file_id)
          .then(setMeshes)
          .catch((e: Error) => setError(e.message))
          .finally(() => setLoading(false))
      } else if (data.stage === 'error') {
        source.close()
        setError(data.message)
        setLoading(false)
      }
    }

    source.onerror = () => {
      source.close()
      setError('Lost connection to geometry stream')
      setLoading(false)
    }

    return () => source.close()
  }, [summary.file_id])

  const presentTypes = useMemo(
    () => [...new Set(meshes.map((m) => m.type))].sort(),
    [meshes]
  )

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center gap-4 text-gray-400 ${panelMode ? 'h-full bg-[#1a1f2e] rounded-lg border border-gray-200' : 'py-24'}`}>
        <svg className="w-8 h-8 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <div className="w-56 flex flex-col gap-2">
          <div className="flex justify-between text-xs">
            <span className={panelMode ? 'text-gray-300' : 'text-gray-500'}>{loadingMsg}</span>
            {loadingPct > 0 && (
              <span className={panelMode ? 'text-gray-400' : 'text-gray-400'}>{loadingPct}%</span>
            )}
          </div>
          <div className="bg-gray-700 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: `${loadingPct}%`,
                background: loadingPct < 100
                  ? 'linear-gradient(90deg, #3b82f6, #818cf8)'
                  : '#22c55e',
              }}
            />
          </div>
        </div>
        {!panelMode && loadingPct === 0 && (
          <p className="text-xs text-gray-400">Large models may take a minute on first load</p>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-2">
        Failed to load geometry: {error}
      </p>
    )
  }

  if (!meshes.length) {
    return (
      <p className="text-sm text-gray-500 py-12 text-center">
        No renderable geometry found in this model.
      </p>
    )
  }

  // ── Panel mode (embedded alongside schedule/tree) ─────────────────────────
  // Parent (App.tsx) owns the detail panel in the bottom slot — just render the canvas
  if (panelMode) {
    return (
      <ViewerCanvas
        meshes={meshes}
        selectedGuid={selectedGuid ?? null}
        onSelectGuid={onSelectGuid}
        presentTypes={presentTypes}
        showHint={false}
      />
    )
  }

  // ── Standalone tab mode ───────────────────────────────────────────────────
  return (
    <div className="flex gap-4" style={{ height: 'calc(100vh - 14rem)' }}>
      <ViewerCanvas
        meshes={meshes}
        selectedGuid={selectedGuid ?? null}
        onSelectGuid={onSelectGuid}
        presentTypes={presentTypes}
        showHint
      />

      {selectedGuid && (
        <ElementDetailPanel
          fileId={summary.file_id}
          guid={selectedGuid}
          onClose={() => onSelectGuid(null)}
        />
      )}
    </div>
  )
}
