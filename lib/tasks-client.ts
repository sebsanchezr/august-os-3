'use client'

import { useEffect, useState, useCallback } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import type { Task, Profile, Client, TaskComment, TaskEvent, TaskStatus } from '@/lib/types'

// Current signed-in user's profile id (= auth user id in our schema).
export function useCurrentUserId(): string | null {
  const [id, setId] = useState<string | null>(null)
  useEffect(() => {
    getSupabaseBrowser().auth.getUser().then(({ data }) => setId(data.user?.id ?? null))
  }, [])
  return id
}

// Profiles + clients for dropdowns and name lookups. Loaded once.
export function useTaskMeta() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tasks/meta')
      .then((r) => r.json())
      .then((d) => {
        setProfiles(d.profiles ?? [])
        setClients(d.clients ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  return { profiles, clients, loading }
}

type TaskFilters = {
  track?: string
  assignee_id?: string
  department?: string
  client_id?: string
  include_archived?: boolean
  include_deleted?: boolean
}

function buildQuery(filters: TaskFilters): string {
  const p = new URLSearchParams()
  if (filters.track) p.set('track', filters.track)
  if (filters.assignee_id) p.set('assignee_id', filters.assignee_id)
  if (filters.department) p.set('department', filters.department)
  if (filters.client_id) p.set('client_id', filters.client_id)
  if (filters.include_archived) p.set('include_archived', 'true')
  if (filters.include_deleted) p.set('include_deleted', 'true')
  const s = p.toString()
  return s ? `?${s}` : ''
}

// Fetches tasks with optional filters and exposes a refetch handle.
export function useTasks(filters: TaskFilters = {}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const key = JSON.stringify(filters)

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/tasks${buildQuery(filters)}`)
    if (res.ok) {
      const d = await res.json()
      setTasks(d.tasks ?? [])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    setLoading(true)
    refetch().finally(() => setLoading(false))
  }, [refetch])

  return { tasks, setTasks, loading, refetch }
}

// Mutation helpers. All return the parsed JSON or throw on error.
export async function createTask(body: Record<string, unknown>): Promise<Task> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const d = await res.json()
  if (!res.ok) throw new Error(d.error ?? 'Failed to create task')
  return d.task
}

export async function patchTask(id: string, body: Record<string, unknown>): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const d = await res.json()
  if (!res.ok) throw new Error(d.error ?? 'Failed to update task')
  return d.task
}

export async function updateStatus(id: string, status: TaskStatus, actorId: string | null, blockedReason?: string): Promise<Task> {
  const body: Record<string, unknown> = { status, actor_id: actorId }
  if (blockedReason) body.blocked_reason = blockedReason
  return patchTask(id, body)
}

export async function softDeleteTask(id: string, actorId: string | null): Promise<Task> {
  return patchTask(id, { deleted_at: 'now', actor_id: actorId })
}

export async function restoreTask(id: string, actorId: string | null): Promise<Task> {
  return patchTask(id, { restore: true, actor_id: actorId })
}

export async function fetchTaskDetail(id: string): Promise<{ task: Task; comments: TaskComment[]; events: TaskEvent[] }> {
  const res = await fetch(`/api/tasks/${id}`)
  const d = await res.json()
  if (!res.ok) throw new Error(d.error ?? 'Failed to load task')
  return d
}

export async function addComment(id: string, body: string, authorId: string | null): Promise<TaskComment> {
  const res = await fetch(`/api/tasks/${id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, author_id: authorId }),
  })
  const d = await res.json()
  if (!res.ok) throw new Error(d.error ?? 'Failed to add comment')
  return d.comment
}
