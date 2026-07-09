'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Calendar, Rocket, AlertTriangle, ListChecks, CircleAlert, Circle } from 'lucide-react'
import { KpiCard } from '@/components/kpi-card'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { PRIORITY_COLOURS } from '@/lib/types'
import { initials, avatarColour, formatDue, DUE_TONE_CLASS, STATUS_LABELS } from '@/lib/task-format'
import type { TaskStatus, TaskPriority, ClientHealthStatus, OnboardingStatus } from '@/lib/types'

type FulfilmentCollaborator = { id: string; name: string; email: string | null }

type FulfilmentTask = {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  assignee_id: string | null
  assignee: { id: string; name: string; email: string | null } | null
  clients: { id: string; name: string } | null
  overdue: boolean
  collaborators?: FulfilmentCollaborator[]
}

type FulfilmentMeeting = {
  id: string
  type: string
  scheduled_at: string
  status: string
  clients: { id: string; name: string } | null
}

type FulfilmentOnboarding = {
  id: string
  company_name: string
  status: OnboardingStatus
  health: ClientHealthStatus
  paid: boolean
}

type FulfilmentClient = {
  id: string
  name: string
  health: ClientHealthStatus
}

type FulfilmentData = {
  tasks: { open: FulfilmentTask[]; counts: Record<string, number>; overdue_count: number }
  meetings: FulfilmentMeeting[]
  onboardings: FulfilmentOnboarding[]
  clients: FulfilmentClient[]
  health_counts: { red: number; amber: number; green: number }
  issues_open_count: number
  pending_reports_count: number
}

// Canonical grouping order across both creative and ops tracks, statuses
// deduped so "brief" (shared by both tracks) only renders once.
const STATUS_ORDER: TaskStatus[] = [
  'brief', 'editing', 'revision', 'approved_by_client', 'sent_to_media_buyer',
  'in_progress', 'review', 'completed', 'live',
]

const HEALTH_COLOUR: Record<string, string> = {
  red: 'text-red-400', amber: 'text-amber-400', green: 'text-emerald-400',
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#181b27] rounded-lg ${className}`} />
}

