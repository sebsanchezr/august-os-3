'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, MessageSquare, CheckCircle2, HelpCircle, Clock, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { fetchCommsInbox, markResponded, type CommsInbox } from '@/lib/accounts-client'
import type { ClientCommsLog, TeamQuestion } from '@/lib/types'

const CHANNEL_ICON: Record<string, string> = {
  whatsapp: 'WA',
  email:    'EM',
  call:     'CA',
  meeting:  'MT',
}

const CHANNEL_COLOUR: Record<string, string> = {
  whatsapp: 'bg-emerald-900/60 text-emerald-300',
  email:    'bg-blue-900/60 text-blue-300',
  call:     'bg-purple-900/60 text-purple-300',
  meeting:  'bg-indigo-900/60 text-indigo-300',
}

function SlaCountdown({ responseDueAt, slaBreached }: { responseDueAt: string; slaBreached: boolean }) {
  const due = new Date(responseDueAt)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  const overdue = diffMs < 0

  if (slaBreached || overdue) {
    const minsOverdue = Math.abs(Math.floor(diffMs / 60000))
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-red-400 animate-pulse">
        <AlertTriangle size={11} />
        BREACHED {minsOverdue}m ago
      </span>
    )
  }

  const totalMins = Math.floor(diffMs / 60000)
  const hrs = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  const pct = Math.max(0, diffMs / (2 * 60 * 60 * 1000)) // assume 2h SLA for colour
  const colour = pct > 0.5 ? 'text-emerald-400' : pct > 0.25 ? 'text-amber-400' : 'text-red-400'

  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${colour}`}>
      <Clock size={11} />
      {hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`} left
    </span>
  )
}

type CommRowProps = {
  comm: CommsInbox['open_clocks'][number]
  onResponded: (id: string) => void
}

