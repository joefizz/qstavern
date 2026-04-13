import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
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

// ── Drag detection (suppresses click-after-pan) ───────────────────────────────
const _drag = { moved: false, x: 0, y: 0 }

// ── Single element mesh ───────────────────────────────────────────────────────

function ElementMesh({
  mesh,
  isSelected,
  dimmed,
  onClick,
}: {
  mesh: GeometryMesh
  isSelected: boolean
  dimmed: boolean
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
    if (hovered && !dimmed) {
      return new THREE.Color(
        Math.min(1, mesh.color[0] * 1.25),
        Math.min(1, mesh.color[1] * 1.25),
        Math.min(1, mesh.color[2] * 1.25),
      )
    }
    return new THREE.Color(mesh.color[0], mesh.color[1], mesh.color[2])
  }, [isSelected, hovered, dimmed, mesh.color])

  const opacity = isSelected ? 1 : dimmed ? 0.08 : mesh.opacity

  return (
    <mesh
      geometry={geo}
      onClick={(e) => { e.stopPropagation(); if (!_drag.moved) onClick() }}
      onPointerOver={(e) => { e.stopPropagation(); if (!dimmed) setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      <meshStandardMaterial
        color={color}
        opacity={opacity}
        transparent={opacity < 1}
        side={THREE.DoubleSide}
        depthWrite={isSelected}
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

// ── Camera focus on selected element ─────────────────────────────────────────

function CameraFocuser({
  meshes,
  selectedGuid,
  groupPos,
  groupScale,
  camDist,
}: {
  meshes: GeometryMesh[]
  selectedGuid: string | null
  groupPos: [number, number, number]
  groupScale: number
  camDist: number
}) {
  const { camera, controls } = useThree()
  const targetPos = useRef<THREE.Vector3 | null>(null)
  const targetLook = useRef<THREE.Vector3 | null>(null)
  const animating = useRef(false)

  type OrbControls = { target: THREE.Vector3; enabled: boolean; update(): void }

  useEffect(() => {
    if (!selectedGuid) {
      // Selection cleared — stop any in-flight animation and re-enable controls
      animating.current = false
      const orb = controls as OrbControls | null
      if (orb) orb.enabled = true
      return
    }
    const mesh = meshes.find(m => m.guid === selectedGuid)
    // If this element has no geometry (e.g. IfcRoof/IfcStair containers), stay put
    if (!mesh) return

    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    for (let i = 0; i < mesh.verts.length; i += 3) {
      const x = mesh.verts[i], y = mesh.verts[i + 1], z = mesh.verts[i + 2]
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
    }

    // Group rotation [-PI/2, 0, 0]: IFC (x,y,z) → Three.js (x, z, -y)
    // wx = ifc_x*s + gx,  wy = ifc_z*s + gy,  wz = -ifc_y*s + gz
    const cx = ((minX + maxX) / 2) * groupScale + groupPos[0]
    const cy = ((minZ + maxZ) / 2) * groupScale + groupPos[1]
    const cz = -((minY + maxY) / 2) * groupScale + groupPos[2]
    const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ) * groupScale
    const dist = Math.max(size * 2.5, 2)

    const look = new THREE.Vector3(cx, cy, cz)
    // Always approach from the same diagonal direction for consistency
    const dir = new THREE.Vector3(0.8, 0.6, 0.8).normalize()
    const pos = look.clone().addScaledVector(dir, dist)

    targetLook.current = look
    targetPos.current = pos

    // Snap camera to overview first so the fly-in is always consistent
    const orb = controls as OrbControls | null
    camera.position.set(camDist * 0.8, camDist * 0.6, camDist * 0.8)
    camera.lookAt(0, 0, 0)
    if (orb?.target) orb.target.set(0, 0, 0)
    if (orb) { orb.update(); orb.enabled = false }
    animating.current = true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGuid])

  useFrame(() => {
    if (!animating.current || !targetPos.current || !targetLook.current) return
    const orb = controls as OrbControls | null

    camera.position.lerp(targetPos.current, 0.12)
    if (orb?.target) orb.target.lerp(targetLook.current, 0.12)
    if (orb) orb.update()

    const close = camera.position.distanceTo(targetPos.current) < 0.05
    if (close) {
      camera.position.copy(targetPos.current)
      if (orb?.target) orb.target.copy(targetLook.current)
      if (orb) { orb.update(); orb.enabled = true }
      animating.current = false
    }
  })

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
  const { groupPos, groupScale, camDist } = useMemo<{
    groupPos: [number, number, number]
    groupScale: number
    camDist: number
  }>(() => {
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
      <CameraFocuser
        meshes={meshes}
        selectedGuid={selectedGuid}
        groupPos={groupPos}
        groupScale={groupScale}
        camDist={camDist}
      />
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
            dimmed={!!selectedGuid && m.guid !== selectedGuid}
            onClick={() => onSelect(m.guid)}
          />
        ))}
        {transparent.map((m) => (
          <ElementMesh
            key={m.guid}
            mesh={m}
            isSelected={m.guid === selectedGuid}
            dimmed={!!selectedGuid && m.guid !== selectedGuid}
            onClick={() => onSelect(m.guid)}
          />
        ))}
      </group>

      <OrbitControls makeDefault minDistance={0.5} maxDistance={500} zoomSpeed={0.6} />
    </>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────

const TYPE_LABEL_COLORS: Record<string, string> = {
  IfcWall:                  'bg-[#dbd4c1]',
  IfcWallStandardCase:      'bg-[#dbd4c1]',
  IfcSlab:                  'bg-[#b8b8b3]',
  IfcRoof:                  'bg-[#b76151]',
  IfcBeam:                  'bg-[#8cb3d9]',
  IfcColumn:                'bg-[#80b380]',
  IfcDoor:                  'bg-[#9e744c]',
  IfcWindow:                'bg-[#a6d0f0]',
  IfcStair:                 'bg-[#c7c796]',
  IfcStairFlight:           'bg-[#c7c796]',
  IfcRailing:               'bg-[#85859e]',
  IfcRamp:                  'bg-[#bfb88c]',
  IfcRampFlight:            'bg-[#bfb88c]',
  IfcCovering:              'bg-[#d1cebe]',
  IfcCurtainWall:           'bg-[#a6d0f0]',
  IfcPlate:                 'bg-[#99b8cc]',
  IfcMember:                'bg-[#8ca6c7]',
  IfcPile:                  'bg-[#948d80]',
  IfcFooting:               'bg-[#9e9a8c]',
  IfcFurnishingElement:     'bg-[#cca680]',
  IfcFurniture:             'bg-[#cca680]',
  IfcSystemFurnitureElement:'bg-[#c7a685]',
  IfcSanitaryTerminal:      'bg-[#e6e6e6]',
  IfcElectricAppliance:     'bg-[#b3b3bf]',
  IfcSite:                  'bg-[#73a659]',
  IfcBuildingElementProxy:  'bg-[#b8ad9e]',
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

// ── On-screen controls ────────────────────────────────────────────────────────

function ControlsOverlay({
  canvasRef,
}: {
  canvasRef: React.RefObject<{ controls?: { dollyIn?: (s: number) => void; dollyOut?: (s: number) => void; reset?: () => void; target?: THREE.Vector3; object?: THREE.Camera } | null }>
}) {
  // We interact with OrbitControls by dispatching wheel events on the canvas
  // and by accessing the controls ref via useThree inside the canvas.
  // Instead, expose imperative handles via a sibling inner component.
  return null
}

// Inner component that lives inside <Canvas> and exposes controls imperatively
const controlsRef: { zoom?: (delta: number) => void; resetView?: () => void } = {}

function ControlsBridge() {
  const { camera, controls } = useThree()
  const orb = controls as { dollyIn?: (s: number) => void; dollyOut?: (s: number) => void; reset?: () => void; target?: THREE.Vector3 } | null

  useEffect(() => {
    controlsRef.zoom = (delta: number) => {
      if (!orb) return
      if (delta > 0 && orb.dollyIn)  orb.dollyIn(1.2)
      if (delta < 0 && orb.dollyOut) orb.dollyOut(1.2)
      // @ts-expect-error update exists on OrbitControls
      if (orb.update) orb.update()
    }
    controlsRef.resetView = () => {
      if (!orb) return
      orb.target?.set(0, 0, 0)
      camera.position.set(20 * 0.8, 20 * 0.6, 20 * 0.8)
      camera.lookAt(0, 0, 0)
      // @ts-expect-error update exists on OrbitControls
      if (orb.update) orb.update()
    }
    return () => { delete controlsRef.zoom; delete controlsRef.resetView }
  }, [camera, orb])

  return null
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
    <div
      className="relative rounded-lg overflow-hidden border border-gray-200 bg-[#1a1f2e] flex-1"
      onPointerDown={(e) => { _drag.moved = false; _drag.x = e.clientX; _drag.y = e.clientY }}
      onPointerMove={(e) => { if (Math.hypot(e.clientX - _drag.x, e.clientY - _drag.y) > 5) _drag.moved = true }}
    >
      <Canvas
        gl={{ antialias: true }}
        camera={{ fov: 45, near: 0.1, far: 1000 }}
        style={{ width: '100%', height: '100%' }}
        onPointerMissed={() => { /* intentionally empty — use Reset to deselect */ }}
      >
        <ControlsBridge />
        <Scene
          meshes={meshes}
          selectedGuid={selectedGuid}
          onSelect={onSelectGuid}
        />
      </Canvas>

      {/* On-screen control buttons */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-auto">
        <button
          onClick={() => controlsRef.zoom?.(1)}
          className="w-8 h-8 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded text-lg leading-none select-none transition-colors"
          title="Zoom in"
        >+</button>
        <button
          onClick={() => controlsRef.zoom?.(-1)}
          className="w-8 h-8 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded text-lg leading-none select-none transition-colors"
          title="Zoom out"
        >−</button>
        <button
          onClick={() => { controlsRef.resetView?.(); onSelectGuid(null) }}
          className="h-8 px-2 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded text-xs select-none transition-colors"
          title="Reset camera and clear selection"
        >⟳ Reset</button>
      </div>

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

    const token = localStorage.getItem('qs_token') ?? ''
    const source = new EventSource(`/api/files/${summary.file_id}/geometry/extract?token=${encodeURIComponent(token)}`)

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
    <div className="relative flex flex-col" style={{ height: 'calc(100vh - 14rem)' }}>
      <ViewerCanvas
        meshes={meshes}
        selectedGuid={selectedGuid ?? null}
        onSelectGuid={onSelectGuid}
        presentTypes={presentTypes}
        showHint
      />

      {/* Detail panel as a floating overlay in the bottom-right corner */}
      {selectedGuid && (
        <div className="absolute bottom-3 right-3 w-80 max-h-[60%] overflow-hidden rounded-lg shadow-xl border border-gray-200 bg-white">
          <ElementDetailPanel
            fileId={summary.file_id}
            guid={selectedGuid}
            onClose={() => onSelectGuid(null)}
          />
        </div>
      )}
    </div>
  )
}
