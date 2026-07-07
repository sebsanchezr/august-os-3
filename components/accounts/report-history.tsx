'use client'

import { useEffect, useState } from 'react'
import { Loader2, FileText, ExternalLink, CheckCircle, Clock, XCircle, Send } from 'lucide-react'
import Link from 'next/link'
import { fetchReports } from '@/lib/accounts-client'
import type { ClientReport } from '@/lib/types'

const TYPE_LABELS: Record<string, string> = {
  weekly_eow:        'Friday EOW Update',
  monday_kickoff:    'Monday Kickoff',
  meeting_prep:      'Meeting Prep Brief',
  meeting_followup:  'Meeting Follow-up',
  monthly_deep_dive: 'Monthly Deep Dive',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending_approval: <Clock size={12} className="text-amber-400" />,
  approved:         <CheckCircle size={12} className="text-indigo-400" />,
  sent:             <Send size={12} className="text-emerald-400" />,
  rejected:         <XCircle size={12} className="text-red-400" />,
}

const STATUS_LABEL: Record<string, string> = {
  pending_approval: 'Pending approval',
  approved:         'Approved',
  sent:             'Sent',
  rejected:         'Rejected',
}

export default function ReportHistory({ accountId }: { accountId: string }) {
  const [reports, setReports] = useState<ClientReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchReports(accountId)
      .then(setReports)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [accountId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-[#636780]" size={18} />
      </div>
    )
  }

  if (error) {
    return <p className="text-red-400 text-xs py-8">{error}</p>
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-16 rounded-xl border border-dashed border-[#1c2035]">
        <FileText size={20} className="mx-auto text-[#3d4060] mb-2" />
        <p className="text-[#636780] text-sm">No reports yet.</p>
        <p className="text-[#3d4060] text-xs mt-1">Reports appear here once the Mac reporter runs each Friday.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[9px] font-bold tracking-widest uppercase text-[#636780] mb-3">
        {reports.length} report{reports.length !== 1 ? 's' : ''}
      </p>
      {reports.map((r) => {
        const status = r.status ?? 'pending_approval'
        const isPending = status === 'pending_approval'
        return (
          <div
            key={r.id}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
              isPending
                ? 'border-amber-900/40 bg-amber-950/10'
                : 'border-[#1c2035] bg-[#0e1017]'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <FileText size={14} className="text-[#636780] shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-[#e4e6f0] font-medium truncate">
                  {TYPE_LABELS[r.type] ?? r.type}
                </p>
                {r.period_start && r.period_end && (
                  <p className="text-[10px] text-[#636780] mt-0.5">
                    {r.period_start} to {r.period_end}
                  </p>
                )}
                {!r.period_start && (
                  <p className="text-[10px] text-[#636780] mt-0.5">
                    {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 ml-4">
              {/* Status */}
              <span className="flex items-center gap-1 text-[10px] text-[#636780]">
                {STATUS_ICON[status]}
                {STATUS_LABEL[status] ?? status.replace(/_/g, ' ')}
              </span>

              {/* Actions */}
              {isPending && (
                <Link
                  href="/accounts/approvals"
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Review
                </Link>
              )}

              {/* Open printable PDF — client version */}
              <Link
                href={`/accounts/${accountId}/report?view=client`}
                target="_blank"
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <ExternalLink size={11} />
                Client PDF
              </Link>

              {/* Internal version */}
              <Link
                href={`/accounts/${accountId}/report?view=internal`}
                target="_blank"
                className="flex items-center gap-1 text-xs text-[#636780] hover:text-[#e4e6f0] transition-colors"
              >
                <ExternalLink size={11} />
                Internal
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}
