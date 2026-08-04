'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, X, ExternalLink, Check, XCircle, Copy, Pencil } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { PAYMENT_LINKS, HOSTING_LINK, paymentLinkFor } from '@/lib/websites'

interface WebsiteBuild {
  id: string
  business_name: string
  google_url: string | null
  phone: string | null
  city: string | null
  niche: string
  notes: string | null
  status: 'requested' | 'approved' | 'building' | 'built' | 'site_approved' | 'sent' | 'paid' | 'live' | 'rejected'
  site_url: string | null
  requested_by: string | null
  owner_name: string | null
  email: string | null
  service_area: string | null
  services: string[] | null
  existing_site_url: string | null
  sale_amount: number | null
  paid_at: string | null
  brief_summary: string | null
  brief_talking_points: string[] | null
  brief_objection_prep: string[] | null
  build_error: string | null
  quality_passed: boolean | null
  quality_warnings: string[] | null
  revision: number
  amend_history: { revision: number; notes: string; requested_by: string; requested_at: string }[] | null
  created_at: string
}

const NICHE_OPTIONS = ['roofing', 'plumbing', 'electrical', 'landscaping', 'other']
const SERVICE_OPTIONS = ['Pitched roofs', 'Flat roofs', 'Repairs', 'Guttering & fascias', 'Chimney work', 'Emergency callout']

const STATUS_LABEL: Record<WebsiteBuild['status'], string> = {
  requested: 'Building',
  approved: 'Building',
  building: 'Building',
  built: 'Sent for approval',
  site_approved: 'Completed',
  sent: 'Sent to caller',
  paid: 'Paid',
  live: 'Live',
  rejected: 'Rejected',
}

const STATUS_STYLE: Record<WebsiteBuild['status'], string> = {
  requested: 'bg-[#636780]/10 text-[#636780] border-[#636780]/20',
  approved: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  building: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  built: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  site_approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  sent: 'bg-green-500/10 text-green-400 border-green-500/20',
  paid: 'bg-green-500/20 text-green-300 border-green-500/30',
  live: 'bg-green-500/20 text-green-300 border-green-500/30',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
}

