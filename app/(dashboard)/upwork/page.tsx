'use client'

import { useEffect, useState, useCallback } from 'react'
import { ExternalLink, Copy, Check } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import type { UpworkJob } from '@/lib/types'

const STATUS_LABELS: Record<string, string> = {
  new: 'New', surfaced: 'Surfaced', applied: 'Applied', replied: 'Replied',
  call_booked: 'Call Booked', won: 'Won', passed: 'Passed',
}

const STATUS_COLOURS: Record<string, string> = {
  surfaced: 'bg-indigo-500/15 text-indigo-400',
  applied: 'bg-amber-500/15 text-amber-400',
  replied: 'bg-purple-500/15 text-purple-400',
  call_booked: 'bg-emerald-500/15 text-emerald-400',
  won: 'bg-green-500/15 text-green-400',
  passed: 'bg-[#636780]/15 text-[#636780]',
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="flex items-center gap-1.5 text-xs text-[#636780] hover:text-[#e4e6f0] transition-colors"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function UpworkPage() {
  const [jobs, setJobs] = useState<UpworkJob[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('surfaced')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})

  const fetchJobs = useCallback(async (s: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/upwork?status=${s}`)
      if (res.ok) {
        const d = await res.json()
        setJobs(d.jobs ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchJobs(status) }, [status, fetchJobs])

  async function updateStatus(id: string, newStatus: string) {
    const res = await fetch(`/api/upwork/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) setJobs(prev => prev.filter(j => j.id !== id))
  }

  async function submitReply(id: string) {
    const inbound_body = replyDrafts[id]
    if (!inbound_body?.trim()) return
    const res = await fetch(`/api/upwork/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inbound_body }),
    })
    if (res.ok) {
      setReplyDrafts(prev => ({ ...prev, [id]: '' }))
      fetchJobs(status)
    }
  }

  return (
    <div className="p-6 min-h-full">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-[#e4e6f0]">Upwork Opportunities</h1>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-1.5 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {['surfaced', 'applied', 'replied', 'call_booked', 'won', 'passed', 'all'].map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All' : STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <span className="text-sm text-[#636780]">Loading opportunities...</span>
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-[#1c2035] bg-[#10121a]">
          <p className="text-sm text-[#636780]">No opportunities in this view yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map(job => {
            const proposal = job.upwork_proposals?.[0]
            return (
              <div key={job.id} className="rounded-xl border border-[#1c2035] bg-[#10121a] p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${STATUS_COLOURS[job.status] ?? ''}`}>
                        {STATUS_LABELS[job.status] ?? job.status}
                      </span>
                      <span className="text-xs text-[#636780]">Fit {job.fit_score ?? '?'}/10 &middot; {timeAgo(job.created_at)}</span>
                    </div>
                    <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#e4e6f0] hover:text-indigo-400 flex items-center gap-1.5">
                      {job.title}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {job.fit_rationale && <p className="text-xs text-[#636780] mt-1">{job.fit_rationale}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {job.status === 'surfaced' && (
                      <>
                        <button onClick={() => updateStatus(job.id, 'applied')} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500">Mark Applied</button>
                        <button onClick={() => updateStatus(job.id, 'passed')} className="text-xs px-3 py-1.5 rounded-lg bg-[#181b27] text-[#636780] hover:text-[#e4e6f0]">Pass</button>
                      </>
                    )}
                  </div>
                </div>

                {proposal && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-[#08090c] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold uppercase text-[#636780]">Proposal</p>
                        <CopyButton text={proposal.cover_letter} />
                      </div>
                      <p className="text-xs text-[#e4e6f0] whitespace-pre-wrap leading-relaxed">{proposal.cover_letter}</p>
                    </div>
                    <div className="bg-[#08090c] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold uppercase text-[#636780]">Loom Script</p>
                        <CopyButton text={proposal.loom_script} />
                      </div>
                      <p className="text-xs text-[#e4e6f0] whitespace-pre-wrap leading-relaxed">{proposal.loom_script}</p>
                    </div>
                  </div>
                )}

                {(job.upwork_messages?.length ?? 0) > 0 && (
                  <div className="mt-4 space-y-2">
                    {job.upwork_messages!.map(m => (
                      <div key={m.id} className="bg-[#08090c] rounded-lg p-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase text-[#636780] mb-1">
                            {m.direction === 'inbound' ? 'Client' : 'Draft reply'}
                          </p>
                          <p className="text-xs text-[#e4e6f0] whitespace-pre-wrap">{m.body}</p>
                        </div>
                        {m.direction === 'outbound' && <CopyButton text={m.body} />}
                      </div>
                    ))}
                  </div>
                )}

                {['applied', 'replied'].includes(job.status) && (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={replyDrafts[job.id] ?? ''}
                      onChange={(e) => setReplyDrafts(prev => ({ ...prev, [job.id]: e.target.value }))}
                      placeholder="Paste the client's reply from Upwork..."
                      className="flex-1 bg-[#08090c] border border-[#1c2035] rounded-lg px-3 py-2 text-xs text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button onClick={() => submitReply(job.id)} className="text-xs px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500">Draft Reply</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
