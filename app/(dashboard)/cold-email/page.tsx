'use client'

import { useEffect, useState, useCallback } from 'react'
import { KpiCard } from '@/components/kpi-card'
import { timeAgo } from '@/lib/utils'
import { Mail, Reply, ThumbsUp, Calendar, Activity, TrendingUp, Layers, Gauge } from 'lucide-react'

type Window = 'yesterday' | '7d' | '30d'

const WINDOWS: { key: Window; label: string }[] = [
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
]

const EVENT_LABELS: Record<string, string> = {
  email_sent: 'Email sent',
  reply_in: 'Reply received',
  ai_replied: 'AI reply sent',
  li_connected: 'LinkedIn connected',
  call_booked: 'Call booked',
  call_cancelled: 'Call cancelled',
  form_submitted: 'Form submitted',
  stage_change: 'Stage changed',
}

const EVENT_COLORS: Record<string, string> = {
  reply_in: 'text-indigo-400',
  call_booked: 'text-green-400',
  call_cancelled: 'text-red-400',
  ai_replied: 'text-sky-400',
  form_submitted: 'text-amber-400',
  stage_change: 'text-purple-400',
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#181b27] rounded-lg ${className}`} />
}

type BenchmarkStatus = 'green' | 'amber' | 'red'

type Benchmark = {
  label: string
  value: string
  status: BenchmarkStatus
  hint: string
}

const STATUS_STYLES: Record<BenchmarkStatus, { dot: string; text: string }> = {
  green: { dot: 'bg-green-400', text: 'text-green-400' },
  amber: { dot: 'bg-amber-400', text: 'text-amber-400' },
  red: { dot: 'bg-red-400', text: 'text-red-400' },
}

// Ecom-agency cold email standards, computed client-side from the fetched
// KPIs. No LLM involved, just thresholds against widely used cold outbound
// benchmarks for agencies running ecom/DTC style campaigns.
function computeBenchmarks(kpis: any): Benchmark[] {
  const sent = kpis.sent ?? 0
  const replies = kpis.replies ?? 0
  const bounces = kpis.bounces ?? 0
  const booked = kpis.booked ?? 0

  const replyRate = kpis.replyRate ?? 0
  const positiveRate = kpis.positiveRate ?? 0
  const bounceRate = sent > 0 ? (bounces / sent) * 100 : 0
  const bookedPer1000 = sent > 0 ? (booked / sent) * 1000 : 0

  const replyStatus: BenchmarkStatus = replyRate >= 1 ? 'green' : replyRate >= 0.5 ? 'amber' : 'red'
  const positiveStatus: BenchmarkStatus = positiveRate >= 20 ? 'green' : positiveRate >= 10 ? 'amber' : 'red'
  const bounceStatus: BenchmarkStatus = bounceRate < 3 ? 'green' : bounceRate < 5 ? 'amber' : 'red'
  const bookedStatus: BenchmarkStatus = bookedPer1000 >= 1 ? 'green' : bookedPer1000 >= 0.5 ? 'amber' : 'red'

  return [
    {
      label: 'Reply Rate',
      value: `${replyRate.toFixed(1)}%`,
      status: replyStatus,
      hint: 'Target 1-3% of sent',
    },
    {
      label: 'Positive Share',
      value: `${positiveRate.toFixed(1)}%`,
      status: positiveStatus,
      hint: 'Target 20-40% of replies',
    },
    {
      label: 'Bounce Rate',
      value: `${bounceRate.toFixed(1)}%`,
      status: bounceStatus,
      hint: 'Must stay under 3%',
    },
    {
      label: 'Booked / 1000 Sent',
      value: bookedPer1000.toFixed(1),
      status: bookedStatus,
      hint: 'Target 1-3 booked calls',
    },
  ]
}

