'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, Loader2, Check } from 'lucide-react'
import type { StaffOnboarding, StaffOnboardingTask } from '@/lib/team-client'
import { fetchOnboardingDetail, updateOnboarding, toggleOnboardingTask } from '@/lib/team-client'
import { ONBOARDING_CATEGORY_LABELS, ONBOARDING_STAGES, ONBOARDING_STAGE_LABELS, type OnboardingTaskCategory } from '@/lib/team-server'

type Props = {
  onboardingId: string
  onClose: () => void
  onChanged: () => void
}

const CATEGORY_ORDER: OnboardingTaskCategory[] = ['admin', 'learning_os', 'learning_video', 'milestone']

const FIELD = 'bg-[#181b27] border border-[#1c2035] rounded-md px-2 py-1.5 text-[12px] text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full [color-scheme:dark]'
const LABEL = 'block text-[10px] uppercase tracking-wide text-[#3d4060] mb-1'

function toLocalDatetimeValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function OnboardingDetail({ onboardingId, onClose, onChanged }: Props) {
  const [onboarding, setOnboarding] = useState<StaffOnboarding | null>(null)
  const [tasks, setTasks] = useState<StaffOnboardingTask[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [contractDraft, setContractDraft] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetchOnboardingDetail(onboardingId)
      setOnboarding(d.onboarding)
      setTasks(d.tasks)
      setNotesDraft(d.onboarding.notes ?? '')
      setContractDraft(d.onboarding.contract_url ?? '')
    } finally {
      setLoading(false)
    }
  }, [onboardingId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  async function apply(patch: Partial<StaffOnboarding>) {
    setBusy(true)
    try {
      await updateOnboarding(onboardingId, patch)
      await load()
      onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function toggleTask(task: StaffOnboardingTask) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)))
    try {
      await toggleOnboardingTask(onboardingId, task.id, !task.done)
      onChanged()
    } catch {
      await load()
    }
  }

  const doneCount = tasks.filter((t) => t.done).length

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-[#0c0d11] border-l border-[#1c2035] h-full overflow-y-auto shadow-2xl">
        {loading || !onboarding ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 text-[#636780] animate-spin" />
          </div>
        ) : (
          <div className="p-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-[15px] font-semibold text-[#e4e6f0] leading-snug">
                  {onboarding.candidate_name ?? 'Candidate'}
                </p>
                <p className="text-[11px] text-[#636780] mt-0.5">{doneCount}/{tasks.length} checklist items complete</p>
              </div>
              <button onClick={onClose} className="text-[#636780] hover:text-[#e4e6f0] shrink-0 mt-1">
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* Stage pills */}
            <div className="flex flex-wrap gap-1.5 mb-5">
              {ONBOARDING_STAGES.map((stage) => (
                <button
                  key={stage}
                  disabled={busy}
                  onClick={() => apply({ stage })}
                  className={`text-[11px] font-medium rounded-full px-2.5 py-1 transition-colors disabled:opacity-50
                    ${onboarding.stage === stage
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#181b27] text-[#636780] hover:text-[#e4e6f0] hover:bg-[#1c2030]'}`}
                >
                  {ONBOARDING_STAGE_LABELS[stage]}
                </button>
              ))}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 gap-3 mb-5">
              <div>
                <label className={LABEL}>Intro meeting</label>
                <input
                  type="datetime-local"
                  className={FIELD}
                  defaultValue={toLocalDatetimeValue(onboarding.intro_meeting_at)}
                  onBlur={(e) => apply({ intro_meeting_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>
              <div>
                <label className={LABEL}>Day-7 review</label>
                <input
                  type="datetime-local"
                  className={FIELD}
                  defaultValue={toLocalDatetimeValue(onboarding.day7_review_at)}
                  onBlur={(e) => apply({ day7_review_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>
            </div>

            {/* Contract URL */}
            <div className="mb-5">
              <label className={LABEL}>Contract URL</label>
              <input
                className={FIELD}
                value={contractDraft}
                onChange={(e) => setContractDraft(e.target.value)}
                onBlur={() => { if (contractDraft !== (onboarding.contract_url ?? '')) apply({ contract_url: contractDraft || null }) }}
                placeholder="https://..."
              />
            </div>

            {/* Checklist grouped by category */}
            <div className="mb-5">
              <label className="block text-[10px] uppercase tracking-wide text-[#3d4060] mb-2">Checklist</label>
              <div className="space-y-4">
                {CATEGORY_ORDER.map((cat) => {
                  const catTasks = tasks.filter((t) => t.category === cat)
                  if (catTasks.length === 0) return null
                  return (
                    <div key={cat}>
                      <p className="text-[10px] font-medium text-[#636780] mb-1.5">{ONBOARDING_CATEGORY_LABELS[cat]}</p>
                      <div className="space-y-1.5">
                        {catTasks.map((task) => (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => toggleTask(task)}
                            className="flex items-start gap-2 w-full text-left group"
                          >
                            <span
                              className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors
                                ${task.done ? 'bg-indigo-600 border-indigo-600' : 'border-[#3d4060] group-hover:border-[#636780]'}`}
                            >
                              {task.done && <Check size={11} className="text-white" />}
                            </span>
                            <span className="flex-1">
                              <span className={`text-[12px] leading-snug ${task.done ? 'text-[#636780] line-through' : 'text-[#e4e6f0]'}`}>
                                {task.title}
                              </span>
                              {task.url && (
                                <a
                                  href={task.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="block text-[10px] text-indigo-400 hover:text-indigo-300 mt-0.5"
                                >
                                  Open link
                                </a>
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="mb-2">
              <label className="block text-[10px] uppercase tracking-wide text-[#3d4060] mb-1.5">Notes</label>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={() => { if (notesDraft !== (onboarding.notes ?? '')) apply({ notes: notesDraft || null }) }}
                rows={4}
                placeholder="Add context..."
                className="w-full bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-2 text-[12px] text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#3d4060] resize-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
