'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchGovTenders, updateGovTenderStatus, fetchGovBidDocumentUrl, uploadGovBidDocument } from '@/lib/pipeline-client'
import type { GovTender, GovTenderStatus } from '@/lib/types'

// Statuses at or beyond "bid_drafted" — a document could exist for any of
// these, either the auto-drafted PDF or a manually uploaded revision.
const BID_DOCUMENT_STATUSES: GovTenderStatus[] = ['bid_drafted', 'submitted', 'won', 'lost']

// gov_tenders only ever holds actionable rows — screened-out notices
// (found/off_scope/no_bid/no_contact_email) never sync into the OS, so
// there's nothing to filter or edit them into here.
const STATUSES: { key: GovTenderStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pushed_to_instantly', label: 'Sent, No Reply' },
  { key: 'replied', label: 'Replied' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'bid_drafted', label: 'Drafted' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
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

export default function GovBidManagerPage() {
  const [filter, setFilter] = useState<GovTenderStatus | 'all'>('all')
  const [rows, setRows] = useState<GovTender[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [docBusyId, setDocBusyId] = useState<string | null>(null)
  const [docError, setDocError] = useState<string | null>(null)
  const uploadTargetRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const refetch = useCallback(async (status: GovTenderStatus | 'all') => {
    try {
      const tenders = await fetchGovTenders(status)
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

  return (
    <div className="p-6 min-h-screen bg-[#08090c]">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-[#e4e6f0]">Bid Manager</h1>
        <span className="bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-1.5 text-xs text-[#e4e6f0] tabular-nums">
          {rows.length} tenders
        </span>
      </div>

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
                <th className="p-3 font-medium">Title</th>
                <th className="p-3 font-medium">Authority</th>
                <th className="p-3 font-medium text-right">Value</th>
                <th className="p-3 font-medium">Contract End</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Updated</th>
                <th className="p-3 font-medium">Bid Doc</th>
                <th className="p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="text-[#e4e6f0]">
              {rows.length === 0 ? (
                <tr><td className="p-6 text-[#636780]" colSpan={8}>No tenders in this view.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.notice_id} className="border-b border-[#1c2035] last:border-b-0 hover:bg-[#181b27]">
                    <td className="p-3 max-w-xs truncate" title={r.title ?? ''}>{r.title ?? 'Untitled'}</td>
                    <td className="p-3 max-w-[160px] truncate" title={r.authority ?? ''}>{r.authority ?? '—'}</td>
                    <td className="p-3 text-right tabular-nums">{formatMoney(r.award_value_gbp)}</td>
                    <td className="p-3 tabular-nums">{r.contract_end ?? '—'}</td>
                    <td className="p-3">
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
                    </td>
                    <td className="p-3 tabular-nums text-[#636780]">{r.last_update ?? '—'}</td>
                    <td className="p-3">
                      {BID_DOCUMENT_STATUSES.includes(r.status) ? (
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          {r.bid_document_path && (
                            <button
                              onClick={() => handleViewBid(r.notice_id)}
                              disabled={docBusyId === r.notice_id}
                              className="text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                            >
                              View PDF
                            </button>
                          )}
                          <button
                            onClick={() => handleUploadClick(r.notice_id)}
                            disabled={docBusyId === r.notice_id}
                            className="text-[#636780] hover:text-[#e4e6f0] disabled:opacity-50"
                          >
                            {r.bid_document_path ? 'Upload revision' : 'Upload PDF'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[#3a3d52]">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {r.notice_url && (
                        <a href={r.notice_url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300">
                          View
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
