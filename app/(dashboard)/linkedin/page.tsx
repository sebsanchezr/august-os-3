'use client'

import { useEffect, useState, useCallback } from 'react'
import { KpiCard } from '@/components/kpi-card'
import { timeAgo } from '@/lib/utils'
import { Activity, Linkedin } from 'lucide-react'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#181b27] rounded-lg ${className}`} />
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-10 h-10 rounded-full bg-[#181b27] flex items-center justify-center mb-3">
        <Activity className="w-4 h-4 text-[#3d4060]" />
      </div>
      <p className="text-sm text-[#3d4060]">{label}</p>
    </div>
  )
}

const STATUS_PILL: Record<string, string> = {
  'DM Pending': 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  'Following Up': 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  'Replied': 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
}

const EVENT_LABELS: Record<string, string> = {
  connection_sent: 'Connect sent',
  connection_accepted: 'Connect accepted',
  withdrawn: 'Withdrawn',
  dm_step_1_sent: 'DM 1 sent',
  dm_step_2_sent: 'DM 2 sent',
  dm_step_3_sent: 'DM 3 sent',
  dm_approval_pending: 'Approval pending',
  reply_received: 'Reply received',
  replied: 'Replied',
}

export default function LinkedInDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/linkedin/stats')
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const kpis = data?.kpis
  const pipeline: any[] = data?.pipeline ?? []

  return (
    <div className="p-6 min-h-full">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <Linkedin className="w-5 h-5 text-[#636780]" />
        <h1 className="text-xl font-semibold text-[#e4e6f0]">LinkedIn Connects</h1>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-5 flex items-center justify-between">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={fetchData}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI row */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#1c2035] bg-[#10121a] p-5">
              <Skeleton className="h-3 w-1/2 mb-3" />
              <Skeleton className="h-7 w-2/3" />
            </div>
          ))}
        </div>
      ) : kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <KpiCard
            label="Connects Sent"
            value={kpis.connects_sent_total}
            accent="default"
            subtext={`last 7 days: ${kpis.connects_sent_7d}`}
          />
          <KpiCard
            label="Acceptance Rate"
            value={kpis.acceptance_rate}
            suffix="%"
            accent="blue"
            subtext="of all sent"
          />
          <KpiCard
            label="Reply Rate"
            value={kpis.reply_rate}
            suffix="%"
            accent="green"
            subtext="of DMs sent"
          />
          <KpiCard
            label="Pending Approvals"
            value={kpis.approvals_pending}
            accent="amber"
            subtext="awaiting your tap"
          />
        </div>
      ) : null}

      {/* Active Pipeline table */}
      <div className="rounded-xl border border-[#1c2035] bg-[#0f1018] p-5">
        <p className="text-sm font-medium text-[#e4e6f0] mb-4 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-[#636780]" />
          Active Pipeline
        </p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : pipeline.length === 0 ? (
          <EmptyState label="No accepted connections yet. Pipeline will populate once leads accept." />
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-3 pb-2 border-b border-[#1c2035]">
              <p className="text-[10px] font-medium text-[#3d4060] uppercase tracking-wider col-span-4">Name / Company</p>
              <p className="text-[10px] font-medium text-[#3d4060] uppercase tracking-wider col-span-2">Industry</p>
              <p className="text-[10px] font-medium text-[#3d4060] uppercase tracking-wider col-span-2">Status</p>
              <p className="text-[10px] font-medium text-[#3d4060] uppercase tracking-wider col-span-2">Last Activity</p>
              <p className="text-[10px] font-medium text-[#3d4060] uppercase tracking-wider col-span-2">Next Action</p>
            </div>

            <div className="space-y-1 mt-2">
              {pipeline.map((lead: any) => (
                <div
                  key={lead.id}
                  className="grid grid-cols-12 gap-2 bg-[#181b27] rounded-lg px-3 py-2.5 items-center"
                >
                  <div className="col-span-4 min-w-0">
                    <p className="text-sm text-[#e4e6f0] font-medium truncate">
                      {lead.first_name} {lead.last_name}
                    </p>
                    <p className="text-xs text-[#636780] truncate">{lead.company_name ?? ''}</p>
                  </div>
                  <p className="col-span-2 text-xs text-[#636780] truncate">
                    {lead.industry ?? lead.niche ?? ''}
                  </p>
                  <div className="col-span-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_PILL[lead.status_label] ?? STATUS_PILL['DM Pending']}`}>
                      {lead.status_label}
                    </span>
                  </div>
                  <p className="col-span-2 text-xs text-[#636780]">
                    {lead.last_activity_at ? timeAgo(lead.last_activity_at) : ''}
                    {lead.last_event_type && (
                      <span className="block text-[10px] text-[#3d4060]">
                        {EVENT_LABELS[lead.last_event_type] ?? lead.last_event_type}
                      </span>
                    )}
                  </p>
                  <p className="col-span-2 text-xs text-[#636780] truncate">
                    {lead.status_label === 'DM Pending' && 'Send DM 1'}
                    {lead.status_label === 'Following Up' && 'Follow up'}
                    {lead.status_label === 'Replied' && 'Respond'}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
