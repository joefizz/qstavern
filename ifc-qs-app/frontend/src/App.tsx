import { useCallback, useEffect, useRef, useState } from 'react'
import type { ModelSummary } from './api/types'
import { getMe } from './api/endpoints'
import { AssemblyView } from './components/AssemblyView'
import { ElementDetailPanel } from './components/ElementDetailPanel'
import { ExportBar } from './components/ExportBar'
import { FileLibrary } from './components/FileLibrary'
import { FileUpload } from './components/FileUpload'
import { HelpPage } from './components/HelpPage'
import { IFCTree } from './components/IFCTree'
import { IFCViewer } from './components/IFCViewer'
import { LoginPage } from './components/LoginPage'
import { Logo } from './components/Logo'
import { ProcessingScreen } from './components/ProcessingScreen'
import { QuantityTable } from './components/QuantityTable'
import { SummaryDashboard } from './components/SummaryDashboard'

type Tab = 'dashboard' | 'schedule' | 'assemblies' | 'tree' | 'viewer'

const TAB_LABELS: Record<Tab, string> = {
  dashboard:  'Dashboard',
  schedule:   'Schedule',
  assemblies: 'Assemblies',
  tree:       'IFC Tree',
  viewer:     '3D View',
}

type AppState =
  | { phase: 'upload' }
  | { phase: 'processing'; fileId: string; fileName: string }
  | { phase: 'ready'; summary: ModelSummary }

export default function App() {
  // ── Help page — hash route, no auth required ─────────────────────────────────
  if (window.location.hash === '#help') return <HelpPage />

  // ── Auth gate ────────────────────────────────────────────────────────────────
  const [authed, setAuthed] = useState<boolean | null>(null) // null = checking

  useEffect(() => {
    const token = localStorage.getItem('qs_token')
    if (!token) { setAuthed(false); return }
    getMe().then(() => setAuthed(true)).catch(() => { localStorage.removeItem('qs_token'); setAuthed(false) })
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('qs_token')
    setAuthed(false)
  }

  if (authed === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading…</div>
      </div>
    )
  }
  if (!authed) return <LoginPage onLogin={() => setAuthed(true)} />

  return <AppInner onLogout={handleLogout} />
}

