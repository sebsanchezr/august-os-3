'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { updatePipelineDeal } from '@/lib/pipeline-client'
import type { PipelineDeal, PipelineStage, SourceChannel } from '@/lib/types'

interface PipelineDealDrawerProps {
  deal: PipelineDeal | null
  onClose: () => void
  onSaved: (updated: PipelineDeal) => void
}

const STAGE_OPTIONS: { value: PipelineStage; label: string }[] = [
  { value: 'new',            label: 'New' },
  { value: 'contacted',      label: 'Contacted' },
  { value: 'positive_reply', label: 'Positive Reply' },
  { value: 'booked',         label: 'Booked' },
  { value: 'showed',         label: 'Showed' },
  { value: 'proposal',       label: 'Proposal' },
  { value: 'won',            label: 'Won' },
  { value: 'lost',           label: 'Lost' },
]

const CHANNEL_OPTIONS: { value: SourceChannel; label: string }[] = [
  { value: 'cold_call',  label: 'Cold Call' },
  { value: 'cold_email', label: 'Cold Email' },
  { value: 'linkedin',   label: 'LinkedIn' },
  { value: 'gov',        label: 'Gov' },
  { value: 'referral',   label: 'Referral' },
  { value: 'expansion',  label: 'Expansion' },
  { value: 'other',      label: 'Other' },
]

type FormState = {
  prospect_name: string
  company: string
  source_channel: SourceChannel
  stage: PipelineStage
  mrr_value: string
  setup_value: string
  probability: string
  currency: string
  expected_close: string
  next_action: string
  next_action_due: string
  notes: string
}

function toForm(deal: PipelineDeal): FormState {
  return {
    prospect_name: deal.prospect_name ?? '',
    company: deal.company ?? '',
    source_channel: deal.source_channel,
    stage: deal.stage,
    mrr_value: deal.mrr_value != null ? String(deal.mrr_value) : '',
    setup_value: deal.setup_value != null ? String(deal.setup_value) : '',
    probability: deal.probability != null ? String(deal.probability) : '',
    currency: deal.currency ?? 'GBP',
    expected_close: deal.expected_close ?? '',
    next_action: deal.next_action ?? '',
    next_action_due: deal.next_action_due ?? '',
    notes: deal.notes ?? '',
  }
}

const inputClass =
  'w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780]'
const labelClass = 'block text-xs font-medium text-[#636780] uppercase tracking-wider'

export default function PipelineDealDrawer({ deal, onClose, onSaved }: PipelineDealDrawerProps) {
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (deal) {
      setForm(toForm(deal))
      setError(null)
    }
  }, [deal])

  if (!deal || !form) return null

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }

  async function handleSave() {
    if (!deal || !form) return
    setSaving(true)
    setError(null)
    try {
      const patch: Partial<PipelineDeal> = {
        prospect_name: form.prospect_name.trim(),
        company: form.company.trim() || null,
        source_channel: form.source_channel,
        stage: form.stage,
        mrr_value: form.mrr_value === '' ? 0 : Number(form.mrr_value),
        setup_value: form.setup_value === '' ? 0 : Number(form.setup_value),
        probability: form.probability === '' ? 0 : Number(form.probability),
        currency: form.currency.trim() || 'GBP',
        expected_close: form.expected_close || null,
        next_action: form.next_action.trim() || null,
        next_action_due: form.next_action_due || null,
        notes: form.notes.trim() || null,
      }
      const updated = await updatePipelineDeal(deal.id, patch)
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[420px] max-w-full bg-[#10121a] border-l border-[#1c2035] z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1c2035] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-[#e4e6f0]">Edit Lead</h2>
            <p className="text-xs text-[#636780] mt-0.5 truncate">{deal.prospect_name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] rounded-lg p-1.5 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <label className={labelClass}>Prospect Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.prospect_name}
              onChange={(e) => set('prospect_name', e.target.value)}
              className={inputClass}
              placeholder="Contact name"
            />
          </div>

          {/* Company */}
          <div className="space-y-1.5">
            <label className={labelClass}>Company</label>
            <input
              type="text"
              value={form.company}
              onChange={(e) => set('company', e.target.value)}
              className={inputClass}
              placeholder="Company name"
            />
          </div>

          {/* Channel + Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Source</label>
              <select
                value={form.source_channel}
                onChange={(e) => set('source_channel', e.target.value as SourceChannel)}
                className={inputClass}
              >
                {CHANNEL_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Stage</label>
              <select
                value={form.stage}
                onChange={(e) => set('stage', e.target.value as PipelineStage)}
                className={inputClass}
              >
                {STAGE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* MRR + Setup */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelClass}>MRR Value</label>
              <input
                type="number"
                value={form.mrr_value}
                onChange={(e) => set('mrr_value', e.target.value)}
                className={`${inputClass} tabular-nums`}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Setup Value</label>
              <input
                type="number"
                value={form.setup_value}
                onChange={(e) => set('setup_value', e.target.value)}
                className={`${inputClass} tabular-nums`}
                placeholder="0"
              />
            </div>
          </div>

          {/* Probability + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Probability (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.probability}
                onChange={(e) => set('probability', e.target.value)}
                className={`${inputClass} tabular-nums`}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Currency</label>
              <input
                type="text"
                value={form.currency}
                onChange={(e) => set('currency', e.target.value.toUpperCase())}
                className={inputClass}
                placeholder="GBP"
              />
            </div>
          </div>

          {/* Expected close */}
          <div className="space-y-1.5">
            <label className={labelClass}>Expected Close</label>
            <input
              type="date"
              value={form.expected_close}
              onChange={(e) => set('expected_close', e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Next action + due */}
          <div className="space-y-1.5">
            <label className={labelClass}>Next Action</label>
            <input
              type="text"
              value={form.next_action}
              onChange={(e) => set('next_action', e.target.value)}
              className={inputClass}
              placeholder="e.g. Send proposal"
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Next Action Due</label>
            <input
              type="date"
              value={form.next_action_due}
              onChange={(e) => set('next_action_due', e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className={labelClass}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={4}
              placeholder="Notes..."
              className={`${inputClass} resize-none`}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1c2035] flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] rounded-lg px-4 py-2 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.prospect_name.trim()}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  )
}
