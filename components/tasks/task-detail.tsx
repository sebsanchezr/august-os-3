'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, Trash2, Send, Clock, Loader2 } from 'lucide-react'
import type { Task, Profile, Client, TaskComment, TaskEvent, TaskStatus, TaskPriority, CreativeStatus, OpsStatus } from '@/lib/types'
import { CREATIVE_COLUMNS, OPS_COLUMNS } from '@/lib/types'
import { fetchTaskDetail, patchTask, addComment, softDeleteTask } from '@/lib/tasks-client'
import { initials, avatarColour, formatTimestamp, DEPARTMENT_LABELS, STATUS_LABELS } from '@/lib/task-format'

type Props = {
  taskId: string
  profiles: Profile[]
  clients: Client[]
  currentUserId: string | null
  onClose: () => void
  onChanged: () => void // notify board to refetch
}

const fieldSelect =
  'bg-[#181b27] border border-[#1c2035] rounded-md px-2 py-1.5 text-[12px] text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full [color-scheme:dark]'

function eventLabel(ev: TaskEvent): string {
  const who = ev.profiles?.name ?? 'System'
  switch (ev.type) {
    case 'created': return `${who} created this task`
    case 'status_change': return `${who} moved ${STATUS_LABELS[(ev.payload.from as TaskStatus)] ?? ev.payload.from} to ${STATUS_LABELS[(ev.payload.to as TaskStatus)] ?? ev.payload.to}`
    case 'assigned': return `${who} changed the assignee`
    case 'commented': return `${who} commented`
    case 'edited': return `${who} edited ${Object.keys(ev.payload).join(', ')}`
    case 'deleted': return `${who} deleted this task`
    case 'restored': return `${who} restored this task`
    case 'archived': return `Auto-archived`
    default: return `${who} ${ev.type}`
  }
}

