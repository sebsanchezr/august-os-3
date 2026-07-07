'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Loader2, User } from 'lucide-react'
import type { Task, TaskTrack, TaskStatus, TaskDepartment } from '@/lib/types'
import { CREATIVE_COLUMNS, OPS_COLUMNS } from '@/lib/types'
import { useTaskMeta, useCurrentUserId, createTask, updateStatus } from '@/lib/tasks-client'
import { DEPARTMENT_LABELS } from '@/lib/task-format'
import TaskColumn from './task-column'
import QuickAdd from './quick-add'
import TaskDetail from './task-detail'

const OPS_DEPTS: TaskDepartment[] = ['paid_ads', 'client', 'company', 'admin', 'ceo']

export default function TaskBoard() {
  const { profiles, clients } = useTaskMeta()
  const currentUserId = useCurrentUserId()

  const [track, setTrack] = useState<TaskTrack>('creative')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [addSignal, setAddSignal] = useState(0)

  // Filters
  const [mineOnly, setMineOnly] = useState(false)
  const [deptFilter, setDeptFilter] = useState<TaskDepartment | ''>('')
  const [clientFilter, setClientFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null)

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

  // Keyboard shortcut: N to open quick add (ignore when typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
      if (e.key === 'n' && !typing && !openTaskId) {
        e.preventDefault()
        setAddSignal((s) => s + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openTaskId])

  const columns = track === 'creative' ? CREATIVE_COLUMNS : OPS_COLUMNS

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (t.track !== track) return false
      if (mineOnly && t.assignee_id !== currentUserId) return false
      if (deptFilter && t.department !== deptFilter) return false
      if (clientFilter && t.client_id !== clientFilter) return false
      if (assigneeFilter && t.assignee_id !== assigneeFilter) return false
      return true
    })
  }, [tasks, track, mineOnly, currentUserId, deptFilter, clientFilter, assigneeFilter])

  const byStatus = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const col of columns) map[col.status] = []
    for (const t of filtered) {
      if (map[t.status]) map[t.status].push(t)
    }
    return map
  }, [filtered, columns])

  async function handleDrop(status: TaskStatus) {
    if (!draggingId) return
    const task = tasks.find((t) => t.id === draggingId)
    setDraggingId(null)
    if (!task || task.status === status) return

    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)))
    try {
      await updateStatus(task.id, status, currentUserId)
      await refetch()
    } catch {
      await refetch() // rollback via source of truth
    }
  }

  async function handleCreate(body: Record<string, unknown>) {
    await createTask(body)
    await refetch()
  }

  const total = filtered.length

  return (
    <div className="flex flex-col h-full p-5">
      {/* Header: title + track tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-[#e4e6f0]">Tasks</h1>
          <div className="flex bg-[#10121a] border border-[#1c2035] rounded-lg p-0.5">
            <button
              onClick={() => setTrack('creative')}
              className={`text-[12px] font-medium rounded-md px-3 py-1 transition-colors ${
                track === 'creative' ? 'bg-[#1c2035] text-[#e4e6f0]' : 'text-[#636780] hover:text-[#e4e6f0]'
              }`}
            >
              Creative Pipeline
            </button>
            <button
              onClick={() => setTrack('ops')}
              className={`text-[12px] font-medium rounded-md px-3 py-1 transition-colors ${
                track === 'ops' ? 'bg-[#1c2035] text-[#e4e6f0]' : 'text-[#636780] hover:text-[#e4e6f0]'
              }`}
            >
              Ops
            </button>
          </div>
        </div>
        <span className="text-[11px] text-[#636780] tabular-nums">{total} tasks</span>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button
          onClick={() => setMineOnly((v) => !v)}
          className={`flex items-center gap-1 text-[11px] font-medium rounded-lg px-2.5 py-1.5 border transition-colors ${
            mineOnly
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-[#10121a] text-[#636780] border-[#1c2035] hover:text-[#e4e6f0]'
          }`}
        >
          <User style={{ width: 12, height: 12 }} /> My Tasks
        </button>

        {track === 'ops' && (
          <div className="flex items-center gap-1">
            {OPS_DEPTS.map((d) => (
              <button
                key={d}
                onClick={() => setDeptFilter((cur) => (cur === d ? '' : d))}
                className={`text-[11px] font-medium rounded-lg px-2.5 py-1.5 border transition-colors ${
                  deptFilter === d
                    ? 'bg-[#1c2035] text-[#e4e6f0] border-[#2e3050]'
                    : 'bg-[#10121a] text-[#636780] border-[#1c2035] hover:text-[#e4e6f0]'
                }`}
              >
                {DEPARTMENT_LABELS[d]}
              </button>
            ))}
          </div>
        )}

        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="bg-[#10121a] border border-[#1c2035] rounded-lg px-2.5 py-1.5 text-[11px] text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="bg-[#10121a] border border-[#1c2035] rounded-lg px-2.5 py-1.5 text-[11px] text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All assignees</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <div className="ml-auto">
          <QuickAdd
            track={track}
            profiles={profiles}
            clients={clients}
            createdBy={currentUserId}
            autoFocusSignal={addSignal}
            onCreate={handleCreate}
          />
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-5 w-5 text-[#636780] animate-spin" />
        </div>
      ) : (
        <div className="flex gap-3 flex-1 overflow-x-auto pb-2">
          {columns.map((col) => (
            <TaskColumn
              key={col.status}
              status={col.status}
              label={col.label}
              tasks={byStatus[col.status] ?? []}
              draggingId={draggingId}
              onCardClick={(t) => setOpenTaskId(t.id)}
              onCardDragStart={(t) => setDraggingId(t.id)}
              onDropToColumn={handleDrop}
            />
          ))}
        </div>
      )}

      {/* Detail slide-over */}
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
