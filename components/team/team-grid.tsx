'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Plus, Trash2, X, MapPin } from 'lucide-react'
import { fetchTeamMembers, deleteTeamMember, createTeamMember, type TeamMember, type TeamMemberRole, type TeamMemberStatus } from '@/lib/team-client'

const ROLE_LABEL: Record<TeamMemberRole, string> = {
  cold_caller: 'Cold Caller',
  sales_manager: 'Sales Manager',
  other: 'Other',
}

const STATUS_BADGE: Record<TeamMemberStatus, string> = {
  onboarding: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  active:     'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  paused:     'bg-amber-500/10 text-amber-300 border-amber-500/20',
  offboarded: 'bg-[#1c2035] text-[#636780] border-[#2e3050]',
}

const AVATAR_COLOURS = [
  'bg-indigo-500/20 text-indigo-300',
  'bg-emerald-500/20 text-emerald-300',
  'bg-amber-500/20 text-amber-300',
  'bg-rose-500/20 text-rose-300',
  'bg-sky-500/20 text-sky-300',
  'bg-purple-500/20 text-purple-300',
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function avatarColour(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length]
}

export default function TeamGrid() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showNewMember, setShowNewMember] = useState(false)

  function refresh() {
    setLoading(true)
    fetchTeamMembers()
      .then((data) => {
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name))
        setMembers(sorted)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteTeamMember(id)
      setMembers((prev) => prev.filter((m) => m.id !== id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDeletingId(null)
      setConfirmingId(null)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#636780]" size={20} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-red-400 text-sm">
        Failed to load team: {error}
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[#e4e6f0] font-semibold text-lg">Team</h1>
          <p className="text-[#636780] text-xs mt-0.5">{members.length} team member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/team/onboarding"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Onboarding board
          </Link>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#181b27] hover:bg-[#1c2035] text-[#e4e6f0] border border-[#1c2035] transition-colors"
            onClick={() => setShowNewMember(true)}
          >
            <Plus size={12} />
            Add member
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {members.map((member) => (
          <Link
            key={member.id}
            href={`/team/${member.id}`}
            className="group relative block min-w-0 rounded-xl border border-[#1c2035] bg-[#0e1017] p-4 transition-all hover:border-[#3d4060]"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {member.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.avatar_url} alt={member.name} className="h-9 w-9 rounded-full object-cover shrink-0" />
                ) : (
                  <span className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarColour(member.name)}`}>
                    {initials(member.name)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-[#e4e6f0] font-medium text-sm truncate">{member.name}</p>
                  {member.title && <p className="text-[#636780] text-xs mt-0.5 truncate">{member.title}</p>}
                </div>
              </div>
              {confirmingId === member.id ? (
                <span className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={deletingId === member.id}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(member.id) }}
                    className="rounded px-1.5 py-0.5 text-[10px] bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50"
                  >
                    {deletingId === member.id ? '...' : 'Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmingId(null) }}
                    className="rounded px-1.5 py-0.5 text-[10px] bg-[#181b27] hover:bg-[#1c2035] text-[#636780] border border-[#1c2035] transition-colors"
                  >
                    No
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  aria-label="Delete member"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmingId(member.id) }}
                  className="text-[#3d4060] hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#181b27] text-[#a9adc4] border border-[#1c2035]">
                {ROLE_LABEL[member.role]}
              </span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${STATUS_BADGE[member.status]}`}>
                {member.status}
              </span>
            </div>

            {member.location && (
              <div className="flex items-center gap-1 text-[10px] text-[#636780] pt-2 border-t border-[#1c2035]">
                <MapPin size={9} /> {member.location}
              </div>
            )}
          </Link>
        ))}
      </div>

      {members.length === 0 && (
        <div className="text-center text-[#636780] text-sm py-16">
          No team members yet.
        </div>
      )}

      {showNewMember && (
        <NewMemberModal
          onClose={() => setShowNewMember(false)}
          onSaved={() => {
            setShowNewMember(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}

// ─── New member modal ───────────────────────────────────────────────────────

function NewMemberModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [role, setRole] = useState<TeamMemberRole>('cold_caller')
  const [status, setStatus] = useState<TeamMemberStatus>('onboarding')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createTeamMember({
        name: name.trim(),
        title: title.trim() || null,
        role,
        status,
      })
      onSaved()
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
          <h2 className="text-[#e4e6f0] font-medium text-sm">Add member</h2>
          <button onClick={onClose} className="text-[#636780] hover:text-[#e4e6f0] transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Name *</label>
            <input
              ref={nameRef}
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>

          <div>
            <label className={labelCls}>Title</label>
            <input
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cold Caller"
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
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as TeamMemberStatus)}>
                <option value="onboarding">Onboarding</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="offboarded">Offboarded</option>
              </select>
            </div>
          </div>

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
              {saving ? 'Adding...' : 'Add member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