function BenchmarksStrip({ kpis }: { kpis: any }) {
  const benchmarks = computeBenchmarks(kpis)
  return (
    <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-4 mb-5">
      <p className="text-sm font-medium text-[#e4e6f0] mb-3 flex items-center gap-2">
        <Gauge className="w-3.5 h-3.5 text-[#636780]" />
        Benchmarks
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {benchmarks.map((b) => {
          const style = STATUS_STYLES[b.status]
          return (
            <div key={b.label} className="rounded-lg bg-[#181b27] px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                <p className="text-[10px] font-medium text-[#3d4060] uppercase tracking-wider">{b.label}</p>
              </div>
              <p className={`text-sm font-semibold ${style.text}`}>{b.value}</p>
              <p className="text-[10px] text-[#636780] mt-0.5">{b.hint}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-10 h-10 rounded-full bg-[#181b27] flex items-center justify-center mb-3">
        <Activity className="w-4 h-4 text-[#3d4060]" />
      </div>
      <p className="text-sm text-[#3d4060]">{label}</p>
    </div>
  )
}

export default function ColdEmailDashboard() {
  const [win, setWin] = useState<Window>('7d')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (w: Window) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/cold-email/metrics?window=${w}`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(win) }, [win, fetchData])

  const kpis = data?.kpis
  const campaigns: any[] = data?.campaigns ?? []
  const recent: any[] = data?.recent ?? []

  return (
    <div className="p-6 min-h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-xl font-semibold text-[#e4e6f0]">Cold Email</h1>
        <div className="flex items-center gap-1 bg-[#10121a] border border-[#1c2035] rounded-lg p-1">
          {WINDOWS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setWin(key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                win === key
                  ? 'bg-[#181b27] text-[#e4e6f0]'
                  : 'text-[#636780] hover:text-[#e4e6f0]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-5 flex items-center justify-between">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => fetchData(win)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI row */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#1c2035] bg-[#10121a] p-3.5">
              <Skeleton className="h-3 w-1/2 mb-3" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ))}
        </div>
      ) : kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-5">
          <KpiCard label="Sent" value={kpis.sent} compact accent="default" />
          <KpiCard label="Replies" value={kpis.replies} compact accent="blue" />
          <KpiCard label="Reply Rate" value={kpis.replyRate.toFixed(1)} suffix="%" compact accent="blue" />
          <KpiCard label="Positives" value={kpis.positives} compact accent="green" />
          <KpiCard label="Positive Rate" value={kpis.positiveRate.toFixed(1)} suffix="%" compact accent="green" />
          <KpiCard label="Booked" value={kpis.booked} compact accent="green" />
          <KpiCard label="Open Pipeline" value={kpis.openPipeline} compact accent="amber" />
          <KpiCard label="Calls Booked" value={kpis.callsBooked} compact accent="blue" />
        </div>
      ) : null}

      {!loading && kpis ? <BenchmarksStrip kpis={kpis} /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Campaign breakdown */}
        <div className="lg:col-span-2 rounded-xl border border-[#1c2035] bg-[#10121a] p-5">
          <p className="text-sm font-medium text-[#e4e6f0] mb-4 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-[#636780]" />
            Campaign Breakdown
          </p>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <EmptyState label="No campaign data yet. Metrics will appear once the Python engine syncs." />
          ) : (
            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-5 gap-2 px-3 pb-1">
                <p className="text-[10px] font-medium text-[#3d4060] uppercase tracking-wider col-span-2">Campaign</p>
                <p className="text-[10px] font-medium text-[#3d4060] uppercase tracking-wider text-right">Sent</p>
                <p className="text-[10px] font-medium text-[#3d4060] uppercase tracking-wider text-right">Replies</p>
                <p className="text-[10px] font-medium text-[#3d4060] uppercase tracking-wider text-right">Booked</p>
              </div>
              {campaigns.map((c) => {
                const rr = c.sent > 0 ? ((c.replies / c.sent) * 100).toFixed(1) : '0.0'
                const displayName = c.campaignName || c.name
                return (
                  <div
                    key={c.campaignName || c.name}
                    className="grid grid-cols-5 gap-2 bg-[#181b27] rounded-lg px-3 py-2.5 items-center"
                  >
                    <p className="text-sm text-[#e4e6f0] font-medium col-span-2 truncate capitalize">{displayName}</p>
                    <p className="text-sm text-[#636780] tabular-nums text-right">{c.sent.toLocaleString()}</p>
                    <p className="text-sm tabular-nums text-right">
                      <span className="text-[#e4e6f0]">{c.replies}</span>
                      <span className="text-[#3d4060] text-xs ml-1">({rr}%)</span>
                    </p>
                    <p className="text-sm text-green-400 tabular-nums text-right">{c.booked}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-5">
          <p className="text-sm font-medium text-[#e4e6f0] mb-4 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-[#636780]" />
            Recent Activity
          </p>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState label="Activity will appear here as leads are created and events come in." />
          ) : (
            <div className="space-y-0">
              {recent.map((ev: any, i: number) => {
                const lead = ev.ce_leads
                const color = EVENT_COLORS[ev.type] ?? 'text-[#636780]'
                return (
                  <div
                    key={ev.id ?? i}
                    className="flex items-start gap-3 py-2.5 border-b border-[#1c2035] last:border-0"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-current mt-2 shrink-0" style={{ color: 'inherit' }}>
                      <div className={`w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium ${color}`}>{EVENT_LABELS[ev.type] ?? ev.type}</p>
                      {lead && (
                        <p className="text-xs text-[#636780] truncate">
                          {lead.first_name ?? lead.email} {lead.company ? `· ${lead.company}` : ''}
                        </p>
                      )}
                    </div>
                    <p className="text-[10px] text-[#3d4060] shrink-0 mt-0.5">{timeAgo(ev.occurred_at)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
