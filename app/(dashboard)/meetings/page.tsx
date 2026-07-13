'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays, Loader2, ChevronRight, ChevronDown, Clock, Users,
  CheckCircle2, Ban,
} from 'lucide-react'
import type { MeetingWithClient } from '@/lib/accounts-client'
import MeetingSlideOver from '@/components/meetings/meeting-slide-over'
import Link from 'next/link'

const TYPE_BADGE: Record<string, string> = {
  weekly:  'bg-indigo-900/50 text-indigo-300',
  monthly: 'bg-purple-900/50 text-purple-300',
  adhoc:   'bg-[#181b27] text-[#636780]',
}

// Stable colour dot per client so the same client reads the same colour
// everywhere on the page, without needing a colour stored on the client row.
const CLIENT_DOT_COLORS = [
  'bg-indigo-400', 'bg-emerald-400', 'bg-amber-400', 'bg-pink-400',
  'bg-sky-400', 'bg-purple-400', 'bg-orange-400', 'bg-teal-400',
]

function colorForClient(id: string | null): string {
  // Internal team meetings have no client: a stable neutral dot.
  if (!id) return 'bg-[#636780]'
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return CLIENT_DOT_COLORS[hash % CLIENT_DOT_COLORS.length]
}

// Title shown on a card: the meeting's own title (e.g. "Team priorities call")
// takes priority, then the client name, then a safe fallback.
function meetingLabel(m: MeetingWithClient): string {
  return m.title ?? m.clients?.name ?? 'Meeting'
}

function startOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

// Monday 00:00 of the week containing `d`.
function startOfWeek(d: Date): Date {
  const out = startOfDay(d)
  const day = out.getDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day
  out.setDate(out.getDate() + diff)
  return out
}

function dayKey(d: Date): string {
  return startOfDay(d).toISOString()
}

function dayHeaderLabel(d: Date, today: Date): string {
  const target = startOfDay(d)
  const t = startOfDay(today)
  const diffDays = Math.round((target.getTime() - t.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Europe/London' })
}

function dayDateLabel(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })
}

function groupByDay(meetings: MeetingWithClient[]): { key: string; date: Date; meetings: MeetingWithClient[] }[] {
  const groups = new Map<string, { date: Date; meetings: MeetingWithClient[] }>()
  for (const m of meetings) {
    const d = new Date(m.scheduled_at)
    const key = dayKey(d)
    if (!groups.has(key)) groups.set(key, { date: startOfDay(d), meetings: [] })
    groups.get(key)!.meetings.push(m)
  }
  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({ key, date: v.date, meetings: v.meetings }))
}

function StatusBadge({ status }: { status: MeetingWithClient['status'] }) {
  if (status === 'cancelled')
    return (
      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-950/50 text-red-400">
        <Ban size={10} /> cancelled
      </span>
    )
  if (status === 'done')
    return (
      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-950/50 text-emerald-400">
        <CheckCircle2 size={10} /> done
      </span>
    )
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[#181b27] text-[#636780]">
      scheduled
    </span>
  )
}

