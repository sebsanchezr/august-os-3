// Client-side fetch helpers for the Team & Staff Onboarding module.
// Mirrors the pattern in lib/accounts-client.ts.

import type { OnboardingTaskCategory } from './team-server'

const BASE = '/api/team'

// ─── Types ──────────────────────────────────────────────────────────────────

export type TeamMemberRole = 'cold_caller' | 'sales_manager' | 'other'
export type TeamMemberStatus = 'onboarding' | 'active' | 'paused' | 'offboarded'

export type TeamMember = {
  id: string
  name: string
  title: string | null
  role: TeamMemberRole
  email: string | null
  phone: string | null
  whatsapp: string | null
  location: string | null
  avatar_url: string | null
  login_email: string | null
  discord_user_id: string | null
  status: TeamMemberStatus
  start_date: string | null
  commission_notes: string | null
  created_at: string
  updated_at: string
}

export type OnboardingStage =
  | 'applied'
  | 'contract_sent'
  | 'details_collected'
  | 'intro_booked'
  | 'ramp_learning'
  | 'day7_review'
  | 'active'

export type StaffOnboardingTask = {
  id: string
  onboarding_id: string
  title: string
  category: OnboardingTaskCategory
  url: string | null
  done: boolean
  position: number
  created_at: string
}

export type StaffOnboarding = {
  id: string
  team_member_id: string | null
  candidate_name: string | null
  role: TeamMemberRole
  stage: OnboardingStage
  intro_meeting_at: string | null
  day7_review_at: string | null
  contract_url: string | null
  welcome_sent: boolean
  notes: string | null
  position: number
  created_at: string
  updated_at: string
}

export type StaffOnboardingListItem = StaffOnboarding & {
  team_member: Pick<TeamMember, 'id' | 'name' | 'avatar_url'> | null
  task_count: number
  task_done_count: number
}

// ─── Team members ───────────────────────────────────────────────────────────

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const res = await fetch(BASE)
  if (!res.ok) throw new Error('Failed to load team members')
  const json = await res.json()
  return json.members
}

export async function fetchTeamMember(id: string): Promise<{
  member: TeamMember
  onboarding: (StaffOnboarding & { tasks: StaffOnboardingTask[] }) | null
}> {
  const res = await fetch(`${BASE}/${id}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load team member')
  return res.json()
}

export async function createTeamMember(data: Partial<TeamMember>): Promise<TeamMember> {
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
  return json.member
}

export async function updateTeamMember(id: string, patch: Partial<TeamMember>): Promise<TeamMember> {
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
  return json.member
}

export async function deleteTeamMember(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
}

// ─── Onboarding board ───────────────────────────────────────────────────────

export async function fetchOnboardings(): Promise<StaffOnboardingListItem[]> {
  const res = await fetch(`${BASE}/onboarding`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load onboarding board')
  const json = await res.json()
  return json.onboardings
}

export async function createOnboarding(data: {
  candidate_name: string
  role?: TeamMemberRole
  team_member_id?: string | null
}): Promise<StaffOnboarding> {
  const res = await fetch(`${BASE}/onboarding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  const json = await res.json()
  return json.onboarding
}

export async function fetchOnboardingDetail(id: string): Promise<{
  onboarding: StaffOnboarding
  tasks: StaffOnboardingTask[]
}> {
  const res = await fetch(`${BASE}/onboarding/${id}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load onboarding')
  return res.json()
}

export async function updateOnboarding(id: string, patch: Partial<StaffOnboarding>): Promise<StaffOnboarding> {
  const res = await fetch(`${BASE}/onboarding/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  const json = await res.json()
  return json.onboarding
}

export async function toggleOnboardingTask(
  onboardingId: string,
  taskId: string,
  done: boolean,
): Promise<StaffOnboardingTask> {
  const res = await fetch(`${BASE}/onboarding/${onboardingId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error)
  }
  const json = await res.json()
  return json.task
}
