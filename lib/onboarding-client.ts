// Client-side fetch helpers for the Onboarding pipeline board.
// Mirrors the pattern in lib/pipeline-client.ts.

import type { Onboarding, OnboardingStatus } from './types'

const BASE = '/api/onboarding'

export async function fetchOnboardings(status?: OnboardingStatus): Promise<Onboarding[]> {
  const qs = status ? `?status=${status}` : ''
  const res = await fetch(`${BASE}${qs}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load onboardings')
  const json = await res.json()
  return json.onboardings
}

export type StartOnboardingInput = {
  deal_id?: string
  company_name: string
  contact_name?: string
  contact_email: string
  service: string
  deliverables?: string
  fee_amount: number
  currency?: string
  term_months?: number
}

export async function startOnboarding(input: StartOnboardingInput): Promise<Onboarding> {
  const res = await fetch(`${BASE}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to start onboarding')
  return json.onboarding
}

export async function updateOnboarding(id: string, patch: Partial<Onboarding>): Promise<Onboarding> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to update onboarding')
  return json.onboarding
}

export async function launchOnboarding(id: string): Promise<Onboarding> {
  const res = await fetch(`${BASE}/${id}/launch`, { method: 'POST' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to launch onboarding')
  return json.onboarding
}

export async function resendOnboardingInvoice(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}/resend-invoice`, { method: 'POST' })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error || 'Failed to resend invoice')
  }
}
