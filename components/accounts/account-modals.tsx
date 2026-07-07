'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, MessageSquare, Lightbulb, AlertTriangle, Calendar, Copy, Check } from 'lucide-react'
import {
  logComm, addTalkingPoint, createIssue, scheduleMeetingWithInvite,
} from '@/lib/accounts-client'
import { CLIENT_ISSUE_CATEGORY_LABELS, CLIENT_COMM_TRIGGER_WORDS } from '@/lib/types'
import type { Client, Profile } from '@/lib/types'

export type ModalKind = 'comm' | 'talking_point' | 'issue' | 'meeting' | null

type Props = {
  kind: ModalKind
  account: Client & { am?: { id: string; name: string } | null }
  profiles: Profile[]
  currentUserId: string | null
  onClose: () => void
  onDone: () => void
}

// ─── Shared shell ─────────────────────────────────────────────────────────────

function Shell({
  title, icon, children, onClose,
}: { title: string; icon: React.ReactNode; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onMouseDown={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-[#1c2035] bg-[#0e1017] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1c2035]">
          <div className="flex items-center gap-2 text-[#e4e6f0] font-medium text-sm">
            {icon}{title}
          </div>
          <button onClick={onClose} className="text-[#636780] hover:text-[#e4e6f0] transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

const INPUT = 'w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-xs text-[#e4e6f0] focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-[#3d4060]'
const LABEL = 'text-[10px] font-medium text-[#636780] uppercase tracking-wide mb-1 block'
const BTN = 'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors'

// ─── Router ───────────────────────────────────────────────────────────────────

export default function AccountModals(props: Props) {
  if (!props.kind) return null
  if (props.kind === 'comm') return <CommModal {...props} />
  if (props.kind === 'talking_point') return <TalkingPointModal {...props} />
  if (props.kind === 'issue') return <IssueModal {...props} />
  if (props.kind === 'meeting') return <MeetingModal {...props} />
  return null
}

// ─── Log comm ─────────────────────────────────────────────────────────────────

function CommModal({ account, currentUserId, onClose, onDone }: Props) {
  const [summary, setSummary] = useState('')
  const [direction, setDirection] = useState('inbound')
  const [channel, setChannel] = useState('whatsapp')
  const [sentiment, setSentiment] = useState('neutral')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-detect trigger words from the summary
  const detectedFlags = CLIENT_COMM_TRIGGER_WORDS.filter((w) =>
    summary.toLowerCase().includes(w),
  )

  async function save() {
    setSaving(true); setError(null)
    try {
      await logComm(account.id, {
        summary, direction, channel, sentiment,
        flags: detectedFlags,
        logged_by: currentUserId ?? undefined,
      })
      onDone()
    } catch (e) { setError((e as Error).message) } finally { setSaving(false) }
  }

  return (
    <Shell title="Log communication" icon={<MessageSquare size={15} />} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={LABEL}>Direction</label>
            <select className={INPUT} value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Channel</label>
            <select className={INPUT} value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="call">Call</option>
              <option value="meeting">Meeting</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Sentiment</label>
            <select className={INPUT} value={sentiment} onChange={(e) => setSentiment(e.target.value)}>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="concern">Concern</option>
            </select>
          </div>
        </div>
        <div>
          <label className={LABEL}>Summary</label>
          <textarea
            className={`${INPUT} resize-none`} rows={4} autoFocus
            placeholder="What was said / what happened..."
            value={summary} onChange={(e) => setSummary(e.target.value)}
          />
        </div>
        {detectedFlags.length > 0 && (
          <div className="flex items-center gap-2 text-[10px] text-amber-400 bg-amber-950/20 border border-amber-900/40 rounded-lg px-3 py-2">
            <AlertTriangle size={11} />
            Trigger words detected: {detectedFlags.join(', ')}. This will fire an early-warning alert.
          </div>
        )}
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex justify-end">
          <button className={BTN} disabled={saving || !summary.trim()} onClick={save}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
            Log comm
          </button>
        </div>
      </div>
    </Shell>
  )
}

// ─── Add talking point ──────────────────────────────────────────────────────

function TalkingPointModal({ account, currentUserId, onClose, onDone }: Props) {
  const [point, setPoint] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true); setError(null)
    try {
      await addTalkingPoint(account.id, point, currentUserId ?? undefined)
      onDone()
    } catch (e) { setError((e as Error).message) } finally { setSaving(false) }
  }

  return (
    <Shell title="Add talking point" icon={<Lightbulb size={15} />} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[10px] text-[#636780]">
          This gets pulled into the next Friday report for {account.name}, so the whole team feeds one update.
        </p>
        <textarea
          className={`${INPUT} resize-none`} rows={4} autoFocus
          placeholder="e.g. New summer creative batch launching, tested 3 new hooks..."
          value={point} onChange={(e) => setPoint(e.target.value)}
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex justify-end">
          <button className={BTN} disabled={saving || !point.trim()} onClick={save}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Lightbulb size={12} />}
            Add point
          </button>
        </div>
      </div>
    </Shell>
  )
}

// ─── Raise issue ──────────────────────────────────────────────────────────────

function IssueModal({ account, profiles, currentUserId, onClose, onDone }: Props) {
  const [category, setCategory] = useState('performance')
  const [severity, setSeverity] = useState('minor')
  const [description, setDescription] = useState('')
  const [owner, setOwner] = useState(currentUserId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true); setError(null)
    try {
      await createIssue({
        client_id: account.id,
        category, severity, description,
        owner_profile_id: owner || undefined,
      })
      onDone()
    } catch (e) { setError((e as Error).message) } finally { setSaving(false) }
  }

  return (
    <Shell title="Raise issue" icon={<AlertTriangle size={15} />} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={LABEL}>Category</label>
            <select className={INPUT} value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(CLIENT_ISSUE_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Severity</label>
            <select className={INPUT} value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="minor">Minor</option>
              <option value="major">Major</option>
              <option value="trust_threatening">Trust-threatening</option>
            </select>
          </div>
        </div>
        <div>
          <label className={LABEL}>Owner</label>
          <select className={INPUT} value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Unassigned</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Description</label>
          <textarea
            className={`${INPUT} resize-none`} rows={4} autoFocus
            placeholder="What is the issue?"
            value={description} onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {(severity === 'trust_threatening' || category === 'financial_reporting') && (
          <div className="flex items-center gap-2 text-[10px] text-red-400 bg-red-950/20 border border-red-900/40 rounded-lg px-3 py-2">
            <AlertTriangle size={11} />
            This fires an immediate Discord alert to Seb (Genflow: money and trust issues are same-day, founder-handled).
          </div>
        )}
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex justify-end">
          <button className={BTN} disabled={saving || !description.trim()} onClick={save}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <AlertTriangle size={12} />}
            Raise issue
          </button>
        </div>
      </div>
    </Shell>
  )
}

// ─── Schedule meeting ────────────────────────────────────────────────────────

function MeetingModal({ account, profiles, onClose, onDone }: Props) {
  const [type, setType] = useState('weekly')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('14:00')
  const [duration, setDuration] = useState('30')
  const [agenda, setAgenda] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ email_sent: boolean; email_error: string | null; google_calendar_url: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Split comma-separated contact_email into individual addresses
  const clientContacts: { email: string; name?: string }[] = (() => {
    if (!account.contact_email) return []
    const emails = account.contact_email.split(',').map((e) => e.trim()).filter(Boolean)
    const names = account.contact_name ? account.contact_name.split(',').map((n) => n.trim()) : []
    return emails.map((email, i) => ({ email, name: names[i] || undefined }))
  })()

  // Selected attendee emails — Set for O(1) toggle.
  // Pre-select: all client contacts + account manager.
  const defaultSelected = new Set<string>([
    ...clientContacts.map((c) => c.email),
    profiles.find((p) => p.id === account.am_profile_id)?.email,
  ].filter(Boolean) as string[])
  const [selected, setSelected] = useState<Set<string>>(defaultSelected)

  function toggle(email: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(email) ? next.delete(email) : next.add(email)
      return next
    })
  }

  // Team profiles that have an email set
  const teamWithEmail = profiles.filter((p) => p.email)
  // Keep clientEmail for the "not set" nudge check
  const clientEmail = account.contact_email

  async function save() {
    setSaving(true); setError(null)
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString()
      const res = await scheduleMeetingWithInvite(account.id, {
        scheduled_at: scheduledAt,
        duration_minutes: Number(duration),
        type, agenda,
        attendees: Array.from(selected),
        organizer_name: 'August Marketing',
      })
      setResult(res)
    } catch (e) { setError((e as Error).message) } finally { setSaving(false) }
  }

  // Success view
  if (result) {
    return (
      <Shell title="Meeting scheduled" icon={<Calendar size={15} />} onClose={() => { onDone() }}>
        <div className="space-y-3">
          {result.email_sent ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-900/40 rounded-lg px-3 py-2">
              <Check size={13} /> Calendar invites sent to {selected.size} attendee{selected.size !== 1 ? 's' : ''}.
            </div>
          ) : (
            <div className="text-xs text-amber-400 bg-amber-950/20 border border-amber-900/40 rounded-lg px-3 py-2">
              Meeting saved. Use the calendar link to add it manually ({result.email_error ?? 'invites could not send'}).
            </div>
          )}
          <div>
            <label className={LABEL}>Add to Google Calendar</label>
            <div className="flex items-center gap-2">
              <a href={result.google_calendar_url} target="_blank" rel="noopener noreferrer" className={BTN}>
                <Calendar size={12} /> Open in Google Calendar
              </a>
              <button
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-[#181b27] border border-[#1c2035] text-[#636780] hover:text-[#e4e6f0]"
                onClick={() => { navigator.clipboard.writeText(result.google_calendar_url); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />} Copy link
              </button>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button className={BTN} onClick={onDone}>Done</button>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell title={`Schedule meeting — ${account.name}`} icon={<Calendar size={15} />} onClose={onClose}>
      <div className="space-y-4">

        {/* Type / Date / Time */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={LABEL}>Type</label>
            <select className={INPUT} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="weekly">Weekly call</option>
              <option value="monthly">Monthly deep dive</option>
              <option value="adhoc">Ad hoc</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Date</label>
            <input className={INPUT} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Time</label>
            <input className={INPUT} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        <div>
          <label className={LABEL}>Duration</label>
          <select className={INPUT} value={duration} onChange={(e) => setDuration(e.target.value)}>
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">60 min</option>
          </select>
        </div>

        {/* Attendee pills — click to toggle */}
        <div>
          <label className={LABEL}>
            Attendees
            <span className="ml-1 normal-case text-[#3d4060]">— tap to add/remove</span>
          </label>

          {/* Client contacts — one chip per address */}
          {clientContacts.length > 0 && (
            <div className="mb-2">
              <p className="text-[9px] text-[#636780] mb-1">Client contacts</p>
              <div className="flex flex-wrap gap-1.5">
                {clientContacts.map((c) => (
                  <AttendeeChip
                    key={c.email}
                    label={c.name ? `${c.name} (${c.email})` : c.email}
                    selected={selected.has(c.email)}
                    onToggle={() => toggle(c.email)}
                  />
                ))}
              </div>
            </div>
          )}
          {!clientEmail && (
            <p className="text-[9px] text-[#3d4060] mb-2">
              Client contact email not set — add it in Settings to include them.
            </p>
          )}

          {/* Team profiles */}
          {teamWithEmail.length > 0 && (
            <div>
              <p className="text-[9px] text-[#636780] mb-1">Team</p>
              <div className="flex flex-wrap gap-1.5">
                {teamWithEmail.map((p) => (
                  <AttendeeChip
                    key={p.id}
                    label={p.name}
                    selected={selected.has(p.email!)}
                    onToggle={() => toggle(p.email!)}
                  />
                ))}
              </div>
            </div>
          )}
          {teamWithEmail.length === 0 && (
            <p className="text-[10px] text-[#3d4060]">
              No team emails found — check that profiles have emails in Supabase.
            </p>
          )}
        </div>

        {/* Agenda */}
        <div>
          <label className={LABEL}>Agenda (optional)</label>
          <textarea
            className={`${INPUT} resize-none`} rows={2}
            placeholder="What are we covering?"
            value={agenda} onChange={(e) => setAgenda(e.target.value)}
          />
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-[#636780]">
            {selected.size > 0 ? `${selected.size} invite${selected.size !== 1 ? 's' : ''} will be sent` : 'No invites'}
          </p>
          <button className={BTN} disabled={saving || !date} onClick={save}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Calendar size={12} />}
            Schedule {selected.size > 0 ? '& send invites' : 'meeting'}
          </button>
        </div>
      </div>
    </Shell>
  )
}

function AttendeeChip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all ${
        selected
          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
          : 'bg-[#181b27] border-[#1c2035] text-[#636780] hover:border-[#3d4060] hover:text-[#e4e6f0]'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${selected ? 'bg-indigo-400' : 'bg-[#3d4060]'}`} />
      {label}
    </button>
  )
}
