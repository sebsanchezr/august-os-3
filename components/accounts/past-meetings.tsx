'use client'

import { useEffect, useState } from 'react'
import { Loader2, ChevronRight, Calendar } from 'lucide-react'
import { fetchAllMeetings, type MeetingWithClient } from '@/lib/accounts-client'
import MeetingSlideOver from '@/components/meetings/meeting-slide-over'

const TYPE_BADGE: Record<string, string> = {
  weekly:  'bg-indigo-900/50 text-indigo-300',
  monthly: 'bg-purple-900/50 text-purple-300',
  adhoc:   'bg-[#181b27] text-[#636780]',
}

// A meeting counts as "past" when it is done, cancelled, or a still-scheduled
// meeting whose slot is already behind us.
function isPast(m: MeetingWithClient): boolean {
  if (m.status === 'done' || m.status === 'cancelled') return true
  return new Date(m.scheduled_at).getTime() < Date.now()
}

export default function PastMeetings({ clientId }: { clientId: string }) {
  const [meetings, setMeetings] = useState<MeetingWithClient[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [selected, setSelected] = useState<MeetingWithClient | null>(null)

  useEffect(() => {
    setLoading(true)
    // Pull every meeting for this client, then keep the past ones. status=all
    // lets us surface cancelled meetings alongside done + past-scheduled.
    fetchAllMeetings({ client_id: clientId, status: 'all' })
      .then(all => {
        const past = all
          .filter(isPast)
          .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
        setMeetings(past)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [clientId])

  function handleUpdated(updated: MeetingWithClient) {
    setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m))
    setSelected(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="animate-spin text-[#636780]" size={20} />
      </div>
    )
  }

  if (error) return <p className="text-sm text-red-400">{error}</p>

  return (
    <div>
      {meetings.length === 0 && (
        <p className="text-sm text-[#636780] py-4">No past meetings for this client yet.</p>
      )}

      <div className="space-y-0.5">
        {meetings.map(m => {
          const dateStr = new Date(m.scheduled_at).toLocaleString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
          })
          return (
            <button
              key={m.id}
              onClick={() => setSelected(m)}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-lg border border-transparent hover:border-[#1c2035] hover:bg-[#181b27] transition-colors group text-left"
            >
              <div className="w-48 shrink-0 flex items-center gap-2">
                <Calendar size={12} className="text-[#3d4060] shrink-0" />
                <p className="text-xs text-[#636780]">{dateStr}</p>
              </div>

              <div className="flex-1 min-w-0">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[m.type] ?? TYPE_BADGE.adhoc}`}>
                  {m.type}
                </span>
                {m.status === 'cancelled' && m.cancellation_reason && (
                  <p className="text-[11px] text-[#636780] mt-1 truncate">
                    Cancelled: {m.cancellation_reason}
                  </p>
                )}
              </div>

              <StatusBadge status={m.status} />

              <div className="w-24 shrink-0 text-right">
                {m.minutes_sent_at ? (
                  <span className="text-[10px] text-emerald-400">minutes sent</span>
                ) : m.minutes_md ? (
                  <span className="text-[10px] text-amber-400">draft minutes</span>
                ) : (
                  <span className="text-[10px] text-[#3d4060]">no minutes</span>
                )}
              </div>

              <ChevronRight size={14} className="text-[#3d4060] group-hover:text-[#636780] shrink-0" />
            </button>
          )
        })}
      </div>

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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    scheduled: 'bg-indigo-900/50 text-indigo-300',
    done:      'bg-emerald-900/50 text-emerald-300',
    cancelled: 'bg-[#1c2035] text-[#636780]',
  }
  const label: Record<string, string> = {
    scheduled: 'Missed', // past but never marked done/cancelled
    done:      'Done',
    cancelled: 'Cancelled',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 w-20 text-center ${styles[status] ?? styles.cancelled}`}>
      {label[status] ?? status}
    </span>
  )
}
