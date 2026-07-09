// Client-side fetch helpers for the cross-channel Pipeline + Acquisition Command Center.
// Mirrors the pattern in lib/accounts-client.ts.

import type { PipelineDeal, PipelineStage, SourceChannel, AcquisitionRollup, GovDashboard, GovTender, GovTenderStatus } from './types'

const PIPELINE_BASE = '/api/pipeline'

export async function fetchPipeline(filters?: { stage?: PipelineStage; channel?: SourceChannel }): Promise<PipelineDeal[]> {
  const params = new URLSearchParams()
  if (filters?.stage) params.set('stage', filters.stage)
  if (filters?.channel) params.set('channel', filters.channel)
  const qs = params.toString()
  const res = await fetch(`${PIPELINE_BASE}${qs ? `?${qs}` : ''}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load pipeline')
  const json = await res.json()
  return json.deals
}

export async function createPipelineDeal(body: Partial<PipelineDeal> & { prospect_name: string; source_channel: SourceChannel }): Promise<PipelineDeal> {
  const res = await fetch(PIPELINE_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to create pipeline deal')
  const json = await res.json()
  return json.deal
}

export async function updatePipelineDeal(id: string, patch: Partial<PipelineDeal>): Promise<PipelineDeal> {
  const res = await fetch(`${PIPELINE_BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Failed to update pipeline deal')
  const json = await res.json()
  return json.deal
}

export async function deletePipelineDeal(id: string): Promise<void> {
  const res = await fetch(`${PIPELINE_BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete pipeline deal')
}

export async function fetchAcquisition(window: '7d' | '30d' | 'qtd' = '7d'): Promise<AcquisitionRollup> {
  const res = await fetch(`/api/acquisition?window=${window}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load acquisition rollup')
  return res.json()
}

export async function fetchGovDashboard(): Promise<GovDashboard> {
  const res = await fetch('/api/gov-contracts', { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load gov contracts dashboard')
  return res.json()
}

export async function fetchGovTenders(status?: GovTenderStatus | 'all'): Promise<GovTender[]> {
  const qs = status && status !== 'all' ? `?status=${status}` : ''
  const res = await fetch(`/api/gov-contracts/bids${qs}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load gov tenders')
  const json = await res.json()
  return json.tenders
}

export async function updateGovTenderStatus(notice_id: string, status: GovTenderStatus, notes?: string): Promise<void> {
  const res = await fetch('/api/gov-contracts/bids', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notice_id, status, notes }),
  })
  if (!res.ok) throw new Error('Failed to update tender status')
}

export async function fetchGovBidDocumentUrl(notice_id: string): Promise<string> {
  const res = await fetch(`/api/gov-contracts/bids/document?notice_id=${encodeURIComponent(notice_id)}`, { cache: 'no-store' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Failed to load bid document')
  return json.url
}

export async function uploadGovBidDocument(notice_id: string, file: File): Promise<void> {
  const form = new FormData()
  form.set('notice_id', notice_id)
  form.set('file', file)
  const res = await fetch('/api/gov-contracts/bids/document', { method: 'POST', body: form })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error ?? 'Failed to upload bid document')
  }
}
