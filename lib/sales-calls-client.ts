import type { SalesCall, SalesCallOutcome } from '@/lib/types'

export async function fetchSalesCall(id: string): Promise<SalesCall> {
  const res = await fetch(`/api/sales-calls/${id}`)
  if (!res.ok) throw new Error('Failed to fetch sales call')
  const { sales_call } = await res.json()
  return sales_call
}

export async function fetchSalesCallsByDeal(dealId: string): Promise<SalesCall[]> {
  const res = await fetch(`/api/sales-calls?deal_id=${dealId}`)
  if (!res.ok) throw new Error('Failed to fetch sales calls')
  const { sales_calls } = await res.json()
  return sales_calls
}

export async function fetchSalesCallsList(filters?: {
  dealId?: string
  status?: string
  owner?: string
  callType?: string
  from?: string
  to?: string
}): Promise<SalesCall[]> {
  const params = new URLSearchParams()
  if (filters?.dealId) params.append('deal_id', filters.dealId)
  if (filters?.status) params.append('status', filters.status)
  if (filters?.owner) params.append('owner', filters.owner)
  if (filters?.callType) params.append('call_type', filters.callType)
  if (filters?.from) params.append('from', filters.from)
  if (filters?.to) params.append('to', filters.to)

  const res = await fetch(`/api/sales-calls?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch sales calls')
  const { sales_calls } = await res.json()
  return sales_calls
}

export async function createSalesCall(dealId: string, payload: {
  callType?: string
  sequence?: number
  scheduledAt?: string
  deckUrl?: string
  ownerProfileId?: string
}): Promise<SalesCall> {
  const res = await fetch('/api/sales-calls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deal_id: dealId,
      call_type: payload.callType || 'discovery',
      sequence: payload.sequence || 1,
      scheduled_at: payload.scheduledAt || null,
      deck_url: payload.deckUrl || null,
      owner_profile_id: payload.ownerProfileId || null,
    }),
  })
  if (!res.ok) throw new Error('Failed to create sales call')
  const { sales_call } = await res.json()
  return sales_call
}

export async function updateSalesCall(
  id: string,
  payload: Partial<SalesCall>
): Promise<SalesCall> {
  const res = await fetch(`/api/sales-calls/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to update sales call')
  const { sales_call } = await res.json()
  return sales_call
}

export async function logSalesCall(dealId: string, payload: {
  callType: string
  heldAt?: string
  durationMinutes?: number
  ownerProfileId?: string
  recordingUrl?: string
  deckUrl?: string
  transcript?: string
  outcome?: SalesCallOutcome
  nextStep?: string
  notes?: string
}): Promise<SalesCall> {
  const res = await fetch('/api/sales-calls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deal_id: dealId,
      call_type: payload.callType,
      status: payload.transcript ? 'held' : 'scheduled',
      held_at: payload.heldAt ? new Date(payload.heldAt).toISOString() : null,
      duration_minutes: payload.durationMinutes || null,
      owner_profile_id: payload.ownerProfileId || null,
      recording_url: payload.recordingUrl || null,
      deck_url: payload.deckUrl || null,
      transcript: payload.transcript || null,
      outcome: payload.outcome || null,
      next_step: payload.nextStep || null,
      notes: payload.notes || null,
    }),
  })
  if (!res.ok) throw new Error('Failed to log sales call')
  const { sales_call } = await res.json()
  return sales_call
}

export async function requestAnalysis(id: string): Promise<SalesCall> {
  const res = await fetch(`/api/sales-calls/${id}/request-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error('Failed to request analysis')
  const { sales_call } = await res.json()
  return sales_call
}

export async function deleteSalesCall(id: string): Promise<void> {
  const res = await fetch(`/api/sales-calls/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete sales call')
}
