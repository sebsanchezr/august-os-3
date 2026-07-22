'use client'

import { useCallback, useEffect, useState } from 'react'

type Order = {
  id: string
  business: string | null // store URL
  revenue: string | null // best ad link
  timeline: string | null // notes
  email: string | null
  stage: string
  created_at: string | null
}

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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/paid-ads')
      const json = await res.json()
      setOrders(json.orders ?? [])
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const setStage = async (id: string, status: string) => {
    setBusyId(id)
    try {
      const res = await fetch('/api/paid-ads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, stage: status } : o)))
    } finally {
      setBusyId(null)
    }
  }

  const fmt = (s: string | null) =>
    s ? new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[#e4e6f0] mb-1">$97 Orders</h1>
      <p className="text-sm text-[#636780] mb-6">
        Set the stage to move an order through fulfilment. &quot;Delivered&quot; flips the customer&apos;s tracker.
      </p>

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
                <th className="text-left font-medium px-4 py-3">Stage</th>
                <th className="text-left font-medium px-4 py-3">Set stage</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[#636780]">Loading…</td></tr>
              )}
              {!loading && orders.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[#636780]">No $97 orders yet.</td></tr>
              )}
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-[#1c2035] last:border-0 text-[#e4e6f0]">
                  <td className="px-4 py-3 text-[#636780] whitespace-nowrap">{fmt(o.created_at)}</td>
                  <td className="px-4 py-3 max-w-[150px] truncate">
                    {o.business ? <a href={o.business} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">{o.business}</a> : '—'}
                  </td>
                  <td className="px-4 py-3 max-w-[170px] truncate">
                    {o.revenue ? <a href={o.revenue} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">{o.revenue}</a> : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#b4b7c9]">{o.email ?? '—'}</td>
                  <td className="px-4 py-3 max-w-[140px] truncate text-[#636780]">{o.timeline ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${STAGE_BADGE[o.stage]}`}>{STAGE_LABEL[o.stage]}</span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={o.stage}
                      disabled={busyId === o.id}
                      onChange={(e) => setStage(o.id, e.target.value)}
                      className="rounded-lg border border-[#1c2035] bg-[#181b27] px-2 py-1.5 text-xs text-[#e4e6f0] focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    >
                      {Object.entries(STAGE_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
