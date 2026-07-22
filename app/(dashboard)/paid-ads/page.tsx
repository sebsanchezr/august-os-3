'use client'

import { useCallback, useEffect, useState } from 'react'
import { KpiCard } from '@/components/kpi-card'

type Order = {
  id: string
  business: string | null // store URL
  revenue: string | null // best ad link
  timeline: string | null // notes
  email: string | null
  status: string | null
  delivered_at: string | null
  created_at: string | null
}

type Metrics = { total: number; delivered: number; inProgress: number; revenue: number }

export default function PaidAdsPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

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

  useEffect(() => {
    load()
  }, [load])

  const toggle = async (o: Order) => {
    setBusyId(o.id)
    const next = o.status === 'delivered' ? 'in_progress' : 'delivered'
    try {
      const res = await fetch('/api/paid-ads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: o.id, status: next }),
      })
      if (res.ok) {
        setOrders((prev) =>
          prev.map((x) => (x.id === o.id ? { ...x, status: next } : x))
        )
        setMetrics((m) =>
          m
            ? {
                ...m,
                delivered: m.delivered + (next === 'delivered' ? 1 : -1),
                inProgress: m.inProgress + (next === 'delivered' ? -1 : 1),
              }
            : m
        )
      }
    } finally {
      setBusyId(null)
    }
  }

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#e4e6f0]">Paid Ads — $97 Orders</h1>
        <p className="text-sm text-[#636780] mt-1">
          Ten-creative orders from the PureScale /ads page. Mark delivered to flip the customer&apos;s tracker.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Total orders" value={metrics?.total ?? (loading ? '…' : 0)} accent="blue" />
        <KpiCard label="Revenue" prefix="$" value={metrics?.revenue ?? (loading ? '…' : 0)} accent="green" />
        <KpiCard label="In production" value={metrics?.inProgress ?? (loading ? '…' : 0)} accent="amber" />
        <KpiCard label="Delivered" value={metrics?.delivered ?? (loading ? '…' : 0)} accent="default" />
      </div>

      <div className="rounded-xl border border-[#1c2035] bg-[#10121a] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-[#3d4060] border-b border-[#1c2035]">
                <th className="text-left font-medium px-4 py-3">When</th>
                <th className="text-left font-medium px-4 py-3">Store</th>
                <th className="text-left font-medium px-4 py-3">Best ad</th>
                <th className="text-left font-medium px-4 py-3">Email</th>
                <th className="text-left font-medium px-4 py-3">Notes</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#636780]">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#636780]">
                    No $97 orders yet.
                  </td>
                </tr>
              )}
              {orders.map((o) => {
                const delivered = o.status === 'delivered'
                return (
                  <tr key={o.id} className="border-b border-[#1c2035] last:border-0 text-[#e4e6f0]">
                    <td className="px-4 py-3 text-[#636780] whitespace-nowrap">{fmtDate(o.created_at)}</td>
                    <td className="px-4 py-3 max-w-[160px] truncate">
                      {o.business ? (
                        <a href={o.business} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                          {o.business}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 max-w-[180px] truncate">
                      {o.revenue ? (
                        <a href={o.revenue} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                          {o.revenue}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#b4b7c9]">{o.email ?? '—'}</td>
                    <td className="px-4 py-3 max-w-[160px] truncate text-[#636780]">{o.timeline ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded border ${
                          delivered
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {delivered ? 'Delivered' : 'In production'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggle(o)}
                        disabled={busyId === o.id}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                          delivered
                            ? 'border border-[#1c2035] text-[#636780] hover:text-[#e4e6f0]'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                      >
                        {busyId === o.id ? '…' : delivered ? 'Undo' : 'Mark delivered'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
