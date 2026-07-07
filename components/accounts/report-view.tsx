'use client'

import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { Client, ClientMetricsDaily } from '@/lib/types'

// Sleek on-page weekly report. Reads client_metrics_daily (populated by the Mac
// reporter) and renders headline metrics + a spend/revenue trend + top creatives.

type Props = {
  account: Client & { am?: { id: string; name: string } | null }
  metrics30d: ClientMetricsDaily[]
}

type Range = 7 | 30

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0)
}

function money(n: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

export default function ReportView({ account, metrics30d }: Props) {
  const [range, setRange] = useState<Range>(7)
  const currency = account.currency || 'GBP'

  const { current, previous } = useMemo(() => {
    const sorted = [...metrics30d].sort((a, b) => a.date.localeCompare(b.date))
    const current = sorted.slice(-range)
    const previous = sorted.slice(-range * 2, -range)
    return { current, previous }
  }, [metrics30d, range])

  if (metrics30d.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#1c2035] bg-[#0e1017] p-10 text-center">
        <p className="text-[#636780] text-sm">No metrics yet.</p>
        <p className="text-[#3d4060] text-xs mt-1">
          Once the Mac reporter runs its daily sync, this page fills with live ad performance.
        </p>
      </div>
    )
  }

  function agg(rows: ClientMetricsDaily[]) {
    const spend = sum(rows.map((r) => r.spend ?? 0))
    const revenue = sum(rows.map((r) => r.revenue ?? 0))
    const purchases = sum(rows.map((r) => r.purchases ?? 0))
    const clicks = sum(rows.map((r) => r.clicks ?? 0))
    const impressions = sum(rows.map((r) => r.impressions ?? 0))
    return {
      spend,
      revenue,
      purchases,
      roas: spend > 0 ? revenue / spend : null,
      cpa: purchases > 0 ? spend / purchases : null,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    }
  }

  const cur = agg(current)
  const prev = agg(previous)

  const maxDaily = Math.max(...current.map((r) => Math.max(r.spend ?? 0, r.revenue ?? 0)), 1)

  // Latest day's top creatives
  const latestWithCreatives = [...current].reverse().find((r) => (r.top_creatives?.length ?? 0) > 0)
  const topCreatives = latestWithCreatives?.top_creatives ?? []

  const periodLabel = range === 7 ? 'Last 7 days' : 'Last 30 days'

  return (
    <div className="space-y-6">
      {/* Header + range toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[#e4e6f0] font-semibold text-sm">{account.name} performance</h2>
          <p className="text-[#636780] text-xs mt-0.5">{periodLabel} vs prior {range} days</p>
        </div>
        <div className="flex items-center gap-1 bg-[#181b27] rounded-lg p-0.5 border border-[#1c2035]">
          {([7, 30] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-md text-xs transition-colors ${
                range === r ? 'bg-indigo-600 text-white' : 'text-[#636780] hover:text-[#e4e6f0]'
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* Headline metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard
          label="Ad spend"
          value={money(cur.spend, currency)}
          delta={pctDelta(cur.spend, prev.spend)}
          invertColour
        />
        <MetricCard
          label="Revenue"
          value={money(cur.revenue, currency)}
          delta={pctDelta(cur.revenue, prev.revenue)}
        />
        <MetricCard
          label="ROAS"
          value={cur.roas != null ? `${cur.roas.toFixed(2)}x` : '--'}
          delta={pctDelta(cur.roas, prev.roas)}
          sub={account.target_roas ? `target ${account.target_roas}x` : undefined}
          target={
            cur.roas != null && account.target_roas != null
              ? cur.roas >= account.target_roas ? 'hit' : cur.roas >= account.target_roas * 0.9 ? 'near' : 'miss'
              : undefined
          }
        />
        <MetricCard
          label="Purchases"
          value={String(cur.purchases)}
          delta={pctDelta(cur.purchases, prev.purchases)}
        />
        <MetricCard
          label="CPA"
          value={cur.cpa != null ? money(cur.cpa, currency) : '--'}
          delta={pctDelta(cur.cpa, prev.cpa)}
          invertColour
          sub={account.target_cpa ? `target ${money(account.target_cpa, currency)}` : undefined}
        />
        <MetricCard
          label="Click-through rate"
          value={cur.ctr != null ? `${cur.ctr.toFixed(2)}%` : '--'}
          delta={pctDelta(cur.ctr, prev.ctr)}
        />
      </div>

      {/* Spend vs revenue trend */}
      <div className="rounded-xl border border-[#1c2035] bg-[#0e1017] p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[9px] font-bold tracking-widest uppercase text-[#636780]">Daily spend vs revenue</p>
          <div className="flex items-center gap-3 text-[9px]">
            <span className="flex items-center gap-1 text-[#636780]"><span className="w-2 h-2 rounded-sm bg-indigo-500 inline-block" /> Spend</span>
            <span className="flex items-center gap-1 text-[#636780]"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> Revenue</span>
          </div>
        </div>
        <div className="flex items-end gap-1 h-32">
          {current.map((row) => (
            <div key={row.date} className="flex-1 flex flex-col items-center justify-end gap-0.5 group relative">
              <div className="w-full flex items-end justify-center gap-0.5 h-full">
                <div
                  className="w-1/2 bg-indigo-500/80 rounded-t-sm transition-all group-hover:bg-indigo-400"
                  style={{ height: `${((row.spend ?? 0) / maxDaily) * 100}%` }}
                />
                <div
                  className="w-1/2 bg-emerald-500/80 rounded-t-sm transition-all group-hover:bg-emerald-400"
                  style={{ height: `${((row.revenue ?? 0) / maxDaily) * 100}%` }}
                />
              </div>
              <span className="text-[8px] text-[#3d4060]">{row.date.slice(8, 10)}</span>
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[#1c2035] rounded-md px-2 py-1 text-[9px] text-[#e4e6f0] whitespace-nowrap z-10">
                {row.date.slice(5)}: {money(row.spend ?? 0, currency)} / {money(row.revenue ?? 0, currency)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top creatives */}
      {topCreatives.length > 0 && (
        <div>
          <p className="text-[9px] font-bold tracking-widest uppercase text-[#636780] mb-3">Top performing creatives</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topCreatives.slice(0, 3).map((c) => {
              // Meta thumbnails end in _t.jpg (tiny) — request _n.jpg (normal ~320px)
              const imgUrl = c.thumbnail_url
                ? c.thumbnail_url.replace(/_t\.jpg/, '_n.jpg').replace(/_s\.jpg/, '_n.jpg')
                : null
              return (
              <div key={c.ad_id} className="rounded-xl border border-[#1c2035] bg-[#0e1017] overflow-hidden">
                {imgUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgUrl} alt={c.name} className="w-full" style={{ maxHeight: '200px', objectFit: 'contain', background: '#181b27' }} />
                ) : (
                  <div className="w-full h-28 bg-[#181b27] flex items-center justify-center text-[#3d4060] text-xs">No preview</div>
                )}
                <div className="p-3">
                  <p className="text-[#e4e6f0] text-xs font-medium truncate">{c.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-[#636780]">
                    <span>{money(c.spend ?? 0, currency)}</span>
                    <span className="text-emerald-400">{c.roas?.toFixed(2)}x ROAS</span>
                  </div>
                </div>
              </div>
            )})}
          </div>
        </div>
      )}
    </div>
  )
}

function pctDelta(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null
  return ((cur - prev) / prev) * 100
}

function MetricCard({
  label, value, delta, sub, invertColour, target,
}: {
  label: string
  value: string
  delta: number | null
  sub?: string
  invertColour?: boolean  // for spend/CPA, up is bad
  target?: 'hit' | 'near' | 'miss'
}) {
  const up = delta != null && delta > 0.5
  const down = delta != null && delta < -0.5
  // For normal metrics up=good(green). For invert (spend/cpa) up=bad(red).
  const good = invertColour ? down : up
  const bad = invertColour ? up : down
  const deltaColour = delta == null ? 'text-[#3d4060]' : good ? 'text-emerald-400' : bad ? 'text-red-400' : 'text-[#636780]'

  const targetColour = target === 'hit' ? 'text-emerald-400' : target === 'near' ? 'text-amber-400' : target === 'miss' ? 'text-red-400' : 'text-[#e4e6f0]'

  return (
    <div className="rounded-xl border border-[#1c2035] bg-[#0e1017] p-4">
      <p className="text-[9px] uppercase tracking-widest text-[#636780] mb-1.5">{label}</p>
      <div className="flex items-baseline justify-between">
        <p className={`text-xl font-semibold ${target ? targetColour : 'text-[#e4e6f0]'}`}>{value}</p>
        {delta != null && (
          <span className={`flex items-center gap-0.5 text-[10px] ${deltaColour}`}>
            {up ? <TrendingUp size={10} /> : down ? <TrendingDown size={10} /> : <Minus size={10} />}
            {Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>
      {sub && <p className="text-[10px] text-[#3d4060] mt-0.5">{sub}</p>}
    </div>
  )
}
