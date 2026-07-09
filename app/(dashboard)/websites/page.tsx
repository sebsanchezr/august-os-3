'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, X, ExternalLink, Check, XCircle } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

interface WebsiteBuild {
  id: string
  business_name: string
  google_url: string | null
  phone: string | null
  city: string | null
  niche: string
  notes: string | null
  status: 'requested' | 'approved' | 'building' | 'built' | 'site_approved' | 'sent' | 'rejected'
  site_url: string | null
  requested_by: string | null
  created_at: string
}

const NICHE_OPTIONS = ['roofing', 'plumbing', 'electrical', 'landscaping', 'other']

const STATUS_LABEL: Record<WebsiteBuild['status'], string> = {
  requested: 'Requested',
  approved: 'Approved',
  building: 'Building',
  built: 'Built',
  site_approved: 'Site approved',
  sent: 'Sent to caller',
  rejected: 'Rejected',
}

const STATUS_STYLE: Record<WebsiteBuild['status'], string> = {
  requested: 'bg-[#636780]/10 text-[#636780] border-[#636780]/20',
  approved: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  building: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  built: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  site_approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  sent: 'bg-green-500/10 text-green-400 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
}

function StatusBadge({ status }: { status: WebsiteBuild['status'] }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function WebsitesPage() {
  const [builds, setBuilds] = useState<WebsiteBuild[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [customNiche, setCustomNiche] = useState(false)

  const [form, setForm] = useState({
    business_name: '',
    google_url: '',
    phone: '',
    city: '',
    niche: 'roofing',
    notes: '',
  })

  useEffect(() => {
    getSupabaseBrowser().auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null))
  }, [])

  const fetchBuilds = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/websites')
      const json = await res.json()
      setBuilds(json.builds ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchBuilds() }, [fetchBuilds])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.business_name.trim()) { setFormError('Business name is required'); return }
    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch('/api/websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: form.business_name,
          google_url: form.google_url || null,
          phone: form.phone || null,
          city: form.city || null,
          niche: form.niche || 'roofing',
          notes: form.notes || null,
          requested_by: userEmail,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      setShowModal(false)
      setForm({ business_name: '', google_url: '', phone: '', city: '', niche: 'roofing', notes: '' })
      setCustomNiche(false)
      setBuilds(prev => [json.build, ...prev])
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function updateStatus(id: string, status: WebsiteBuild['status'], reason?: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/websites/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(reason ? { reason } : {}) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      setBuilds(prev => prev.map(b => b.id === id ? json.build : b))
    } catch { /* silent, keep row as-is */ }
    finally {
      setBusyId(null)
      setRejectId(null)
      setRejectReason('')
    }
  }

  return (
    <div className="p-6 min-h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#e4e6f0]">Websites</h1>
          <p className="text-xs text-[#636780] mt-0.5">Request pre-built sites for leads, track them through the build pipeline</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          Request a website
        </button>
      </div>

      {/* Builds list */}
      <div className="rounded-xl border border-[#1c2035] bg-[#10121a] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-[#636780]">Loading website builds...</div>
        ) : builds.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-[#636780] mb-3">No website build requests yet.</p>
            <button onClick={() => setShowModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
              Request the first one
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#1c2035]">
            {builds.map(b => (
              <div key={b.id} className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-[#181b27]/40 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-medium text-[#e4e6f0]">{b.business_name}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-xs text-[#636780]">
                    {b.city && <span>{b.city}</span>}
                    <span className="capitalize">{b.niche}</span>
                    {b.phone && <span>{b.phone}</span>}
                    {b.google_url && (
                      <a href={b.google_url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-1">
                        Google/site <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  {b.notes && <p className="text-xs text-[#636780] mt-1.5 whitespace-pre-wrap">{b.notes}</p>}
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-[#3d4060] uppercase tracking-wider">
                    <span>{b.requested_by ?? 'unknown'}</span>
                    <span>{formatDate(b.created_at)}</span>
                  </div>
                  {b.site_url && (
                    <a href={b.site_url} target="_blank" rel="noreferrer" className="text-xs text-green-400 hover:underline inline-flex items-center gap-1 mt-1.5">
                      {b.site_url} <ExternalLink size={10} />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {b.status === 'requested' && (
                    <>
                      <button
                        onClick={() => updateStatus(b.id, 'approved')}
                        disabled={busyId === b.id}
                        className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                      >
                        <Check size={12} /> Approve
                      </button>
                      <button
                        onClick={() => setRejectId(b.id)}
                        disabled={busyId === b.id}
                        className="flex items-center gap-1 text-red-400 hover:bg-red-500/10 disabled:opacity-50 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border border-red-500/20"
                      >
                        <XCircle size={12} /> Reject
                      </button>
                    </>
                  )}
                  {(b.status === 'approved' || b.status === 'building') && (
                    <span className="text-xs text-[#636780] px-3 py-1.5">In build queue</span>
                  )}
                  {b.status === 'built' && (
                    <button
                      onClick={() => updateStatus(b.id, 'site_approved')}
                      disabled={busyId === b.id}
                      className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                    >
                      <Check size={12} /> Approve site
                    </button>
                  )}
                  {b.status === 'site_approved' && (
                    <button
                      onClick={() => updateStatus(b.id, 'sent')}
                      disabled={busyId === b.id}
                      className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                    >
                      Mark sent to caller
                    </button>
                  )}
                  {b.status === 'sent' && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-400 px-3 py-1.5">
                      <Check size={12} /> Done
                    </span>
                  )}
                  {b.status === 'rejected' && (
                    <span className="text-xs text-red-400 px-3 py-1.5">Rejected</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md bg-[#10121a] border border-[#1c2035] rounded-2xl shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c2035]">
              <div>
                <h2 className="text-base font-semibold text-[#e4e6f0]">Request a website</h2>
                <p className="text-xs text-[#636780] mt-0.5">For a lead you're about to call</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-[#636780] hover:text-[#e4e6f0] transition-colors p-1 rounded-lg hover:bg-[#181b27]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#636780] mb-1.5">Business name</label>
                <input
                  type="text"
                  placeholder="Smith Roofing Ltd"
                  value={form.business_name}
                  onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                  className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#636780] mb-1.5">Google Business or website URL</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={form.google_url}
                  onChange={e => setForm(f => ({ ...f, google_url: e.target.value }))}
                  className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#636780] mb-1.5">Phone</label>
                  <input
                    type="text"
                    placeholder="07..."
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#636780] mb-1.5">City</label>
                  <input
                    type="text"
                    placeholder="Manchester"
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#636780] mb-1.5">Niche</label>
                {!customNiche ? (
                  <select
                    value={form.niche}
                    onChange={e => {
                      if (e.target.value === '__other__') { setCustomNiche(true); setForm(f => ({ ...f, niche: '' })) }
                      else setForm(f => ({ ...f, niche: e.target.value }))
                    }}
                    className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {NICHE_OPTIONS.filter(n => n !== 'other').map(n => (
                      <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>
                    ))}
                    <option value="__other__">Other (type your own)</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. driveways"
                      value={form.niche}
                      onChange={e => setForm(f => ({ ...f, niche: e.target.value }))}
                      className="flex-1 bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780]"
                    />
                    <button
                      type="button"
                      onClick={() => { setCustomNiche(false); setForm(f => ({ ...f, niche: 'roofing' })) }}
                      className="text-xs text-[#636780] hover:text-[#e4e6f0] px-2"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#636780] mb-1.5">Notes <span className="text-[#3d4060]">(optional)</span></label>
                <textarea
                  rows={3}
                  placeholder="Anything the builder should know..."
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
                  {submitting ? 'Sending...' : 'Request website'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject reason modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRejectId(null)} />
          <div className="relative w-full max-w-sm bg-[#10121a] border border-[#1c2035] rounded-2xl shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c2035]">
              <h2 className="text-base font-semibold text-[#e4e6f0]">Reject request</h2>
              <button onClick={() => setRejectId(null)} className="text-[#636780] hover:text-[#e4e6f0] transition-colors p-1 rounded-lg hover:bg-[#181b27]">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <textarea
                rows={3}
                placeholder="Reason (optional)"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780] resize-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setRejectId(null)}
                  className="flex-1 text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateStatus(rejectId, 'rejected', rejectReason || undefined)}
                  disabled={busyId === rejectId}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
