'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, CheckCircle, XCircle, Edit3, ChevronDown, ChevronUp } from 'lucide-react'
import { fetchPendingReports, approveReport, rejectReport } from '@/lib/accounts-client'
import type { ClientReport, Client } from '@/lib/types'

type ReportWithClient = ClientReport & { clients: Pick<Client, 'id' | 'name' | 'health'> }

const TYPE_LABELS: Record<string, string> = {
  weekly_eow:       'Friday EOW Update',
  monday_kickoff:   'Monday Kickoff',
  meeting_prep:     'Meeting Prep Brief',
  meeting_followup: 'Meeting Follow-up',
  monthly_deep_dive: 'Monthly Deep Dive',
}

const HEALTH_COLOUR: Record<string, string> = {
  red: 'text-red-400', amber: 'text-amber-400', green: 'text-emerald-400',
}

export default function ApprovalsQueue() {
  const [reports, setReports] = useState<ReportWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({})
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({})
  const [rejecting, setRejecting] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const load = useCallback(() => {
    fetchPendingReports()
      .then(setReports)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleApprove(report: ReportWithClient) {
    setBusy((b) => ({ ...b, [report.id]: true }))
    try {
      await approveReport(report.id, { client_message: editedMessages[report.id] })
      setReports((rs) => rs.filter((r) => r.id !== report.id))
    } catch (e: unknown) {
      alert((e as Error).message)
    } finally {
      setBusy((b) => ({ ...b, [report.id]: false }))
    }
  }

  async function handleReject(report: ReportWithClient) {
    setBusy((b) => ({ ...b, [report.id]: true }))
    try {
      await rejectReport(report.id, rejectionNotes[report.id])
      setReports((rs) => rs.filter((r) => r.id !== report.id))
    } catch (e: unknown) {
      alert((e as Error).message)
    } finally {
      setBusy((b) => ({ ...b, [report.id]: false }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#636780]" size={20} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-5">
        <h1 className="text-[#e4e6f0] font-semibold text-lg">Approval Queue</h1>
        <p className="text-[#636780] text-xs mt-0.5">
          {reports.length} report{reports.length !== 1 ? 's' : ''} pending. Edit the client message inline then approve.
        </p>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {reports.length === 0 && (
        <div className="text-center text-[#636780] text-sm py-16">
          Nothing pending -- great work.
        </div>
      )}

      <div className="space-y-4">
        {reports.map((report) => {
          const isExpanded = expanded[report.id] ?? false
          const isRejecting = rejecting[report.id] ?? false
          const isBusy = busy[report.id] ?? false
          const currentMessage = editedMessages[report.id] ?? report.client_message ?? ''

          return (
            <div key={report.id} className="rounded-xl border border-[#1c2035] bg-[#0e1017]">
              {/* Header */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-[#e4e6f0] font-medium text-sm">
                      {report.clients?.name ?? 'Unknown'}
                    </p>
                    <p className="text-[#636780] text-xs mt-0.5">
                      {TYPE_LABELS[report.type] ?? report.type}
                      {report.period_start && report.period_end && (
                        <span className="ml-1 text-[#3d4060]">
                          {report.period_start} to {report.period_end}
                        </span>
                      )}
                    </p>
                  </div>
                  {report.clients?.health && (
                    <span className={`text-[10px] font-medium ${HEALTH_COLOUR[report.clients.health] ?? ''}`}>
                      {report.clients.health}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [report.id]: !isExpanded }))}
                  className="text-[#636780] hover:text-[#e4e6f0] transition-colors"
                >
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-[#1c2035] p-4 space-y-4">
                  {/* Internal draft */}
                  {report.draft_md && (
                    <div>
                      <p className="text-[9px] font-bold tracking-widest uppercase text-[#636780] mb-2">
                        Internal brief (for your eyes only)
                      </p>
                      <div className="bg-[#181b27] rounded-lg p-3 text-xs text-[#8b8fa8] whitespace-pre-wrap font-mono leading-relaxed">
                        {report.draft_md}
                      </div>
                    </div>
                  )}

                  {/* Editable client message */}
                  <div>
                    <p className="text-[9px] font-bold tracking-widest uppercase text-[#636780] mb-2 flex items-center gap-1">
                      <Edit3 size={10} /> Client message (edit before approving)
                    </p>
                    <textarea
                      className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg p-3 text-xs text-[#e4e6f0] leading-relaxed font-mono resize-none focus:outline-none focus:border-indigo-500"
                      rows={Math.min(20, (currentMessage.split('\n').length + 2))}
                      value={currentMessage}
                      onChange={(e) => setEditedMessages((m) => ({ ...m, [report.id]: e.target.value }))}
                      placeholder="Client message will appear here once the Mac generates it..."
                    />
                  </div>

                  {/* Reject note */}
                  {isRejecting && (
                    <div>
                      <p className="text-[9px] font-bold tracking-widest uppercase text-[#636780] mb-2">
                        Rejection note (sent back to the team)
                      </p>
                      <textarea
                        className="w-full bg-[#181b27] border border-red-900 rounded-lg p-3 text-xs text-[#e4e6f0] leading-relaxed resize-none focus:outline-none focus:border-red-500"
                        rows={3}
                        value={rejectionNotes[report.id] ?? ''}
                        onChange={(e) => setRejectionNotes((n) => ({ ...n, [report.id]: e.target.value }))}
                        placeholder="What needs to change? The reporter will regenerate on next run."
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      disabled={isBusy || !currentMessage.trim()}
                      onClick={() => handleApprove(report)}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {isBusy ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                      Approve and post to Discord
                    </button>

                    {!isRejecting ? (
                      <button
                        disabled={isBusy}
                        onClick={() => setRejecting((r) => ({ ...r, [report.id]: true }))}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs bg-[#181b27] hover:bg-[#1c2035] text-[#636780] hover:text-red-400 border border-[#1c2035] transition-colors"
                      >
                        <XCircle size={11} />
                        Reject
                      </button>
                    ) : (
                      <>
                        <button
                          disabled={isBusy}
                          onClick={() => handleReject(report)}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs bg-red-800 hover:bg-red-700 text-white disabled:opacity-40 transition-colors"
                        >
                          {isBusy ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                          Confirm reject
                        </button>
                        <button
                          onClick={() => setRejecting((r) => ({ ...r, [report.id]: false }))}
                          className="text-xs text-[#636780] hover:text-[#e4e6f0]"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
