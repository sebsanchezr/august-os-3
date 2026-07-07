'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { fetchPipeline } from '@/lib/pipeline-client'
import { logSalesCall } from '@/lib/sales-calls-client'
import type { PipelineDeal, SalesCallType } from '@/lib/types'

interface LogSalesCallDrawerProps {
  onClose: () => void
  onSaved: () => void
}

export default function LogSalesCallDrawer({ onClose, onSaved }: LogSalesCallDrawerProps) {
  const [deals, setDeals] = useState<PipelineDeal[]>([])
  const [dealId, setDealId] = useState('')
  const [callType, setCallType] = useState<SalesCallType>('discovery')
  const [heldDate, setHeldDate] = useState(new Date().toISOString().split('T')[0])
  const [heldTime, setHeldTime] = useState('14:00')
  const [duration, setDuration] = useState('60')
  const [recordingUrl, setRecordingUrl] = useState('')
  const [deckUrl, setDeckUrl] = useState('')
  const [transcript, setTranscript] = useState('')
  const [outcome, setOutcome] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNewDealForm, setShowNewDealForm] = useState(false)
  const [newDealName, setNewDealName] = useState('')
  const [newDealCompany, setNewDealCompany] = useState('')

  useEffect(() => {
    async function loadDeals() {
      try {
        const data = await fetchPipeline()
        setDeals(data.filter(d => d.stage !== 'won' && d.stage !== 'lost'))
      } catch {
        setError('Failed to load prospects')
      }
    }
    loadDeals()
  }, [])

  async function handleSave() {
    if (!dealId && !showNewDealForm) {
      setError('Please select or create a prospect')
      return
    }

    setSaving(true)
    setError(null)

    try {
      let finalDealId = dealId

      if (showNewDealForm && newDealName) {
        const res = await fetch('/api/pipeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prospect_name: newDealName,
            company: newDealCompany || null,
            source_channel: 'other',
            stage: 'booked',
          }),
        })
        if (!res.ok) throw new Error('Failed to create prospect')
        const { deal } = await res.json()
        finalDealId = deal.id
      }

      const heldAtISO = `${heldDate}T${heldTime}:00Z`

      await logSalesCall(finalDealId, {
        callType,
        heldAt: heldAtISO,
        durationMinutes: parseInt(duration) || undefined,
        recordingUrl: recordingUrl || undefined,
        deckUrl: deckUrl || undefined,
        transcript: transcript || undefined,
        outcome: (outcome || undefined) as any,
        nextStep: nextStep || undefined,
        notes: notes || undefined,
      })

      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sales call')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end">
      <div className="w-full max-w-md bg-[#10121a] border-l border-t border-[#1c2035] max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#10121a] border-b border-[#1c2035] px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#e4e6f0]">Log Sales Call</h2>
          <button
            onClick={onClose}
            className="text-[#636780] hover:text-[#e4e6f0] transition-colors"
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Prospect selection */}
          <div>
            {!showNewDealForm ? (
              <>
                <label className="block text-xs font-semibold text-[#636780] mb-2 uppercase tracking-wide">Prospect</label>
                <select
                  value={dealId}
                  onChange={(e) => setDealId(e.target.value)}
                  className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2.5 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select a prospect</option>
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.prospect_name} {d.company ? `(${d.company})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowNewDealForm(true)}
                  className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
                >
                  Or create new prospect
                </button>
              </>
            ) : (
              <>
                <label className="block text-xs font-semibold text-[#636780] mb-2 uppercase tracking-wide">New Prospect Name</label>
                <input
                  type="text"
                  value={newDealName}
                  onChange={(e) => setNewDealName(e.target.value)}
                  placeholder="e.g. John Smith"
                  className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2.5 text-sm text-[#e4e6f0] placeholder:text-[#636780] focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-2"
                />
                <input
                  type="text"
                  value={newDealCompany}
                  onChange={(e) => setNewDealCompany(e.target.value)}
                  placeholder="Company name (optional)"
                  className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2.5 text-sm text-[#e4e6f0] placeholder:text-[#636780] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={() => setShowNewDealForm(false)}
                  className="mt-2 text-xs text-[#636780] hover:text-[#e4e6f0]"
                >
                  Or select existing
                </button>
              </>
            )}
          </div>

          {/* Call type */}
          <div>
            <label className="block text-xs font-semibold text-[#636780] mb-2 uppercase tracking-wide">Call Type</label>
            <select
              value={callType}
              onChange={(e) => setCallType(e.target.value as SalesCallType)}
              className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2.5 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="discovery">Discovery Call (Call 1)</option>
              <option value="pitch">Pitch Call (Call 2)</option>
              <option value="followup">Follow-up Call</option>
              <option value="onboarding">Onboarding Call</option>
            </select>
          </div>

          {/* Date and time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#636780] mb-2 uppercase tracking-wide">Date</label>
              <input
                type="date"
                value={heldDate}
                onChange={(e) => setHeldDate(e.target.value)}
                className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2.5 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#636780] mb-2 uppercase tracking-wide">Time</label>
              <input
                type="time"
                value={heldTime}
                onChange={(e) => setHeldTime(e.target.value)}
                className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2.5 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-semibold text-[#636780] mb-2 uppercase tracking-wide">Duration (minutes)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="60"
              className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2.5 text-sm text-[#e4e6f0] placeholder:text-[#636780] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Recording URL */}
          <div>
            <label className="block text-xs font-semibold text-[#636780] mb-2 uppercase tracking-wide">Recording URL (optional)</label>
            <input
              type="url"
              value={recordingUrl}
              onChange={(e) => setRecordingUrl(e.target.value)}
              placeholder="https://meet.google.com/..."
              className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2.5 text-sm text-[#e4e6f0] placeholder:text-[#636780] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Deck URL */}
          <div>
            <label className="block text-xs font-semibold text-[#636780] mb-2 uppercase tracking-wide">Deck URL (optional)</label>
            <input
              type="url"
              value={deckUrl}
              onChange={(e) => setDeckUrl(e.target.value)}
              placeholder="https://docs.google.com/..."
              className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2.5 text-sm text-[#e4e6f0] placeholder:text-[#636780] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Transcript */}
          <div>
            <label className="block text-xs font-semibold text-[#636780] mb-2 uppercase tracking-wide">Transcript (paste from Google Meet)</label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste transcript here..."
              rows={4}
              className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2.5 text-sm text-[#e4e6f0] placeholder:text-[#636780] focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Outcome */}
          <div>
            <label className="block text-xs font-semibold text-[#636780] mb-2 uppercase tracking-wide">Outcome (optional)</label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2.5 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select outcome</option>
              <option value="advanced">Advanced to Next Stage</option>
              <option value="stalled">Stalled</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="rebook">Reschedule</option>
            </select>
          </div>

          {/* Next step */}
          <div>
            <label className="block text-xs font-semibold text-[#636780] mb-2 uppercase tracking-wide">Next Step (optional)</label>
            <input
              type="text"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="e.g. Send proposal by Friday"
              className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2.5 text-sm text-[#e4e6f0] placeholder:text-[#636780] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#636780] mb-2 uppercase tracking-wide">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
              className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2.5 text-sm text-[#e4e6f0] placeholder:text-[#636780] focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#10121a] border-t border-[#1c2035] px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] rounded-lg px-4 py-2 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Call'}
          </button>
        </div>
      </div>
    </div>
  )
}
