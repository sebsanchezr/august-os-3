'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Rocket } from 'lucide-react'
import { KpiCard } from '@/components/kpi-card'
import StartOnboardingModal from '@/components/onboarding/start-onboarding-modal'
import PipelineDealDrawer from '@/components/pipeline-deal-drawer'
import { fetchPipeline, updatePipelineDeal } from '@/lib/pipeline-client'
import { fetchOnboardings } from '@/lib/onboarding-client'
import { ONBOARDING_STATUS_LABELS } from '@/lib/types'
import type { PipelineDeal, PipelineStage, SourceChannel, Onboarding } from '@/lib/types'

const STAGES: { key: PipelineStage; label: string; accent: string }[] = [
  { key: 'new',            label: 'New',            accent: 'border-l-[#636780]' },
  { key: 'contacted',      label: 'Contacted',      accent: 'border-l-sky-500' },
  { key: 'positive_reply', label: 'Positive Reply', accent: 'border-l-indigo-500' },
  { key: 'booked',         label: 'Booked',         accent: 'border-l-blue-500' },
  { key: 'showed',         label: 'Showed',         accent: 'border-l-amber-500' },
  { key: 'proposal',       label: 'Proposal',       accent: 'border-l-purple-500' },
  { key: 'won',            label: 'Won',            accent: 'border-l-green-500' },
  { key: 'lost',           label: 'Lost',           accent: 'border-l-red-500' },
]

const CHANNELS: { key: SourceChannel; label: string }[] = [
  { key: 'cold_call',  label: 'Cold Call' },
  { key: 'cold_email', label: 'Cold Email' },
  { key: 'linkedin',   label: 'LinkedIn' },
  { key: 'gov',        label: 'Gov' },
  { key: 'referral',   label: 'Referral' },
  { key: 'expansion',  label: 'Expansion' },
  { key: 'other',      label: 'Other' },
]

