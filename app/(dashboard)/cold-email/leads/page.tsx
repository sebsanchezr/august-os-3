'use client'

import { useEffect, useState, useCallback } from 'react'
import { timeAgo, getStatusColor } from '@/lib/utils'
import { ChevronDown, ChevronUp, X } from 'lucide-react'

type Lead = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  website: string | null
  niche: string | null
  source: string | null
  campaign: string | null
  quality_score: number | null
  status: string
  created_at: string
}

type EventRow = {
  id: string
  type: string
  payload: any
  occurred_at: string
}

type LeadDetail = {
  lead: Lead
  events: EventRow[]
  pipeline: { stage: string; stage_entered_at: string; value: number | null; notes: string | null } | null
}

const EVENT_LABELS: Record<string, string> = {
  email_sent: 'Email sent',
  reply_in: 'Reply received',
  ai_replied: 'AI reply sent',
  li_connected: 'LinkedIn connected',
  call_booked: 'Call booked',
  call_cancelled: 'Call cancelled',
  form_submitted: 'Form submitted',
  stage_change: 'Stage changed',
}

const EVENT_DOT: Record<string, string> = {
  reply_in: 'bg-indigo-400',
  call_booked: 'bg-green-400',
  call_cancelled: 'bg-red-400',
  ai_replied: 'bg-sky-400',
  stage_change: 'bg-purple-400',
  email_sent: 'bg-[#636780]',
}

