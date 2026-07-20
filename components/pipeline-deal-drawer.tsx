'use client'

import { useState, useEffect } from 'react'
import { X, Send, Sparkles, Copy, Check } from 'lucide-react'
import { updatePipelineDeal, createPipelineDeal, deletePipelineDeal, draftPipelineFollowUp } from '@/lib/pipeline-client'
import { SOURCE_CHANNELS } from '@/lib/pipeline-constants'
import type { PipelineDeal, PipelineStage, SourceChannel } from '@/lib/types'

interface PipelineDealDrawerProps {
  deal: PipelineDeal | null
  creating?: boolean
  onClose: () => void
  onSaved: (deal: PipelineDeal, isNew?: boolean) => void
  onDeleted?: (id: string) => void
}

const STAGE_OPTIONS: { value: PipelineStage; label: string }[] = [
  { value: 'positive_reply', label: 'Positive Reply' },
  { value: 'booked',         label: 'Booked' },
  { value: 'showed',         label: 'Showed' },
  { value: 'no_show',        label: 'No Show / Cancelled' },
  { value: 'proposal',       label: 'Proposal' },
  { value: 'won',            label: 'Won' },
  { value: 'lost',           label: 'Lost' },
]

const CHANNEL_OPTIONS = SOURCE_CHANNELS