function formatMoney(amount: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function isRotting(deal: PipelineDeal): boolean {
  if (deal.stage === 'won' || deal.stage === 'lost') return false
  if (!deal.next_action) return true
  if (!deal.next_action_due) return false
  return new Date(deal.next_action_due) < new Date()
}

export default function PipelinePage() {
  const [deals, setDeals] = useState<PipelineDeal[]>([])
  const [onboardingByDeal, setOnboardingByDeal] = useState<Record<string, Onboarding>>({})
  const [loading, setLoading] = useState(true)
  const [channelFilter, setChannelFilter] = useState<SourceChannel | 'all'>('all')
  const [movingId, setMovingId] = useState<string | null>(null)
  const [onboardingModalDeal, setOnboardingModalDeal] = useState<PipelineDeal | null>(null)
  const [editingDeal, setEditingDeal] = useState<PipelineDeal | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    // Load pipeline and onboarding independently: the pipeline board must never
    // be blanked just because the (secondary) onboarding lookup fails.
    try {
      const data = await fetchPipeline()
      setDeals(data)
      setLoadError(null)
    } catch (err) {
      setLoadError(
        err instanceof Error && err.message.includes('Unexpected token')
          ? 'Your session looks expired — log in again to see the pipeline.'
          : 'Failed to load pipeline. Try refreshing.'
      )
    } finally {
      setLoading(false)
    }

    try {
      const onboardings = await fetchOnboardings()
      const map: Record<string, Onboarding> = {}
      for (const o of onboardings) {
        if (o.deal_id) map[o.deal_id] = o
      }
      setOnboardingByDeal(map)
    } catch {
      // Onboarding overlay is optional; deals still render without it.
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(
    () => (channelFilter === 'all' ? deals : deals.filter((d) => d.source_channel === channelFilter)),
    [deals, channelFilter]
  )

  const openDeals = filtered.filter((d) => d.stage !== 'won' && d.stage !== 'lost')
  const weightedPipeline = openDeals.reduce((s, d) => s + d.mrr_value * (d.probability / 100), 0)
  const wonMrr = filtered.filter((d) => d.stage === 'won').reduce((s, d) => s + d.mrr_value, 0)
  const rottingCount = openDeals.filter(isRotting).length

  async function moveStage(deal: PipelineDeal, stage: PipelineStage) {
    const patch: Partial<PipelineDeal> = { stage }

    // The API enforces: won needs an mrr_value, lost needs a reason in notes.
    if (stage === 'won' && (!deal.mrr_value || deal.mrr_value <= 0)) {
      const input = window.prompt(`Enter the monthly MRR value for ${deal.prospect_name} to mark this deal won:`)
      const parsed = input ? Number(input) : NaN
      if (!input || Number.isNaN(parsed) || parsed <= 0) return
      patch.mrr_value = parsed
    }
    if (stage === 'lost' && !deal.notes) {
      const reason = window.prompt(`Why was ${deal.prospect_name} lost?`)
      if (!reason) return
      patch.notes = reason
    }

    setMovingId(deal.id)
    try {
      const updated = await updatePipelineDeal(deal.id, patch)
      setDeals((prev) => prev.map((d) => (d.id === deal.id ? updated : d)))
    } catch {
      // no-op: card stays on prior stage, next load() reconciles
    } finally {
      setMovingId(null)
    }
  }

  return (
    <div className="p-6 min-h-screen bg-[#08090c]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#e4e6f0]">Pipeline</h1>
          <p className="text-xs text-[#636780] mt-1">Cross-channel prospect pipeline, all sources in one board</p>
        </div>
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value as SourceChannel | 'all')}
          className="bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-1.5 text-xs text-[#e4e6f0]"
        >
          <option value="all">All channels</option>
          {CHANNELS.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Open Deals" value={openDeals.length} accent="blue" />
        <KpiCard label="Weighted Pipeline" value={formatMoney(weightedPipeline)} accent="amber" subtext="sum of MRR x probability" />
        <KpiCard label="Won MRR" value={formatMoney(wonMrr)} accent="green" />
        <KpiCard label="Rotting Deals" value={rottingCount} accent={rottingCount > 0 ? 'amber' : 'default'} subtext="no next action, or overdue" />
      </div>

      {loadError && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <span className="text-xs text-red-300">{loadError}</span>
          <button
            onClick={() => load()}
            className="text-xs px-2.5 py-1 rounded bg-red-500/20 text-red-200 hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-sm text-[#636780]">Loading pipeline...</span>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageDeals = filtered.filter((d) => d.stage === stage.key)
            return (
              <div key={stage.key} className="w-[200px] shrink-0">
                <div className={`flex items-center justify-between border-l-2 ${stage.accent} pl-2 mb-2`}>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#e4e6f0]">{stage.label}</span>
                  <span className="text-[11px] text-[#636780] tabular-nums">{stageDeals.length}</span>
                </div>
                <div className="space-y-2">
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      onClick={() => setEditingDeal(deal)}
                      className={`bg-[#10121a] border rounded-lg p-3 cursor-pointer hover:border-indigo-500/40 transition-colors ${isRotting(deal) ? 'border-amber-500/40' : 'border-[#1c2035]'}`}
                    >
                      <p className="text-xs font-medium text-[#e4e6f0] truncate">{deal.prospect_name}</p>
                      {deal.company && <p className="text-[10px] text-[#636780] truncate">{deal.company}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1c2035] text-[#8b8fa8]">
                          {CHANNELS.find((c) => c.key === deal.source_channel)?.label ?? deal.source_channel}
                        </span>
                        <span className="text-[11px] text-green-400 tabular-nums">{formatMoney(deal.mrr_value, deal.currency)}</span>
                      </div>
                      {deal.next_action && (
                        <p className="text-[10px] text-[#636780] mt-1.5 truncate">
                          Next: {deal.next_action}
                          {deal.next_action_due && ` (${new Date(deal.next_action_due).toLocaleDateString('en-GB')})`}
                        </p>
                      )}
                      {deal.stage === 'won' && (
                        onboardingByDeal[deal.id] ? (
                          <Link
                            href="/onboarding"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-2 flex items-center justify-center gap-1 text-[10px] px-1.5 py-1 rounded bg-[#1c2035] text-[#8b8fa8] hover:text-[#e4e6f0]"
                          >
                            Onboarding: {ONBOARDING_STATUS_LABELS[onboardingByDeal[deal.id].status]}
                          </Link>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setOnboardingModalDeal(deal) }}
                            className="mt-2 w-full flex items-center justify-center gap-1 text-[10px] px-1.5 py-1 rounded bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30"
                          >
                            <Rocket size={10} /> Start Onboarding
                          </button>
                        )
                      )}
                      <select
                        value={deal.stage}
                        disabled={movingId === deal.id}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => moveStage(deal, e.target.value as PipelineStage)}
                        className="w-full mt-2 bg-[#08090c] border border-[#1c2035] rounded px-1.5 py-1 text-[10px] text-[#e4e6f0]"
                      >
                        {STAGES.map((s) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {stageDeals.length === 0 && (
                    <div className="text-[10px] text-[#3a3d52] italic px-1">Empty</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <PipelineDealDrawer
        deal={editingDeal}
        onClose={() => setEditingDeal(null)}
        onSaved={(updated) => setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))}
      />

      {onboardingModalDeal && (
        <StartOnboardingModal
          deal={onboardingModalDeal}
          onClose={() => setOnboardingModalDeal(null)}
          onStarted={() => {
            setOnboardingModalDeal(null)
            load()
          }}
        />
      )}
    </div>
  )
}
