'use client'

import { useState, useCallback } from 'react'
import { Calendar, ExternalLink } from 'lucide-react'
import type { Booking, Deal, DealTier, PaymentType } from '@/lib/types'

type Props = { bookings: Booking[] }

type Column = {
  key: Booking['status']
  label: string
  color: string
  badgeColor: string
  headerAccent: string
}

const COLUMNS: Column[] = [
  {
    key: 'booked',
    label: 'Booked',
    color: 'text-blue-400',
    badgeColor: 'bg-blue-500/10 text-blue-400',
    headerAccent: 'border-blue-500/30',
  },
  {
    key: 'showed',
    label: 'Showed',
    color: 'text-green-400',
    badgeColor: 'bg-green-500/10 text-green-400',
    headerAccent: 'border-green-500/30',
  },
  {
    key: 'no_show',
    label: 'No Show',
    color: 'text-amber-400',
    badgeColor: 'bg-amber-500/10 text-amber-400',
    headerAccent: 'border-amber-500/30',
  },
  {
    key: 'closed',
    label: 'Closed',
    color: 'text-indigo-400',
    badgeColor: 'bg-indigo-500/10 text-indigo-400',
    headerAccent: 'border-indigo-500/30',
  },
]

type DealForm = {
  tier: DealTier
  setup_amount: string
  monthly_amount: string
  payment_type: PaymentType
  stripe_ref: string
}

const DEFAULT_DEAL_FORM: DealForm = {
  tier: 'full_1995',
  setup_amount: '',
  monthly_amount: '',
  payment_type: 'full',
  stripe_ref: '',
}

function formatCallTime(callTime: string | null): string {
  if (!callTime) return 'No time set'
  try {
    return new Date(callTime).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return callTime
  }
}

function formatRevenue(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount)
}

function getDealTotal(deals: Deal[]): number {
  return deals.reduce((sum, d) => sum + (d.setup_amount || 0), 0)
}

