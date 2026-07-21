'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import type { StaffOnboardingListItem, OnboardingStage, TeamMemberRole } from '@/lib/team-client'
import { fetchOnboardings, createOnboarding, updateOnboarding, fetchTeamMembers, type TeamMember } from '@/lib/team-client'
import { ONBOARDING_STAGES, ONBOARDING_STAGE_LABELS } from '@/lib/team-server'
import OnboardingColumn from './onboarding-column'
import OnboardingDetail from './onboarding-detail'

export default function OnboardingBoard() {
  const [items, setItems] = useState<StaffOnboardingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      const data = await fetchOnboardings()
      setItems(data)
    } catch {
      // keep last known state on transient fetch errors
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    refetch().finally(() => setLoading(false))
  }, [refetch])

  const byStage = useCallback(
    (stage: OnboardingStage) => items.filter((i) => i.stage === stage),
    [items],
  )

  async function handleDrop(stage: OnboardingStage) {
    if (!draggingId) return
    const item = items.find((i) => i.id === draggingId)
    setDraggingId(null)
    if (!item || item.stage === stage) return

    // Optimistic update
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, stage } : i)))
    try {
      await updateOnboarding(item.id, { stage })
      await refetch()
    } catch {
      await refetch()
    }
  }

  const total = items.length

  return (
    <div className="flex flex-col min-h-full p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-[#e4e6f0]">Staff Onboarding</h1>
          <span className="text-[11px] text-[#636780] tabular-nums">{total} in pipeline</span>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          <Plus size={12} />
          New onboarding
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-5 w-5 text-[#636780] animate-spin" />
        </div>
      ) : (
        <div className="flex gap-3 flex-1 overflow-x-auto pb-2">
          {ONBOARDING_STAGES.map((stage) => (
            <OnboardingColumn
              key={stage}
              stage={stage}
              label={ONBOARDING_STAGE_LABELS[stage]}
              items={byStage(stage)}
              draggingId={draggingId}
              onCardClick={(item) => setOpenId(item.id)}
              onCardDragStart={(item) => setDraggingId(item.id)}
              onDropToColumn={handleDrop}
            />
          ))}
        </div>
      )}

      {openId && (
        <OnboardingDetail
          onboardingId={openId}
          onClose={() => setOpenId(null)}
          onChanged={refetch}
        />
      )}

      {showNew && (
        <NewOnboardingModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); refetch() }}
        />
      )}
    </div>
  )
}

// ─── New onboarding modal ────────────────────────────────────────────────────

function NewOnboardingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState<TeamMemberRole>('cold_caller')
  const [teamMemberId, setTeamMemberId] = useState('')
  const [members, setMembers] = useState<TeamMember[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
    fetchTeamMembers().then(setMembers).catch(() => {})
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Candidate name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createOnboarding({
        candidate_name: name.trim(),
        role,
        team_member_id: teamMemberId || null,
      })
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780]'
  const labelCls = 'block text-xs font-medium text-[#636780] uppercase tracking-wider mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-[#1c2035] bg-[#10121a] p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[#e4e6f0] font-medium text-sm">New onboarding</h2>
          <button onClick={onClose} className="text-[#636780] hover:text-[#e4e6f0] transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Candidate name *</label>
            <input
              ref={nameRef}
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Role</label>
              <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as TeamMemberRole)}>
                <option value="cold_caller">Cold Caller</option>
                <option value="sales_manager">Sales Manager</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Link to team member</label>
              <select className={inputCls} value={teamMemberId} onChange={(e) => setTeamMemberId(e.target.value)}>
                <option value="">None yet</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <p className="text-[10px] text-[#3d4060]">
            Creating this seeds the default onboarding checklist and posts a ready-to-forward welcome message to Discord.
          </p>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] rounded-lg px-3 py-2 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              {saving ? 'Creating...' : 'Create onboarding'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