export default function ColdEmailLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [campaignFilter, setCampaignFilter] = useState('')
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [sortField, setSortField] = useState<keyof Lead>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (sourceFilter) params.set('source', sourceFilter)
      if (campaignFilter) params.set('campaign', campaignFilter)
      const res = await fetch(`/api/cold-email/leads?${params}`)
      if (res.ok) {
        const d = await res.json()
        setLeads(d.leads ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [statusFilter, sourceFilter, campaignFilter])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  async function openLead(lead: Lead) {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/cold-email/leads/${lead.id}`)
      if (res.ok) setSelectedLead(await res.json())
    } finally {
      setDetailLoading(false)
    }
  }

  function toggleSort(field: keyof Lead) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sorted = [...leads].sort((a, b) => {
    const av = a[sortField] ?? ''
    const bv = b[sortField] ?? ''
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
    return sortDir === 'asc' ? cmp : -cmp
  })

  function SortIcon({ field }: { field: keyof Lead }) {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-indigo-400" />
      : <ChevronDown className="w-3 h-3 text-indigo-400" />
  }

  const allCampaigns = Array.from(new Set(leads.map((l) => l.campaign).filter(Boolean))) as string[]
  const allSources = Array.from(new Set(leads.map((l) => l.source).filter(Boolean))) as string[]
  const allStatuses = Array.from(new Set(leads.map((l) => l.status).filter(Boolean))) as string[]

  return (
    <div className="p-6 min-h-full">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-[#e4e6f0]">Leads</h1>
        <span className="text-xs text-[#636780] tabular-nums bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-1.5">
          {leads.length} total
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {allStatuses.length > 0 && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-1.5 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            {allStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {allSources.length > 0 && (
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-1.5 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All sources</option>
            {allSources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {allCampaigns.length > 0 && (
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-1.5 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All campaigns</option>
            {allCampaigns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {(statusFilter || sourceFilter || campaignFilter) && (
          <button
            onClick={() => { setStatusFilter(''); setSourceFilter(''); setCampaignFilter('') }}
            className="flex items-center gap-1 text-xs text-[#636780] hover:text-[#e4e6f0] transition-colors"
          >
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>

      <div className="rounded-xl border border-[#1c2035] bg-[#10121a] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <span className="text-sm text-[#636780]">Loading leads...</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm text-[#3d4060]">No leads yet.</p>
            <p className="text-xs text-[#2e3050] mt-1">
              Leads are created automatically when someone replies or books a call.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1c2035]">
                {[
                  { key: 'email', label: 'Email' },
                  { key: 'company', label: 'Company' },
                  { key: 'campaign', label: 'Campaign' },
                  { key: 'source', label: 'Source' },
                  { key: 'quality_score', label: 'Q' },
                  { key: 'status', label: 'Status' },
                  { key: 'created_at', label: 'Added' },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    className="text-left text-[10px] font-medium text-[#3d4060] uppercase tracking-wider px-4 py-3 cursor-pointer select-none"
                    onClick={() => toggleSort(key as keyof Lead)}
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      <SortIcon field={key as keyof Lead} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-[#1c2035] last:border-0 hover:bg-[#181b27] transition-colors cursor-pointer"
                  onClick={() => openLead(lead)}
                >
                  <td className="px-4 py-3">
                    <p className="text-sm text-[#e4e6f0]">
                      {lead.first_name ? `${lead.first_name} ${lead.last_name ?? ''}`.trim() : lead.email}
                    </p>
                    {lead.first_name && (
                      <p className="text-xs text-[#636780] truncate max-w-[180px]">{lead.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#636780]">
                    {lead.company ?? <span className="text-[#2e3050]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {lead.campaign ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 capitalize">
                        {lead.campaign}
                      </span>
                    ) : <span className="text-[#2e3050]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {lead.source ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#1c2035] text-[#636780] border border-[#1c2035] capitalize">
                        {lead.source.replace(/_/g, ' ')}
                      </span>
                    ) : <span className="text-[#2e3050]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#636780] tabular-nums">
                    {lead.quality_score ?? <span className="text-[#2e3050]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium capitalize ${getStatusColor(lead.status)}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#636780]">{timeAgo(lead.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Lead detail slide-over */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLead(null)} />
          <div className="relative z-10 ml-auto w-full max-w-md bg-[#10121a] border-l border-[#1c2035] overflow-y-auto">
            <div className="sticky top-0 bg-[#10121a] border-b border-[#1c2035] px-5 py-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#e4e6f0]">
                {selectedLead.lead.company ?? selectedLead.lead.email}
              </h2>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-[#636780] hover:text-[#e4e6f0] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Lead info */}
              <div className="bg-[#181b27] rounded-xl border border-[#1c2035] p-4 space-y-2">
                {[
                  ['Email', selectedLead.lead.email],
                  ['Name', selectedLead.lead.first_name ? `${selectedLead.lead.first_name} ${selectedLead.lead.last_name ?? ''}`.trim() : null],
                  ['Company', selectedLead.lead.company],
                  ['Website', selectedLead.lead.website],
                  ['Campaign', selectedLead.lead.campaign],
                  ['Source', selectedLead.lead.source?.replace(/_/g, ' ')],
                  ['Status', selectedLead.lead.status],
                  ['Quality', selectedLead.lead.quality_score != null ? String(selectedLead.lead.quality_score) : null],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4">
                    <span className="text-xs text-[#636780]">{k}</span>
                    <span className="text-xs text-[#e4e6f0] text-right truncate max-w-[220px]">{v}</span>
                  </div>
                ))}
              </div>

              {/* Pipeline stage */}
              {selectedLead.pipeline && (
                <div className="bg-[#181b27] rounded-xl border border-[#1c2035] p-4">
                  <p className="text-xs font-medium text-[#636780] uppercase tracking-wider mb-2">Current Stage</p>
                  <p className="text-sm font-semibold text-indigo-400 capitalize">
                    {selectedLead.pipeline.stage.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-[#636780] mt-1">
                    Entered {timeAgo(selectedLead.pipeline.stage_entered_at)}
                  </p>
                  {selectedLead.pipeline.notes && (
                    <p className="text-xs text-[#636780] mt-2 italic">{selectedLead.pipeline.notes}</p>
                  )}
                </div>
              )}

              {/* Event timeline */}
              <div>
                <p className="text-xs font-medium text-[#636780] uppercase tracking-wider mb-3">Timeline</p>
                {selectedLead.events.length === 0 ? (
                  <p className="text-xs text-[#2e3050]">No events recorded.</p>
                ) : (
                  <div className="relative border-l border-[#1c2035] ml-2 space-y-4">
                    {selectedLead.events.map((ev) => (
                      <div key={ev.id} className="ml-4 relative">
                        <div
                          className={`absolute -left-5 top-1 w-2 h-2 rounded-full ${EVENT_DOT[ev.type] ?? 'bg-[#636780]'}`}
                        />
                        <p className="text-xs font-medium text-[#e4e6f0]">
                          {EVENT_LABELS[ev.type] ?? ev.type}
                        </p>
                        {ev.payload?.from && ev.payload?.to && (
                          <p className="text-xs text-[#636780]">
                            {ev.payload.from.replace(/_/g, ' ')} to {ev.payload.to.replace(/_/g, ' ')}
                          </p>
                        )}
                        <p className="text-[10px] text-[#3d4060] mt-0.5">{timeAgo(ev.occurred_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