function StatusBadge({ status }: { status: WebsiteBuild['status'] }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

// Live thumbnail of the actual demo, not a stale screenshot: the iframe is
// rendered at 4x the card's width then scaled down 75%, a CSS-only trick
// that stays responsive without measuring anything in JS. pointer-events is
// off on the iframe itself so a click always opens the real site in a new
// tab instead of interacting with the tiny embedded page.
function SitePreview({ url, businessName }: { url: string; businessName: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group relative block w-full aspect-[4/3] overflow-hidden bg-[#0b0d14]"
      title={`Open ${businessName}'s live demo`}
    >
      <div className="absolute top-0 left-0 w-[400%] h-[400%] origin-top-left scale-[0.25] pointer-events-none">
        <iframe src={url} className="w-full h-full border-0" loading="lazy" tabIndex={-1} title={`${businessName} preview`} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
        <span className="inline-flex items-center gap-1.5 text-white text-xs font-medium">
          <ExternalLink size={12} /> Open live site
        </span>
      </div>
    </a>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Caller-facing picker: copy the correct Stripe Payment Link for this build.
// Each link carries the build id as client_reference_id so the webhook matches
// the payment back to the build and fires the hookup + newsletter automation.
function PaymentPicker({ buildId }: { buildId: string }) {
  const [copied, setCopied] = useState<string | null>(null)
  const links = [
    ...PAYMENT_LINKS.map(l => ({ key: l.tier, label: l.label, url: paymentLinkFor(l.url, buildId) })),
    ...(HOSTING_LINK ? [{ key: 'hosting', label: '£75/mo hosting', url: paymentLinkFor(HOSTING_LINK, buildId) }] : []),
  ]
  const configured = links.filter(l => l.url)

  async function copy(key: string, url: string) {
    try { await navigator.clipboard.writeText(url); setCopied(key); setTimeout(() => setCopied(null), 1500) } catch { /* noop */ }
  }

  if (!configured.length) {
    return <p className="text-[10px] text-amber-400/80 mt-2">Set the Stripe payment link envs to enable one-click send.</p>
  }
  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      {configured.map(l => (
        <button
          key={l.key}
          onClick={() => copy(l.key, l.url)}
          className="inline-flex items-center gap-1.5 bg-[#181b27] hover:bg-[#1c2035] border border-[#1c2035] text-[#e4e6f0] rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
        >
          {copied === l.key ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-[#636780]" />}
          {copied === l.key ? 'Copied' : l.label}
        </button>
      ))}
    </div>
  )
}

interface HookupTask { id: string; title: string; done: boolean; position: number }

// Post-payment checklist fulfilment works to take the site live on the real domain.
function HookupChecklist({ buildId }: { buildId: string }) {
  const [open, setOpen] = useState(false)
  const [tasks, setTasks] = useState<HookupTask[]>([])
  const [loaded, setLoaded] = useState(false)

  async function load() {
    try {
      const res = await fetch(`/api/websites/${buildId}/hookup`)
      const json = await res.json()
      setTasks(json.tasks ?? [])
      setLoaded(true)
    } catch { /* silent */ }
  }

  async function toggle(taskId: string, done: boolean) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, done } : t))
    try {
      const res = await fetch(`/api/websites/${buildId}/hookup`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, done }),
      })
      const json = await res.json()
      if (json.tasks) setTasks(json.tasks)
    } catch { /* silent */ }
  }

  const doneCount = tasks.filter(t => t.done).length

  return (
    <div className="mt-2.5">
      <button
        onClick={() => { const next = !open; setOpen(next); if (next && !loaded) load() }}
        className="text-xs text-[#636780] hover:text-[#e4e6f0] transition-colors"
      >
        {open ? 'Hide' : 'Show'} hookup checklist{loaded ? ` (${doneCount}/${tasks.length})` : ''}
      </button>
      {open && loaded && (
        <div className="mt-2 space-y-1.5">
          {tasks.map(t => (
            <label key={t.id} className="flex items-center gap-2 text-xs text-[#e4e6f0] cursor-pointer">
              <input
                type="checkbox"
                checked={t.done}
                onChange={e => toggle(t.id, e.target.checked)}
                className="rounded border-[#1c2035] bg-[#181b27] text-indigo-500 focus:ring-0"
              />
              <span className={t.done ? 'line-through text-[#636780]' : ''}>{t.title}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
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
  const [amendId, setAmendId] = useState<string | null>(null)
  const [amendNotes, setAmendNotes] = useState('')
  const [amendSubmitting, setAmendSubmitting] = useState(false)
  const [amendError, setAmendError] = useState<string | null>(null)
  const [customNiche, setCustomNiche] = useState(false)

  const [form, setForm] = useState({
    business_name: '',
    owner_name: '',
    email: '',
    google_url: '',
    existing_site_url: '',
    phone: '',
    city: '',
    service_area: '',
    niche: 'roofing',
    services: [] as string[],
    notes: '',
  })

  function toggleService(s: string) {
    setForm(f => ({
      ...f,
      services: f.services.includes(s) ? f.services.filter(x => x !== s) : [...f.services, s],
    }))
  }

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
          owner_name: form.owner_name || null,
          email: form.email || null,
          google_url: form.google_url || null,
          existing_site_url: form.existing_site_url || null,
          phone: form.phone || null,
          city: form.city || null,
          service_area: form.service_area || null,
          niche: form.niche || 'roofing',
          services: form.services,
          notes: form.notes || null,
          requested_by: userEmail,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      setShowModal(false)
      setForm({ business_name: '', owner_name: '', email: '', google_url: '', existing_site_url: '', phone: '', city: '', service_area: '', niche: 'roofing', services: [], notes: '' })
      setCustomNiche(false)
      setBuilds(prev => [json.build, ...prev])
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitAmend(id: string) {
    if (!amendNotes.trim()) { setAmendError('Describe what to change'); return }
    setAmendSubmitting(true)
    setAmendError(null)
    try {
      const res = await fetch(`/api/websites/${id}/amend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: amendNotes, amended_by: userEmail }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      setBuilds(prev => prev.map(b => b.id === id ? json.build : b))
      setAmendId(null)
      setAmendNotes('')
    } catch (err) {
      setAmendError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setAmendSubmitting(false)
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

      {/* Builds grid */}
      {loading ? (
        <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-8 text-center text-sm text-[#636780]">Loading website builds...</div>
      ) : builds.length === 0 ? (
        <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-12 text-center">
          <p className="text-sm text-[#636780] mb-3">No website build requests yet.</p>
          <button onClick={() => setShowModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
            Request the first one
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {builds.map(b => (
            <div key={b.id} className="rounded-xl border border-[#1c2035] bg-[#10121a] overflow-hidden flex flex-col hover:border-[#2a2f45] transition-colors">
              {b.site_url ? (
                <SitePreview url={b.site_url} businessName={b.business_name} />
              ) : (
                <div className="w-full aspect-[4/3] bg-[#0b0d14] flex items-center justify-center">
                  {(b.status === 'requested' || b.status === 'approved' || b.status === 'building') ? (
                    <span className="text-xs text-amber-400 inline-flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Building...
                    </span>
                  ) : (
                    <span className="text-2xl font-semibold text-[#2a2f45]">{b.business_name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
              )}

              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-medium text-[#e4e6f0] truncate">{b.business_name}</span>
                  {b.revision > 1 && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">v{b.revision}</span>
                  )}
                  <StatusBadge status={b.status} />
                  {b.quality_passed === false && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">Needs review</span>
                  )}
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
                {b.notes && <p className="text-xs text-[#636780] mt-1.5 whitespace-pre-wrap line-clamp-2">{b.notes}</p>}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-[#3d4060] uppercase tracking-wider">
                  <span>{b.requested_by ?? 'unknown'}</span>
                  <span>{formatDate(b.created_at)}</span>
                </div>
                {b.site_url && (
                  <a href={b.site_url} target="_blank" rel="noreferrer" className="text-xs text-green-400 hover:underline inline-flex items-center gap-1 mt-1.5 truncate">
                    <ExternalLink size={10} className="shrink-0" /> <span className="truncate">{b.site_url}</span>
                  </a>
                )}
                {b.build_error && (
                  <p className="text-xs text-amber-400 mt-1.5">Site deploy issue: {b.build_error}</p>
                )}
                {!!b.quality_warnings?.length && b.quality_passed === false && (
                  <ul className="mt-1.5 text-[11px] text-amber-400/90 list-disc list-inside space-y-0.5">
                    {b.quality_warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                )}
                {b.brief_summary && (
                  <div className="mt-2.5 rounded-lg border border-[#1c2035] bg-[#181b27]/60 px-3 py-2.5 space-y-1.5">
                    <p className="text-xs text-[#e4e6f0]">{b.brief_summary}</p>
                    {!!b.brief_talking_points?.length && (
                      <ul className="text-[11px] text-[#8a8fb0] list-disc list-inside space-y-0.5">
                        {b.brief_talking_points.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    )}
                    {!!b.brief_objection_prep?.length && (
                      <ul className="text-[11px] text-[#636780] list-disc list-inside space-y-0.5">
                        {b.brief_objection_prep.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    )}
                  </div>
                )}
                {/* On the sales call: copy the right Stripe link to send the prospect. */}
                {(b.status === 'sent' || b.status === 'site_approved') && <PaymentPicker buildId={b.id} />}
                {(b.status === 'paid' || b.status === 'live') && (
                  <>
                    <p className="text-xs text-green-300 mt-2 inline-flex items-center gap-1.5">
                      <Check size={12} /> Paid{b.sale_amount ? ` (£${b.sale_amount.toLocaleString()})` : ''}. Client added to newsletter.
                    </p>
                    <HookupChecklist buildId={b.id} />
                  </>
                )}

                <div className="flex items-center gap-2 flex-wrap mt-auto pt-3">
                  {(b.status === 'requested' || b.status === 'approved' || b.status === 'building') && (
                    <span className="text-xs text-amber-400 px-1 py-1.5">Building...</span>
                  )}
                  {b.status === 'built' && (
                    <>
                      <button
                        onClick={() => updateStatus(b.id, 'site_approved')}
                        disabled={busyId === b.id}
                        className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                      >
                        <Check size={12} /> Approve
                      </button>
                      <button
                        onClick={() => { setAmendId(b.id); setAmendNotes(''); setAmendError(null) }}
                        disabled={busyId === b.id}
                        className="flex items-center gap-1 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border border-amber-500/20"
                      >
                        <Pencil size={12} /> Amend
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
                    <span className="inline-flex items-center gap-1 text-xs text-green-400 px-1 py-1.5">
                      <Check size={12} /> With caller
                    </span>
                  )}
                  {(b.status === 'paid' || b.status === 'live') && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-300 px-1 py-1.5">
                      <Check size={12} /> {b.status === 'live' ? 'Live' : 'Paid'}
                    </span>
                  )}
                  {b.status === 'rejected' && (
                    <span className="text-xs text-red-400 px-1 py-1.5">Rejected</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#636780] mb-1.5">Owner name</label>
                  <input
                    type="text"
                    placeholder="Dave Smith"
                    value={form.owner_name}
                    onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
                    className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#636780] mb-1.5">Email</label>
                  <input
                    type="email"
                    placeholder="dave@..."
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#636780] mb-1.5">Google Business or existing website URL</label>
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
                <label className="block text-xs font-medium text-[#636780] mb-1.5">Service area <span className="text-[#3d4060]">(towns they cover)</span></label>
                <input
                  type="text"
                  placeholder="Greater Manchester, Bolton, Stockport"
                  value={form.service_area}
                  onChange={e => setForm(f => ({ ...f, service_area: e.target.value }))}
                  className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#636780] mb-2">Services they offer</label>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_OPTIONS.map(s => {
                    const on = form.services.includes(s)
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleService(s)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${on ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#181b27] border-[#1c2035] text-[#636780] hover:text-[#e4e6f0]'}`}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
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
                  {submitting ? 'Building site... (up to 2 minutes, real research + photos)' : 'Request website'}
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

      {/* Amend modal: send change notes, site rebuilds off the prior version
          and the revision number bumps so it's clear which link is current. */}
      {amendId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !amendSubmitting && setAmendId(null)} />
          <div className="relative w-full max-w-sm bg-[#10121a] border border-[#1c2035] rounded-2xl shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c2035]">
              <div>
                <h2 className="text-base font-semibold text-[#e4e6f0]">Amend site</h2>
                <p className="text-xs text-[#636780] mt-0.5">Site rebuilds with these changes, becomes v{(builds.find(b => b.id === amendId)?.revision ?? 1) + 1}</p>
              </div>
              <button onClick={() => !amendSubmitting && setAmendId(null)} className="text-[#636780] hover:text-[#e4e6f0] transition-colors p-1 rounded-lg hover:bg-[#181b27]">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <textarea
                rows={4}
                autoFocus
                placeholder="e.g. Change the hero headline, swap the accent colour to blue, add a testimonials section..."
                value={amendNotes}
                onChange={e => setAmendNotes(e.target.value)}
                className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-[#636780] resize-none"
              />
              {amendError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{amendError}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setAmendId(null)}
                  disabled={amendSubmitting}
                  className="flex-1 text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => submitAmend(amendId)}
                  disabled={amendSubmitting}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                >
                  {amendSubmitting ? 'Rebuilding... (up to 2 minutes)' : 'Send amend'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
