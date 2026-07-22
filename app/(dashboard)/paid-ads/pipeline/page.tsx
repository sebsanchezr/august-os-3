'use client'

import { useCallback, useEffect, useState } from 'react'

type Order = {
  id: string
  business: string | null
  revenue: string | null
  email: string | null
  stage: string
  created_at: string | null
}

const STAGES: { key: string; label: string; dot: string }[] = [
  { key: 'new', label: 'New', dot: 'bg-blue-400' },
  { key: 'brief', label: 'Brief in', dot: 'bg-indigo-400' },
  { key: 'production', label: 'In production', dot: 'bg-amber-400' },
  { key: 'review', label: 'Final review', dot: 'bg-purple-400' },
  { key: 'delivered', label: 'Delivered', dot: 'bg-green-400' },
]

export default function PipelinePage() {
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

  const move = async (o: Order, dir: 1 | -1) => {
    const idx = STAGES.findIndex((s) => s.key === o.stage)
    const next = STAGES[idx + dir]
    if (!next) return
    setBusyId(o.id)
    try {
      const res = await fetch('/api/paid-ads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: o.id, status: next.key }),
      })
      if (res.ok) setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, stage: next.key } : x)))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#e4e6f0] mb-1">Order Pipeline</h1>
      <p className="text-sm text-[#636780] mb-6">
        Move each order through fulfilment. Landing at &quot;Delivered&quot; flips the customer&apos;s live tracker.
      </p>

      {loading ? (
        <p className="text-sm text-[#636780]">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {STAGES.map((stage, si) => {
            const col = orders.filter((o) => o.stage === stage.key)
            return (
              <div key={stage.key} className="rounded-xl border border-[#1c2035] bg-[#10121a] p-3">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-[#b4b7c9]">{stage.label}</h2>
                  <span className="ml-auto text-[10px] text-[#3d4060]">{col.length}</span>
                </div>
                <div className="space-y-2 min-h-[40px]">
                  {col.map((o) => (
                    <div key={o.id} className="rounded-lg bg-[#181b27] border border-[#1c2035] p-3">
                      <p className="text-sm text-[#e4e6f0] truncate">{o.business || o.email || 'Order'}</p>
                      <p className="text-[11px] text-[#636780] truncate mt-0.5">{o.email}</p>
                      <div className="flex items-center justify-between mt-2">
                        <button
                          onClick={() => move(o, -1)}
                          disabled={si === 0 || busyId === o.id}
                          className="text-[11px] text-[#636780] hover:text-[#e4e6f0] disabled:opacity-30"
                        >
                          ← back
                        </button>
                        <button
                          onClick={() => move(o, 1)}
                          disabled={si === STAGES.length - 1 || busyId === o.id}
                          className="rounded bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:opacity-30"
                        >
                          {si === STAGES.length - 2 ? 'Deliver →' : 'Advance →'}
                        </button>
                      </div>
                    </div>
                  ))}
                  {col.length === 0 && <p className="text-[11px] text-[#3d4060] px-1 py-2">—</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