export default function TaskDetail({ taskId, profiles, clients, currentUserId, onClose, onChanged }: Props) {
  const [task, setTask] = useState<Task | null>(null)
  const [comments, setComments] = useState<TaskComment[]>([])
  const [events, setEvents] = useState<TaskEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [descDraft, setDescDraft] = useState('')
  const [titleDraft, setTitleDraft] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const statusColumns = task?.track === 'creative' ? CREATIVE_COLUMNS : OPS_COLUMNS

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetchTaskDetail(taskId)
      setTask(d.task)
      setComments(d.comments)
      setEvents(d.events)
      setDescDraft(d.task.description)
      setTitleDraft(d.task.title)
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => { load() }, [load])

  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function apply(body: Record<string, unknown>) {
    setBusy(true)
    try {
      await patchTask(taskId, { ...body, actor_id: currentUserId })
      await load()
      onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(next: TaskStatus) {
    await apply({ status: next })
  }

  async function changeAssignee(id: string | null) {
    if (!task) return
    const body: Record<string, unknown> = { assignee_id: id }
    const current = task.collaborator_ids ?? []
    if (id && current.includes(id)) body.collaborator_ids = current.filter((c) => c !== id)
    await apply(body)
  }

  async function toggleCollaborator(id: string) {
    if (!task) return
    const current = task.collaborator_ids ?? []
    const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
    await apply({ collaborator_ids: next })
  }

  async function saveDescription() {
    if (task && descDraft !== task.description) await apply({ description: descDraft })
  }

  async function saveTitle() {
    if (task && titleDraft.trim() && titleDraft !== task.title) await apply({ title: titleDraft.trim() })
  }

  async function submitComment() {
    if (!commentDraft.trim()) return
    setBusy(true)
    try {
      await addComment(taskId, commentDraft.trim(), currentUserId)
      setCommentDraft('')
      await load()
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this task? It moves to the archive and can be restored.')) return
    await softDeleteTask(taskId, currentUserId)
    onChanged()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md bg-[#0c0d11] border-l border-[#1c2035] h-full overflow-y-auto shadow-2xl">
        {loading || !task ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 text-[#636780] animate-spin" />
          </div>
        ) : (
          <div className="p-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <textarea
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                rows={2}
                className="flex-1 bg-transparent text-[15px] font-semibold text-[#e4e6f0] leading-snug resize-none focus:outline-none focus:bg-[#10121a] rounded px-1 -mx-1"
              />
              <button onClick={onClose} className="text-[#636780] hover:text-[#e4e6f0] shrink-0 mt-1">
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* Status pills */}
            <div className="flex flex-wrap gap-1.5 mb-5">
              {statusColumns.map((col) => (
                <button
                  key={col.status}
                  disabled={busy}
                  onClick={() => changeStatus(col.status)}
                  className={`text-[11px] font-medium rounded-full px-2.5 py-1 transition-colors disabled:opacity-50
                    ${task.status === col.status
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#181b27] text-[#636780] hover:text-[#e4e6f0] hover:bg-[#1c2030]'}`}
                >
                  {col.label}
                </button>
              ))}
            </div>

            {/* Field grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[#3d4060] mb-1">Assignee</label>
                <select value={task.assignee_id ?? ''} onChange={(e) => changeAssignee(e.target.value || null)} className={fieldSelect}>
                  <option value="">Unassigned</option>
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[#3d4060] mb-1">Client</label>
                <select value={task.client_id ?? ''} onChange={(e) => apply({ client_id: e.target.value || null })} className={fieldSelect}>
                  <option value="">None</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[#3d4060] mb-1">Priority</label>
                <select value={task.priority} onChange={(e) => apply({ priority: e.target.value as TaskPriority })} className={fieldSelect}>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[#3d4060] mb-1">Due date</label>
                <input type="date" value={task.due_date ?? ''} onChange={(e) => apply({ due_date: e.target.value || null })} className={fieldSelect} />
              </div>
            </div>

            {/* Collaborators: media buyer + anyone else tagged alongside the assignee */}
            {profiles.filter((p) => p.id !== task.assignee_id).length > 0 && (
              <div className="mb-5">
                <label className="block text-[10px] uppercase tracking-wide text-[#3d4060] mb-1.5">Collaborators</label>
                <div className="flex flex-wrap gap-1.5">
                  {profiles.filter((p) => p.id !== task.assignee_id).map((p) => {
                    const active = (task.collaborator_ids ?? []).includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={busy}
                        onClick={() => toggleCollaborator(p.id)}
                        className={`text-[11px] font-medium rounded-full px-2.5 py-1 transition-colors disabled:opacity-50
                          ${active
                            ? 'bg-indigo-600 text-white'
                            : 'bg-[#181b27] text-[#636780] hover:text-[#e4e6f0] hover:bg-[#1c2030]'}`}
                      >
                        {p.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Department + source line */}
            <div className="flex items-center gap-2 mb-5 text-[11px] text-[#636780]">
              <span className="bg-[#181b27] rounded px-1.5 py-0.5">{DEPARTMENT_LABELS[task.department]}</span>
              <span className="capitalize">{task.track} track</span>
              {task.source !== 'manual' && <span className="capitalize">from {task.source}</span>}
            </div>

            {/* Description */}
            <div className="mb-5">
              <label className="block text-[10px] uppercase tracking-wide text-[#3d4060] mb-1.5">Description</label>
              <textarea
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                onBlur={saveDescription}
                rows={4}
                placeholder="Add detail, links, context..."
                className="w-full bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-2 text-[12px] text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#3d4060] resize-none"
              />
            </div>

            {/* Comments */}
            <div className="mb-5">
              <label className="block text-[10px] uppercase tracking-wide text-[#3d4060] mb-2">Comments</label>
              <div className="space-y-2.5 mb-2">
                {comments.length === 0 && <p className="text-[11px] text-[#3d4060]">No comments yet</p>}
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0 ${avatarColour(c.profiles?.name)}`}>
                      {initials(c.profiles?.name)}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[11px] font-medium text-[#a9adc4]">{c.profiles?.name ?? 'Unknown'}</span>
                        <span className="text-[10px] text-[#3d4060]">{formatTimestamp(c.created_at)}</span>
                      </div>
                      <p className="text-[12px] text-[#e4e6f0] leading-snug">{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                  placeholder="Write a comment..."
                  className="flex-1 bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-1.5 text-[12px] text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#3d4060]"
                />
                <button onClick={submitComment} disabled={busy || !commentDraft.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-2.5 disabled:opacity-40">
                  <Send style={{ width: 13, height: 13 }} />
                </button>
              </div>
            </div>

            {/* Activity / event log */}
            <div className="mb-5">
              <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#3d4060] mb-2">
                <Clock style={{ width: 11, height: 11 }} /> Activity
              </label>
              <div className="space-y-1.5">
                {events.map((ev) => (
                  <div key={ev.id} className="flex items-baseline gap-2 text-[11px]">
                    <span className="text-[#636780] flex-1">{eventLabel(ev)}</span>
                    <span className="text-[10px] text-[#3d4060] shrink-0">{formatTimestamp(ev.occurred_at)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Delete */}
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-[11px] text-rose-400/70 hover:text-rose-400 transition-colors"
            >
              <Trash2 style={{ width: 13, height: 13 }} /> Delete task
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
