'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { timeAgo } from '@/lib/utils'
import { ExternalLink } from 'lucide-react'

type ReplyEvent = {
  id: string
  type: string
  payload: any
  occurred_at: string
  lead_id: string | null
  ce_leads: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    company: string | null
    campaign: string | null
  } | null
}

export default function ColdEmailReplies() {
  const [events, setEvents] = useState<ReplyEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [campaign, setCampaign] = useState('')
  const [campaigns, setCampaigns] = useState<string[]>([])

  const fetchEvents = useCallback(async (c: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (c) params.set('campaign', c)
      const res = await fetch(`/api/cold-email/events?${params}`)
      if (res.ok) {
        const d = await res.json()
        const replies = (d.events ?? []).filter((e: ReplyEvent) => e.type === 'reply_in')
        setEvents(replies)

        // Build campaign list from data
        const set = new Set<string>()
        for (const ev of d.events ?? []) {
          if (ev.ce_leads?.campaign) set.add(ev.ce_leads.campaign)
        }
        setCampaigns(Array.from(set))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEvents(campaign) }, [campaign, fetchEvents])

  function getSnippet(payload: any): string {
    if (!payload) return ''
    if (typeof payload.text === 'string') return payload.text.slice(0, 140)
    if (typeof payload.body === 'string') return payload.body.slice(0, 140)
    if (typeof payload.snippet === 'string') return payload.snippet.slice(0, 140)
    return ''
  }

  return (
    <div className="p-6 min-h-full">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-[#e4e6f0]">Replies</h1>

        {campaigns.length > 0 && (
          <select
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            className="bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-1.5 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      <div className="rounded-xl border border-[#1c2035] bg-[#10121a] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <span className="text-sm text-[#636780]">Loading replies...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-10 h-10 rounded-full bg-[#181b27] flex items-center justify-center mb-3">
              <span className="text-lg">✉</span>
            </div>
            <p className="text-sm text-[#3d4060]">No replies yet.</p>
            <p className="text-xs text-[#2e3050] mt-1">
              Reply events will appear here once the Python engine syncs.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1c2035]">
                <th className="text-left text-[10px] font-medium text-[#3d4060] uppercase tracking-wider px-4 py-3">When</th>
                <th className="text-left text-[10px] font-medium text-[#3d4060] uppercase tracking-wider px-4 py-3">Who</th>
                <th className="text-left text-[10px] font-medium text-[#3d4060] uppercase tracking-wider px-4 py-3">Company</th>
                <th className="text-left text-[10px] font-medium text-[#3d4060] uppercase tracking-wider px-4 py-3">Campaign</th>
                <th className="text-left text-[10px] font-medium text-[#3d4060] uppercase tracking-wider px-4 py-3">Snippet</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {events.map((ev, i) => {
                const lead = ev.ce_leads
                const snippet = getSnippet(ev.payload)
                return (
                  <tr
                    key={ev.id}
                    className={`border-b border-[#1c2035] last:border-0 hover:bg-[#181b27] transition-colors ${i % 2 === 0 ? '' : ''}`}
                  >
                    <td className="px-4 py-3 text-xs text-[#636780] whitespace-nowrap">
                      {timeAgo(ev.occurred_at)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-[#e4e6f0] font-medium">
                        {lead?.first_name ? `${lead.first_name} ${lead.last_name ?? ''}`.trim() : (lead?.email ?? 'Unknown')}
                      </p>
                      {lead?.first_name && (
                        <p className="text-xs text-[#636780] truncate max-w-[160px]">{lead.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#636780]">
                      {lead?.company ?? <span className="text-[#2e3050]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {lead?.campaign ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 capitalize">
                          {lead.campaign}
                        </span>
                      ) : (
                        <span className="text-[#2e3050]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#636780] max-w-xs">
                      {snippet ? (
                        <span className="line-clamp-2">{snippet}</span>
                      ) : (
                        <span className="text-[#2e3050]">No body</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {lead?.id && (
                        <Link
                          href={`/cold-email/leads?highlight=${lead.id}`}
                          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          Lead
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
