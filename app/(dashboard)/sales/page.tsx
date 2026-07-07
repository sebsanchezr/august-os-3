'use client'

import { useEffect, useState } from 'react'
import { Plus, Filter } from 'lucide-react'
import { fetchSalesCallsList } from '@/lib/sales-calls-client'
import type { SalesCall, SalesCallStatus, SalesCallType } from '@/lib/types'
import LogSalesCallDrawer from '@/components/sales/log-sales-call-drawer'
import SalesCallDetailSlideOver from '@/components/sales/sales-call-detail'

export default function SalesPage() {
  const [calls, setCalls] = useState<SalesCall[]>([])
  const [loading, setLoading] = useState(true)
  const [logDrawerOpen, setLogDrawerOpen] = useState(false)
  const [selectedCall, setSelectedCall] = useState<SalesCall | null>(null)
  const [statusFilter, setStatusFilter] = useState<SalesCallStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<SalesCallType | 'all'>('all')

  async function load() {
    setLoading(true)
    try {
      const data = await fetchSalesCallsList({
        status: statusFilter === 'all' ? undefined : statusFilter,
        callType: typeFilter === 'all' ? undefined : typeFilter,
      })
      setCalls(data)
    } catch {
      console.error('Failed to load sales calls')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [statusFilter, typeFilter])

  function onCallLogged() {
    setLogDrawerOpen(false)
    load()
  }

  function onCallUpdated() {
    setSelectedCall(null)
    load()
  }

  return (
    <div className="min-h-screen bg-[#08090c] px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#e4e6f0] tracking-tight">Sales Calls</h1>
            <p className="text-sm text-[#636780] mt-1">Track and learn from every discovery and pitch call</p>
          </div>
          <button
            onClick={() => setLogDrawerOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus style={{ width: 16, height: 16 }} />
            Log Sales Call
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SalesCallStatus | 'all')}
            className="text-xs bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-1.5 text-[#e4e6f0]"
          >
            <option value="all">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="held">Held</option>
            <option value="analyzed">Analyzed</option>
            <option value="no_show">No Show</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as SalesCallType | 'all')}
            className="text-xs bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-1.5 text-[#e4e6f0]"
          >
            <option value="all">All types</option>
            <option value="discovery">Discovery</option>
            <option value="pitch">Pitch</option>
            <option value="followup">Follow-up</option>
            <option value="onboarding">Onboarding</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-sm text-[#636780]">Loading sales calls...</p>
        </div>
      ) : (
        <div className="bg-[#10121a] border border-[#1c2035] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1c2035]">
                <th className="text-left px-6 py-4 text-xs font-semibold text-[#636780] uppercase tracking-wide">Prospect</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-[#636780] uppercase tracking-wide">Type</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-[#636780] uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-[#636780] uppercase tracking-wide">Scheduled / Held</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-[#636780] uppercase tracking-wide">Score</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-[#636780] uppercase tracking-wide">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {calls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-[#636780]">
                    No sales calls yet
                  </td>
                </tr>
              ) : (
                calls.map((call) => (
                  <tr
                    key={call.id}
                    onClick={() => setSelectedCall(call)}
                    className="border-b border-[#1c2035] hover:bg-[#181b27] cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-[#e4e6f0]">{call.pipeline_deals?.prospect_name}</p>
                      <p className="text-xs text-[#636780]">{call.pipeline_deals?.company}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 capitalize">
                        {call.call_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded capitalize ${
                        call.status === 'held' ? 'bg-green-500/10 text-green-400' :
                        call.status === 'scheduled' ? 'bg-blue-500/10 text-blue-400' :
                        call.status === 'analyzed' ? 'bg-indigo-500/10 text-indigo-400' :
                        'bg-amber-500/10 text-amber-400'
                      }`}>
                        {call.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-[#636780]">
                      {call.held_at
                        ? new Date(call.held_at).toLocaleDateString('en-GB')
                        : call.scheduled_at
                        ? new Date(call.scheduled_at).toLocaleDateString('en-GB')
                        : '-'}
                    </td>
                    <td className="px-6 py-4">
                      {call.analysis ? (
                        <span className="text-xs font-semibold text-[#e4e6f0]">
                          {call.analysis.overall_score}/10
                        </span>
                      ) : (
                        <span className="text-xs text-[#636780]">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {call.outcome ? (
                        <span className="text-xs px-2 py-1 rounded capitalize bg-[#1c2035] text-[#8b8fa8]">
                          {call.outcome}
                        </span>
                      ) : (
                        <span className="text-xs text-[#636780]">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Log drawer */}
      {logDrawerOpen && (
        <LogSalesCallDrawer
          onClose={() => setLogDrawerOpen(false)}
          onSaved={onCallLogged}
        />
      )}

      {/* Detail slide-over */}
      {selectedCall && (
        <SalesCallDetailSlideOver
          call={selectedCall}
          onClose={() => setSelectedCall(null)}
          onUpdated={onCallUpdated}
        />
      )}
    </div>
  )
}
