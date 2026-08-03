'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { KpiCard } from '@/components/kpi-card'

type Order = {
  id: string
  business: string | null
  email: string | null
  stage: string
  created_at: string | null
}
type Metrics = { total: number; delivered: number; inProgress: number; revenue: number }
type AgencyAdsSummary = { spend: number; leads: number; cpl: number | null; revenue: number }
type AgencyAdsRow = { date: string; spend: number; revenue: number; leads: number; purchases: number }

const STAGE_LABEL: Record<string, string> = {
  new: 'New',
  brief: 'Brief in',
  production: 'In production',
  review: 'Final review',
  delivered: 'Delivered',
}
const STAGE_BADGE: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  brief: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  production: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  review: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  delivered: 'bg-green-500/10 text-green-400 border-green-500/20',
}

export default function PaidAdsDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [adsSummary, setAdsSummary] = useState<AgencyAdsSummary | null>(null)
  const [adsRows, setAdsRows] = useState<AgencyAdsRow[]>([])
  const [adsLoading, setAdsLoading] = useState(true)
  const [adsConnected, setAdsConnected] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/paid-ads')
      const json = await res.json()
      setOrders(json.orders ?? [])
      setMetrics(json.metrics ?? null)
    } finally {
      setLoading(false)
    }
  }, [])
  const loadAds = useCallback(async () => {
    try {
      const res = await fetch('/api/ads?scope=agency')
      const json = await res.json()
      if (json.error) {
        setAdsConnected(false)
      } else {
        setAdsSummary(json.summary ?? null)
        setAdsRows(json.rows ?? [])
        setAdsConnected(!json.empty)
      }
    } finally {
      setAdsLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
    loadAds()
  }, [load, loadAds])

  const fmt = (s: string | null) =>
    s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#e4e6f0]">Paid Ads</h1>
          <p className="text-sm text-[#636780] mt-1">
            Our own $97 creative offer — orders, revenue and fulfilment pipeline.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/paid-ads/orders" className="rounded-lg border border-[#1c2035] px-3 py-1.5 text-xs font-medium text-[#b4b7c9] hover:text-[#e4e6f0]">
            Orders
          </Link>
          <Link href="/paid-ads/pipeline" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500">
            Pipeline
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Total orders" value={metrics?.total ?? (loading ? '…' : 0)} accent="blue" />
        <KpiCard label="Revenue" prefix="$" value={metrics?.revenue ?? (loading ? '…' : 0)} accent="green" />
        <KpiCard label="In production" value={metrics?.inProgress ?? (loading ? '…' : 0)} accent="amber" />
        <KpiCard label="Delivered" value={metrics?.delivered ?? (loading ? '…' : 0)} accent="default" />
      </div>

      <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#e4e6f0]">Recent orders</h2>
          <Link href="/paid-ads/orders" className="text-xs text-indigo-400 hover:underline">
            View all
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-[#636780] py-6 text-center">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-[#636780] py-6 text-center">No $97 orders yet.</p>
        ) : (
          <div className="space-y-2">
            {orders.slice(0, 6).map((o) => (
              <div
                key={o.id}
                className="grid grid-cols-[70px_1fr_auto] items-center gap-3 rounded-lg bg-[#181b27] px-4 py-2.5 text-sm"
              >
                <span className="text-[#636780] text-xs">{fmt(o.created_at)}</span>
                <span className="truncate text-[#e4e6f0]">{o.business || o.email || '—'}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded border ${STAGE_BADGE[o.stage]}`}>
                  {STAGE_LABEL[o.stage]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-[#e4e6f0] mb-1">Our ad spend</h2>
        <p className="text-xs text-[#636780] mb-4">
          August&apos;s own Meta ad account driving these orders — last 7 days.
        </p>

        {adsLoading ? (
          <p className="text-sm text-[#636780] py-6 text-center">Loading…</p>
        ) : !adsConnected ? (
          <p className="text-xs text-[#3d4060]">
            No agency ad spend synced yet. Set <code>AGENCY_META_AD_ACCOUNT_ID</code> to activate — house account (act_1721794349135023) is currently disabled in Meta, needs reactivating or swapping to the account under BM 1020754523930738 first.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <KpiCard label="Spend (7d)" prefix="$" value={adsSummary?.spend.toFixed(0) ?? 0} accent="amber" />
              <KpiCard label="Leads (7d)" value={adsSummary?.leads ?? 0} accent="blue" />
              <KpiCard label="CPL" prefix="$" value={adsSummary?.cpl ? adsSummary.cpl.toFixed(2) : '—'} accent="default" />
              <KpiCard label="Revenue (7d)" prefix="$" value={adsSummary?.revenue.toFixed(0) ?? 0} accent="green" />
            </div>
            <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-5">
              <div className="space-y-2">
                {adsRows.map((r) => (
                  <div
                    key={r.date}
                    className="grid grid-cols-[70px_1fr_1fr_1fr] items-center gap-3 rounded-lg bg-[#181b27] px-4 py-2.5 text-sm"
                  >
                    <span className="text-[#636780] text-xs">{fmt(r.date)}</span>
                    <span className="text-[#e4e6f0]">${r.spend.toFixed(0)} spend</span>
                    <span className="text-[#e4e6f0]">{r.leads} leads</span>
                    <span className="text-[#e4e6f0]">${r.revenue.toFixed(0)} rev</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
