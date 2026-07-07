'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Upload, Plus, X } from 'lucide-react'
import type { CallLead, Caller } from '@/lib/types'
import CallTable from '@/components/call-table'
import LogCallDrawer from '@/components/log-call-drawer'

export default function TrackerPage() {
  const [leads, setLeads] = useState<CallLead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<CallLead | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showAddLead, setShowAddLead] = useState(false)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/leads')
      if (!res.ok) throw new Error('Failed to fetch leads')
      const data = await res.json()
      setLeads(data.leads ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  return (
    <div className="min-h-screen bg-[#08090c] p-6">
      {/* Page header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold text-[#e4e6f0]">Call Tracker</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] rounded-lg px-3 py-2 text-sm transition-colors flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            Import Leads
          </button>
          <button
            onClick={() => setShowAddLead(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex items-center gap-3 text-[#636780]">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">Loading leads...</span>
          </div>
        </div>
      ) : (
        <CallTable leads={leads} onLogCall={setSelectedLead} onRefresh={fetchLeads} />
      )}

      {/* Log Call Drawer */}
      <LogCallDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onSaved={fetchLeads}
      />

      {/* Import Modal */}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onImported={fetchLeads} />
      )}

      {/* Add Lead Modal */}
      {showAddLead && (
        <AddLeadModal onClose={() => setShowAddLead(false)} onSaved={fetchLeads} />
      )}
    </div>
  )
}

// ─── Import Modal ────────────────────────────────────────────────────────────

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [csv, setCsv] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [done, setDone] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const rows = csv
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.toLowerCase().startsWith('company'))

  async function handleImport() {
    if (!rows.length) return
    setErrors([])
    setProgress({ done: 0, total: rows.length })
    const errs: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const cols = rows[i].split(',').map((c) => c.trim())
      const [company, phone, city, niche, website] = cols

      if (!company || !phone) {
        errs.push(`Row ${i + 1}: missing company or phone`)
        setProgress({ done: i + 1, total: rows.length })
        continue
      }

      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company,
            phone,
            city: city || null,
            niche: niche || null,
            website: website || null,
          }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          errs.push(`Row ${i + 1} (${company}): ${d?.error ?? 'failed'}`)
        }
      } catch {
        errs.push(`Row ${i + 1}: network error`)
      }

      setProgress({ done: i + 1, total: rows.length })
    }

    setErrors(errs)
    setDone(true)
    onImported()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-[#1c2035] bg-[#10121a] p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#e4e6f0]">Import Leads</h2>
          <button
            onClick={onClose}
            className="text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] rounded-lg p-1.5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#636780] mb-3">
          Paste CSV data with columns: <span className="text-[#e4e6f0] font-mono">Company, Phone, City, Niche, Website</span>
          <br />
          First row can be a header — it will be skipped automatically.
        </p>

        <textarea
          value={csv}
          onChange={(e) => { setCsv(e.target.value); setDone(false); setErrors([]) }}
          rows={10}
          placeholder={'Acme Roofing,07700900000,Manchester,Roofers,https://acme.co.uk\nBeta Builders,07700900001,Leeds,Builders,'}
          className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780] resize-none font-mono"
        />

        {progress && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-[#636780]">
              <span>Progress</span>
              <span className="tabular-nums">{progress.done} / {progress.total}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#181b27] overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-200"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 max-h-28 overflow-y-auto">
            {errors.map((e, i) => (
              <p key={i} className="text-xs text-red-400">{e}</p>
            ))}
          </div>
        )}

        {done && !errors.length && (
          <p className="mt-3 text-xs text-green-400">All rows imported successfully.</p>
        )}

        <div className="mt-4 flex gap-3">
          <button
            onClick={onClose}
            className="text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] rounded-lg px-3 py-2 text-sm transition-colors"
          >
            {done ? 'Close' : 'Cancel'}
          </button>
          {!done && (
            <button
              onClick={handleImport}
              disabled={rows.length === 0 || !!progress}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              {progress ? `Importing... (${progress.done}/${progress.total})` : `Import ${rows.length} row${rows.length === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Add Lead Modal ──────────────────────────────────────────────────────────

function AddLeadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    company: '',
    phone: '',
    city: '',
    niche: '',
    website: '',
    quality_score: '',
    caller_id: '',
  })
  const [callers, setCallers] = useState<Caller[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const companyRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    companyRef.current?.focus()
    fetch('/api/callers')
      .then((r) => r.json())
      .then((d) => setCallers(d.callers ?? []))
      .catch(() => {})
  }, [])

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company.trim() || !form.phone.trim()) {
      setError('Company and phone are required.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: form.company.trim(),
          phone: form.phone.trim(),
          city: form.city.trim() || null,
          niche: form.niche.trim() || null,
          website: form.website.trim() || null,
          quality_score: form.quality_score ? Number(form.quality_score) : null,
          caller_id: form.caller_id || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error ?? 'Failed to create lead')
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780]'
  const labelCls = 'block text-xs font-medium text-[#636780] uppercase tracking-wider mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-[#1c2035] bg-[#10121a] p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-[#e4e6f0]">Add Lead</h2>
          <button
            onClick={onClose}
            className="text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] rounded-lg p-1.5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>
                Company <span className="text-red-400">*</span>
              </label>
              <input
                ref={companyRef}
                type="text"
                value={form.company}
                onChange={(e) => set('company', e.target.value)}
                placeholder="Acme Roofing Ltd"
                className={inputCls}
                required
              />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>
                Phone <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="07700 900000"
                className={inputCls}
                required
              />
            </div>

            <div>
              <label className={labelCls}>City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                placeholder="Manchester"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Niche</label>
              <input
                type="text"
                value={form.niche}
                onChange={(e) => set('niche', e.target.value)}
                placeholder="Roofers"
                className={inputCls}
              />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Website</label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => set('website', e.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Quality Score (1-10)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.quality_score}
                onChange={(e) => set('quality_score', e.target.value)}
                placeholder="7"
                className={`${inputCls} tabular-nums`}
              />
            </div>

            <div>
              <label className={labelCls}>Assign Caller</label>
              <select
                value={form.caller_id}
                onChange={(e) => set('caller_id', e.target.value)}
                className={inputCls}
              >
                <option value="">Unassigned</option>
                {callers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] rounded-lg px-3 py-2 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Adding...
                </>
              ) : (
                'Add Lead'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
