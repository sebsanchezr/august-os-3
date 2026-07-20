'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Loader2, ArrowUpDown, X } from 'lucide-react'
import type { Task, TaskStatus, TaskTrack, TaskPriority } from '@/lib/types'
import { CREATIVE_COLUMNS, OPS_COLUMNS, PRIORITY_COLOURS } from '@/lib/types'
import { useTaskMeta, useCurrentUserId, patchTask, updateStatus, softDeleteTask } from '@/lib/tasks-client'
import { STATUS_LABELS, DEPARTMENT_LABELS, formatDue, DUE_TONE_CLASS, initials, avatarColour } from '@/lib/task-format'
import TaskDetail from './task-detail'

type SortKey = 'title' | 'status' | 'assignee' | 'client' | 'priority' | 'due_date'
const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 }

const cellSelect =
  'bg-transparent hover:bg-[#181b27] border border-transparent hover:border-[#1c2035] rounded px-1.5 py-1 text-[12px] text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-[#181b27] [color-scheme:dark] cursor-pointer'

export default function TaskList() {
  const { profiles, clients } = useTaskMeta()
  const currentUserId = useCurrentUserId()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [trackFilter, setTrackFilter] = useState<TaskTrack | 'all'>('all')
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('due_date')
  const [sortAsc, setSortAsc] = useState(true)

  const refetch = useCallback(async () => {
    const res = await fetch('/api/tasks')
    if (res.ok) {
      const d = await res.json()
      setTasks(d.tasks ?? [])
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    refetch().finally(() => setLoading(false))
  }, [refetch])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(true) }
  }

  const rows = useMemo(() => {
    const filtered = tasks.filter((t) => trackFilter === 'all' || t.track === trackFilter)
    const sorted = [...filtered].sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      switch (sortKey) {
        case 'title': av = a.title.toLowerCase(); bv = b.title.toLowerCase(); break
        case 'status': av = a.status; bv = b.status; break
        case 'assignee': av = a.profiles?.name ?? '~'; bv = b.profiles?.name ?? '~'; break
        case 'client': av = a.clients?.name ?? '~'; bv = b.clients?.name ?? '~'; break
        case 'priority': av = PRIORITY_ORDER[a.priority]; bv = PRIORITY_ORDER[b.priority]; break
        case 'due_date': av = a.due_date ?? '9999'; bv = b.due_date ?? '9999'; break
      }
      if (av < bv) return sortAsc ? -1 : 1
      if (av > bv) return sortAsc ? 1 : -1
      return 0
    })
    return sorted
  }, [tasks, trackFilter, sortKey, sortAsc])

  async function inlineStatus(task: Task, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)))
    try { await updateStatus(task.id, status, currentUserId); await refetch() } catch { await refetch() }
  }

  async function inlineField(task: Task, body: Record<string, unknown>) {
    try { await patchTask(task.id, { ...body, actor_id: currentUserId }); await refetch() } catch { await refetch() }
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`Delete this task?\n\n"${task.title}"\n\nThis removes it from the board and list.`)) return
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
    try { await softDeleteTask(task.id, currentUserId); await refetch() } catch { await refetch() }
  }

  function statusOptions(track: TaskTrack) {
    return track === 'creative' ? CREATIVE_COLUMNS : OPS_COLUMNS
  }

  // Overdue colour rule. A terminal status means the deliverable shipped, so it
  // reads green even when the due date has passed: 'live' on the creative track,
  // 'completed' on the ops track. Any other non-terminal creative status
  // (brief, editing, revision, sent_for_approval, approved_by_client,
  // sent_to_media_buyer) that is overdue means work is still stuck (red).
  function overdueTone(task: Task): 'done' | 'stuck' | null {
    // Terminal status means the deliverable shipped: always green, regardless
    // of due date (a task completed early or with no due date still reads done).
    if (task.status === 'live' || task.status === 'completed') return 'done'
    const due = formatDue(task.due_date)
    if (!due || due.tone !== 'overdue') return null
    if (task.track !== 'creative') return null
    return 'stuck'
  }

  function SortHeader({ label, k, className = '' }: { label: string; k: SortKey; className?: string }) {
    return (
      <th className={`text-left font-medium px-2 py-2 ${className}`}>
        <button onClick={() => toggleSort(k)} className="flex items-center gap-1 text-[#636780] hover:text-[#e4e6f0] transition-colors">
          {label}
          <ArrowUpDown style={{ width: 10, height: 10 }} className={sortKey === k ? 'text-indigo-400' : 'opacity-40'} />
        </button>
      </th>
    )
  }

  return (
    <div className="flex flex-col min-h-full p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-[#e4e6f0]">Tasks List</h1>
          <div className="flex bg-[#10121a] border border-[#1c2035] rounded-lg p-0.5">
            {(['all', 'creative', 'ops'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTrackFilter(t)}
                className={`text-[11px] font-medium rounded-md px-2.5 py-1 capitalize transition-colors ${
                  trackFilter === t ? 'bg-[#1c2035] text-[#e4e6f0]' : 'text-[#636780] hover:text-[#e4e6f0]'
                }`}
              >
                {t === 'all' ? 'All' : t === 'creative' ? 'Creative' : 'Ops'}
              </button>
            ))}
          </div>
        </div>
        <span className="text-[11px] text-[#636780] tabular-nums">{rows.length} tasks</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-5 w-5 text-[#636780] animate-spin" />
        </div>
      ) : (
        <div className="rounded-xl border border-[#1c2035] bg-[#10121a] overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#1c2035] text-[11px]">
                <SortHeader label="Task" k="title" className="w-[34%]" />
                <SortHeader label="Status" k="status" />
                <SortHeader label="Assignee" k="assignee" />
                <SortHeader label="Client" k="client" />
                <SortHeader label="Priority" k="priority" />
                <SortHeader label="Due" k="due_date" />
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="text-center text-[#3d4060] py-8">No tasks</td></tr>
              )}
              {rows.map((task) => {
                const due = formatDue(task.due_date)
                const tone = overdueTone(task)
                const rowToneClass = tone === 'done' ? 'bg-green-500/10' : tone === 'stuck' ? 'bg-red-500/10' : ''
                return (
                  <tr key={task.id} className={`group border-b border-[#1c2035]/60 hover:bg-[#151824] transition-colors ${rowToneClass}`}>
                    {/* Title */}
                    <td className="px-2 py-1.5">
                      <button onClick={() => setOpenTaskId(task.id)} className="text-left text-[#e4e6f0] hover:text-indigo-400 transition-colors leading-snug">
                        {task.title}
                      </button>
                      {task.department && (
                        <span className="ml-2 text-[10px] text-[#3d4060]">{DEPARTMENT_LABELS[task.department]}</span>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-2 py-1.5">
                      <select value={task.status} onChange={(e) => inlineStatus(task, e.target.value as TaskStatus)} className={cellSelect}>
                        {statusOptions(task.track).map((s) => (
                          <option key={s.status} value={s.status}>{STATUS_LABELS[s.status]}</option>
                        ))}
                      </select>
                    </td>
                    {/* Assignee */}
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        {task.profiles && (
                          <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-semibold shrink-0 ${avatarColour(task.profiles.name)}`}>
                            {initials(task.profiles.name)}
                          </span>
                        )}
                        <select value={task.assignee_id ?? ''} onChange={(e) => inlineField(task, { assignee_id: e.target.value || null })} className={cellSelect}>
                          <option value="">Unassigned</option>
                          {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    </td>
                    {/* Client */}
                    <td className="px-2 py-1.5">
                      <select value={task.client_id ?? ''} onChange={(e) => inlineField(task, { client_id: e.target.value || null })} className={cellSelect}>
                        <option value="">None</option>
                        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    {/* Priority */}
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLOURS[task.priority] }} />
                        <select value={task.priority} onChange={(e) => inlineField(task, { priority: e.target.value as TaskPriority })} className={cellSelect}>
                          <option value="urgent">Urgent</option>
                          <option value="high">High</option>
                          <option value="normal">Normal</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                    </td>
                    {/* Due */}
                    <td className="px-2 py-1.5">
                      <input
                        type="date"
                        value={task.due_date ?? ''}
                        onChange={(e) => inlineField(task, { due_date: e.target.value || null })}
                        className={`${cellSelect} ${
                          tone === 'done' ? 'text-green-400' : tone === 'stuck' ? 'text-red-400' : due ? DUE_TONE_CLASS[due.tone] : ''
                        }`}
                      />
                    </td>
                    {/* Delete */}
                    <td className="px-1 py-1.5 text-right">
                      <button
                        onClick={() => deleteTask(task)}
                        title="Delete task"
                        aria-label="Delete task"
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[#636780] hover:text-red-400 transition-opacity rounded p-1 hover:bg-red-500/10"
                      >
                        <X style={{ width: 13, height: 13 }} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {openTaskId && (
        <TaskDetail
          taskId={openTaskId}
          profiles={profiles}
          clients={clients}
          currentUserId={currentUserId}
          onClose={() => setOpenTaskId(null)}
          onChanged={refetch}
        />
      )}
    </div>
  )
}
