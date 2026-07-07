'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { CallLead, CallOutcome } from '@/lib/types'

interface LogCallDrawerProps {
  lead: CallLead | null
  onClose: () => void
  onSaved: () => void
}

const OUTCOME_OPTIONS: { value: CallOutcome; label: string }[] = [
  { value: 'dial', label: 'Dial' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'callback', label: 'Callback' },
  { value: 'positive', label: 'Positive Reply' },
  { value: 'booked', label: 'Booked' },
]

export default function LogCallDrawer({ lead, onClose, onSaved }: LogCallDrawerProps) {
  const [outcome, setOutcome] = useState<CallOutcome>('dial')
  const [notes, setNotes] = useState('')
  const [markBooked, setMarkBooked] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [callTime, setCallTime] = useState('')
  const [demoUrl, setDemoUrl] = useState('https://august-demo.vercel.app')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when lead changes
  useEffect(() => {
    if (lead) {
      setOutcome('dial')
      setNotes('')
      setMarkBooked(false)
      setBusinessName(lead.company)
      setCallTime('')
      setDemoUrl('https://august-demo.vercel.app')
      setError(null)
    }
  }, [lead])

  // Auto-check booked if outcome is booked
  useEffect(() => {
    if (outcome === 'booked') setMarkBooked(true)
  }, [outcome])

  if (!lead) return null

  async function handleSave() {
    if (!lead) return
    setLoading(true)
    setError(null)

    try {
      const callRes = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          outcome,
          notes: notes.trim() || null,
        }),
      })

      if (!callRes.ok) {
        const data = await callRes.json().catch(() => ({}))
        throw new Error(data?.error ?? 'Failed to save call')
      }

      if (markBooked) {
        const bookingRes = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: lead.id,
            business_name: businessName.trim() || lead.company,
            phone: lead.phone,
            call_time: callTime || null,
            demo_url: demoUrl.trim() || null,
          }),
        })

        if (!bookingRes.ok) {
          const data = await bookingRes.json().catch(() => ({}))
          throw new Error(data?.error ?? 'Failed to save booking')
        }
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
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
      <div className="fixed right-0 top-0 h-full w-[420px] bg-[#10121a] border-l border-[#1c2035] z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1c2035] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-[#e4e6f0]">Log Call</h2>
            <p className="text-xs text-[#636780] mt-0.5">{lead.company}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] rounded-lg p-1.5 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lead info bar */}
        <div className="px-6 py-3 bg-[#181b27] border-b border-[#1c2035] flex items-center gap-4 shrink-0">
          <a
            href={`tel:${lead.phone}`}
            className="text-sm text-indigo-400 hover:text-indigo-300 font-mono"
          >
            {lead.phone}
          </a>
          {lead.city && (
            <span className="text-xs text-[#636780]">{lead.city}</span>
          )}
          {lead.niche && (
            <span className="text-xs text-[#636780]">{lead.niche}</span>
          )}
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Outcome */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#636780] uppercase tracking-wider">
              Outcome <span className="text-red-400">*</span>
            </label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as CallOutcome)}
              className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {OUTCOME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#636780] uppercase tracking-wider">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Call notes..."
              className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780] resize-none"
            />
          </div>

          {/* Mark as Booked */}
          <div className="space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={markBooked}
                onChange={(e) => setMarkBooked(e.target.checked)}
                className="w-4 h-4 rounded border border-[#1c2035] bg-[#181b27] text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
              />
              <span className="text-sm text-[#e4e6f0] group-hover:text-white transition-colors">
                Mark as Booked
              </span>
            </label>

            {markBooked && (
              <div className="space-y-4 pl-6 border-l border-[#1c2035]">
                {/* Business name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#636780] uppercase tracking-wider">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780]"
                    placeholder="Business name"
                  />
                </div>

                {/* Call time */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#636780] uppercase tracking-wider">
                    Call Time
                  </label>
                  <input
                    type="datetime-local"
                    value={callTime}
                    onChange={(e) => setCallTime(e.target.value)}
                    className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]"
                  />
                </div>

                {/* Demo URL */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#636780] uppercase tracking-wider">
                    Demo URL
                  </label>
                  <input
                    type="url"
                    value={demoUrl}
                    onChange={(e) => setDemoUrl(e.target.value)}
                    className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780]"
                    placeholder="https://..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1c2035] flex gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving...
              </>
            ) : (
              'Save Call'
            )}
          </button>
        </div>
      </div>
    </>
  )
}
