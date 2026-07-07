'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, Loader2, ChevronRight, CheckCircle2, Circle, Clock } from 'lucide-react'
import { fetchAllMeetings, type MeetingWithClient } from '@/lib/accounts-client'
import MeetingSlideOver from '@/components/meetings/meeting-slide-over'
import Link from 'next/link'

const TYPE_BADGE: Record<string, string> = {
  weekly:  'bg-indigo-900/50 text-indigo-300',
  monthly: 'bg-purple-900/50 text-purple-300',
  adhoc:   'bg-[#181b27] text-[#636780]',
}

function PrepChip({ prep }: { prep: { status: string } | null }) {
  if (!prep) return <span className="text-[10px] text-[#3d4060]">no prep</span>
  if (prep.status === 'approved' || prep.status === 'sent')
    return <span className="text-[10px] text-emerald-400 font-medium">prep ready</span>
  if (prep.status === 'pending_approval')
    return <span className="text-[10px] text-amber-400 font-medium">prep pending</span>
  return <span className="text-[10px] text-[#3d4060]">no prep</span>
}

function ThisWeekStrip({ meetings, onOpen }: { meetings: MeetingWithClient[]; onOpen: (m: MeetingWithClient) => void }) {
  const now = new Date()
  const weekEnd = new Date(now)
  weekEnd.setDate(now.getDate() + 7)
  const thisWeek = meetings.filter(m => {
    const d = new Date(m.scheduled_at)
    return d >= now && d <= weekEnd
  })

  if (thisWeek.length === 0) return null

  return (
    <div className="mb-6">
      <p className="text-[10px] font-bold tracking-[0.12em] text-[#636780] uppercase mb-3">This Week</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {thisWeek.map(m => (
          <button
            key={m.id}
            onClick={() => onOpen(m)}
            className="flex-shrink-0 bg-[#0d0f15] border border-[#1c2035] rounded-xl p-4 w-52 text-left hover:border-indigo-500/40 transition-colors group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[m.type] ?? TYPE_BADGE.adhoc}`}>
                {m.type}
              </span>
              <PrepChip prep={m.prep_report} />
            </div>
            <p className="text-sm font-medium text-[#e4e6f0] truncate group-hover:text-white">{m.clients.name}</p>
            <p className="text-[11px] text-[#636780] mt-1">
              {new Date(m.scheduled_at).toLocaleString('en-GB', {
                weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
              })}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

function MeetingRow({ meeting, onOpen }: { meeting: MeetingWithClient; onOpen: () => void }) {
  const dateStr = new Date(meeting.scheduled_at).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  })
  const isToday = new Date(meeting.scheduled_at).toDateString() === new Date().toDateString()

  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-[#181b27] transition-colors group text-left"
    >
      {/* Time */}
      <div className="w-36 shrink-0">
        <p className={`text-xs ${isToday ? 'text-indigo-400 font-semibold' : 'text-[#636780]'}`}>{dateStr}</p>
      </div>

      {/* Client */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#e4e6f0] font-medium truncate group-hover:text-white">{meeting.clients.name}</p>
      </div>

      {/* Type */}
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${TYPE_BADGE[meeting.type] ?? TYPE_BADGE.adhoc}`}>
        {meeting.type}
      </span>

      {/* Prep */}
      <div className="w-20 shrink-0 text-right">
        <PrepChip prep={meeting.prep_report} />
      </div>

      {/* Minutes */}
      <div className="w-20 shrink-0 text-right">
        {meeting.minutes_sent_at ? (
          <span className="text-[10px] text-emerald-400">minutes sent</span>
        ) : meeting.minutes_md ? (
          <span className="text-[10px] text-amber-400">draft</span>
        ) : (
          <span className="text-[10px] text-[#3d4060]">no minutes</span>
        )}
      </div>

      <ChevronRight size={14} className="text-[#3d4060] group-hover:text-[#636780] shrink-0" />
    </button>
  )
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingWithClient[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [selected, setSelected] = useState<MeetingWithClient | null>(null)

  useEffect(() => {
    fetchAllMeetings()
      .then(setMeetings)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function handleUpdated(updated: MeetingWithClient) {
    setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m))
    setSelected(updated)
  }

  const upcoming = meetings.filter(m => new Date(m.scheduled_at) >= new Date())

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <CalendarDays className="text-indigo-400" size={20} />
          <h1 className="text-lg font-semibold text-[#e4e6f0]">Meetings</h1>
        </div>
        <Link
          href="/meetings/past"
          className="text-xs text-[#636780] hover:text-[#e4e6f0] transition-colors flex items-center gap-1"
        >
          <Clock size={12} /> Past meetings
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="animate-spin text-[#636780]" size={20} />
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <>
          <ThisWeekStrip meetings={upcoming} onOpen={setSelected} />

          <div>
            <p className="text-[10px] font-bold tracking-[0.12em] text-[#636780] uppercase mb-2">
              Upcoming ({upcoming.length})
            </p>
            {upcoming.length === 0 ? (
              <p className="text-sm text-[#636780] py-4">No upcoming meetings. Schedule one from a client page.</p>
            ) : (
              <div className="space-y-0.5">
                {upcoming.map(m => (
                  <MeetingRow key={m.id} meeting={m} onOpen={() => setSelected(m)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {selected && (
        <MeetingSlideOver
          meeting={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}