function MeetingCard({ meeting, onOpen }: { meeting: MeetingWithClient; onOpen: () => void }) {
  const isCancelled = meeting.status === 'cancelled'
  const timeStr = new Date(meeting.scheduled_at).toLocaleString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  })

  return (
    <button
      onClick={onOpen}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-transparent hover:border-[#1c2035] hover:bg-[#141722] transition-colors text-left ${isCancelled ? 'opacity-60' : ''}`}
    >
      <span className={`h-2 w-2 rounded-full shrink-0 ${colorForClient(meeting.client_id)}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium truncate ${isCancelled ? 'line-through text-[#636780]' : 'text-[#e4e6f0]'}`}>
            {meetingLabel(meeting)}
          </p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${TYPE_BADGE[meeting.type] ?? TYPE_BADGE.adhoc}`}>
            {meeting.type}
          </span>
        </div>
        {meeting.agenda && (
          <p className="text-xs text-[#636780] truncate mt-0.5">{meeting.agenda}</p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <p className={`text-xs ${isCancelled ? 'line-through text-[#3d4060]' : 'text-[#e4e6f0]'}`}>{timeStr}</p>
          <p className="text-[10px] text-[#636780]">{meeting.duration_minutes} min</p>
        </div>

        {meeting.attendees && meeting.attendees.length > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-[#636780]">
            <Users size={11} /> {meeting.attendees.length}
          </span>
        )}

        <StatusBadge status={meeting.status} />

        <ChevronRight size={14} className="text-[#3d4060]" />
      </div>
    </button>
  )
}

function DaySection({
  date, today, meetings, onOpen,
}: {
  date: Date
  today: Date
  meetings: MeetingWithClient[]
  onOpen: (m: MeetingWithClient) => void
}) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-2 mb-1.5 px-1">
        <p className="text-xs font-semibold text-[#e4e6f0]">{dayHeaderLabel(date, today)}</p>
        <p className="text-[10px] text-[#636780]">{dayDateLabel(date)}</p>
      </div>
      <div className="space-y-1">
        {meetings.map(m => (
          <MeetingCard key={m.id} meeting={m} onOpen={() => onOpen(m)} />
        ))}
      </div>
    </div>
  )
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: 'default' | 'good' | 'bad' }) {
  const toneClass = tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-red-400' : 'text-[#e4e6f0]'
  return (
    <div className="flex-1 bg-[#0d0f15] border border-[#1c2035] rounded-xl px-4 py-3">
      <p className={`text-xl font-semibold ${toneClass}`}>{value}</p>
      <p className="text-[10px] font-medium tracking-[0.08em] text-[#636780] uppercase mt-0.5">{label}</p>
    </div>
  )
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingWithClient[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [selected, setSelected] = useState<MeetingWithClient | null>(null)
  const [laterOpen, setLaterOpen] = useState(false)

  useEffect(() => {
    const now = new Date()
    const from = startOfWeek(now)
    const to = new Date(from)
    to.setDate(to.getDate() + 70) // this week + next week + a generous later window

    const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })

    fetch(`/api/meetings?${params}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load meetings')
        return res.json()
      })
      .then(json => setMeetings(json.meetings ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function handleUpdated(updated: MeetingWithClient) {
    setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m))
    setSelected(updated)
  }

  const { thisWeek, nextWeek, later, stats } = useMemo(() => {
    const now = new Date()
    const thisWeekStart = startOfWeek(now)
    const nextWeekStart = new Date(thisWeekStart)
    nextWeekStart.setDate(nextWeekStart.getDate() + 7)
    const laterStart = new Date(nextWeekStart)
    laterStart.setDate(laterStart.getDate() + 7)

    const sorted = [...meetings].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
    )

    const thisWeekMeetings = sorted.filter(m => {
      const d = new Date(m.scheduled_at)
      return d >= thisWeekStart && d < nextWeekStart
    })
    const nextWeekMeetings = sorted.filter(m => {
      const d = new Date(m.scheduled_at)
      return d >= nextWeekStart && d < laterStart
    })
    const laterMeetings = sorted.filter(m => new Date(m.scheduled_at) >= laterStart)

    return {
      thisWeek: thisWeekMeetings,
      nextWeek: nextWeekMeetings,
      later: laterMeetings,
      stats: {
        total: thisWeekMeetings.length,
        completed: thisWeekMeetings.filter(m => m.status === 'done').length,
        cancelled: thisWeekMeetings.filter(m => m.status === 'cancelled').length,
      },
    }
  }, [meetings])

  const today = new Date()
  const thisWeekDays = useMemo(() => groupByDay(thisWeek), [thisWeek])
  const nextWeekDays = useMemo(() => groupByDay(nextWeek), [nextWeek])
  const laterDays = useMemo(() => groupByDay(later), [later])

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
          <div className="flex gap-3 mb-8">
            <StatTile label="Meetings this week" value={stats.total} tone="default" />
            <StatTile label="Completed this week" value={stats.completed} tone="good" />
            <StatTile label="Cancelled this week" value={stats.cancelled} tone="bad" />
          </div>

          <div className="mb-8">
            <p className="text-[10px] font-bold tracking-[0.12em] text-[#636780] uppercase mb-3">This Week</p>
            {thisWeekDays.length === 0 ? (
              <p className="text-sm text-[#636780] py-2">No meetings this week.</p>
            ) : (
              thisWeekDays.map(g => (
                <DaySection key={g.key} date={g.date} today={today} meetings={g.meetings} onOpen={setSelected} />
              ))
            )}
          </div>

          <div className="mb-8">
            <p className="text-[10px] font-bold tracking-[0.12em] text-[#636780] uppercase mb-3">Next Week</p>
            {nextWeekDays.length === 0 ? (
              <p className="text-sm text-[#636780] py-2">No meetings scheduled yet.</p>
            ) : (
              nextWeekDays.map(g => (
                <DaySection key={g.key} date={g.date} today={today} meetings={g.meetings} onOpen={setSelected} />
              ))
            )}
          </div>

          {later.length > 0 && (
            <div>
              <button
                onClick={() => setLaterOpen(v => !v)}
                className="flex items-center gap-2 text-[10px] font-bold tracking-[0.12em] text-[#636780] uppercase mb-3 hover:text-[#e4e6f0] transition-colors"
              >
                {laterOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Later ({later.length})
              </button>
              {laterOpen && laterDays.map(g => (
                <DaySection key={g.key} date={g.date} today={today} meetings={g.meetings} onOpen={setSelected} />
              ))}
            </div>
          )}
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