export default function PipelineBoard({ bookings: initialBookings }: Props) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [dealModal, setDealModal] = useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null })
  const [dealForm, setDealForm] = useState<DealForm>(DEFAULT_DEAL_FORM)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/bookings')
      if (res.ok) {
        const data = await res.json()
        setBookings(data.bookings ?? [])
      }
    } catch {
      // fallback: no-op
    }
  }, [])

  async function updateStatus(id: string, status: Booking['status']) {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        await refetch()
      }
    } finally {
      setUpdatingId(null)
    }
  }

  function openDealModal(booking: Booking) {
    setDealModal({ open: true, booking })
    setDealForm(DEFAULT_DEAL_FORM)
  }

  function closeDealModal() {
    setDealModal({ open: false, booking: null })
    setDealForm(DEFAULT_DEAL_FORM)
  }

  async function saveDeal() {
    if (!dealModal.booking) return
    setSaving(true)
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: dealModal.booking.id,
          lead_id: dealModal.booking.lead_id,
          caller_id: dealModal.booking.caller_id,
          tier: dealForm.tier,
          setup_amount: parseFloat(dealForm.setup_amount) || 0,
          monthly_amount: parseFloat(dealForm.monthly_amount) || 0,
          payment_type: dealForm.payment_type,
          stripe_ref: dealForm.stripe_ref || null,
          status: 'deposit_paid',
          closed_at: new Date().toISOString(),
        }),
      })
      if (res.ok) {
        // also mark booking as closed
        await fetch(`/api/bookings/${dealModal.booking.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'closed' }),
        })
        closeDealModal()
        await refetch()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-4 h-full">
        {COLUMNS.map((col) => {
          const cards = bookings.filter((b) => b.status === col.key)
          return (
            <div
              key={col.key}
              className="rounded-xl border border-[#1c2035] bg-[#10121a] overflow-hidden flex flex-col"
            >
              {/* Column header */}
              <div className="px-4 py-3 border-b border-[#1c2035] flex items-center justify-between">
                <span className={`text-sm font-medium ${col.color}`}>{col.label}</span>
                <span className="text-xs bg-[#181b27] text-[#636780] px-2 py-0.5 rounded-full tabular-nums">
                  {cards.length}
                </span>
              </div>

              {/* Cards */}
              <div className="p-3 space-y-3 min-h-[200px] flex-1">
                {cards.length === 0 && (
                  <p className="text-xs text-[#636780] text-center pt-6">No bookings</p>
                )}
                {cards.map((booking) => {
                  const dealTotal = booking.deals && booking.deals.length > 0 ? getDealTotal(booking.deals) : null
                  const isUpdating = updatingId === booking.id

                  return (
                    <div
                      key={booking.id}
                      className="bg-[#181b27] rounded-lg border border-[#1c2035] p-4 hover:border-indigo-500/30 transition-colors cursor-pointer"
                    >
                      {/* Top row: name + deal badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-sm font-semibold text-[#e4e6f0] leading-snug">
                          {booking.business_name}
                        </span>
                        {dealTotal !== null && (
                          <span className="text-xs font-medium text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full tabular-nums shrink-0">
                            {formatRevenue(dealTotal)}
                          </span>
                        )}
                      </div>

                      {/* Source + niche badges */}
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        {booking.source === 'cal_com' ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">Cal.com</span>
                        ) : booking.source === 'cold_call' ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Cold Call</span>
                        ) : null}
                        {booking.niche && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#181b27] text-[#636780] border border-[#1c2035] capitalize">{booking.niche}</span>
                        )}
                      </div>

                      {/* Call time */}
                      <div className="flex items-center gap-1 text-xs text-[#636780] mb-1">
                        <Calendar style={{ width: 11, height: 11 }} />
                        <span>{formatCallTime(booking.call_time)}</span>
                      </div>

                      {/* Caller name */}
                      {booking.callers && (
                        <p className="text-xs text-[#636780] mb-2">{booking.callers.name}</p>
                      )}

                      {/* Demo URL */}
                      {booking.demo_url && (
                        <a
                          href={booking.demo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors mb-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Demo
                          <ExternalLink style={{ width: 10, height: 10 }} />
                        </a>
                      )}

                      {/* Action buttons */}
                      {col.key === 'booked' && (
                        <div className="flex gap-2 mt-2">
                          <button
                            disabled={isUpdating}
                            onClick={() => updateStatus(booking.id, 'showed')}
                            className="flex-1 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg px-2 py-1.5 font-medium transition-colors disabled:opacity-50"
                          >
                            Mark Showed
                          </button>
                          <button
                            disabled={isUpdating}
                            onClick={() => updateStatus(booking.id, 'no_show')}
                            className="flex-1 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg px-2 py-1.5 font-medium transition-colors disabled:opacity-50"
                          >
                            No Show
                          </button>
                        </div>
                      )}

                      {col.key === 'showed' && (
                        <div className="mt-2">
                          <button
                            onClick={() => openDealModal(booking)}
                            className="w-full text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg px-2 py-1.5 font-medium transition-colors"
                          >
                            Close Deal
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Deal modal */}
      {dealModal.open && dealModal.booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeDealModal}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-md bg-[#10121a] border border-[#1c2035] rounded-xl p-5 shadow-2xl mx-4">
            <h2 className="text-base font-semibold text-[#e4e6f0] mb-5">
              Close Deal &mdash; {dealModal.booking.business_name}
            </h2>

            <div className="space-y-4">
              {/* Tier */}
              <div>
                <label className="block text-xs text-[#636780] mb-1.5">Package Tier</label>
                <select
                  value={dealForm.tier}
                  onChange={(e) => setDealForm((f) => ({ ...f, tier: e.target.value as DealTier }))}
                  className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="full_1995">Full Package - £1,995</option>
                  <option value="website_950">Website Only - £950</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {/* Setup + Monthly */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#636780] mb-1.5">Setup Amount (£)</label>
                  <input
                    type="number"
                    placeholder="1995"
                    value={dealForm.setup_amount}
                    onChange={(e) => setDealForm((f) => ({ ...f, setup_amount: e.target.value }))}
                    className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#636780] mb-1.5">Monthly Amount (£)</label>
                  <input
                    type="number"
                    placeholder="75"
                    value={dealForm.monthly_amount}
                    onChange={(e) => setDealForm((f) => ({ ...f, monthly_amount: e.target.value }))}
                    className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780] tabular-nums"
                  />
                </div>
              </div>

              {/* Payment type */}
              <div>
                <label className="block text-xs text-[#636780] mb-1.5">Payment Type</label>
                <select
                  value={dealForm.payment_type}
                  onChange={(e) => setDealForm((f) => ({ ...f, payment_type: e.target.value as PaymentType }))}
                  className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="full">Full Payment</option>
                  <option value="deposit">Deposit</option>
                  <option value="clearpay">Clearpay</option>
                </select>
              </div>

              {/* Stripe ref */}
              <div>
                <label className="block text-xs text-[#636780] mb-1.5">Stripe Reference</label>
                <input
                  type="text"
                  placeholder="pi_... or ch_..."
                  value={dealForm.stripe_ref}
                  onChange={(e) => setDealForm((f) => ({ ...f, stripe_ref: e.target.value }))}
                  className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780]"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeDealModal}
                className="flex-1 text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] rounded-lg px-4 py-2 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveDeal}
                disabled={saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Deal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
