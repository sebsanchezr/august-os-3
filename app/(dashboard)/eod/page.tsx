'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, X, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface EodReport {
  id: string
  report_date: string
  caller_name: string
  calls_made: number
  positive_replies: number
  calls_booked: number
  notes: string | null
  created_at: string
}

function pct(num: number, denom: number) {
  if (!denom) return null
  return ((num / denom) * 100).toFixed(1)
}

function PctBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-[#636780] text-xs">—</span>
  const n = parseFloat(value)
  const color = n >= 10 ? 'text-green-400' : n >= 5 ? 'text-amber-400' : 'text-[#636780]'
  return <span className={`text-xs font-mono tabular-nums ${color}`}>{value}%</span>
}

function ChangeIndicator({ current, prev }: { current: number; prev: number }) {
  if (!prev) return null
  const diff = current - prev
  if (diff === 0) return <Minus size={12} className="text-[#636780]" />
  return diff > 0
    ? <TrendingUp size={12} className="text-green-400" />
    : <TrendingDown size={12} className="text-red-400" />
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function EodPage() {
  const [reports, setReports] = useState<EodReport[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [noteReport, setNoteReport] = useState<EodReport | null>(null)

  const [form, setForm] = useState({
    report_date: new Date().toISOString().slice(0, 10),
    caller_name: '',
    calls_made: '',
    positive_replies: '',
    calls_booked: '',
    notes: '',
  })

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/eod')
      const json = await res.json()
      setReports(json.reports ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  const livePositivePct = pct(Number(form.positive_replies), Number(form.calls_made))
  const liveBookPct = pct(Number(form.calls_booked), Number(form.calls_made))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.caller_name.trim()) { setFormError('Name is required'); return }
    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch('/api/eod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_date: form.report_date,
          caller_name: form.caller_name,
          calls_made: Number(form.calls_made) || 0,
          positive_replies: Number(form.positive_replies) || 0,
          calls_booked: Number(form.calls_booked) || 0,
          notes: form.notes || null,
        }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Failed') }
      setShowModal(false)
      setForm({ report_date: new Date().toISOString().slice(0, 10), caller_name: '', calls_made: '', positive_replies: '', calls_booked: '', notes: '' })
      await fetchReports()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  // Totals row
  const totals = reports.reduce((acc, r) => ({
    calls: acc.calls + r.calls_made,
    positives: acc.positives + r.positive_replies,
    booked: acc.booked + r.calls_booked,
  }), { calls: 0, positives: 0, booked: 0 })

  return (
    <div className="p-6 min-h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#e4e6f0]">EOD Reports</h1>
          <p className="text-xs text-[#636780] mt-0.5">End-of-day submissions from the team</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          Submit EOD
        </button>
      </div>

      {/* Summary strip */}
      {reports.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Total Calls', value: totals.calls.toLocaleString() },
            { label: 'Total Positives', value: `${totals.positives.toLocaleString()} (${pct(totals.positives, totals.calls) ?? '0'}%)` },
            { label: 'Total Booked', value: `${totals.booked.toLocaleString()} (${pct(totals.booked, totals.calls) ?? '0'}%)` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-[#1c2035] bg-[#10121a] px-4 py-3">
              <p className="text-[10px] font-medium text-[#636780] uppercase tracking-wider mb-1">{label}</p>
              <p className="text-lg font-bold tabular-nums text-[#e4e6f0]">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[#1c2035] bg-[#10121a] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-[#636780]">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-[#636780] mb-3">No EOD reports yet.</p>
            <button onClick={() => setShowModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
              Submit the first one
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1c2035]">
                  {['Date', 'Caller', 'Calls', 'Positives', 'Positive %', 'Booked', 'Book %', 'Notes'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#636780] uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => {
                  const prev = reports[i + 1]
                  return (
                    <tr key={r.id} className="border-b border-[#1c2035] last:border-0 hover:bg-[#181b27]/40 transition-colors">
                      <td className="px-4 py-3 text-xs text-[#e4e6f0] whitespace-nowrap font-medium">{formatDate(r.report_date)}</td>
                      <td className="px-4 py-3 text-sm text-[#e4e6f0] font-medium">{r.caller_name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-mono tabular-nums text-[#e4e6f0]">{r.calls_made}</span>
                          {prev && <ChangeIndicator current={r.calls_made} prev={prev.calls_made} />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono tabular-nums text-[#e4e6f0]">{r.positive_replies}</td>
                      <td className="px-4 py-3"><PctBadge value={pct(r.positive_replies, r.calls_made)} /></td>
                      <td className="px-4 py-3 text-sm font-mono tabular-nums text-[#e4e6f0]">{r.calls_booked}</td>
                      <td className="px-4 py-3"><PctBadge value={pct(r.calls_booked, r.calls_made)} /></td>
                      <td
                        className={`px-4 py-3 text-xs text-[#636780] max-w-[200px] truncate ${r.notes ? 'cursor-pointer hover:text-[#e4e6f0] hover:underline' : ''}`}
                        title={r.notes ?? undefined}
                        onClick={() => r.notes && setNoteReport(r)}
                      >
                        {r.notes ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md bg-[#10121a] border border-[#1c2035] rounded-2xl shadow-2xl animate-fade-in">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c2035]">
              <div>
                <h2 className="text-base font-semibold text-[#e4e6f0]">End of Day Report</h2>
                <p className="text-xs text-[#636780] mt-0.5">Log today's calling activity</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-[#636780] hover:text-[#e4e6f0] transition-colors p-1 rounded-lg hover:bg-[#181b27]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Date + Caller row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#636780] mb-1.5">Date</label>
                  <input
                    type="date"
                    value={form.report_date}
                    onChange={e => setForm(f => ({ ...f, report_date: e.target.value }))}
                    className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#636780] mb-1.5">Your name</label>
                  <input
                    type="text"
                    placeholder="Jake, Seb..."
                    value={form.caller_name}
                    onChange={e => setForm(f => ({ ...f, caller_name: e.target.value }))}
                    className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780]"
                    required
                  />
                </div>
              </div>

              {/* Calls made */}
              <div>
                <label className="block text-xs font-medium text-[#636780] mb-1.5">Calls made</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.calls_made}
                  onChange={e => setForm(f => ({ ...f, calls_made: e.target.value }))}
                  className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780] font-mono"
                />
              </div>

              {/* Positives + Booked side by side with live % */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#636780] mb-1.5">
                    Positive replies
                    {livePositivePct && <span className="ml-1.5 text-green-400 font-mono">{livePositivePct}%</span>}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.positive_replies}
                    onChange={e => setForm(f => ({ ...f, positive_replies: e.target.value }))}
                    className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#636780] mb-1.5">
                    Calls booked
                    {liveBookPct && <span className="ml-1.5 text-indigo-400 font-mono">{liveBookPct}%</span>}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.calls_booked}
                    onChange={e => setForm(f => ({ ...f, calls_booked: e.target.value }))}
                    className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780] font-mono"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-[#636780] mb-1.5">Notes <span className="text-[#3d4060]">(optional)</span></label>
                <textarea
                  rows={3}
                  placeholder="Anything worth noting today..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780] resize-none"
                />
              </div>

              {formError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                >
                  {submitting ? 'Saving...' : 'Submit EOD'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Note detail modal */}
      {noteReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setNoteReport(null)} />
          <div className="relative w-full max-w-md bg-[#10121a] border border-[#1c2035] rounded-2xl shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c2035]">
              <div>
                <h2 className="text-base font-semibold text-[#e4e6f0]">Note</h2>
                <p className="text-xs text-[#636780] mt-0.5">{noteReport.caller_name} - {formatDate(noteReport.report_date)}</p>
              </div>
              <button onClick={() => setNoteReport(null)} className="text-[#636780] hover:text-[#e4e6f0] transition-colors p-1 rounded-lg hover:bg-[#181b27]">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-[#e4e6f0] whitespace-pre-wrap">{noteReport.notes}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
