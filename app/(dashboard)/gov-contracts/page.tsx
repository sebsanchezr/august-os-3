'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { KpiCard } from '@/components/kpi-card'
import { fetchGovDashboard } from '@/lib/pipeline-client'
import type { GovDashboard } from '@/lib/types'

const OUTREACH_LABELS: Record<string, string> = {
  pushed_to_instantly: 'Sent, No Reply',
  replied: 'Replied',
  meeting: 'Meeting',
}

const BID_LABELS: Record<string, string> = {
  bid_drafted: 'Drafted, Not Submitted',
  submitted: 'Submitted, Awaiting Outcome',
  won: 'Won',
  lost: 'Lost',
}

function formatPct(v: number): string {
  return `${(v * 100).toFixed(0)}%`
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
          <p className="text-xs text-[#636780] mt-1">Tenders being emailed via Instantly, and bids in progress</p>
        </div>
        <Link
          href="/gov-contracts/bids"
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
        >
          Open Bid Manager
        </Link>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-sm text-[#636780]">Loading gov contracts data...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <KpiCard label="In Instantly Outreach" value={data.outreach_count} accent="blue" />
            <KpiCard label="Bids In Progress" value={data.bids_count} accent="amber" />
            <KpiCard label="Win Rate" value={formatPct(data.win_rate)} accent="green" subtext="of submitted bids decided" />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#636780] mb-1">Instantly Outreach</h2>
              <p className="text-[10px] text-[#3a3d52] mb-4">Buyer contacts pushed into the gov Instantly campaign</p>
              <table className="w-full text-xs">
                <tbody className="text-[#e4e6f0] tabular-nums">
                  {Object.entries(OUTREACH_LABELS).map(([key, label]) => (
                    <tr key={key} className="border-t border-[#1c2035] first:border-t-0">
                      <td className="py-1.5 text-[#636780]">{label}</td>
                      <td className="py-1.5 text-right font-medium">{data.by_status[key] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.instantly ? (
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#1c2035] text-center">
                  <div>
                    <p className="text-[10px] text-[#636780] uppercase">Sent</p>
                    <p className="text-sm font-semibold text-[#e4e6f0] tabular-nums">{data.instantly.emails_sent_total}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#636780] uppercase">Opens</p>
                    <p className="text-sm font-semibold text-[#e4e6f0] tabular-nums">{data.instantly.opens_total}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#636780] uppercase">Replies</p>
                    <p className="text-sm font-semibold text-[#e4e6f0] tabular-nums">{data.instantly.replies_total}</p>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-[#3a3d52] mt-4 pt-4 border-t border-[#1c2035]">No Instantly data synced yet.</p>
              )}
            </div>

            <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#636780] mb-1">Bids</h2>
              <p className="text-[10px] text-[#3a3d52] mb-4">Tenders we've decided to draft or submit a response for</p>
              <table className="w-full text-xs">
                <tbody className="text-[#e4e6f0] tabular-nums">
                  {Object.entries(BID_LABELS).map(([key, label]) => (
                    <tr key={key} className="border-t border-[#1c2035] first:border-t-0">
                      <td className="py-1.5 text-[#636780]">{label}</td>
                      <td className="py-1.5 text-right font-medium">{data.by_status[key] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[10px] text-[#3a3d52]">
            Only tenders that reached outreach or bidding show here — screened-out notices are dropped before they sync. Submitted / Won / Lost are set manually in the Bid Manager.
          </p>
        </>
      )}
    </div>
  )
}
