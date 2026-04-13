import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getAggregates } from '../api/endpoints'
import type { AggregateRow, ModelSummary } from '../api/types'

interface Props {
  summary: ModelSummary
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  )
}

function fmt(n: number | null | undefined, digits = 1) {
  return n != null ? n.toFixed(digits) : '—'
}

export function SummaryDashboard({ summary }: Props) {
  const [byType, setByType] = useState<AggregateRow[]>([])
  const [byStorey, setByStorey] = useState<AggregateRow[]>([])

  useEffect(() => {
    getAggregates(summary.file_id, 'ifc_type').then(setByType)
    getAggregates(summary.file_id, 'storey').then(setByStorey)
  }, [summary.file_id])

  const totalArea = byType.reduce((s, r) => s + (r.total_area ?? 0), 0)
  const totalVolume = byType.reduce((s, r) => s + (r.total_volume ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Project" value={summary.project_name} />
        <StatCard label="Schema" value={summary.ifc_schema} />
        <StatCard label="Elements" value={summary.element_count} />
        <StatCard label="Storeys" value={summary.storeys.length} />
        <StatCard label="Total Area" value={`${fmt(totalArea)} m²`} />
        <StatCard label="Total Volume" value={`${fmt(totalVolume)} m³`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Area by type */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Area by Type (m²)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byType} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="group_value"
                tick={{ fontSize: 10 }}
                angle={-30}
                textAnchor="end"
                interval={0}
                height={60}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${Number(v).toFixed(2)} m²`, 'Area']} />
              <Bar dataKey="total_area" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Volume by storey */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Volume by Storey (m³)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byStorey} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="group_value" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${Number(v).toFixed(2)} m³`, 'Volume']} />
              <Bar dataKey="total_volume" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
