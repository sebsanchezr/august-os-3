'use client'

import { useEffect, useState } from 'react'
import { KpiCard } from '@/components/kpi-card'
import { fetchAcquisition } from '@/lib/pipeline-client'
import type { AcquisitionRollup } from '@/lib/types'

const WINDOWS: { key: '7d' | '30d' | 'qtd'; label: string }[] = [
  { key: '7d',  label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: 'qtd', label: 'Quarter to Date' },
]

const CHANNEL_LABELS: Record<string, string> = {
  cold_call: 'Cold Call',
  cold_email: 'Cold Email',
  linkedin: 'LinkedIn',
  gov: 'Gov Contracts',
  upwork: 'Upwork',
}

function formatMoney(amount: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function formatPct(v: number): string {
  return `${(v * 100).toFixed(0)}%`
}

export default function AcquisitionPage() {
  const [window, setWindowFilter] = useState<'7d' | '30d' | 'qtd'>('7d')
  const [data, setData] = useState<AcquisitionRollup | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchAcquisition(window)
      .then((res) => { if (!cancelled) setData(res) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [window])

  return (
    <div className="p-6 min-h-screen bg-[#08090c]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#e4e6f0]">Acquisition Command Center</h1>
          <p className="text-xs text-[#636780] mt-1">Every channel, one funnel</p>
        </div>
        <div className="flex items-center gap-1 bg-[#10121a] border border-[#1c2035] rounded-lg p-1">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWindowFilter(w.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                window === w.key ? 'bg-indigo-600 text-white' : 'text-[#636780] hover:text-[#e4e6f0]'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-sm text-[#636780]">Loading acquisition data...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-5 gap-4 mb-6">
            <KpiCard label="New Prospects" value={data.kpis.new_prospects} accent="blue" />
            <KpiCard label="Booked Calls" value={data.kpis.booked_calls} accent="blue" />
            <KpiCard label="Show Rate" value={formatPct(data.kpis.show_rate)} accent="amber" />
            <KpiCard label="Close Rate" value={formatPct(data.kpis.close_rate)} accent="amber" />
            <KpiCard label="New MRR" value={formatMoney(data.kpis.new_mrr)} accent="green" />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#636780] mb-4">Funnel by Channel</h2>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#636780] text-left">
                    <th className="pb-2 font-medium">Channel</th>
                    <th className="pb-2 font-medium text-right">Sourced</th>
                    <th className="pb-2 font-medium text-right">Contacted</th>
                    <th className="pb-2 font-medium text-right">Positive</th>
                    <th className="pb-2 font-medium text-right">Booked</th>
                    <th className="pb-2 font-medium text-right">Showed</th>
                    <th className="pb-2 font-medium text-right">Won</th>
                  </tr>
                </thead>
                <tbody className="text-[#e4e6f0] tabular-nums">
                  {Object.entries(data.channels).map(([key, funnel]) => (
                    <tr key={key} className="border-t border-[#1c2035]">
                      <td className="py-2">{CHANNEL_LABELS[key] ?? key}</td>
                      <td className="py-2 text-right">{funnel.sourced}</td>
                      <td className="py-2 text-right">{funnel.contacted}</td>
                      <td className="py-2 text-right">{funnel.positive_reply}</td>
                      <td className="py-2 text-right">{funnel.booked}</td>
                      <td className="py-2 text-right">{funnel.showed}</td>
                      <td className="py-2 text-right">{funnel.won}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-[#1c2035] font-semibold">
                    <td className="py-2">Blended</td>
                    <td className="py-2 text-right">{data.blended.sourced}</td>
                    <td className="py-2 text-right">{data.blended.contacted}</td>
                    <td className="py-2 text-right">{data.blended.positive_reply}</td>
                    <td className="py-2 text-right">{data.blended.booked}</td>
                    <td className="py-2 text-right">{data.blended.showed}</td>
                    <td className="py-2 text-right">{data.blended.won}</td>
                  </tr>
                </tbody>
              </table>
              {data.channels.gov.note && (
                <p className="text-[10px] text-[#3a3d52] mt-3">Gov: {data.channels.gov.note}</p>
              )}
            </div>

            <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#636780] mb-4">ROI by Channel</h2>
              {data.roi.length === 0 ? (
                <p className="text-xs text-[#636780]">No won or booked deals in this window yet.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#636780] text-left">
                      <th className="pb-2 font-medium">Channel</th>
                      <th className="pb-2 font-medium text-right">Booked</th>
                      <th className="pb-2 font-medium text-right">Won</th>
                      <th className="pb-2 font-medium text-right">New MRR</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#e4e6f0] tabular-nums">
                    {data.roi.map((r) => (
                      <tr key={r.channel} className="border-t border-[#1c2035]">
                        <td className="py-2">{CHANNEL_LABELS[r.channel] ?? r.channel}</td>
                        <td className="py-2 text-right">{r.booked}</td>
                        <td className="py-2 text-right">{r.won}</td>
                        <td className="py-2 text-right text-green-400">{formatMoney(r.new_mrr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <p className="text-[10px] text-[#3a3d52]">{data.currency_note}</p>
        </>
      )}
    </div>
  )
}
