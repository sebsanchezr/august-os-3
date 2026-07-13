'use client'

import { useState } from 'react'
import {
  X, FileText, CheckSquare, List, Mic, Send, Loader2, ExternalLink, Ban,
} from 'lucide-react'
import type { MeetingWithClient } from '@/lib/accounts-client'
import { updateMeeting, sendMinutes, cancelMeeting } from '@/lib/accounts-client'

type Tab = 'prep' | 'minutes' | 'actions' | 'transcript'

const TAB_ICONS: Record<Tab, React.ElementType> = {
  prep:       FileText,
  minutes:    List,
  actions:    CheckSquare,
  transcript: Mic,
}

const TAB_LABELS: Record<Tab, string> = {
  prep:       'Prep',
  minutes:    'Minutes',
  actions:    'Actions',
  transcript: 'Transcript',
}

type Props = {
  meeting: MeetingWithClient
  onClose: () => void
  onUpdated: (m: MeetingWithClient) => void
}

export default function MeetingSlideOver({ meeting, onClose, onUpdated }: Props) {
  const [tab, setTab] = useState<Tab>('prep')
  const [minutesText, setMinutesText] = useState(meeting.minutes_md ?? '')
  const [savingMinutes, setSavingMinutes] = useState(false)
  const [sendingMinutes, setSendingMinutes] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [showCancelForm, setShowCancelForm] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const dateStr = new Date(meeting.scheduled_at).toLocaleString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  })

  const canSendMinutes =
    !!minutesText.trim() &&
    !meeting.minutes_sent_at &&
    meeting.followup_report?.status === 'approved'

  async function handleSaveMinutes() {
    // Internal team meetings have no client, so there is no per-client meeting
    // update endpoint to hit. Guard rather than post to /accounts/null/...
    if (!meeting.client_id) return
    setSavingMinutes(true)
    try {
      const updated = await updateMeeting(meeting.client_id, meeting.id, { minutes_md: minutesText })
      // updateMeeting returns the plain meeting row with no relational joins,
      // so keep the client/report relations from the existing meeting object.
      onUpdated({ ...meeting, ...updated, clients: meeting.clients, prep_report: meeting.prep_report, followup_report: meeting.followup_report })
    } finally {
      setSavingMinutes(false)
    }
  }

  async function handleCancelMeeting() {
    setCancelling(true)
    setCancelError(null)
    try {
      const updated = await cancelMeeting(meeting.id, cancelReason.trim() || undefined)
      onUpdated({ ...meeting, ...updated, clients: meeting.clients, prep_report: meeting.prep_report, followup_report: meeting.followup_report })
      setShowCancelForm(false)
    } catch (e: unknown) {
      setCancelError((e as Error).message)
    } finally {
      setCancelling(false)
    }
  }

  async function handleSendMinutes() {
    setSendingMinutes(true)
    setSendError(null)
    try {
      await sendMinutes(meeting.id)
      setSendSuccess(true)
      onUpdated({ ...meeting, minutes_sent_at: new Date().toISOString() })
    } catch (e: unknown) {
      setSendError((e as Error).message)
    } finally {
      setSendingMinutes(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative flex flex-col w-full max-w-2xl bg-[#08090c] border-l border-[#1c2035] h-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[#1c2035] shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                {meeting.type}
              </span>
              <StatusDot status={meeting.status} />
            </div>
            <h2 className="text-[#e4e6f0] font-semibold text-base">{meeting.clients?.name ?? meeting.title ?? 'Meeting'}</h2>
            <p className="text-[11px] text-[#636780] mt-0.5">{dateStr}</p>
            {meeting.status === 'cancelled' && meeting.cancellation_reason && (
              <p className="text-[11px] text-[#636780] mt-1">Cancelled: {meeting.cancellation_reason}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {meeting.status === 'scheduled' && !showCancelForm && (
              <button
                onClick={() => setShowCancelForm(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#636780] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Ban size={13} /> Cancel meeting
              </button>
            )}
            <button onClick={onClose} className="text-[#636780] hover:text-[#e4e6f0] transition-colors p-1 -mr-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Cancel meeting form */}
        {showCancelForm && (
          <div className="px-5 py-4 border-b border-[#1c2035] bg-red-500/5 shrink-0 space-y-2">
            <p className="text-xs text-[#e4e6f0] font-medium">Cancel this meeting?</p>
            <input
              type="text"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Reason (optional), e.g. Kris on holiday"
              className="w-full bg-[#0d0f15] border border-[#1c2035] rounded-lg px-3 py-1.5 text-xs text-[#e4e6f0] placeholder-[#3d4060] focus:outline-none focus:border-red-500/50"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelMeeting}
                disabled={cancelling}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50 transition-colors"
              >
                {cancelling ? <Loader2 size={12} className="animate-spin" /> : null}
                Confirm cancellation
              </button>
              <button
                onClick={() => { setShowCancelForm(false); setCancelError(null) }}
                disabled={cancelling}
                className="px-3 py-1.5 text-xs text-[#636780] hover:text-[#e4e6f0] transition-colors"
              >
                Never mind
              </button>
              {cancelError && <p className="text-[11px] text-red-400">{cancelError}</p>}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 border-b border-[#1c2035] shrink-0">
          {(Object.keys(TAB_LABELS) as Tab[]).map(t => {
            const Icon = TAB_ICONS[t]
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-t transition-colors ${
                  tab === t
                    ? 'text-[#e4e6f0] border-b-2 border-indigo-500 -mb-px pb-[7px]'
                    : 'text-[#636780] hover:text-[#e4e6f0]'
                }`}
              >
                <Icon size={13} />
                {TAB_LABELS[t]}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'prep' && <PrepTab meeting={meeting} />}
          {tab === 'minutes' && (
            <MinutesTab
              meeting={meeting}
              minutesText={minutesText}
              setMinutesText={setMinutesText}
              savingMinutes={savingMinutes}
              sendingMinutes={sendingMinutes}
              sendError={sendError}
              sendSuccess={sendSuccess}
              canSendMinutes={canSendMinutes}
              onSave={handleSaveMinutes}
              onSend={handleSendMinutes}
            />
          )}
          {tab === 'actions' && <ActionsTab meeting={meeting} />}
          {tab === 'transcript' && <TranscriptTab meeting={meeting} />}
        </div>
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const colours: Record<string, string> = {
    scheduled: 'bg-indigo-400',
    done:      'bg-emerald-400',
    cancelled: 'bg-[#636780]',
  }
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${colours[status] ?? 'bg-[#636780]'}`} />
}

function PrepTab({ meeting }: { meeting: MeetingWithClient }) {
  const prepStatus = meeting.prep_report?.status
  return (
    <div className="space-y-5">
      {/* Prep status */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#636780]">Prep pack:</span>
        {prepStatus === 'approved' || prepStatus === 'sent' ? (
          <span className="text-xs text-emerald-400 font-medium">Ready</span>
        ) : prepStatus === 'pending_approval' ? (
          <span className="text-xs text-amber-400 font-medium">Pending approval</span>
        ) : (
          <span className="text-xs text-[#636780]">Not generated yet</span>
        )}
        {meeting.prep_report && (
          <a
            href="/accounts/approvals"
            className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 ml-auto"
          >
            View <ExternalLink size={10} />
          </a>
        )}
      </div>

      {/* Agenda */}
      <div>
        <p className="text-xs font-semibold text-[#636780] uppercase tracking-wider mb-2">Agenda</p>
        {meeting.agenda ? (
          <div className="text-sm text-[#b0b3c6] whitespace-pre-wrap leading-relaxed bg-[#0d0f15] rounded-lg p-3 border border-[#1c2035]">
            {meeting.agenda}
          </div>
        ) : (
          <p className="text-xs text-[#636780]">No agenda set. The prep cron will fill this before the call.</p>
        )}
      </div>

      {/* Meeting meta */}
      <div className="grid grid-cols-2 gap-3">
        <MetaCard label="Type" value={meeting.type} />
        <MetaCard label="Duration" value={`${meeting.duration_minutes} min`} />
        {meeting.outcome_note && <MetaCard label="Outcome" value={meeting.outcome_note} className="col-span-2" />}
        {Array.isArray(meeting.attendees) && meeting.attendees.length > 0 && (
          <div className="col-span-2">
            <p className="text-[10px] text-[#636780] uppercase tracking-wider mb-1.5">Attendees</p>
            <div className="flex flex-wrap gap-1.5">
              {meeting.attendees.map((email: string) => (
                <span key={email} className="text-[11px] bg-[#181b27] text-[#8b8fa8] px-2 py-0.5 rounded">
                  {email}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MetaCard({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`bg-[#0d0f15] border border-[#1c2035] rounded-lg p-3 ${className}`}>
      <p className="text-[10px] text-[#636780] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-[#b0b3c6]">{value}</p>
    </div>
  )
}

type MinutesTabProps = {
  meeting: MeetingWithClient
  minutesText: string
  setMinutesText: (v: string) => void
  savingMinutes: boolean
  sendingMinutes: boolean
  sendError: string | null
  sendSuccess: boolean
  canSendMinutes: boolean
  onSave: () => void
  onSend: () => void
}

function MinutesTab({
  meeting, minutesText, setMinutesText,
  savingMinutes, sendingMinutes, sendError, sendSuccess,
  canSendMinutes, onSave, onSend,
}: MinutesTabProps) {
  const followupStatus = meeting.followup_report?.status
  return (
    <div className="space-y-4">
      {/* Status row */}
      <div className="flex items-center gap-3 text-xs text-[#636780]">
        <span>Follow-up report:</span>
        {followupStatus === 'approved' ? (
          <span className="text-emerald-400 font-medium">Approved</span>
        ) : followupStatus === 'pending_approval' ? (
          <span className="text-amber-400 font-medium">Pending approval</span>
        ) : (
          <span>Not generated</span>
        )}
        {meeting.minutes_sent_at && (
          <span className="ml-auto text-emerald-400">
            Sent {new Date(meeting.minutes_sent_at).toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Editor */}
      <textarea
        value={minutesText}
        onChange={e => setMinutesText(e.target.value)}
        placeholder="Draft minutes here. Markdown supported. The agent will auto-fill this after the transcript is processed."
        className="w-full h-80 bg-[#0d0f15] border border-[#1c2035] rounded-lg p-3 text-sm text-[#b0b3c6] placeholder-[#3d4060] resize-none focus:outline-none focus:border-indigo-500/50 font-mono leading-relaxed"
        readOnly={!!meeting.minutes_sent_at}
      />

      {!meeting.minutes_sent_at && (
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={savingMinutes}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#181b27] border border-[#1c2035] text-[#e4e6f0] rounded-lg hover:border-indigo-500/50 disabled:opacity-50 transition-colors"
          >
            {savingMinutes ? <Loader2 size={12} className="animate-spin" /> : null}
            Save draft
          </button>

          <button
            onClick={onSend}
            disabled={!canSendMinutes || sendingMinutes || sendSuccess}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {sendingMinutes ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {sendSuccess ? 'Sent' : 'Send to client'}
          </button>

          {!canSendMinutes && !sendSuccess && (
            <p className="text-[11px] text-[#636780]">
              {!minutesText.trim()
                ? 'Write minutes first'
                : 'Approve the follow-up report to unlock'}
            </p>
          )}

          {sendError && <p className="text-[11px] text-red-400">{sendError}</p>}
        </div>
      )}
    </div>
  )
}

function ActionsTab({ meeting }: { meeting: MeetingWithClient }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-[#636780]">
        Tasks extracted from this meeting&apos;s transcript. The meeting agent links them by <code className="text-[11px] bg-[#181b27] px-1 rounded">meeting_ref</code>.
      </p>
      <a
        href={`/tasks?meeting_ref=${meeting.transcript_id ?? ''}`}
        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300"
      >
        View in Tasks board <ExternalLink size={11} />
      </a>
      {!meeting.transcript_id && (
        <p className="text-xs text-[#3d4060] mt-4">No transcript linked yet. Tasks will appear here once the agent processes the recording.</p>
      )}
    </div>
  )
}

function TranscriptTab({ meeting }: { meeting: MeetingWithClient }) {
  if (!meeting.transcript_id) {
    return (
      <p className="text-sm text-[#636780]">
        No transcript linked yet. The agent checks Drive three times daily and will link it automatically.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-[#636780]">Transcript ID: <code className="text-[11px] bg-[#181b27] px-1 rounded">{meeting.transcript_id}</code></p>
      <p className="text-xs text-[#636780]">Full transcript text is stored in the meeting_transcripts table and is consumed by the agent to generate minutes and action items.</p>
    </div>
  )
}
