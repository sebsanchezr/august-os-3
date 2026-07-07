'use client'

import { useEffect, useState, useCallback } from 'react'
import { KpiCard } from '@/components/kpi-card'
import { TrendChart } from '@/components/trend-chart'
import { LeaderboardTable } from '@/components/leaderboard-table'
import { ActivityFeed } from '@/components/activity-feed'
import { pctChange } from '@/lib/utils'
import type { DashboardMetrics, CallerStats, TrendPoint, RecentActivity } from '@/lib/types'

type Window = 'yesterday' | '7d' | '30d'

interface DashboardData {
  metrics: DashboardMetrics
  trend: TrendPoint[]
  leaderboard: CallerStats[]
  recent: RecentActivity[]
}

const WINDOWS: { key: Window; label: string }[] = [
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
]

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#181b27] rounded-lg ${className}`} />
}

function SkeletonKpi() {
  return (
    <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-4">
      <Skeleton className="h-3 w-1/2 mb-3" />
      <Skeleton className="h-6 w-2/3 mb-2" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  )
}

export default function DashboardPage() {
  const [activeWindow, setActiveWindow] = useState<Window>('7d')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (win: Window) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard?window=${win}`)
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Error ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(activeWindow) }, [activeWindow, fetchData])

  const m = data?.metrics

  return (
    <div className="p-6 min-h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-xl font-semibold text-[#e4e6f0]">Dashboard</h1>
        <div className="flex items-center gap-1 bg-[#10121a] border border-[#1c2035] rounded-lg p-1">
          {WINDOWS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveWindow(key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeWindow === key
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
          <button onClick={() => fetchData(activeWindow)} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* Compact KPI strip */}
      {loading ? (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonKpi key={i} />)}
        </div>
      ) : m ? (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
          <KpiCard label="Calls" value={m.calls_made} change={pctChange(m.calls_made, m.prev_calls_made)} compact />
          <KpiCard label="Positives" value={m.positive_replies} change={pctChange(m.positive_replies, m.prev_positive_replies)} compact />
          <KpiCard label="Booked" value={m.calls_booked} change={pctChange(m.calls_booked, m.prev_calls_booked)} compact accent="blue" />
          <KpiCard label="Closed" value={m.deals_closed} change={pctChange(m.deals_closed, m.prev_deals_closed)} compact accent="green" />
          <KpiCard label="Revenue" value={`£${m.setup_revenue.toLocaleString()}`} change={pctChange(m.setup_revenue, m.prev_setup_revenue)} compact accent="green" />
          <KpiCard label="Close %" value={`${(m.close_rate * 100).toFixed(1)}%`} compact accent="blue" />
        </div>
      ) : null}

      {/* Trend + leaderboard */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <Skeleton className="lg:col-span-2 h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="lg:col-span-2 rounded-xl border border-[#1c2035] bg-[#10121a] p-5">
            <p className="text-sm font-medium text-[#e4e6f0] mb-4">Activity trend</p>
            <TrendChart data={data.trend} window={activeWindow === 'yesterday' ? '7d' : activeWindow} />
          </div>
          <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-5">
            <p className="text-sm font-medium text-[#e4e6f0] mb-4">Leaderboard</p>
            <LeaderboardTable data={data.leaderboard} />
          </div>
        </div>
      ) : null}

      {/* Recent activity */}
      {loading ? (
        <Skeleton className="h-48 rounded-xl border border-[#1c2035]" />
      ) : data ? (
        <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-5">
          <p className="text-sm font-medium text-[#e4e6f0] mb-4">Recent activity</p>
          <ActivityFeed items={data.recent} />
        </div>
      ) : null}
    </div>
  )
}
