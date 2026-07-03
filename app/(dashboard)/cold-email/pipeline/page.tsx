'use client'

import { useEffect, useState, useCallback } from 'react'
import { timeAgo } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

type Stage =
  | 'new_reply'
  | 'qualified'
  | 'creatives_in_production'
  | 'creatives_delivered'
  | 'call_booked'
  | 'showed'
  | 'proposal'
  | 'won'
  | 'lost'
  | 'nurture'

type PipelineRow = {
  id: string
  stage: Stage
  stage_entered_at: string
  value: number | null
  notes: string | null
  lead_id: string | null
  ce_leads: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    company: string | null
    website: string | null
    niche: string | null
    source: string | null
    campaign: string | null
    quality_score: number | null
    status: string
    created_at: string
  } | null
}

type Column = {
  key: Stage
  label: string
  color: string
  badgeColor: string
  headerAccent: string
  next?: Stage
  nextLabel?: string
}

const COLUMNS: Column[] = [
  { key: 'new_reply',              label: 'New Reply',           color: 'text-sky-400',     badgeColor: 'bg-sky-500/10 text-sky-400',     headerAccent: 'border-sky-500/30',     next: 'qualified',                  nextLabel: 'Qualify' },
  { key: 'qualified',              label: 'Qualified',           color: 'text-indigo-400',  badgeColor: 'bg-indigo-500/10 text-indigo-400', headerAccent: 'border-indigo-500/30', next: 'creatives_in_production',    nextLabel: 'Start Creatives' },
  { key: 'creatives_in_production', label: 'Creatives: WIP',    color: 'text-amber-400',   badgeColor: 'bg-amber-500/10 text-amber-400',  headerAccent: 'border-amber-500/30',  next: 'creatives_delivered',        nextLabel: 'Mark Delivered' },
  { key: 'creatives_delivered',    label: 'Creatives: Sent',     color: 'text-purple-400',  badgeColor: 'bg-purple-500/10 text-purple-400', headerAccent: 'border-purple-500/30', next: 'call_booked',                nextLabel: 'Book Call' },
  { key: 'call_booked',            label: 'Call Booked',         color: 'text-blue-400',    badgeColor: 'bg-blue-500/10 text-blue-400',    headerAccent: 'border-blue-500/30',   next: 'showed',                     nextLabel: 'Mark Showed' },
  { key: 'showed',                 label: 'Showed',              color: 'text-green-400',   badgeColor: 'bg-green-500/10 text-green-400',  headerAccent: 'border-green-500/30',  next: 'proposal',                   nextLabel: 'Send Proposal' },
  { key: 'proposal',               label: 'Proposal',            color: 'text-teal-400',    badgeColor: 'bg-teal-500/10 text-teal-400',    headerAccent: 'border-teal-500/30',   next: 'won',                        nextLabel: 'Mark Won' },
  { key: 'won',                    label: 'Won',                 color: 'text-emerald-400', badgeColor: 'bg-emerald-500/10 text-emerald-400', headerAccent: 'border-emerald-500/30' },
  { key: 'lost',                   label: 'Lost',                color: 'text-red-400',     badgeColor: 'bg-red-500/10 text-red-400',      headerAccent: 'border-red-500/30' },
  { key: 'nurture',                label: 'Nurture',             color: 'text-zinc-400',    badgeColor: 'bg-zinc-500/10 text-zinc-400',    headerAccent: 'border-zinc-500/30' },
]