type FormState = {
  prospect_name: string
  company: string
  contact_email: string
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
    contact_email: deal.contact_email ?? '',
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

function emptyForm(): FormState {
  return {
    prospect_name: '',
    company: '',
    contact_email: '',
    source_channel: 'cold_call',
    stage: 'booked',
    mrr_value: '',
    setup_value: '',
    probability: '',
    currency: 'GBP',
    expected_close: '',
    next_action: '',
    next_action_due: '',
    notes: '',
  }
}

const inputClass =
  'w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780]'
const labelClass = 'block text-xs font-medium text-[#636780] uppercase tracking-wider'

export default function PipelineDealDrawer({ deal, creating, onClose, onSaved, onDeleted }: PipelineDealDrawerProps) {
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Follow-up drafting state
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [followUpContext, setFollowUpContext] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [followUpError, setFollowUpError] = useState<string | null>(null)
  const [draftResult, setDraftResult] = useState<{ subject: string; body: string; usedEmailHistory: boolean } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Reset follow-up UI whenever the drawer switches to a different deal.
    setFollowUpOpen(false)
    setFollowUpContext('')
    setDraftResult(null)
    setFollowUpError(null)
    setCopied(false)
  }, [deal?.id])

  useEffect(() => {
    if (deal) {
      setForm(toForm(deal))
      setError(null)
      setConfirmDelete(false)
    } else if (creating) {
      setForm(emptyForm())
      setError(null)
      setConfirmDelete(false)
    }
  }, [deal, creating])

  if ((!deal && !creating) || !form) return null

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }

  async function handleSave() {
    if (!form) return
    setSaving(true)
    setError(null)
    try {
      if (deal) {
        const patch: Partial<PipelineDeal> = {
          prospect_name: form.prospect_name.trim(),
          company: form.company.trim() || null,
          contact_email: form.contact_email.trim() || null,
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
      } else {
        const created = await createPipelineDeal({
          prospect_name: form.prospect_name.trim(),
          company: form.company.trim() || undefined,
          contact_email: form.contact_email.trim() || undefined,
          source_channel: form.source_channel,
          stage: form.stage,
          mrr_value: form.mrr_value === '' ? 0 : Number(form.mrr_value),
          setup_value: form.setup_value === '' ? 0 : Number(form.setup_value),
          probability: form.probability === '' ? 0 : Number(form.probability),
          currency: form.currency.trim() || 'GBP',
          expected_close: form.expected_close || undefined,
          next_action: form.next_action.trim() || undefined,
          next_action_due: form.next_action_due || undefined,
          notes: form.notes.trim() || undefined,
        })
        onSaved(created, true)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deal) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    setError(null)
    try {
      await deletePipelineDeal(deal.id)
      onDeleted?.(deal.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete deal')
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  async function handleDraftFollowUp() {
    if (!deal) return
    setDrafting(true)
    setFollowUpError(null)
    setDraftResult(null)
    try {
      const { draft, usedEmailHistory } = await draftPipelineFollowUp(deal.id, followUpContext.trim())
      setDraftResult({ ...draft, usedEmailHistory })
    } catch (err) {
      setFollowUpError(err instanceof Error ? err.message : 'Failed to draft follow-up')
    } finally {
      setDrafting(false)
    }
  }

  async function handleCopyDraft() {
    if (!draftResult) return
    const text = `Subject: ${draftResult.subject}\n\n${draftResult.body}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked, no-op */ }
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
            <h2 className="text-sm font-semibold text-[#e4e6f0]">{deal ? 'Edit Lead' : 'Add Deal'}</h2>
            <p className="text-xs text-[#636780] mt-0.5 truncate">
              {deal ? deal.prospect_name : 'New pipeline deal'}
            </p>
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
          {/* Send follow-up (existing deals only) */}
          {deal && (
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-4 space-y-3">
              {!followUpOpen ? (
                <button
                  onClick={() => setFollowUpOpen(true)}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Follow-up
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#e4e6f0] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      AI Follow-up
                    </p>
                    <button
                      onClick={() => { setFollowUpOpen(false); setDraftResult(null); setFollowUpError(null) }}
                      className="text-[#636780] hover:text-[#e4e6f0] transition-colors"
                      aria-label="Close follow-up"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {!form.contact_email.trim() ? (
                    <p className="text-xs text-amber-400">
                      Add a contact email above and save before drafting a follow-up.
                    </p>
                  ) : (
                    <>
                      <p className="text-[11px] text-[#636780] leading-relaxed">
                        Reads your last email thread with {form.contact_email.trim()}, then drafts a follow-up and
                        posts it to Discord to copy and send. Add any new context below.
                      </p>
                      <textarea
                        value={followUpContext}
                        onChange={(e) => setFollowUpContext(e.target.value)}
                        rows={3}
                        placeholder="e.g. They asked for pricing on the 3-video package. Mention the case study from last week."
                        className={`${inputClass} resize-none`}
                      />
                      <button
                        onClick={handleDraftFollowUp}
                        disabled={drafting}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {drafting ? 'Drafting...' : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Generate Follow-up
                          </>
                        )}
                      </button>

                      {followUpError && <p className="text-xs text-red-400">{followUpError}</p>}

                      {draftResult && (
                        <div className="rounded-lg border border-[#1c2035] bg-[#181b27] p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] uppercase tracking-wider text-[#636780]">
                              {draftResult.usedEmailHistory ? 'Drafted from your email thread' : 'Drafted from notes'}
                            </p>
                            <button
                              onClick={handleCopyDraft}
                              className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copied ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <p className="text-xs font-medium text-[#e4e6f0]">{draftResult.subject}</p>
                          <p className="text-xs text-[#a9adc8] whitespace-pre-wrap leading-relaxed">{draftResult.body}</p>
                          <p className="text-[10px] text-[#3d4060] pt-1">Also sent to your Discord.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

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

          {/* Contact email */}
          <div className="space-y-1.5">
            <label className={labelClass}>Contact Email</label>
            <input
              type="email"
              value={form.contact_email}
              onChange={(e) => set('contact_email', e.target.value)}
              className={inputClass}
              placeholder="name@company.com"
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
        <div className="px-6 py-4 border-t border-[#1c2035] flex flex-col gap-2 shrink-0">
          <div className="flex gap-3">
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
              {saving ? (deal ? 'Saving...' : 'Creating...') : deal ? 'Save Changes' : 'Create Deal'}
            </button>
          </div>
          {deal && (
            <button
              onClick={handleDelete}
              disabled={deleting || saving}
              className={`w-full rounded-lg px-4 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                confirmDelete
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'text-red-400 border border-red-500/30 hover:bg-red-500/10'
              }`}
            >
              {deleting ? 'Deleting...' : confirmDelete ? 'Click again to confirm delete' : 'Delete Deal'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
