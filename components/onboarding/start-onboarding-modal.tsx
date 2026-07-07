'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { PipelineDeal } from '@/lib/types'
import { startOnboarding } from '@/lib/onboarding-client'

export default function StartOnboardingModal({
  deal,
  onClose,
  onStarted,
}: {
  deal: PipelineDeal
  onClose: () => void
  onStarted: () => void
}) {
  const [companyName, setCompanyName] = useState(deal.company || deal.prospect_name)
  const [contactName, setContactName] = useState(deal.prospect_name)
  const [contactEmail, setContactEmail] = useState('')
  const [service, setService] = useState('')
  const [deliverables, setDeliverables] = useState('')
  const [feeAmount, setFeeAmount] = useState(String(deal.setup_value > 0 ? deal.setup_value : deal.mrr_value))
  const [currency, setCurrency] = useState(deal.currency)
  const [termMonths, setTermMonths] = useState('3')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await startOnboarding({
        deal_id: deal.id,
        company_name: companyName,
        contact_name: contactName,
        contact_email: contactEmail,
        service,
        deliverables,
        fee_amount: Number(feeAmount),
        currency,
        term_months: Number(termMonths),
      })
      onStarted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start onboarding')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[#0c0d11] border border-[#1c2035] rounded-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-[#e4e6f0]">Start Onboarding</h2>
          <button onClick={onClose} className="text-[#636780] hover:text-[#e4e6f0]">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-[#636780] mb-5">
          Sends the master contract via SignWell and the first 30-day invoice via Stripe. The client portal
          unlocks the moment they sign. Recurring invoices after the first one are not yet automated — see the
          onboarding detail panel once launched.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required
            placeholder="Company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className={inputClass}
          />
          <input
            placeholder="Contact name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className={inputClass}
          />
          <input
            required
            type="email"
            placeholder="Contact email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className={inputClass}
          />
          <input
            required
            placeholder="Service (e.g. Paid Ads Management)"
            value={service}
            onChange={(e) => setService(e.target.value)}
            className={inputClass}
          />
          <textarea
            rows={2}
            placeholder="Deliverables for the Statement of Work (e.g. Meta + Google ads management, 4 ad creatives/month)"
            value={deliverables}
            onChange={(e) => setDeliverables(e.target.value)}
            className={inputClass}
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              required
              type="number"
              min="1"
              placeholder="Fee / 30 days"
              value={feeAmount}
              onChange={(e) => setFeeAmount(e.target.value)}
              className={inputClass}
            />
            <input
              placeholder="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={inputClass}
            />
            <input
              type="number"
              min="1"
              placeholder="Min term (mo)"
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              className={inputClass}
            />
          </div>
          <p className="text-[10px] text-[#636780]">
            Fee is billed every 30 days starting once the client's campaigns go live — there's no fixed start date to set here.
          </p>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {busy ? 'Starting...' : 'Send contract + invoice'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputClass =
  'w-full bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] placeholder:text-[#3d4060] focus:outline-none focus:border-indigo-500'
