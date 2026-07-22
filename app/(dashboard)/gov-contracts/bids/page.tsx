'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, Download, Upload, CheckCircle2 } from 'lucide-react'
import { fetchGovTenders, updateGovTenderStatus, fetchGovBidDocumentUrl, uploadGovBidDocument } from '@/lib/pipeline-client'
import type { GovTender, GovTenderStatus } from '@/lib/types'

// Statuses at or beyond "bid_drafted" — a document could exist for any of
// these, either the auto-drafted PDF or a manually uploaded revision.
const BID_DOCUMENT_STATUSES: GovTenderStatus[] = ['bid_drafted', 'submitted', 'won', 'lost']

// gov_tenders only ever holds actionable rows — screened-out notices
// (found/off_scope/no_bid/no_contact_email) never sync into the OS, so
// there's nothing to filter or edit them into here.
const STATUSES: { key: GovTenderStatus | 'all'; label: string }[] = [
  { key: 'bid_drafted', label: 'Drafted' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'pushed_to_instantly', label: 'Sent, No Reply' },
  { key: 'replied', label: 'Replied' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'all', label: 'All' },
]

const EDITABLE_STATUSES: GovTenderStatus[] = [
  'pushed_to_instantly', 'replied', 'meeting', 'bid_drafted', 'submitted', 'won', 'lost',
]

const STATUS_COLOR: Record<string, string> = {
  pushed_to_instantly: 'text-sky-400',
  replied: 'text-indigo-400',
  meeting: 'text-purple-400',
  bid_drafted: 'text-amber-400',
  submitted: 'text-blue-400',
  won: 'text-green-400',
  lost: 'text-red-400',
}

function formatMoney(amount: number | null): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount)
}

// Days from today (midnight) until the given date. null if unparseable.
function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

