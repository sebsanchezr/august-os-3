'use client'

import { useState, useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import type { CallLead, LeadStatus } from '@/lib/types'
import { getStatusColor } from '@/lib/utils'

interface CallTableProps {
  leads: CallLead[]
  onLogCall: (lead: CallLead) => void
  onRefresh: () => void
}

const STATUS_OPTIONS: { value: LeadStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'callback', label: 'Callback' },
  { value: 'booked', label: 'Booked' },
  { value: 'closed', label: 'Closed' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'dead', label: 'Dead' },
]

function ScoreDot({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[#636780] text-sm font-mono tabular-nums">-</span>
  const color =
    score >= 7 ? 'bg-green-400' : score >= 4 ? 'bg-amber-400' : 'bg-red-400'
  const textColor =
    score >= 7 ? 'text-green-400' : score >= 4 ? 'text-amber-400' : 'text-red-400'
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
      <span className={`text-sm font-mono tabular-nums ${textColor}`}>{score}</span>
    </span>
  )
}

export default function CallTable({ leads, onLogCall, onRefresh }: CallTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [nicheFilter, setNicheFilter] = useState<string>('all')

  const uniqueNiches = useMemo(() => {
    const niches = leads
      .map((l) => l.niche)
      .filter((n): n is string => !!n)
    return Array.from(new Set(niches)).sort()
  }, [leads])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return leads.filter((lead) => {
      const matchesSearch =
        !q ||
        lead.company.toLowerCase().includes(q) ||
        (lead.city ?? '').toLowerCase().includes(q)
      const matchesStatus =
        statusFilter === 'all' || lead.status === statusFilter
      const matchesNiche =
        nicheFilter === 'all' || lead.niche === nicheFilter
      return matchesSearch && matchesStatus && matchesNiche
    })
  }, [leads, search, statusFilter, nicheFilter])

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search company, city..."
          className="flex-1 max-w-xs bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeadStatus | 'all')}
          className="bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={nicheFilter}
          onChange={(e) => setNicheFilter(e.target.value)}
          className="bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="all">All niches</option>
          {uniqueNiches.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button
          onClick={onRefresh}
          className="text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] rounded-lg px-3 py-2 text-sm transition-colors flex items-center gap-1.5"
          aria-label="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[#1c2035]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#10121a]">
              {['Company', 'Phone', 'City', 'Niche', 'Status', 'Score', 'Actions'].map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-medium text-[#636780] uppercase tracking-wider border-b border-[#1c2035]"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-[#10121a]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#636780]">
                  No leads match your filters
                </td>
              </tr>
            ) : (
              filtered.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-[#1c2035] last:border-0 hover:bg-[#181b27]/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-[#e4e6f0]">{lead.company}</span>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`tel:${lead.phone}`}
                      className="text-sm text-indigo-400 hover:text-indigo-300 font-mono"
                    >
                      {lead.phone}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-[#636780]">{lead.city ?? '-'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-[#636780]">{lead.niche ?? '-'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}
                    >
                      {lead.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ScoreDot score={lead.quality_score} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onLogCall(lead)}
                      className="text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                    >
                      Log Call
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      <p className="text-xs text-[#636780] mt-3 tabular-nums">
        Showing {filtered.length} of {leads.length} leads
      </p>
    </div>
  )
}
