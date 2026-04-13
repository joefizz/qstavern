import { useEffect, useRef, useState } from 'react'
import type { ModelSummary } from '../api/types'

interface Props {
  fileId: string
  fileName: string
  onComplete: (summary: ModelSummary) => void
  onError: (msg: string) => void
}

interface ProgressEvent {
  stage?: 'complete' | 'error'
  percent: number
  message: string
  summary?: ModelSummary
}

export function ProcessingScreen({ fileId, fileName, onComplete, onError }: Props) {
  const [percent, setPercent] = useState(0)
  const [displayPercent, setDisplayPercent] = useState(0)
  const [message, setMessage] = useState('Connecting…')
  const [stages, setStages] = useState<string[]>([])
  const rafRef = useRef<number | null>(null)
  const targetRef = useRef(0)

  // Smooth animation — ratchets toward target, never goes backward
  useEffect(() => {
    const animate = () => {
      setDisplayPercent(prev => {
        const target = targetRef.current
        if (prev >= target) return prev
        const step = Math.max(0.3, (target - prev) * 0.08)
        return Math.min(target, prev + step)
      })
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  useEffect(() => {
    targetRef.current = percent
  }, [percent])

  useEffect(() => {
    const es = new EventSource(`/api/files/${fileId}/process`)

    es.onmessage = (e: MessageEvent) => {
      const data: ProgressEvent = JSON.parse(e.data)

      if (data.percent > 0) {
        setPercent(data.percent)
      }
      if (data.message) {
        setMessage(data.message)
        setStages(prev => {
          const next = [...prev, data.message]
          return next.slice(-6) // keep last 6 messages
        })
      }

      if (data.stage === 'complete' && data.summary) {
        es.close()
        // Let the bar finish visually before transitioning
        setPercent(100)
        setTimeout(() => onComplete(data.summary!), 600)
      }

      if (data.stage === 'error') {
        es.close()
        onError(data.message)
      }
    }

    es.onerror = () => {
      es.close()
      onError('Connection lost during processing')
    }

    return () => es.close()
  }, [fileId, onComplete, onError])

  const pct = Math.round(displayPercent)
  const isComplete = pct >= 100

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-6">

        {/* Icon + title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-50 mb-1">
            {isComplete ? (
              <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            {isComplete ? 'Processing complete' : 'Processing IFC file'}
          </h2>
          <p className="text-sm text-gray-400 truncate" title={fileName}>{fileName}</p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-400">
            <span>{message}</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-none ${
                isComplete ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${displayPercent}%` }}
            />
          </div>
        </div>

        {/* Stage log */}
        <div className="space-y-1 min-h-[5rem]">
          {stages.map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 text-xs transition-opacity ${
                i === stages.length - 1 ? 'text-gray-700 opacity-100' : 'text-gray-400 opacity-60'
              }`}
            >
              <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                i === stages.length - 1 ? 'bg-blue-400' : 'bg-gray-300'
              }`} />
              {s}
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