function CommRow({ comm, onResponded }: CommRowProps) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleRespond() {
    setLoading(true)
    try {
      await markResponded(comm.id)
      setDone(true)
      onResponded(comm.id)
    } catch {
      // keep visible
    } finally {
      setLoading(false)
    }
  }

  const occurredStr = new Date(comm.occurred_at).toLocaleString('en-GB', {
    timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  if (done) return null

  return (
    <div className="flex items-start gap-4 px-4 py-3.5 rounded-lg bg-[#0d0f15] border border-[#1c2035] hover:border-indigo-500/20 transition-colors">
      {/* Channel badge */}
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${CHANNEL_COLOUR[comm.channel] ?? 'bg-[#181b27] text-[#636780]'}`}>
        {CHANNEL_ICON[comm.channel] ?? comm.channel.toUpperCase()}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Link href={`/accounts/${comm.clients.id}`} className="text-sm font-medium text-[#e4e6f0] hover:text-indigo-400 transition-colors">
            {comm.clients.name}
          </Link>
          {comm.sla_breached && <AlertTriangle size={11} className="text-red-400 shrink-0" />}
        </div>
        <p className="text-xs text-[#8b8fa8] leading-relaxed line-clamp-2">{comm.summary}</p>
        <p className="text-[10px] text-[#3d4060] mt-1">{occurredStr}</p>
      </div>

      {/* SLA */}
      <div className="shrink-0 text-right space-y-1.5">
        {comm.response_due_at && (
          <SlaCountdown responseDueAt={comm.response_due_at} slaBreached={comm.sla_breached} />
        )}
        <button
          onClick={handleRespond}
          disabled={loading}
          className="flex items-center gap-1 text-[11px] bg-[#181b27] border border-[#1c2035] text-[#636780] hover:text-[#e4e6f0] hover:border-emerald-500/40 px-2 py-1 rounded transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
          Responded
        </button>
      </div>
    </div>
  )
}

function QuestionRow({ question }: { question: TeamQuestion }) {
  const timeStr = new Date(question.asked_at).toLocaleString('en-GB', {
    timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  const isAnswered = question.status === 'answered'

  return (
    <div className={`flex items-start gap-3 px-4 py-3.5 rounded-lg border transition-colors ${
      isAnswered ? 'bg-[#0d0f15] border-[#1c2035]' : 'bg-[#0d0f15] border-[#1c2035] hover:border-indigo-500/20'
    }`}>
      <HelpCircle size={14} className={`shrink-0 mt-0.5 ${isAnswered ? 'text-emerald-400' : 'text-indigo-400'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#e4e6f0] font-medium">{question.question}</p>
        {question.context && <p className="text-xs text-[#636780] mt-0.5">{question.context}</p>}
        {question.clients && (
          <Link href={`/accounts/${question.clients.id}`} className="text-[11px] text-indigo-400 hover:underline mt-0.5 block">
            {question.clients.name}
          </Link>
        )}
        {isAnswered && question.answer && (
          <div className="mt-2 bg-emerald-950/30 border border-emerald-900/40 rounded p-2">
            <p className="text-[11px] text-emerald-300">{question.answer}</p>
            {question.answerer && (
              <p className="text-[10px] text-[#636780] mt-1">
                {question.answerer.name} via Discord
              </p>
            )}
          </div>
        )}
        <p className="text-[10px] text-[#3d4060] mt-1">{timeStr}</p>
      </div>
      <span className={`text-[10px] shrink-0 font-medium ${isAnswered ? 'text-emerald-400' : 'text-amber-400'}`}>
        {isAnswered ? 'answered' : 'open'}
      </span>
    </div>
  )
}

export default function CommsInboxPage() {
  const [inbox, setInbox] = useState<CommsInbox | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(() => {
    fetchCommsInbox()
      .then(setInbox)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function handleResponded(commId: string) {
    setInbox(prev => prev ? {
      ...prev,
      open_clocks: prev.open_clocks.filter(c => c.id !== commId),
    } : prev)
  }

  const breached = inbox?.open_clocks.filter(c => c.sla_breached) ?? []
  const dueSoon  = inbox?.open_clocks.filter(c => !c.sla_breached) ?? []

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2.5 mb-6">
        <MessageSquare className="text-indigo-400" size={20} />
        <h1 className="text-lg font-semibold text-[#e4e6f0]">Comms Inbox</h1>
        {inbox && (inbox.open_clocks.length > 0) && (
          <span className="ml-1 text-xs bg-red-900/60 text-red-300 px-1.5 py-0.5 rounded-full font-medium">
            {inbox.open_clocks.length} open
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="animate-spin text-[#636780]" size={20} />
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && inbox && (
        <div className="space-y-8">
          {/* SLA Clocks */}
          <section>
            <p className="text-[10px] font-bold tracking-[0.12em] text-[#636780] uppercase mb-3">
              Response clocks ({inbox.open_clocks.length})
            </p>

            {inbox.open_clocks.length === 0 && (
              <p className="text-sm text-[#636780] py-3">All clear. No open response clocks.</p>
            )}

            {breached.length > 0 && (
              <div className="space-y-2 mb-3">
                {breached.map(c => (
                  <CommRow key={c.id} comm={c} onResponded={handleResponded} />
                ))}
              </div>
            )}

            {dueSoon.length > 0 && (
              <div className="space-y-2">
                {dueSoon.map(c => (
                  <CommRow key={c.id} comm={c} onResponded={handleResponded} />
                ))}
              </div>
            )}
          </section>

          {/* Team questions */}
          <section>
            <p className="text-[10px] font-bold tracking-[0.12em] text-[#636780] uppercase mb-3">
              Team questions ({inbox.questions.length})
            </p>
            {inbox.questions.length === 0 && (
              <p className="text-sm text-[#636780] py-3">No questions yet.</p>
            )}
            <div className="space-y-2">
              {inbox.questions.map(q => (
                <QuestionRow key={q.id} question={q} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
