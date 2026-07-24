'use client'

import { useCallback, useEffect, useState } from 'react'
import { KpiCard } from '@/components/kpi-card'

type Summary = {
  month: string
  status: string
  revenue_total: number | null
  cost_total: number | null
  operating_profit: number | null
  operating_margin: number | null
  owner_drawings: number | null
  sustainable_draw: number | null
  narrative: string | null
}
type CatRow = { category: string; total: number }
type RevRow = { label: string; amount: number; source: string }
type DrawRow = { label: string; amount: number }
type FlagRow = { label: string; flag: string; amount: number }
type LiveSignals = { agencyAdSpend: number; offerOrders: number; offerRevenue: number }
type MonthOpt = { month: string; status: string }

type FinanceData = {
  month: string | null
  summary: Summary | null
  byCategory: CatRow[]
  revenue: RevRow[]
  drawings: DrawRow[]
  flags: FlagRow[]
  liveSignals: LiveSignals | null
  availableMonths: MonthOpt[]
}

const CAT_LABEL: Record<string, string> = {
  cost_of_sales: 'Cost of sales',
  team: 'Team',
  contractors: 'Contractors',
  acquisition_tools: 'Acquisition tools',
  delivery_tools: 'Delivery / AI tools',
  overhead: 'Overhead',
  regulatory: 'Regulatory',
}

const gbp0 = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-GB', { maximumFractionDigits: 0 })
const gbp2 = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function monthLabel(iso: string) {
  const [y, m] = iso.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export default function FinancePage() {
  const [data, setData] = useState<FinanceData | null>(null)
  const [month, setMonth] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (m: string | null) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance${m ? `?month=${m}` : ''}`)
      const json = (await res.json()) as FinanceData
      setData(json)
      setMonth(json.month)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(null)
  }, [load])

  const s = data?.summary
  const marginPct = s?.operating_margin != null ? Math.round(s.operating_margin * 100) : null
  const maxCat = Math.max(1, ...(data?.byCategory ?? []).map((c) => c.total))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#e4e6f0]">Finance</h1>
          <p className="text-sm text-[#636780] mt-1">
            Consolidated monthly P&amp;L across Tide, Lillys/Revolut and Stripe. Owner-only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.availableMonths && data.availableMonths.length > 0 && (
            <select
              value={month ?? ''}
              onChange={(e) => load(e.target.value)}
              className="rounded-lg border border-[#1c2035] bg-[#10121a] px-3 py-1.5 text-xs font-medium text-[#b4b7c9]"
            >
              {data.availableMonths.map((m) => (
                <option key={m.month} value={m.month}>{monthLabel(m.month)}</option>
              ))}
            </select>
          )}
          {s?.status && (
            <span className={`text-[10px] px-2 py-0.5 rounded border ${
              s.status === 'final'
                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {s.status === 'final' ? 'Final' : 'Draft'}
            </span>
          )}
        </div>
      </div>

      {loading && !data ? (
        <p className="text-sm text-[#636780] py-10 text-center">Loading…</p>
      ) : !s ? (
        <p className="text-sm text-[#636780] py-10 text-center">No finance data for this month yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <KpiCard label="Revenue" prefix="£" value={gbp0(s.revenue_total)} accent="green" />
            <KpiCard label="Real costs" prefix="£" value={gbp0(s.cost_total)} accent="amber" />
            <KpiCard label="Operating profit" prefix="£" value={gbp0(s.operating_profit)} accent="blue" />
            <KpiCard label="Operating margin" suffix="%" value={marginPct ?? '—'} accent="green" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KpiCard label="Owner drawings" prefix="£" value={gbp0(s.owner_drawings)} accent="default" />
            <KpiCard
              label="Sustainable draw / mo"
              prefix="£"
              value={gbp0(s.sustainable_draw)}
              accent="default"
              subtext="Take up to this without shrinking cash"
            />
            <div className="lg:col-span-2 rounded-xl border border-[#1c2035] bg-[#10121a] p-5">
              <p className="text-xs font-medium text-[#636780] uppercase tracking-wider mb-2">Live signals (current-month, pre-statement)</p>
              <div className="flex gap-6">
                <div>
                  <p className="text-lg font-bold tabular-nums text-[#e4e6f0]">£{gbp0(data?.liveSignals?.agencyAdSpend)}</p>
                  <p className="text-[11px] text-[#636780]">Agency ad spend</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-[#e4e6f0]">{data?.liveSignals?.offerOrders ?? 0}</p>
                  <p className="text-[11px] text-[#636780]">$97 orders</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-[#e4e6f0]">£{gbp0(data?.liveSignals?.offerRevenue)}</p>
                  <p className="text-[11px] text-[#636780]">$97 revenue</p>
                </div>
              </div>
            </div>
          </div>

          {s.narrative && (
            <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-5 mb-8">
              <p className="text-sm text-[#b4b7c9] leading-relaxed">{s.narrative}</p>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Costs by category */}
            <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-5">
              <h2 className="text-sm font-semibold text-[#e4e6f0] mb-4">Costs by category</h2>
              <div className="space-y-3">
                {(data?.byCategory ?? []).map((c) => (
                  <div key={c.category}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-[#b4b7c9]">{CAT_LABEL[c.category] ?? c.category}</span>
                      <span className="text-[#e4e6f0] tabular-nums">£{gbp2(c.total)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#181b27] overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${(c.total / maxCat) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue + drawings */}
            <div className="space-y-6">
              <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-5">
                <h2 className="text-sm font-semibold text-[#e4e6f0] mb-4">Revenue</h2>
                <div className="space-y-2">
                  {(data?.revenue ?? []).map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-[#b4b7c9]">{r.label}</span>
                      <span className="text-green-400 tabular-nums">£{gbp2(r.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-5">
                <h2 className="text-sm font-semibold text-[#e4e6f0] mb-4">Owner drawings</h2>
                <div className="space-y-2">
                  {(data?.drawings ?? []).map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-[#b4b7c9]">{r.label}</span>
                      <span className="text-[#636780] tabular-nums">£{gbp2(r.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Flags */}
          {data?.flags && data.flags.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-5 mt-6">
              <h2 className="text-sm font-semibold text-amber-400 mb-3">Flags to resolve</h2>
              <div className="space-y-2">
                {data.flags.map((f, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 text-sm">
                    <span className="text-[#b4b7c9]">{f.label} <span className="text-[#636780]">— {f.flag}</span></span>
                    <span className="text-[#636780] tabular-nums shrink-0">£{gbp2(f.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