function AppInner({ onLogout }: { onLogout: () => void }) {
  const [state, setState] = useState<AppState>({ phase: 'upload' })
  const [tab, setTab] = useState<Tab>('dashboard')
  const [processingError, setProcessingError] = useState<string | null>(null)
  // Shared selection: highlights across schedule, tree, and 3D panel
  const [selectedGuid, setSelectedGuid] = useState<string | null>(null)
  // Whether the live 3D panel is shown alongside schedule/tree tabs
  const [show3D, setShow3D] = useState(false)

  const handleUploaded = (fileId: string, fileName: string) => {
    setProcessingError(null)
    setState({ phase: 'processing', fileId, fileName })
  }

  const handleProcessingComplete = (summary: ModelSummary) => {
    setState({ phase: 'ready', summary })
    setTab('dashboard')
  }

  const handleProcessingError = (msg: string) => {
    setProcessingError(msg)
    setState({ phase: 'upload' })
  }

  const handleReset = () => {
    setState({ phase: 'upload' })
    setProcessingError(null)
    setTab('dashboard')
    setSelectedGuid(null)
  }

  const handleTabChange = (t: Tab) => {
    setTab(t)
    setSelectedGuid(null)
  }

  // ── Resizable panel state ────────────────────────────────────────────────────
  const [leftPct, setLeftPct] = useState(25)    // left list column width %
  const [detailPx, setDetailPx] = useState(260) // detail panel height px (when 3D+detail both shown)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  const onHorizDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startPct = leftPct
    const onMove = (me: MouseEvent) => {
      const container = splitContainerRef.current
      if (!container) return
      const w = container.getBoundingClientRect().width
      const newPct = startPct + ((me.clientX - startX) / w) * 100
      setLeftPct(Math.min(50, Math.max(15, newPct)))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [leftPct])

  const onVertDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startPx = detailPx
    const onMove = (me: MouseEvent) => {
      // dragging down → smaller detail panel; up → larger
      setDetailPx(Math.min(600, Math.max(80, startPx - (me.clientY - startY))))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [detailPx])

  // Load a previously processed file — skips the processing screen entirely
  const handleLoadExisting = (summary: ModelSummary) => {
    setProcessingError(null)
    setState({ phase: 'ready', summary })
    setTab('dashboard')
  }

  // Called when a duplicate upload is detected — open the existing file
  const handleDuplicate = (fileId: string) => {
    setState({ phase: 'processing', fileId, fileName: '' })
  }

  // ── Upload screen ────────────────────────────────────────────────────────────
  if (state.phase === 'upload') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 gap-8">
        <div className="flex flex-col items-center gap-4">
          <img src="/hull-construction-logo.png" alt="Hull Construction" className="h-10 object-contain" />
          <div className="w-px h-4 bg-gray-300" />
          <Logo size={56} showWordmark showTagline />
        </div>

        {/* Saved files — shown above the upload dropzone when files exist */}
        <FileLibrary onLoad={handleLoadExisting} onUploadNew={() => {}} />

        <FileUpload onUploaded={handleUploaded} onDuplicate={handleDuplicate} />

        {processingError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-2 max-w-lg">
            {processingError}
          </p>
        )}

        <button onClick={onLogout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          Sign out
        </button>
      </div>
    )
  }

  // ── Processing screen ────────────────────────────────────────────────────────
  if (state.phase === 'processing') {
    return (
      <ProcessingScreen
        fileId={state.fileId}
        fileName={state.fileName}
        onComplete={handleProcessingComplete}
        onError={handleProcessingError}
      />
    )
  }

  // ── Main app ────────────────────────────────────────────────────────────────
  const { summary } = state
  const hasSplitPanel = show3D && (tab === 'schedule' || tab === 'tree')
  const showSplitToggle = tab === 'schedule' || tab === 'tree'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/hull-construction-logo.png" alt="Hull Construction" className="h-7 object-contain" />
            <div className="w-px h-8 bg-gray-200" />
            <Logo size={32} showWordmark={false} />
            <div className="w-px h-8 bg-gray-200" />
            <button onClick={handleReset} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← New file
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{summary.project_name}</h1>
              <p className="text-xs text-gray-400">
                {summary.ifc_schema} · {summary.element_count} elements · {summary.storeys.length} storeys
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ExportBar fileId={summary.file_id} />
            <button
              onClick={() => window.open('/#help', '_blank')}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors w-6 h-6 rounded-full border border-gray-300 hover:border-gray-400 flex items-center justify-center font-semibold"
              title="Help & documentation"
            >
              ?
            </button>
            <button
              onClick={onLogout}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1"
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex gap-0">
            {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {/* 3D panel toggle — only useful on schedule/tree tabs */}
          {showSplitToggle && (
            <button
              onClick={() => setShow3D(v => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                show3D
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
              </svg>
              {show3D ? '3D On' : 'Show 3D'}
            </button>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-6">
        {tab === 'dashboard' && <SummaryDashboard summary={summary} />}
        {tab === 'assemblies' && (
          <div
            ref={splitContainerRef}
            className="flex"
            style={{ height: 'calc(100vh - 14rem)' }}
          >
            <div style={{ width: selectedGuid ? `${leftPct}%` : '100%' }} className="min-w-0 flex flex-col transition-all">
              <AssemblyView
                summary={summary}
                selectedGuid={selectedGuid}
                onSelectGuid={setSelectedGuid}
              />
            </div>
            {selectedGuid && (
              <>
                <div
                  onMouseDown={onHorizDrag}
                  className="w-1.5 cursor-col-resize flex-shrink-0 bg-gray-200 hover:bg-blue-400 active:bg-blue-500 transition-colors mx-1 rounded-full select-none"
                />
                <div className="flex-1 min-w-0">
                  <ElementDetailPanel
                    fileId={summary.file_id}
                    guid={selectedGuid}
                    onClose={() => setSelectedGuid(null)}
                  />
                </div>
              </>
            )}
          </div>
        )}
        {tab === 'viewer'    && (
          <IFCViewer
            summary={summary}
            selectedGuid={selectedGuid}
            onSelectGuid={setSelectedGuid}
          />
        )}

        {/* Schedule and Tree tabs */}
        {(tab === 'schedule' || tab === 'tree') && (
          <div
            ref={splitContainerRef}
            className="flex"
            style={{ height: 'calc(100vh - 14rem)' }}
          >
            {/* Left: list */}
            <div style={{ width: `${leftPct}%` }} className="min-w-0 flex flex-col">
              {tab === 'schedule' && (
                <QuantityTable
                  summary={summary}
                  selectedGuid={selectedGuid}
                  onSelectGuid={setSelectedGuid}
                  showDetailPanel={false}
                />
              )}
              {tab === 'tree' && (
                <IFCTree
                  summary={summary}
                  selectedGuid={selectedGuid}
                  onSelectGuid={setSelectedGuid}
                  showDetailPanel={false}
                />
              )}
            </div>

            {/* Horizontal drag handle */}
            <div
              onMouseDown={onHorizDrag}
              className="w-1.5 cursor-col-resize flex-shrink-0 bg-gray-200 hover:bg-blue-400 active:bg-blue-500 transition-colors mx-1 rounded-full select-none"
            />

            {/* Right column: 3D (top) + detail panel (bottom) */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* 3D viewer */}
              {hasSplitPanel && (
                <div className={`flex flex-col ${selectedGuid ? 'flex-1 min-h-0' : 'h-full'}`}>
                  <IFCViewer
                    summary={summary}
                    selectedGuid={selectedGuid}
                    onSelectGuid={setSelectedGuid}
                    panelMode
                  />
                </div>
              )}

              {/* Vertical drag handle — only when 3D and detail both shown */}
              {hasSplitPanel && selectedGuid && (
                <div
                  onMouseDown={onVertDrag}
                  className="h-1.5 cursor-row-resize flex-shrink-0 bg-gray-200 hover:bg-blue-400 active:bg-blue-500 transition-colors my-1 rounded-full select-none"
                />
              )}

              {/* Detail panel */}
              {selectedGuid && (
                <div
                  className="flex-shrink-0 overflow-hidden"
                  style={hasSplitPanel ? { height: `${detailPx}px` } : { flex: 1 }}
                >
                  <ElementDetailPanel
                    fileId={summary.file_id}
                    guid={selectedGuid}
                    onClose={() => setSelectedGuid(null)}
                  />
                </div>
              )}

              {/* Placeholder when nothing is active on the right */}
              {!hasSplitPanel && !selectedGuid && (
                <div className="flex-1 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
                  <p className="text-sm text-gray-400">Select an element to inspect its details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