// Only show first 8 by default (won/lost/nurture are terminal, still rendered)
const ACTIVE_COLS = COLUMNS.slice(0, 7)
const TERMINAL_COLS = COLUMNS.slice(7)

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return null
  const label = source.replace(/_/g, ' ')
  const cls =
    source === 'cal_booking' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
    source === 'instantly_reply' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
    'bg-[#1c2035] text-[#636780] border-[#1c2035]'
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${cls} capitalize`}>{label}</span>
  )
}

export default function ColdEmailPipeline() {
  const [rows, setRows] = useState<PipelineRow[]>([])
  const [loading, setLoading] = useState(true)
  const [movingId, setMovingId] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/cold-email/pipeline')
      if (res.ok) {
        const d = await res.json()
        setRows(d.pipeline ?? [])
      }
    } catch { /* no-op */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    refetch().finally(() => setLoading(false))
  }, [refetch])

  async function moveStage(id: string, stage: Stage) {
    setMovingId(id)
    try {
      const res = await fetch('/api/cold-email/pipeline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, stage }),
      })
      if (res.ok) await refetch()
    } finally {
      setMovingId(null)
    }
  }

  function renderCard(row: PipelineRow, col: Column) {
    const lead = row.ce_leads
    const days = daysSince(row.stage_entered_at)
    const isMoving = movingId === row.id

    return (
      <div
        key={row.id}
        className="bg-[#181b27] rounded-lg border border-[#1c2035] p-3.5 hover:border-indigo-500/30 transition-colors"
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-sm font-semibold text-[#e4e6f0] leading-snug truncate">
            {lead?.company ?? lead?.email ?? 'Unknown'}
          </p>
          {days > 0 && (
            <span className={`text-[10px] shrink-0 tabular-nums ${days > 7 ? 'text-amber-400' : 'text-[#636780]'}`}>
              {days}d
            </span>
          )}
        </div>

        {lead?.email && (
          <p className="text-xs text-[#636780] truncate mb-1.5">{lead.email}</p>
        )}

        <div className="flex flex-wrap gap-1 mb-2">
          <SourceBadge source={lead?.source ?? null} />
          {lead?.campaign && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1c2035] text-[#636780] capitalize border border-[#1c2035]">
              {lead.campaign}
            </span>
          )}
          {lead?.quality_score != null && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1c2035] text-[#636780] border border-[#1c2035] tabular-nums">
              Q{lead.quality_score}
            </span>
          )}
        </div>

        {col.next && (
          <button
            disabled={isMoving}
            onClick={() => moveStage(row.id, col.next!)}
            className="w-full flex items-center justify-center gap-1 text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg px-2 py-1.5 font-medium transition-colors disabled:opacity-50 mt-1"
          >
            {col.nextLabel}
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    )
  }

  const total = rows.length
  const won = rows.filter((r) => r.stage === 'won').length

  return (
    <div className="p-6 min-h-full">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-[#e4e6f0]">CE Pipeline</h1>
        <div className="flex items-center gap-2">
          <span className="bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-1.5 text-xs text-[#e4e6f0] tabular-nums">
            {total} total
          </span>
          <span className="bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-1.5 text-xs text-green-400 tabular-nums">
            {won} won
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-sm text-[#636780]">Loading pipeline...</span>
        </div>
      ) : (
        <>
          {/* Active stages */}
          <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: `repeat(${ACTIVE_COLS.length}, minmax(160px, 1fr))` }}>
            {ACTIVE_COLS.map((col) => {
              const cards = rows.filter((r) => r.stage === col.key)
              return (
                <div
                  key={col.key}
                  className={`rounded-xl border border-[#1c2035] bg-[#10121a] overflow-hidden flex flex-col`}
                >
                  <div className={`px-3 py-2.5 border-b border-[#1c2035] flex items-center justify-between`}>
                    <span className={`text-xs font-medium ${col.color}`}>{col.label}</span>
                    <span className="text-xs bg-[#181b27] text-[#636780] px-1.5 py-0.5 rounded-full tabular-nums">
                      {cards.length}
                    </span>
                  </div>
                  <div className="p-2.5 space-y-2.5 flex-1 min-h-[120px]">
                    {cards.length === 0 ? (
                      <p className="text-xs text-[#2e3050] text-center pt-4">Empty</p>
                    ) : (
                      cards.map((row) => renderCard(row, col))
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Terminal stages */}
          <div className="grid grid-cols-3 gap-4">
            {TERMINAL_COLS.map((col) => {
              const cards = rows.filter((r) => r.stage === col.key)
              return (
                <div
                  key={col.key}
                  className="rounded-xl border border-[#1c2035] bg-[#10121a] overflow-hidden flex flex-col"
                >
                  <div className="px-3 py-2.5 border-b border-[#1c2035] flex items-center justify-between">
                    <span className={`text-xs font-medium ${col.color}`}>{col.label}</span>
                    <span className="text-xs bg-[#181b27] text-[#636780] px-1.5 py-0.5 rounded-full tabular-nums">
                      {cards.length}
                    </span>
                  </div>
                  <div className="p-2.5 space-y-2.5 flex-1 min-h-[80px]">
                    {cards.length === 0 ? (
                      <p className="text-xs text-[#2e3050] text-center pt-4">Empty</p>
                    ) : (
                      cards.map((row) => renderCard(row, col))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