// Countdown badge: red <7 days (or overdue), amber <14 days, grey otherwise
// or when no deadline is set. deadline is optional (migration 050).
function DeadlineBadge({ deadline }: { deadline: string | null | undefined }) {
  const days = daysUntil(deadline)
  if (days == null) {
    return <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-[#181b27] text-[#636780]">No deadline</span>
  }
  let cls = 'bg-[#181b27] text-[#8b8fa8]'
  if (days < 7) cls = 'bg-red-950/50 text-red-300 border border-red-900/60'
  else if (days < 14) cls = 'bg-amber-950/40 text-amber-300 border border-amber-900/50'

  const label = days < 0 ? `Overdue ${Math.abs(days)}d` : days === 0 ? 'Due today' : `${days}d left`
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] whitespace-nowrap ${cls}`} title={deadline ?? ''}>
      {label}
    </span>
  )
}

// Domain label for the "Submit at" link. Strips protocol + www.
function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  }
}

export default function GovBidManagerPage() {
  const [filter, setFilter] = useState<GovTenderStatus | 'all'>('bid_drafted')
  const [rows, setRows] = useState<GovTender[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [docBusyId, setDocBusyId] = useState<string | null>(null)
  const [docError, setDocError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})
  const [notesSavingId, setNotesSavingId] = useState<string | null>(null)
  const uploadTargetRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const refetch = useCallback(async (status: GovTenderStatus | 'all') => {
    try {
      // Submission cockpit always ranks by soonest deadline (nulls last).
      const tenders = await fetchGovTenders(status, 'deadline')
      setRows(tenders)
    } catch { /* no-op */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    refetch(filter).finally(() => setLoading(false))
  }, [filter, refetch])

  async function handleStatusChange(notice_id: string, status: GovTenderStatus) {
    setSavingId(notice_id)
    try {
      await updateGovTenderStatus(notice_id, status)
      await refetch(filter)
    } finally {
      setSavingId(null)
    }
  }

  async function handleMarkSubmitted(notice_id: string) {
    await handleStatusChange(notice_id, 'submitted')
  }

  async function handleViewBid(notice_id: string) {
    setDocError(null)
    setDocBusyId(notice_id)
    try {
      const url = await fetchGovBidDocumentUrl(notice_id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setDocError(e instanceof Error ? e.message : 'Failed to open bid document')
    } finally {
      setDocBusyId(null)
    }
  }

  function handleUploadClick(notice_id: string) {
    uploadTargetRef.current = notice_id
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const notice_id = uploadTargetRef.current
    e.target.value = ''
    if (!file || !notice_id) return

    setDocError(null)
    setDocBusyId(notice_id)
    try {
      await uploadGovBidDocument(notice_id, file)
      await refetch(filter)
    } catch (err) {
      setDocError(err instanceof Error ? err.message : 'Failed to upload bid document')
    } finally {
      setDocBusyId(null)
    }
  }

  function toggleExpand(r: GovTender) {
    if (expandedId === r.notice_id) {
      setExpandedId(null)
      return
    }
    setNotesDraft((d) => ({ ...d, [r.notice_id]: r.notes ?? '' }))
    setExpandedId(r.notice_id)
  }

  async function handleSaveNotes(r: GovTender) {
    setNotesSavingId(r.notice_id)
    try {
      await updateGovTenderStatus(r.notice_id, r.status, notesDraft[r.notice_id] ?? '')
      await refetch(filter)
    } finally {
      setNotesSavingId(null)
    }
  }

  const COLS = 9

  return (
    <div className="p-6 min-h-screen bg-[#08090c]">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-[#e4e6f0]">Bid Manager</h1>
        <span className="bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-1.5 text-xs text-[#e4e6f0] tabular-nums">
          {rows.length} tenders
        </span>
      </div>
      <p className="text-xs text-[#636780] mb-5">Submission cockpit — soonest deadline first. Download the bid, submit on the portal, then mark it submitted.</p>

      {docError && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-950/40 border border-red-900 text-xs text-red-300 w-fit">
          {docError}
        </div>
      )}

      <div className="flex items-center gap-1 bg-[#10121a] border border-[#1c2035] rounded-lg p-1 mb-5 flex-wrap w-fit">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === s.key ? 'bg-indigo-600 text-white' : 'text-[#636780] hover:text-[#e4e6f0]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-sm text-[#636780]">Loading bids...</span>
        </div>
      ) : (
        <div className="bg-[#10121a] border border-[#1c2035] rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#636780] text-left border-b border-[#1c2035]">
                <th className="p-3 font-medium w-6"></th>
                <th className="p-3 font-medium">Title</th>
                <th className="p-3 font-medium">Authority</th>
                <th className="p-3 font-medium">Deadline</th>
                <th className="p-3 font-medium text-right">Value</th>
                <th className="p-3 font-medium">Bid PDF</th>
                <th className="p-3 font-medium">Submit at</th>
                <th className="p-3 font-medium">Found</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="text-[#e4e6f0]">
              {rows.length === 0 ? (
                <tr><td className="p-6 text-[#636780]" colSpan={COLS}>No tenders in this view.</td></tr>
              ) : (
                rows.map((r) => {
                  const submitUrl = r.portal ?? r.notice_url
                  const hasDoc = !!r.bid_document_path
                  const isExpanded = expandedId === r.notice_id
                  return (
                    <Fragment key={r.notice_id}>
                      <tr
                        className="border-b border-[#1c2035] hover:bg-[#181b27] cursor-pointer"
                        onClick={() => toggleExpand(r)}
                      >
                        <td className="p-3 text-[#636780]">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td className="p-3 max-w-xs truncate" title={r.title ?? ''}>{r.title ?? 'Untitled'}</td>
                        <td className="p-3 max-w-[160px] truncate" title={r.authority ?? ''}>{r.authority ?? '—'}</td>
                        <td className="p-3"><DeadlineBadge deadline={r.deadline} /></td>
                        <td className="p-3 text-right tabular-nums">{formatMoney(r.award_value_gbp)}</td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          {BID_DOCUMENT_STATUSES.includes(r.status) ? (
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              {hasDoc && (
                                <button
                                  onClick={() => handleViewBid(r.notice_id)}
                                  disabled={docBusyId === r.notice_id}
                                  className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                                >
                                  <Download size={12} /> PDF
                                </button>
                              )}
                              <button
                                onClick={() => handleUploadClick(r.notice_id)}
                                disabled={docBusyId === r.notice_id}
                                className="inline-flex items-center gap-1 text-[#636780] hover:text-[#e4e6f0] disabled:opacity-50"
                              >
                                <Upload size={12} /> {hasDoc ? 'Revision' : 'Upload'}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[#3a3d52]">—</span>
                          )}
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          {submitUrl ? (
                            <a
                              href={submitUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 max-w-[150px] truncate"
                              title={submitUrl}
                            >
                              <ExternalLink size={12} className="shrink-0" />
                              <span className="truncate">{domainOf(submitUrl)}</span>
                            </a>
                          ) : (
                            <span className="text-[#3a3d52]">—</span>
                          )}
                        </td>
                        <td className="p-3 tabular-nums text-[#636780]">{r.date_added ?? '—'}</td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <select
                              value={r.status}
                              disabled={savingId === r.notice_id}
                              onChange={(e) => handleStatusChange(r.notice_id, e.target.value as GovTenderStatus)}
                              className={`bg-[#181b27] border border-[#1c2035] rounded px-1.5 py-1 text-xs disabled:opacity-50 ${STATUS_COLOR[r.status] ?? 'text-[#e4e6f0]'}`}
                            >
                              {EDITABLE_STATUSES.map((s) => (
                                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                              ))}
                            </select>
                            {r.status === 'bid_drafted' && hasDoc && (
                              <button
                                onClick={() => handleMarkSubmitted(r.notice_id)}
                                disabled={savingId === r.notice_id}
                                className="inline-flex items-center gap-1 text-green-400 hover:text-green-300 disabled:opacity-50"
                                title="Mark this bid as submitted"
                              >
                                <CheckCircle2 size={12} /> Submitted
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-[#1c2035] bg-[#0c0e14]">
                          <td></td>
                          <td colSpan={COLS - 1} className="p-4">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-3 max-w-3xl">
                              <Detail label="Buyer" value={r.buyer_name} />
                              <Detail label="Buyer email" value={r.buyer_email} />
                              <Detail label="CPV" value={r.cpv} />
                              <Detail label="Incumbent" value={r.incumbent} />
                              <div className="col-span-2">
                                <p className="text-[10px] uppercase tracking-wide text-[#636780] mb-1">Notice URL</p>
                                {r.notice_url ? (
                                  <a href={r.notice_url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 break-all">
                                    {r.notice_url}
                                  </a>
                                ) : <span className="text-[#3a3d52]">—</span>}
                              </div>
                              <div className="col-span-2">
                                <p className="text-[10px] uppercase tracking-wide text-[#636780] mb-1">Notes</p>
                                <textarea
                                  value={notesDraft[r.notice_id] ?? ''}
                                  onChange={(e) => setNotesDraft((d) => ({ ...d, [r.notice_id]: e.target.value }))}
                                  rows={3}
                                  className="w-full bg-[#10121a] border border-[#1c2035] rounded-lg p-2 text-xs text-[#e4e6f0] focus:outline-none focus:border-indigo-600"
                                  placeholder="Internal notes on this tender..."
                                />
                                <button
                                  onClick={() => handleSaveNotes(r)}
                                  disabled={notesSavingId === r.notice_id}
                                  className="mt-2 px-3 py-1 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                                >
                                  {notesSavingId === r.notice_id ? 'Saving...' : 'Save notes'}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[#636780] mb-1">{label}</p>
      <p className="text-[#e4e6f0] break-words">{value || <span className="text-[#3a3d52]">—</span>}</p>
    </div>
  )
}
