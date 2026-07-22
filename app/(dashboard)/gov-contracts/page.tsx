'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react'
import { KpiCard } from '@/components/kpi-card'
import { fetchGovDashboard } from '@/lib/pipeline-client'
import type { GovDashboard, GovInstantlyDaily } from '@/lib/types'

// How long ago the pipeline last synced, in human terms.
function relativeAge(iso: string | null): string {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  const h = Math.floor(ms / (60 * 60 * 1000))
  if (h < 1) return 'under an hour ago'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function InstantlyDaily({ series }: { series: GovInstantlyDaily[] }) {
  const last30 = series.slice(-30)
  if (last30.length === 0) {
    return <p className="text-[10px] text-[#3a3d52]">No Instantly data synced yet.</p>
  }
  const maxSent = Math.max(1, ...last30.map((d) => d.emails_sent_total))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[#636780] text-left border-b border-[#1c2035]">
            <th className="py-2 pr-3 font-medium">Date</th>
            <th className="py-2 px-3 font-medium">Sent (cumulative)</th>
            <th className="py-2 px-3 font-medium text-right">Opens</th>
            <th className="py-2 pl-3 font-medium text-right">Replies</th>
          </tr>
        </thead>
        <tbody className="text-[#e4e6f0] tabular-nums">
          {last30.map((d) => (
            <tr key={d.date} className="border-b border-[#1c2035] last:border-b-0">
              <td className="py-1.5 pr-3 text-[#8b8fa8] whitespace-nowrap">{d.date}</td>
              <td className="py-1.5 px-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 rounded-full bg-sky-500/70" style={{ width: `${Math.max(4, (d.emails_sent_total / maxSent) * 100)}px` }} />
                  <span className="text-[#e4e6f0]">{d.emails_sent_total}</span>
                </div>
              </td>
              <td className="py-1.5 px-3 text-right">{d.opens_total}</td>
              <td className="py-1.5 pl-3 text-right">{d.replies_total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function GovContractsPage() {
  const [data, setData] = useState<GovDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchGovDashboard()
      .then((res) => { if (!cancelled) setData(res) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="p-6 min-h-screen bg-[#08090c]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#e4e6f0]">Gov Contracts</h1>
          <p className="text-xs text-[#636780] mt-1">Bids in progress and buyer outreach via Instantly</p>
        </div>
        <Link
          href="/gov-contracts/bids"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
        >
          Open Bid Manager <ArrowRight size={13} />
        </Link>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-sm text-[#636780]">Loading gov contracts data...</span>
        </div>
      ) : (
        <>
          {/* Pipeline health strip */}
          <div className={`flex items-center gap-2 mb-6 px-3 py-2 rounded-lg border text-xs w-fit ${
            data.sync_stale
              ? 'bg-amber-950/30 border-amber-900/50 text-amber-300'
              : 'bg-[#10121a] border-[#1c2035] text-[#8b8fa8]'
          }`}>
            {data.sync_stale ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} className="text-green-400" />}
            <span>
              Pipeline last synced {relativeAge(data.last_sync)}
              {data.sync_stale && ' — stale (over 48h). Check the gov engine cron.'}
            </span>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <KpiCard compact label="Awaiting Submission" value={data.awaiting_submission} accent="amber" />
            <KpiCard compact label="Submitted" value={data.submitted_count} accent="blue" />
            <KpiCard compact label="Won" value={data.won_count} accent="green" />
            <KpiCard compact label="Deadlines Next 14d" value={data.deadlines_14d} accent="amber" />
            <KpiCard compact label="Emails Sent" value={data.emails_sent_total} accent="default" />
            <KpiCard compact label="Replies" value={data.replies_total} accent="default" />
          </div>

          {/* Instantly daily outreach */}
          <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#636780]">Instantly Outreach</h2>
              <span className="text-[10px] text-[#3a3d52]">Last 30 days</span>
            </div>
            <p className="text-[10px] text-[#3a3d52] mb-4">Daily snapshot of the gov Instantly campaign (cumulative totals per day)</p>
            <InstantlyDaily series={data.instantly_series} />
          </div>

          <p className="text-[10px] text-[#3a3d52]">
            Only tenders that reached outreach or bidding show here — screened-out notices are dropped before they sync. Submitted / Won / Lost are set in the Bid Manager.
          </p>
        </>
      )}
    </div>
  )
}
