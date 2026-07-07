'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { KpiCard } from '@/components/kpi-card'
import { fetchSalesCallsList } from '@/lib/sales-calls-client'
import type { SalesCall } from '@/lib/types'

export default function SalesInsightsPage() {
  const [calls, setCalls] = useState<SalesCall[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchSalesCallsList()
        setCalls(data)
      } catch {
        console.error('Failed to load sales calls')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const callsLast30 = calls.filter(c => new Date(c.created_at) > last30Days)
  const heldCallsLast30 = callsLast30.filter(c => c.status === 'held' || c.status === 'analyzed')
  const analyzedCalls = calls.filter(c => c.analysis)

  const avgDiscoveryScore = callsLast30
    .filter(c => c.call_type === 'discovery' && c.analysis)
    .reduce((sum, c) => sum + (c.analysis?.overall_score || 0), 0) / (callsLast30.filter(c => c.call_type === 'discovery' && c.analysis).length || 1)

  const avgPitchScore = callsLast30
    .filter(c => c.call_type === 'pitch' && c.analysis)
    .reduce((sum, c) => sum + (c.analysis?.overall_score || 0), 0) / (callsLast30.filter(c => c.call_type === 'pitch' && c.analysis).length || 1)

  const pitchCalls = callsLast30.filter(c => c.call_type === 'pitch' && (c.status === 'held' || c.status === 'analyzed'))
  const wonCalls = pitchCalls.filter(c => c.outcome === 'won')
  const winRate = pitchCalls.length > 0 ? ((wonCalls.length / pitchCalls.length) * 100).toFixed(0) : '0'

  // Objections analysis
  const allObjections = analyzedCalls.flatMap(c => c.analysis?.objections || [])
  const objectionCounts = allObjections.reduce((acc, o) => {
    const key = o.objection
    if (!acc[key]) acc[key] = { objection: key, count: 0, handled: 0 }
    acc[key].count++
    if (o.handled_well) acc[key].handled++
    return acc
  }, {} as Record<string, { objection: string; count: number; handled: number }>)

  const topObjections = Object.values(objectionCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // SOP gaps
  const allGaps = analyzedCalls.flatMap(c => c.analysis?.sop_gaps || [])
  const gapCounts = allGaps.reduce((acc, g) => {
    acc[g] = (acc[g] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const topGaps = Object.entries(gapCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Dimension averages
  const allDimensions = analyzedCalls.flatMap(c => c.analysis?.dimensions || [])
  const dimensionScores = allDimensions.reduce((acc, d) => {
    if (!acc[d.key]) acc[d.key] = { key: d.key, total: 0, count: 0 }
    acc[d.key].total += d.score
    acc[d.key].count++
    return acc
  }, {} as Record<string, { key: string; total: number; count: number }>)

  const dimensionData = Object.values(dimensionScores)
    .map(d => ({
      dimension: d.key.replace(/_/g, ' '),
      avg: parseFloat((d.total / d.count).toFixed(1)),
    }))
    .sort((a, b) => b.avg - a.avg)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-sm text-[#636780]">Loading insights...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#08090c] px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#e4e6f0] tracking-tight">Sales Insights</h1>
        <p className="text-sm text-[#636780] mt-1">Learn what's working and where to improve</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <KpiCard label="Calls (30d)" value={heldCallsLast30.length} accent="blue" />
        <KpiCard label="Avg Discovery Score" value={`${avgDiscoveryScore.toFixed(1)}/10`} accent="blue" />
        <KpiCard label="Avg Pitch Score" value={`${avgPitchScore.toFixed(1)}/10`} accent="blue" />
        <KpiCard label="Win Rate" value={`${winRate}%`} accent={parseFloat(winRate) > 50 ? 'green' : 'amber'} subtext={`${wonCalls.length}/${pitchCalls.length} pitches`} />
      </div>

      {/* Dimension scores */}
      {dimensionData.length > 0 && (
        <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#e4e6f0] mb-6">Performance by Dimension</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dimensionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2035" />
              <XAxis dataKey="dimension" tick={{ fontSize: 11, fill: '#636780' }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#636780' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#181b27',
                  border: '1px solid #1c2035',
                  borderRadius: '8px',
                  color: '#e4e6f0',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="avg" fill="#6366f1" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Objections */}
      {topObjections.length > 0 && (
        <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#e4e6f0] mb-4">Top Objections Faced</h2>
          <div className="space-y-3">
            {topObjections.map((obj, i) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#e4e6f0]">{obj.objection}</p>
                  <p className="text-xs text-[#636780]">{obj.count} occurrences</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-green-400">
                    {obj.count > 0 ? ((obj.handled / obj.count) * 100).toFixed(0) : 0}%
                  </p>
                  <p className="text-xs text-[#636780]">handled well</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SOP Gaps */}
      {topGaps.length > 0 && (
        <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-[#e4e6f0] mb-4">Most Common SOP Gaps</h2>
          <div className="space-y-2">
            {topGaps.map(([gap, count]) => (
              <div key={gap} className="flex items-center justify-between p-3 bg-[#181b27] rounded-lg">
                <p className="text-sm text-[#e4e6f0]">{gap}</p>
                <span className="text-xs font-medium px-2 py-1 rounded bg-amber-500/10 text-amber-400">
                  {count} call{count !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#636780] mt-4">
            These are framework steps that were skipped. Review the SOP to improve consistency.
          </p>
        </div>
      )}
    </div>
  )
}
