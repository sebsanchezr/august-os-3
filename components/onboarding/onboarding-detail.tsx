'use client'

import { useState } from 'react'
import { X, ExternalLink, Copy, Check } from 'lucide-react'
import type { Onboarding } from '@/lib/types'
import { ONBOARDING_STATUS_LABELS } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { launchOnboarding, resendOnboardingInvoice, updateOnboarding } from '@/lib/onboarding-client'

function portalUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_ONBOARDING_PORTAL_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/welcome/${token}`
}

export default function OnboardingDetail({
  onboarding,
  onClose,
  onUpdated,
}: {
  onboarding: Onboarding
  onClose: () => void
  onUpdated: (updated: Onboarding) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleLaunch() {
    setBusy(true)
    setError(null)
    try {
      const updated = await launchOnboarding(onboarding.id)
      onUpdated(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch')
    } finally {
      setBusy(false)
    }
  }

  async function handleResendInvoice() {
    setBusy(true)
    setError(null)
    try {
      await resendOnboardingInvoice(onboarding.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invoice')
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkPaid() {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateOnboarding(onboarding.id, { paid: true, invoice_paid_at: new Date().toISOString() })
      onUpdated(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setBusy(false)
    }
  }

  async function handleAdvance(status: Onboarding['status']) {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateOnboarding(onboarding.id, { status })
      onUpdated(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setBusy(false)
    }
  }

  function copyPortalLink() {
    navigator.clipboard.writeText(portalUrl(onboarding.portal_token))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="w-[440px] h-full bg-[#0c0d11] border-l border-[#1c2035] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-[#e4e6f0]">{onboarding.company_name}</h2>
            <p className="text-xs text-[#636780] mt-1">{onboarding.service}</p>
          </div>
          <button onClick={onClose} className="text-[#636780] hover:text-[#e4e6f0]">
            <X size={18} />
          </button>
        </div>

        <div className="mb-6 flex items-center gap-2">
          <span className="text-[10px] px-2 py-1 rounded bg-[#1c2035] text-[#8b8fa8]">
            {ONBOARDING_STATUS_LABELS[onboarding.status]}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              onboarding.health === 'red' ? 'bg-red-500' : onboarding.health === 'amber' ? 'bg-amber-500' : 'bg-green-500'
            }`}
          />
          <span className="text-xs text-green-400 tabular-nums ml-auto">
            {formatCurrency(onboarding.fee_amount, onboarding.currency)}
          </span>
        </div>

        <Section title="Contact">
          <Row label="Name" value={onboarding.contact_name ?? '—'} />
          <Row label="Email" value={onboarding.contact_email} />
        </Section>

        <Section title="Contract & Invoice">
          <Row label="Contract sent" value={fmt(onboarding.contract_sent_at)} />
          <Row label="Signed" value={fmt(onboarding.contract_signed_at)} />
          <Row label="Invoice sent" value={fmt(onboarding.invoice_sent_at)} />
          <Row label="Paid" value={onboarding.paid ? `Yes, ${fmt(onboarding.invoice_paid_at)}` : 'No'} />
          {onboarding.stripe_invoice_url && (
            <a
              href={onboarding.stripe_invoice_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-1"
            >
              View Stripe invoice <ExternalLink size={11} />
            </a>
          )}
        </Section>

        <Section title="Portal">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8b8fa8] truncate flex-1">{portalUrl(onboarding.portal_token)}</span>
            <button onClick={copyPortalLink} className="text-[#636780] hover:text-[#e4e6f0] shrink-0">
              {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            </button>
          </div>
          <Row label="Opened" value={fmt(onboarding.portal_opened_at)} />
          <Row label="Form completed" value={fmt(onboarding.form_completed_at)} />
          <Row label="Kickoff" value={fmt(onboarding.kickoff_at)} />
        </Section>

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <div className="space-y-2 mt-6">
          {onboarding.status === 'contract_sent' && !onboarding.paid && (
            <button
              onClick={handleResendInvoice}
              disabled={busy}
              className="w-full bg-[#1c2035] hover:bg-[#252a45] text-[#e4e6f0] px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              Resend invoice
            </button>
          )}
          {!onboarding.paid && (
            <button
              onClick={handleMarkPaid}
              disabled={busy}
              className="w-full bg-[#1c2035] hover:bg-[#252a45] text-[#e4e6f0] px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              Mark paid manually (bank transfer, etc.)
            </button>
          )}
          {onboarding.status === 'kickoff_booked' && (
            <button
              onClick={() => handleAdvance('kickoff_held')}
              disabled={busy}
              className="w-full bg-[#1c2035] hover:bg-[#252a45] text-[#e4e6f0] px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              Mark kickoff held
            </button>
          )}
          {onboarding.status === 'kickoff_held' && (
            <button
              onClick={() => handleAdvance('building')}
              disabled={busy}
              className="w-full bg-[#1c2035] hover:bg-[#252a45] text-[#e4e6f0] px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              Mark build started
            </button>
          )}
          {(onboarding.status === 'building' || onboarding.status === 'kickoff_held') && (
            <button
              onClick={handleLaunch}
              disabled={busy || !onboarding.paid}
              title={!onboarding.paid ? 'Invoice must be paid before launch' : undefined}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            >
              {onboarding.paid ? 'Launch → hand to Accounts' : 'Launch (invoice unpaid)'}
            </button>
          )}
          {onboarding.status === 'launched' && (
            <button
              onClick={() => handleAdvance('handed_off')}
              disabled={busy}
              className="w-full bg-[#1c2035] hover:bg-[#252a45] text-[#e4e6f0] px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              Confirm handed off to Accounts
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function fmt(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#636780] mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#636780]">{label}</span>
      <span className="text-xs text-[#e4e6f0]">{value}</span>
    </div>
  )
}
