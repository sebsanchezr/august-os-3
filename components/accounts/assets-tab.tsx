'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check, ExternalLink } from 'lucide-react'
import { fetchAssetsTab, type AssetsTabData } from '@/lib/accounts-client'
import { patchTask } from '@/lib/tasks-client'
import { PRIORITY_COLOURS } from '@/lib/types'

const KIND_BADGE: Record<string, string> = {
  brief:       'bg-indigo-900/50 text-indigo-300',
  asset:       'bg-purple-900/50 text-purple-300',
  inspiration: 'bg-emerald-900/50 text-emerald-300',
  other:       'bg-[#1c2035] text-[#636780]',
}

function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function AssetsTab({ clientId }: { clientId: string }) {
  const [data, setData] = useState<AssetsTabData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchAssetsTab(clientId)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [clientId])

  async function toggleTask(task: AssetsTabData['tasks'][number], nowDone: boolean) {
    if (!data) return
    // Same terminal statuses the kanban board and task list already use, so
    // ticking here shows up as Completed/Live there too (and vice versa).
    const targetStatus = nowDone ? (task.track === 'creative' ? 'live' : 'completed') : 'brief'
    // Optimistic update
    setData((d) => d && {
      ...d,
      tasks: d.tasks.map((t) => t.id === task.id
        ? { ...t, status: targetStatus, completed_at: nowDone ? new Date().toISOString() : null }
        : t),
    })
    try {
      await patchTask(task.id, { status: targetStatus })
    } catch (e) {
      setError((e as Error).message)
      fetchAssetsTab(clientId).then(setData)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="animate-spin text-[#636780]" size={20} />
      </div>
    )
  }

  if (error && !data) return <p className="text-sm text-red-400">{error}</p>
  if (!data) return null

  const { notes, form, assets, tasks } = data

  return (
    <div className="space-y-6">
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Onboarding brief */}
      <Section title="Onboarding brief">
        {form ? (
          <ul className="space-y-1.5">
            <Bullet label="Business overview" value={form.business_overview} />
            <Bullet label="Target audience" value={form.target_audience} />
            <Bullet label="Goals" value={form.goals} />
            <Bullet label="Primary contact" value={form.primary_contact} />
            <Bullet label="Billing contact" value={form.billing_contact} />
            <Bullet label="Access notes" value={form.access_notes} />
            {form.extra && Object.entries(form.extra).map(([key, value]) => (
              <ExtraBullet key={key} label={humanize(key)} value={value} />
            ))}
          </ul>
        ) : notes ? (
          <ul className="space-y-1.5">
            {notes.split('\n').filter((line) => line.trim()).map((line, i) => (
              <li key={i} className="text-xs text-[#b0b3c6] leading-relaxed flex gap-2">
                <span className="text-[#3d4060] shrink-0">&bull;</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[#636780]">No onboarding brief yet.</p>
        )}
      </Section>

      {/* Assets and creative links */}
      <Section title="Assets & creative links">
        {assets.length === 0 ? (
          <p className="text-xs text-[#636780]">No assets logged yet.</p>
        ) : (
          <div className="space-y-1.5">
            {assets.map((a) => (
              <div key={a.id} className="rounded-lg border border-[#1c2035] bg-[#181b27] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#e4e6f0] font-medium">{a.title}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${KIND_BADGE[a.kind] ?? KIND_BADGE.other}`}>
                    {a.kind}
                  </span>
                  {a.url && (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors ml-auto shrink-0"
                    >
                      Open <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                {a.notes && <p className="text-[11px] text-[#636780] mt-1 leading-relaxed whitespace-pre-line">{a.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Onboarding checklist */}
      <Section title="Onboarding checklist">
        {tasks.length === 0 ? (
          <p className="text-xs text-[#636780]">No tasks for this client yet.</p>
        ) : (
          <div className="space-y-1">
            {tasks.map((t) => {
              const done = !!t.completed_at
              return (
                <label
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg border border-[#1c2035] bg-[#181b27] px-3 py-2 cursor-pointer hover:border-[#2a2f47] transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggleTask(t, !done)}
                    className={`flex items-center justify-center h-4 w-4 rounded shrink-0 border transition-colors ${
                      done ? 'bg-emerald-600 border-emerald-600' : 'border-[#3d4060] hover:border-[#636780]'
                    }`}
                  >
                    {done && <Check size={11} className="text-white" />}
                  </button>
                  <span className={`text-xs flex-1 min-w-0 truncate ${done ? 'text-[#636780] line-through' : 'text-[#e4e6f0]'}`}>
                    {t.title}
                  </span>
                  {t.profiles?.name && (
                    <span className="text-[10px] text-[#636780] shrink-0">{t.profiles.name}</span>
                  )}
                  {t.due_date && (
                    <span className="text-[10px] text-[#3d4060] shrink-0">
                      {new Date(t.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: PRIORITY_COLOURS[t.priority] }}
                    title={t.priority}
                  />
                </label>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}

function Bullet({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <li className="text-xs text-[#b0b3c6] leading-relaxed flex gap-2">
      <span className="text-[#3d4060] shrink-0">&bull;</span>
      <span><span className="text-[#e4e6f0] font-medium">{label}:</span> {value}</span>
    </li>
  )
}

function ExtraBullet({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === '') return null
  if (typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v != null && v !== '')
    if (entries.length === 0) return null
    return (
      <li className="text-xs text-[#b0b3c6] leading-relaxed">
        <span className="text-[#3d4060] shrink-0">&bull; </span>
        <span className="text-[#e4e6f0] font-medium">{label}:</span>
        <ul className="mt-1 ml-4 space-y-1">
          {entries.map(([k, v]) => (
            <li key={k} className="flex gap-2">
              <span className="text-[#3d4060] shrink-0">&ndash;</span>
              <span><span className="text-[#8b8fa8]">{humanize(k)}:</span> {String(v)}</span>
            </li>
          ))}
        </ul>
      </li>
    )
  }
  const display = Array.isArray(value) ? value.join(', ') : String(value)
  return (
    <li className="text-xs text-[#b0b3c6] leading-relaxed flex gap-2">
      <span className="text-[#3d4060] shrink-0">&bull;</span>
      <span><span className="text-[#e4e6f0] font-medium">{label}:</span> {display}</span>
    </li>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-bold tracking-widest uppercase text-[#636780] mb-3">{title}</p>
      {children}
    </div>
  )
}
