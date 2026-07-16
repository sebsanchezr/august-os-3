'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, X, Clock } from 'lucide-react'

type TimelineKind = 'report' | 'meeting' | 'issue' | 'comm' | 'history'

type TimelineEntry = {
  id: string
  kind: TimelineKind
  occurred_at: string
  data: Record<string, unknown>
}

const HISTORY_CATEGORIES = ['update', 'milestone', 'payment', 'status_change', 'issue', 'note'] as const
type HistoryCategory = (typeof HISTORY_CATEGORIES)[number]

const REPORT_TYPE_LABELS: Record<string, string> = {
  weekly_eow:        'EOW Update',
  monday_kickoff:    'Monday Kickoff',
  meeting_prep:      'Prep Brief',
  meeting_followup:  'Follow-up',
  monthly_deep_dive: 'Monthly Deep Dive',
}

const CATEGORY_LABELS: Record<HistoryCategory, string> = {
  update:        'Update',
  milestone:     'Milestone',
  payment:       'Payment',
  status_change: 'Status change',
  issue:         'Issue',
  note:          'Note',
}

// Chip colour per kind, with history sub-categories overriding by category.
function chipClass(entry: TimelineEntry): string {
  if (entry.kind === 'history') {
    const category = (entry.data.category as string) || 'update'
    switch (category) {
      case 'milestone':     return 'bg-emerald-900/50 text-emerald-300'
      case 'payment':       return 'bg-emerald-900/50 text-emerald-300'
      case 'issue':         return 'bg-amber-900/50 text-amber-300'
      case 'status_change': return 'bg-indigo-900/50 text-indigo-300'
      default:               return 'bg-[#1c2035] text-[#636780]'
    }
  }
  switch (entry.kind) {
    case 'report':  return 'bg-blue-900/50 text-blue-300'
    case 'meeting': return 'bg-purple-900/50 text-purple-300'
    case 'issue':   return 'bg-amber-900/50 text-amber-300'
    case 'comm':    return 'bg-[#1c2035] text-[#636780]'
    default:        return 'bg-[#1c2035] text-[#636780]'
  }
}

function chipLabel(entry: TimelineEntry): string {
  if (entry.kind === 'history') {
    const category = (entry.data.category as string) as HistoryCategory
    return CATEGORY_LABELS[category] ?? 'Update'
  }
  switch (entry.kind) {
    case 'report':  return 'Report'
    case 'meeting': return 'Meeting'
    case 'issue':   return 'Issue'
    case 'comm':    return (entry.data.channel as string)?.toUpperCase() ?? 'Comm'
    default:        return entry.kind
  }
}

function entryTitle(entry: TimelineEntry): string {
  const d = entry.data
  switch (entry.kind) {
    case 'history':
      return (d.title as string) ?? 'Update'
    case 'report': {
      const label = REPORT_TYPE_LABELS[d.type as string] ?? (d.type as string)
      const status = (d.status as string)?.replace(/_/g, ' ')
      return status ? `${label} (${status})` : label
    }
    case 'meeting': {
      const type = (d.type as string) ?? ''
      const capType = type.charAt(0).toUpperCase() + type.slice(1)
      const status = (d.status as string)?.replace(/_/g, ' ')
      return status ? `${capType} meeting (${status})` : `${capType} meeting`
    }
    case 'issue':
      return (d.description as string) ?? 'Issue'
    case 'comm':
      return (d.summary as string) ?? 'Comm'
    default:
      return ''
  }
}

function entryDetail(entry: TimelineEntry): string | null {
  if (entry.kind === 'history') {
    return (entry.data.detail as string) || null
  }
  if (entry.kind === 'meeting') {
    return (entry.data.agenda as string) || null
  }
  return null
}

function formatDayDivider(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit',
  })
}

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
}

export default function HistoryTimeline({ clientId }: { clientId: string }) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)

  function reload() {
    setLoading(true)
    fetch(`/api/accounts/${clientId}/timeline`)
      .then((res) => res.json())
      .then((json) => setTimeline(json.timeline ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-[#636780]" size={18} />
      </div>
    )
  }

  if (error) {
    return <p className="text-red-400 text-xs py-8">{error}</p>
  }

  // Group entries by day (already sorted newest first by the API)
  const groups: { key: string; label: string; entries: TimelineEntry[] }[] = []
  for (const entry of timeline) {
    const key = dayKey(entry.occurred_at)
    const last = groups[groups.length - 1]
    if (last && last.key === key) {
      last.entries.push(entry)
    } else {
      groups.push({ key, label: formatDayDivider(entry.occurred_at), entries: [entry] })
    }
  }

  return (
    <div className="space-y-4">
      <AddUpdateForm
        clientId={clientId}
        show={showForm}
        onToggle={() => setShowForm((s) => !s)}
        onAdded={() => { setShowForm(false); reload() }}
      />

      {groups.length === 0 && (
        <div className="text-center py-16 rounded-xl border border-dashed border-[#1c2035]">
          <Clock size={20} className="mx-auto text-[#3d4060] mb-2" />
          <p className="text-[#636780] text-sm">No history yet.</p>
        </div>
      )}

      {groups.map((group) => (
        <div key={group.key}>
          <p className="text-[9px] font-bold tracking-widest uppercase text-[#636780] mb-2">
            {group.label}
          </p>
          <div className="space-y-2">
            {group.entries.map((entry) => {
              const detail = entryDetail(entry)
              const isExpanded = expanded.has(entry.id)
              return (
                <div
                  key={`${entry.kind}-${entry.id}`}
                  className="rounded-xl border border-[#1c2035] bg-[#0e1017] px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${chipClass(entry)}`}>
                      {chipLabel(entry)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[#e4e6f0] font-medium">{entryTitle(entry)}</p>
                      {detail && (
                        <p
                          onClick={() => toggleExpanded(entry.id)}
                          className={`text-[11px] text-[#636780] mt-1 cursor-pointer leading-relaxed ${
                            isExpanded ? '' : 'line-clamp-3'
                          }`}
                        >
                          {detail}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-[#3d4060] shrink-0 ml-2">
                      {formatTime(entry.occurred_at)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Add update form ────────────────────────────────────────────────────────

const INPUT = 'w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-xs text-[#e4e6f0] focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-[#3d4060]'

function AddUpdateForm({
  clientId, show, onToggle, onAdded,
}: {
  clientId: string
  show: boolean
  onToggle: () => void
  onAdded: () => void
}) {
  const [category, setCategory] = useState<HistoryCategory>('update')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!show) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#181b27] hover:bg-[#1c2035] text-[#636780] hover:text-[#e4e6f0] border border-[#1c2035] transition-colors"
      >
        <Plus size={12} />
        Add update
      </button>
    )
  }

  async function handleSubmit() {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/accounts/${clientId}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, title: title.trim(), detail: detail.trim() || undefined }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Failed to add update')
      }
      setTitle('')
      setDetail('')
      setCategory('update')
      onAdded()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#1c2035] bg-[#181b27] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold tracking-widest uppercase text-[#636780]">Add update</p>
        <button onClick={onToggle} className="text-[#636780] hover:text-[#e4e6f0] transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <select
          className={INPUT}
          value={category}
          onChange={(e) => setCategory(e.target.value as HistoryCategory)}
        >
          {HISTORY_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <input
          className={`${INPUT} col-span-2`}
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <textarea
        className={`${INPUT} resize-none`}
        rows={3}
        placeholder="Optional detail..."
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
      />

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          {saving ? 'Saving...' : 'Add'}
        </button>
      </div>
    </div>
  )
}
