'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { fetchAllMeetings, type MeetingWithClient } from '@/lib/accounts-client'
import MeetingSlideOver from '@/components/meetings/meeting-slide-over'

const TYPE_BADGE: Record<string, string> = {
  weekly:  'bg-indigo-900/50 text-indigo-300',
  monthly: 'bg-purple-900/50 text-purple-300',
  adhoc:   'bg-[#181b27] text-[#636780]',
}

export default function PastMeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingWithClient[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [selected, setSelected] = useState<MeetingWithClient | null>(null)

  useEffect(() => {
    fetchAllMeetings({ past: true })
      .then(setMeetings)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function handleUpdated(updated: MeetingWithClient) {
    setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m))
    setSelected(updated)
  }

  return (
    <div className="p-6 max-w-4xl">
      <Link href="/meetings" className="flex items-center gap-1.5 text-xs text-[#636780] hover:text-[#e4e6f0] mb-5 transition-colors">
        <ArrowLeft size={12} /> Upcoming meetings
      </Link>

      <h1 className="text-lg font-semibold text-[#e4e6f0] mb-6">Past Meetings</h1>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="animate-spin text-[#636780]" size={20} />
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="space-y-0.5">
          {meetings.length === 0 && (
            <p className="text-sm text-[#636780] py-4">No past meetings yet.</p>
          )}
          {meetings.map(m => {
            const dateStr = new Date(m.scheduled_at).toLocaleString('en-GB', {
              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
            })
            return (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-[#181b27] transition-colors group text-left"
              >
                <div className="w-44 shrink-0">
                  <p className="text-xs text-[#636780]">{dateStr}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#e4e6f0] font-medium truncate group-hover:text-white">{m.title ?? m.clients?.name ?? 'Meeting'}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${TYPE_BADGE[m.type] ?? TYPE_BADGE.adhoc}`}>
                  {m.type}
                </span>
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
