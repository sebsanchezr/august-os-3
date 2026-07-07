'use client'

import { useEffect, useMemo, useState } from 'react'
import { KpiCard } from '@/components/kpi-card'
import OnboardingDetail from '@/components/onboarding/onboarding-detail'
import { fetchOnboardings } from '@/lib/onboarding-client'
import { formatCurrency } from '@/lib/utils'
import type { Onboarding, OnboardingStatus } from '@/lib/types'
import { ONBOARDING_STATUS_LABELS, ONBOARDING_STATUS_ORDER } from '@/lib/types'

const COLUMN_ACCENT: Record<OnboardingStatus, string> = {
  won:            'border-l-[#636780]',
  contract_sent:  'border-l-sky-500',
  signed:         'border-l-indigo-500',
  form_completed: 'border-l-blue-500',
  kickoff_booked: 'border-l-purple-500',
  kickoff_held:   'border-l-violet-500',
  building:       'border-l-amber-500',
  launched:       'border-l-green-500',
  handed_off:     'border-l-emerald-600',
}

export default function OnboardingPage() {
  const [onboardings, setOnboardings] = useState<Onboarding[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Onboarding | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await fetchOnboardings()
      setOnboardings(data)
    } catch {
      // leave existing data visible on refresh failure
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const inFlight = onboardings.filter((o) => o.status !== 'handed_off')
  const redHealth = onboardings.filter((o) => o.health === 'red' && o.status !== 'handed_off')
  const unpaid = onboardings.filter((o) => !o.paid && o.status !== 'handed_off')
  const launchedThisWeek = onboardings.filter((o) => {
    if (!o.launched_at) return false
    const days = (Date.now() - new Date(o.launched_at).getTime()) / (1000 * 60 * 60 * 24)
    return days <= 7
  })

  function handleUpdated(updated: Onboarding) {
    setOnboardings((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
    setSelected(updated)
  }

  return (
    <div className="p-6 min-h-screen bg-[#08090c]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#e4e6f0]">Onboarding</h1>
        <p className="text-xs text-[#636780] mt-1">
          From closed won to handed off. Signed unlocks the client portal — payment gates launch.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="In Flight" value={inFlight.length} accent="blue" />
        <KpiCard label="Unpaid" value={unpaid.length} accent={unpaid.length > 0 ? 'amber' : 'default'} subtext="cannot launch until paid" />
        <KpiCard label="Needs Attention" value={redHealth.length} accent={redHealth.length > 0 ? 'amber' : 'default'} subtext="stalled onboardings" />
        <KpiCard label="Launched, Last 7d" value={launchedThisWeek.length} accent="green" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-sm text-[#636780]">Loading onboarding pipeline...</span>
        </div>
      ) : (
        <div className="grid grid-cols-9 gap-3 overflow-x-auto pb-4">
          {ONBOARDING_STATUS_ORDER.map((status) => {
            const items = onboardings.filter((o) => o.status === status)
            return (
              <div key={status} className="min-w-[170px]">
                <div className={`flex items-center justify-between border-l-2 ${COLUMN_ACCENT[status]} pl-2 mb-2`}>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#e4e6f0]">
                    {ONBOARDING_STATUS_LABELS[status]}
                  </span>
                  <span className="text-[11px] text-[#636780] tabular-nums">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setSelected(o)}
                      className={`w-full text-left bg-[#10121a] border rounded-lg p-3 ${
                        o.health === 'red' ? 'border-red-500/40' : o.health === 'amber' ? 'border-amber-500/40' : 'border-[#1c2035]'
                      }`}
                    >
                      <p className="text-xs font-medium text-[#e4e6f0] truncate">{o.company_name}</p>
                      <p className="text-[10px] text-[#636780] truncate">{o.service}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${o.paid ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          {o.paid ? 'Paid' : 'Unpaid'}
                        </span>
                        <span className="text-[11px] text-green-400 tabular-nums">{formatCurrency(o.fee_amount, o.currency)}</span>
                      </div>
                    </button>
                  ))}
                  {items.length === 0 && <div className="text-[10px] text-[#3a3d52] italic px-1">Empty</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <OnboardingDetail onboarding={selected} onClose={() => setSelected(null)} onUpdated={handleUpdated} />
      )}
    </div>
  )
}
