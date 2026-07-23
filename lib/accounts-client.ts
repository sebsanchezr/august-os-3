// Client-side fetch helpers for the Accounts module.
// Mirrors the pattern in lib/tasks-client.ts.

import type { Client, ClientReport, ClientIssue, ClientCommsLog, ClientMeeting, TeamQuestion, OnboardingForm, ClientCreativeAsset, Task, Profile, PendingMeetingTask, PendingChange } from './types'

const BASE = '/api/accounts'

// ─── Accounts ─────────────────────────────────────────────────────────────────

export type AccountListItem = Client & {
  open_task_count: number
  open_issue_count: number
  next_meeting: { id: string; scheduled_at: string; type: string } | null
  metrics_7d: { spend: number; revenue: number; roas_avg: number | null } | null
}

export async function fetchAccounts(): Promise<AccountListItem[]> {
  const res = await fetch(BASE)
  if (!res.ok) throw new Error('Failed to load accounts')
  const json = await res.json()
  return json.accounts
}

export async function fetchAccount(id: string) {
  const res = await fetch(`${BASE}/${id}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load account')
  return res.json()
}

export async function updateAccount(id: string, patch: Partial<Client>): Promise<Client> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  const json = await res.json()
  return json.account
}

export async function createAccount(data: Partial<Client>): Promise<Client> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  const json = await res.json()
  return json.account
}

export async function deleteAccount(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
}

// ─── Assets tab ───────────────────────────────────────────────────────────────

export type AssetsTabData = {
  notes: string | null
  form: OnboardingForm | null
  assets: ClientCreativeAsset[]
  tasks: (Pick<Task, 'id' | 'title' | 'priority' | 'due_date' | 'completed_at' | 'track' | 'assignee_id'> & {
    // DB status vocabulary is broader than the kanban TaskStatus enum (e.g. 'this_week', 'done')
    status: string
    profiles?: Pick<Profile, 'id' | 'name'> | null
  })[]
}

export async function fetchAssetsTab(clientId: string): Promise<AssetsTabData> {
  const res = await fetch(`${BASE}/${clientId}/assets`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load assets')
  return res.json()
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function fetchPendingReports(): Promise<(ClientReport & { clients: Pick<Client, 'id' | 'name' | 'health'> })[]> {
  const res = await fetch(`${BASE}/reports?status=pending_approval`)
  if (!res.ok) throw new Error('Failed to load reports')
  const json = await res.json()
  return json.reports
}

export async function fetchReports(clientId: string): Promise<ClientReport[]> {
  const res = await fetch(`${BASE}/reports?client_id=${clientId}`)
  if (!res.ok) throw new Error('Failed to load reports')
  const json = await res.json()
  return json.reports
}

export async function approveReport(
  reportId: string,
  opts: { approved_by?: string; client_message?: string } = {},
): Promise<ClientReport> {
  const res = await fetch(`${BASE}/reports/${reportId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  const json = await res.json()
  return json.report
}

export async function rejectReport(reportId: string, rejectionNote?: string): Promise<ClientReport> {
  const res = await fetch(`${BASE}/reports/${reportId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rejection_note: rejectionNote }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  const json = await res.json()
  return json.report
}

// ─── Pending meeting tasks (real approval gate, see 041 migration) ───────────

export async function fetchPendingMeetingTasks(): Promise<PendingMeetingTask[]> {
  const res = await fetch('/api/pending-tasks', { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load pending meeting tasks')
  const json = await res.json()
  return json.pending_tasks
}

export async function approvePendingMeetingTask(id: string): Promise<Task> {
  const res = await fetch(`/api/pending-tasks/${id}/approve`, { method: 'POST' })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  const json = await res.json()
  return json.task
}

export async function rejectPendingMeetingTask(id: string): Promise<void> {
  const res = await fetch(`/api/pending-tasks/${id}/reject`, { method: 'POST' })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
}

// ─── Pending changes (issue / health / weekly-focus proposals) ────────────────

export async function fetchPendingChanges(): Promise<PendingChange[]> {
  const res = await fetch('/api/pending-changes?status=pending', { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load pending changes')
  const json = await res.json()
  return json.changes
}

export async function approvePendingChange(id: string): Promise<PendingChange> {
  const res = await fetch(`/api/pending-changes/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  const json = await res.json()
  return json.change
}

export async function rejectPendingChange(id: string, rejectionNote?: string): Promise<PendingChange> {
  const res = await fetch(`/api/pending-changes/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rejection_note: rejectionNote }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  const json = await res.json()
  return json.change
}

// ─── Comms ────────────────────────────────────────────────────────────────────

export async function logComm(
  clientId: string,
  data: {
    direction: string
    channel: string
    summary: string
    sentiment?: string
    flags?: string[]
    logged_by?: string
    occurred_at?: string
  },
): Promise<ClientCommsLog> {
  const res = await fetch(`${BASE}/${clientId}/comms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  const json = await res.json()
  return json.comm
}

// ─── Talking points ──────────────────────────────────────────────────────────

export async function addTalkingPoint(clientId: string, point: string, addedBy?: string) {
  const res = await fetch(`${BASE}/${clientId}/talking-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ point, added_by: addedBy }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  return res.json()
}

// ─── Issues ───────────────────────────────────────────────────────────────────

export async function fetchIssues(opts: {
  client_id?: string
  status?: string
  severity?: string
} = {}): Promise<ClientIssue[]> {
  const params = new URLSearchParams()
  if (opts.client_id) params.set('client_id', opts.client_id)
  if (opts.status) params.set('status', opts.status)
  if (opts.severity) params.set('severity', opts.severity)
  const res = await fetch(`${BASE}/issues?${params}`)
  if (!res.ok) throw new Error('Failed to load issues')
  const json = await res.json()
  return json.issues
}

export async function createIssue(data: {
  client_id: string
  category: string
  severity?: string
  description: string
  owner_profile_id?: string
}): Promise<ClientIssue> {
  const res = await fetch(`${BASE}/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  const json = await res.json()
  return json.issue
}

export async function updateIssue(issueId: string, patch: Partial<ClientIssue>): Promise<ClientIssue> {
  const res = await fetch(`${BASE}/issues/${issueId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  const json = await res.json()
  return json.issue
}

// ─── Meetings ─────────────────────────────────────────────────────────────────

export async function fetchMeetings(clientId: string): Promise<ClientMeeting[]> {
  const res = await fetch(`${BASE}/${clientId}/meetings`)
  if (!res.ok) throw new Error('Failed to load meetings')
  const json = await res.json()
  return json.meetings
}

export async function createMeeting(
  clientId: string,
  data: { scheduled_at: string; type?: string; agenda?: string },
): Promise<ClientMeeting> {
  const res = await fetch(`${BASE}/${clientId}/meetings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  const json = await res.json()
  return json.meeting
}

export async function scheduleMeetingWithInvite(
  clientId: string,
  data: {
    scheduled_at: string
    duration_minutes?: number
    type?: string
    agenda?: string
    attendees: string[]
    organizer_email?: string
    organizer_name?: string
    title?: string
  },
): Promise<{ meeting: ClientMeeting; email_sent: boolean; email_error: string | null; google_calendar_url: string }> {
  const res = await fetch(`${BASE}/${clientId}/meetings/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  return res.json()
}

export async function updateMeeting(
  clientId: string,
  meetingId: string,
  patch: Partial<ClientMeeting>,
): Promise<ClientMeeting> {
  const res = await fetch(`${BASE}/${clientId}/meetings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meeting_id: meetingId, ...patch }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  const json = await res.json()
  return json.meeting
}

// ─── Meetings hub (cross-client) ──────────────────────────────────────────────

export type MeetingWithClient = ClientMeeting & {
  // null for internal team meetings with no client (migration 038)
  clients: Pick<Client, 'id' | 'name' | 'health' | 'am_profile_id'> | null
  prep_report: { id: string; status: string } | null
  followup_report: { id: string; status: string } | null
}

export async function fetchAllMeetings(opts: {
  past?: boolean
  client_id?: string
  type?: string
  status?: string
} = {}): Promise<MeetingWithClient[]> {
  const params = new URLSearchParams()
  if (opts.past) params.set('past', 'true')
  if (opts.client_id) params.set('client_id', opts.client_id)
  if (opts.type) params.set('type', opts.type)
  if (opts.status) params.set('status', opts.status)
  const res = await fetch(`/api/meetings?${params}`)
  if (!res.ok) throw new Error('Failed to load meetings')
  const json = await res.json()
  return json.meetings
}

export async function cancelMeeting(
  meetingId: string,
  cancellationReason?: string,
): Promise<ClientMeeting> {
  const res = await fetch(`/api/meetings/${meetingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'cancelled', cancellation_reason: cancellationReason }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  const json = await res.json()
  return json.meeting
}

export async function sendMinutes(
  meetingId: string,
  opts: { extra_recipients?: string[]; sent_by?: string } = {},
): Promise<{ sent: boolean; recipients: string[] }> {
  const res = await fetch(`/api/meetings/${meetingId}/send-minutes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  return res.json()
}

// ─── Comms inbox ──────────────────────────────────────────────────────────────

export type CommsInbox = {
  open_clocks: (ClientCommsLog & { clients: Pick<Client, 'id' | 'name' | 'health' | 'am_profile_id'> })[]
  questions: TeamQuestion[]
}

export async function fetchCommsInbox(): Promise<CommsInbox> {
  const res = await fetch('/api/comms/inbox')
  if (!res.ok) throw new Error('Failed to load comms inbox')
  return res.json()
}

export async function markResponded(commId: string): Promise<ClientCommsLog> {
  const res = await fetch(`/api/comms/${commId}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  const json = await res.json()
  return json.comm
}

// ─── Team questions ───────────────────────────────────────────────────────────

export async function fetchQuestions(status = 'open'): Promise<TeamQuestion[]> {
  const res = await fetch(`/api/questions?status=${status}`)
  if (!res.ok) throw new Error('Failed to load questions')
  const json = await res.json()
  return json.questions
}

export async function createQuestion(data: {
  question: string
  context?: string
  client_id?: string
  meeting_id?: string
  task_id?: string
  asked_by?: string
  target_profile_id?: string
}): Promise<TeamQuestion> {
  const res = await fetch('/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  const json = await res.json()
  return json.question
}
