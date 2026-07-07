'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { fetchIssues, updateIssue } from '@/lib/accounts-client'
import type { ClientIssue } from '@/lib/types'
import { CLIENT_ISSUE_CATEGORY_LABELS } from '@/lib/types'

const STATUS_COLUMNS = [
  { status: 'open',       label: 'Open' },
  { status: 'resolving',  label: 'Resolving' },
  { status: 'resolved',   label: 'Resolved' },
] as const

const SEVERITY_COLOUR: Record<string, string> = {
  trust_threatening: 'bg-red-950/50 border-red-900/50 text-red-300',
  major:             'bg-amber-950/30 border-amber-900/40 text-amber-300',
  minor:             'bg-[#181b27] border-[#1c2035] text-[#e4e6f0]',
}

const SEVERITY_BADGE: Record<string, string> = {
  trust_threatening: 'bg-red-900/60 text-red-300',
  major:             'bg-amber-900/50 text-amber-300',
  minor:             'bg-[#1c2035] text-[#636780]',
}

export default function IssuesBoard() {
  const [issues, setIssues] = useState<ClientIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)

  useEffect(() => {
    fetchIssues()
      .then(setIssues)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function moveIssue(issue: ClientIssue, newStatus: string) {
    setMovingId(issue.id)
    try {
      const updated = await updateIssue(issue.id, { status: newStatus } as Partial<ClientIssue>)
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
    } catch (e: unknown) {
      alert((e as Error).message)
    } finally {
      setMovingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#636780]" size={20} />
      </div>
    )
  }

  const trustThreateningOpen = issues.filter(
    (i) => i.severity === 'trust_threatening' && i.status !== 'resolved',
  )

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-[#e4e6f0] font-semibold text-lg flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-400" />
          Issues
        </h1>
        <p className="text-[#636780] text-xs mt-0.5">
          {issues.filter((i) => i.status !== 'resolved').length} open or resolving
        </p>
      </div>

      {/* Urgent alert bar */}
      {trustThreateningOpen.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-900/50 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle size={13} className="shrink-0" />
          <span>
            <strong>{trustThreateningOpen.length}</strong> trust-threatening issue{trustThreateningOpen.length > 1 ? 's' : ''} open.
            Genflow rule: respond same day, personally. These must be founder-handled.
          </span>
        </div>
      )}

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {/* Kanban columns */}
      <div className="grid grid-cols-3 gap-4">
        {STATUS_COLUMNS.map(({ status, label }) => {
          const col = issues
            .filter((i) => i.status === status)
            .sort((a, b) => {
              const sev = { trust_threatening: 0, major: 1, minor: 2 }
              return (sev[a.severity as keyof typeof sev] ?? 2) - (sev[b.severity as keyof typeof sev] ?? 2)
            })

          return (
            <div key={status}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[9px] font-bold tracking-widest uppercase text-[#636780]">{label}</p>
                <span className="text-[10px] text-[#3d4060]">{col.length}</span>
              </div>

              <div className="space-y-2">
                {col.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    moving={movingId === issue.id}
                    onMove={moveIssue}
                  />
                ))}
                {col.length === 0 && (
                  <div className="text-center text-[#3d4060] text-xs py-8 rounded-xl border border-dashed border-[#1c2035]">
                    --
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function IssueCard({
  issue,
  moving,
  onMove,
}: {
  issue: ClientIssue
  moving: boolean
  onMove: (issue: ClientIssue, status: string) => void
}) {
  return (
    <div className={`rounded-lg border p-3 text-xs ${SEVERITY_COLOUR[issue.severity] ?? SEVERITY_COLOUR.minor}`}>
      {/* Client link and category */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link
          href={`/accounts/${(issue as ClientIssue & { client_id: string }).client_id}`}
          className="font-medium hover:underline truncate"
          onClick={(e) => e.stopPropagation()}
        >
          {(issue as ClientIssue & { clients?: { name: string } }).clients?.name ?? 'Client'}
        </Link>
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${SEVERITY_BADGE[issue.severity]}`}>
          {issue.severity.replace('_', ' ')}
        </span>
      </div>

      <p className="text-[10px] opacity-70 mb-2">
        {CLIENT_ISSUE_CATEGORY_LABELS[issue.category as keyof typeof CLIENT_ISSUE_CATEGORY_LABELS] ?? issue.category}
      </p>

      <p className="leading-snug opacity-80 line-clamp-3">{issue.description}</p>

      {/* Resolution requirements */}
      {issue.status === 'resolving' && (
        <div className="mt-2 pt-2 border-t border-current/10 text-[9px] opacity-60">
          {!issue.root_cause && <p className="text-amber-400">Root cause required to resolve</p>}
          {!issue.process_fix && <p className="text-amber-400">Process fix required to resolve</p>}
        </div>
      )}

      {/* Actions */}
      {!moving && issue.status !== 'resolved' && (
        <div className="mt-2 pt-2 border-t border-current/10 flex gap-2">
          {issue.status === 'open' && (
            <button
              onClick={() => onMove(issue, 'resolving')}
              className="text-[9px] text-indigo-400 hover:text-indigo-300"
            >
              Mark resolving
            </button>
          )}
          {issue.status === 'resolving' && (
            <button
              onClick={() => onMove(issue, 'resolved')}
              className="text-[9px] text-emerald-400 hover:text-emerald-300"
            >
              Mark resolved
            </button>
          )}
        </div>
      )}
      {moving && <Loader2 size={10} className="animate-spin mt-2 text-current/50" />}
    </div>
  )
}
