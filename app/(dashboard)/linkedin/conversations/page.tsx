'use client'

import { useEffect, useState, useCallback } from 'react'
import { timeAgo } from '@/lib/utils'
import { MessageSquare, Activity } from 'lucide-react'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#181b27] rounded-lg ${className}`} />
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-10 h-10 rounded-full bg-[#181b27] flex items-center justify-center mb-3">
        <Activity className="w-4 h-4 text-[#3d4060]" />
      </div>
      <p className="text-sm text-[#3d4060]">{label}</p>
    </div>
  )
}

const CLASSIFICATION_PILL: Record<string, string> = {
  positive: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  question: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  objection: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  not_now: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  not_interested: 'bg-red-500/10 text-red-400 border border-red-500/20',
}

const DEFAULT_PILL = 'bg-[#1c2035] text-[#636780] border border-[#2a2d40]'

function classificationLabel(c: string | null): string {
  if (!c) return 'Unknown'
  return c.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
}

export default function LinkedInConversations() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/linkedin/stats')
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const conversations: any[] = data?.conversations ?? []

  return (
    <div className="p-6 min-h-full">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <MessageSquare className="w-5 h-5 text-[#636780]" />
        <h1 className="text-xl font-semibold text-[#e4e6f0]">LinkedIn Conversations</h1>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-5 flex items-center justify-between">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={fetchData}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div className="rounded-xl border border-[#1c2035] bg-[#0f1018] p-5">
        <p className="text-sm font-medium text-[#e4e6f0] mb-4 flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-[#636780]" />
          All Conversations
          {!loading && (
            <span className="ml-auto text-xs text-[#636780]">{conversations.length} total</span>
          )}
        </p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState label="No conversations yet. Replies will appear here once leads respond." />
        ) : (
          <>
            {/* Header row */}
            <div className="grid grid-cols-12 gap-2 px-3 pb-2 border-b border-[#1c2035]">
              <p className="text-[10px] font-medium text-[#3d4060] uppercase tracking-wider col-span-3">Name</p>
              <p className="text-[10px] font-medium text-[#3d4060] uppercase tracking-wider col-span-2">Company</p>
              <p className="text-[10px] font-medium text-[#3d4060] uppercase tracking-wider col-span-2">Classification</p>
              <p className="text-[10px] font-medium text-[#3d4060] uppercase tracking-wider col-span-3">Last Message</p>
              <p className="text-[10px] font-medium text-[#3d4060] uppercase tracking-wider col-span-2 text-right">Updated</p>
            </div>

            <div className="space-y-1 mt-2">
              {conversations.map((conv: any) => {
                const pillClass =
                  CLASSIFICATION_PILL[conv.classification] ?? DEFAULT_PILL
                return (
                  <div
                    key={conv.id}
                    className="grid grid-cols-12 gap-2 bg-[#181b27] rounded-lg px-3 py-2.5 items-center"
                  >
                    <p className="col-span-3 text-sm text-[#e4e6f0] font-medium truncate">
                      {conv.first_name ?? ''} {conv.last_name ?? ''}
                    </p>
                    <p className="col-span-2 text-sm text-[#636780] truncate">
                      {conv.company_name ?? ''}
                    </p>
                    <div className="col-span-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${pillClass}`}>
                        {classificationLabel(conv.classification)}
                      </span>
                    </div>
                    <p className="col-span-3 text-xs text-[#636780] truncate">
                      {conv.last_reply ?? <span className="text-[#3d4060]">No message</span>}
                    </p>
                    <p className="col-span-2 text-xs text-[#3d4060] text-right">
                      {conv.updated_at ? timeAgo(conv.updated_at) : ''}
                    </p>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