export default function FulfilmentPage() {
  const [data, setData] = useState<FulfilmentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    getSupabaseBrowser().auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null))
  }, [])

  useEffect(() => {
    fetch('/api/fulfilment')
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Error ${res.status}`)
        return res.json()
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const yourTasks = useMemo(() => {
    if (!data || !userEmail) return []
    const email = userEmail.toLowerCase()
    return data.tasks.open.filter((t) =>
      t.assignee?.email?.toLowerCase() === email ||
      (t.collaborators ?? []).some((c) => c.email?.toLowerCase() === email)
    )
  }, [data, userEmail])

  const grouped = useMemo(() => {
    if (!data) return [] as { status: TaskStatus; tasks: FulfilmentTask[] }[]
    const seen = new Set<TaskStatus>()
    const groups: { status: TaskStatus; tasks: FulfilmentTask[] }[] = []
    for (const status of STATUS_ORDER) {
      if (seen.has(status)) continue
      seen.add(status)
      const tasks = data.tasks.open.filter((t) => t.status === status)
      if (tasks.length > 0) groups.push({ status, tasks })
    }
    return groups
  }, [data])

  if (loading) {
    return (
      <div className="p-6 min-h-full">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 mb-5" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center justify-between">
          <p className="text-red-400 text-sm">{error ?? 'Failed to load fulfilment dashboard'}</p>
        </div>
      </div>
    )
  }

  const meetingsThisWeek = data.meetings.length
  const onboardingsInFlight = data.onboardings.length
  const clientsAtRisk = data.health_counts.red + data.health_counts.amber

  return (
    <div className="p-6 min-h-full">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[#e4e6f0]">Fulfilment</h1>
        <p className="text-[#636780] text-xs mt-0.5">Everything the team needs to run delivery, in one place.</p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <KpiCard label="Open Tasks" value={data.tasks.open.length} compact />
        <KpiCard label="Overdue" value={data.tasks.overdue_count} compact accent={data.tasks.overdue_count > 0 ? 'amber' : 'default'} />
        <KpiCard label="Meetings This Week" value={meetingsThisWeek} compact accent="blue" />
        <KpiCard label="Onboardings In Flight" value={onboardingsInFlight} compact accent="blue" />
        <KpiCard label="Clients At Risk" value={clientsAtRisk} compact accent={clientsAtRisk > 0 ? 'amber' : 'default'} />
      </div>

      {/* Your tasks */}
      {yourTasks.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks size={14} className="text-indigo-400" />
            <p className="text-sm font-medium text-[#e4e6f0]">Your Tasks</p>
            <span className="text-[10px] text-[#636780]">{yourTasks.length}</span>
          </div>
          <div className="space-y-1.5">
            {yourTasks.map((t) => (
              <TaskRow key={t.id} task={t} highlighted />
            ))}
          </div>
        </div>
      )}

      {/* All open tasks, grouped by status */}
      <div className="mb-6">
        <p className="text-sm font-medium text-[#e4e6f0] mb-3">All Open Tasks</p>
        {grouped.length === 0 ? (
          <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-6 text-center text-[#636780] text-sm">
            No open tasks. Clear board.
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map((g) => (
              <div key={g.status}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#636780]">
                    {STATUS_LABELS[g.status]}
                  </span>
                  <span className="text-[10px] text-[#3d4060]">{g.tasks.length}</span>
                </div>
                <div className="space-y-1.5">
                  {g.tasks.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Meetings + Onboarding columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={13} className="text-[#636780]" />
            <p className="text-sm font-medium text-[#e4e6f0]">Meetings This Week</p>
          </div>
          {data.meetings.length === 0 ? (
            <p className="text-xs text-[#636780]">Nothing scheduled in the next 7 days.</p>
          ) : (
            <div className="space-y-2">
              {data.meetings.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-[#1c2035] bg-[#181b27] px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs text-[#e4e6f0] truncate">{m.clients?.name ?? 'Unknown client'}</p>
                    <p className="text-[10px] text-[#636780] capitalize">{m.type}</p>
                  </div>
                  <span className="text-[10px] text-[#636780] shrink-0 ml-2">
                    {new Date(m.scheduled_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Rocket size={13} className="text-[#636780]" />
            <p className="text-sm font-medium text-[#e4e6f0]">Onboarding In Flight</p>
          </div>
          {data.onboardings.length === 0 ? (
            <p className="text-xs text-[#636780]">No active onboardings.</p>
          ) : (
            <div className="space-y-2">
              {data.onboardings.map((o) => (
                <Link
                  key={o.id}
                  href="/onboarding"
                  className="flex items-center justify-between rounded-lg border border-[#1c2035] bg-[#181b27] px-3 py-2 hover:border-[#3d4060] transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Circle size={8} className={`fill-current shrink-0 ${HEALTH_COLOUR[o.health] ?? HEALTH_COLOUR.green}`} />
                    <span className="text-xs text-[#e4e6f0] truncate">{o.company_name}</span>
                  </div>
                  <span className="flex items-center gap-2 shrink-0 ml-2">
                    {!o.paid && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">Unpaid</span>
                    )}
                    <span className="text-[10px] text-[#636780] capitalize">{o.status.replace(/_/g, ' ')}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Extras: open issues + pending approvals, if any */}
      {(data.issues_open_count > 0 || data.pending_reports_count > 0) && (
        <div className="flex items-center gap-3 mb-6">
          {data.issues_open_count > 0 && (
            <Link
              href="/accounts/issues"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-amber-950/20 border border-amber-900/40 text-amber-300 hover:border-amber-700 transition-colors"
            >
              <AlertTriangle size={12} />
              {data.issues_open_count} open client issue{data.issues_open_count === 1 ? '' : 's'}
            </Link>
          )}
          {data.pending_reports_count > 0 && (
            <Link
              href="/accounts/approvals"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#181b27] border border-[#1c2035] text-[#e4e6f0] hover:border-[#3d4060] transition-colors"
            >
              <CircleAlert size={12} />
              {data.pending_reports_count} report{data.pending_reports_count === 1 ? '' : 's'} awaiting approval
            </Link>
          )}
        </div>
      )}

      {/* Client health strip */}
      <div>
        <p className="text-sm font-medium text-[#e4e6f0] mb-3">Client Health</p>
        <div className="flex flex-wrap gap-2">
          {data.clients.map((c) => (
            <Link
              key={c.id}
              href={`/accounts/${c.id}`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-[#10121a] border border-[#1c2035] text-[#e4e6f0] hover:border-[#3d4060] transition-colors"
            >
              <Circle size={8} className={`fill-current ${HEALTH_COLOUR[c.health] ?? HEALTH_COLOUR.green}`} />
              {c.name}
            </Link>
          ))}
          {data.clients.length === 0 && (
            <p className="text-xs text-[#636780]">No clients on file.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function TaskRow({ task, highlighted }: { task: FulfilmentTask; highlighted?: boolean }) {
  const due = formatDue(task.due_date)
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors ${
        highlighted
          ? 'border-indigo-500/40 bg-indigo-500/5'
          : 'border-[#1c2035] bg-[#10121a]'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: PRIORITY_COLOURS[task.priority] }}
          title={task.priority}
        />
        <span className="text-xs text-[#e4e6f0] truncate">{task.title}</span>
        {task.clients && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shrink-0">
            {task.clients.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center -space-x-1.5">
          {task.assignee ? (
            <span
              className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-semibold ring-2 ring-[#10121a] ${avatarColour(task.assignee.name)}`}
              title={task.assignee.name}
            >
              {initials(task.assignee.name)}
            </span>
          ) : (
            <span className="h-5 w-5 rounded-full border border-dashed border-[#2e3050] ring-2 ring-[#10121a]" title="Unassigned" />
          )}
          {(task.collaborators ?? []).map((c) => (
            <span
              key={c.id}
              className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-semibold ring-2 ring-[#10121a] ${avatarColour(c.name)}`}
              title={c.name}
            >
              {initials(c.name)}
            </span>
          ))}
        </div>
        {due && (
          <span className={`text-[10px] font-medium tabular-nums w-16 text-right ${task.overdue ? 'text-red-400' : DUE_TONE_CLASS[due.tone]}`}>
            {due.label}
          </span>
        )}
      </div>
    </div>
  )
}
