'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { Profile, Client, TaskTrack, TaskDepartment, TaskPriority, TaskStatus } from '@/lib/types'

type Props = {
  track: TaskTrack
  profiles: Profile[]
  clients: Client[]
  createdBy: string | null
  autoFocusSignal: number // increment to trigger focus (keyboard shortcut N)
  onCreate: (body: Record<string, unknown>) => Promise<void>
}

const CREATIVE_DEPARTMENT: TaskDepartment = 'creative'
const OPS_DEPARTMENTS: { value: TaskDepartment; label: string }[] = [
  { value: 'paid_ads', label: 'Paid Ads' },
  { value: 'client', label: 'Client' },
  { value: 'company', label: 'Company' },
  { value: 'admin', label: 'Admin' },
  { value: 'ceo', label: 'CEO' },
]

const selectClass =
  'bg-[#181b27] border border-[#1c2035] rounded-md px-2 py-1 text-[11px] text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500'

export default function QuickAdd({ track, profiles, clients, createdBy, autoFocusSignal, onCreate }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState('')
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([])
  const [clientId, setClientId] = useState('')
  const [department, setDepartment] = useState<TaskDepartment>(track === 'creative' ? 'creative' : 'paid_ads')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function toggleCollaborator(id: string) {
    setCollaboratorIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  useEffect(() => {
    if (autoFocusSignal > 0) {
      setExpanded(true)
      // focus after expand renders
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [autoFocusSignal])

  function reset() {
    setTitle('')
    setAssignee('')
    setCollaboratorIds([])
    setClientId('')
    setDepartment(track === 'creative' ? 'creative' : 'paid_ads')
    setPriority('normal')
    setDueDate('')
    setError(null)
  }

  function selectAssignee(id: string) {
    setAssignee(id)
    setCollaboratorIds((prev) => prev.filter((c) => c !== id))
  }

  async function submit() {
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    const defaultStatus: TaskStatus = 'brief'
    try {
      await onCreate({
        title: title.trim(),
        track,
        department: track === 'creative' ? CREATIVE_DEPARTMENT : department,
        status: defaultStatus,
        priority,
        assignee_id: assignee || null,
        collaborator_ids: collaboratorIds,
        client_id: clientId || null,
        due_date: dueDate || null,
        created_by: createdBy,
      })
      reset()
      // keep expanded and focused for rapid entry
      setTimeout(() => inputRef.current?.focus(), 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => {
          setExpanded(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
        className="flex items-center gap-1.5 text-[12px] text-[#636780] hover:text-[#e4e6f0] bg-[#10121a] hover:bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-1.5 transition-colors"
      >
        <Plus style={{ width: 13, height: 13 }} />
        New task
        <kbd className="ml-1 text-[9px] text-[#3d4060] border border-[#1c2035] rounded px-1 py-0.5">N</kbd>
      </button>
    )
  }

  return (
    <div className="bg-[#10121a] border border-indigo-500/30 rounded-lg p-2.5">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
            if (e.key === 'Escape') {
              setExpanded(false)
              reset()
            }
          }}
          placeholder={track === 'creative' ? 'New creative task...' : 'New task...'}
          className="flex-1 bg-transparent text-[13px] text-[#e4e6f0] placeholder:text-[#3d4060] focus:outline-none"
        />
        <button
          onClick={() => {
            setExpanded(false)
            reset()
          }}
          className="text-[#636780] hover:text-[#e4e6f0]"
        >
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Inline selectors */}
      <div className="flex items-center gap-1.5 flex-wrap mt-2">
        <select value={assignee} onChange={(e) => selectAssignee(e.target.value)} className={selectClass}>
          <option value="">Assignee</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={selectClass}>
          <option value="">Client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {track === 'ops' && (
          <select value={department} onChange={(e) => setDepartment(e.target.value as TaskDepartment)} className={selectClass}>
            {OPS_DEPARTMENTS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        )}

        <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={selectClass}>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>

        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={`${selectClass} [color-scheme:dark]`}
        />

        <button
          onClick={submit}
          disabled={saving || !title.trim()}
          className="ml-auto bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium rounded-md px-3 py-1 transition-colors disabled:opacity-40"
        >
          {saving ? 'Adding...' : 'Add'}
        </button>
      </div>

      {/* Collaborators: media buyer + anyone else who needs to be tagged alongside the assignee */}
      {profiles.filter((p) => p.id !== assignee).length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          <span className="text-[10px] text-[#3d4060]">Collaborators:</span>
          {profiles.filter((p) => p.id !== assignee).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleCollaborator(p.id)}
              className={`text-[10px] font-medium rounded-full px-2 py-0.5 transition-colors ${
                collaboratorIds.includes(p.id)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#181b27] text-[#636780] border border-[#1c2035] hover:text-[#e4e6f0]'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-[11px] text-rose-400 mt-1.5">{error}</p>}
    </div>
  )
}
