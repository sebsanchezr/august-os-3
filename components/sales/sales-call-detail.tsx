'use client'

import { useState } from 'react'
import { X, ExternalLink, RefreshCw } from 'lucide-react'
import { updateSalesCall, requestAnalysis } from '@/lib/sales-calls-client'
import type { SalesCall } from '@/lib/types'

interface SalesCallDetailProps {
  call: SalesCall
  onClose: () => void
  onUpdated: () => void
}

export default function SalesCallDetailSlideOver({ call, onClose, onUpdated }: SalesCallDetailProps) {
  const [notes, setNotes] = useState(call.notes || '')
  const [nextStep, setNextStep] = useState(call.next_step || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [requestingAnalysis, setRequestingAnalysis] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSaveNotes() {
    setSavingNotes(true)
    setError(null)
    try {
      await updateSalesCall(call.id, { notes, next_step: nextStep })
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingNotes(false)
    }
  }

  async function handleRequestAnalysis() {
    if (!call.transcript) {
      setError('No transcript available for analysis')
      return
    }
    setRequestingAnalysis(true)
    setError(null)
    try {
      await requestAnalysis(call.id)
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request analysis')
    } finally {
      setRequestingAnalysis(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[#10121a] border-l border-[#1c2035] shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#10121a] border-b border-[#1c2035] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#e4e6f0]">
              {call.pipeline_deals?.prospect_name}
            </h2>
            <p className="text-xs text-[#636780]">{call.pipeline_deals?.company}</p>
          </div>
          <button onClick={onClose} className="text-[#636780] hover:text-[#e4e6f0]">
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Basic info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#636780] uppercase tracking-wide">Call Type</span>
              <span className="text-sm font-medium text-[#e4e6f0] capitalize">{call.call_type}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#636780] uppercase tracking-wide">Status</span>
              <span className={`text-sm font-medium capitalize ${
                call.status === 'held' ? 'text-green-400' :
                call.status === 'scheduled' ? 'text-blue-400' :
                call.status === 'analyzed' ? 'text-indigo-400' :
                'text-amber-400'
              }`}>{call.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#636780] uppercase tracking-wide">Date</span>
              <span className="text-sm font-medium text-[#e4e6f0]">
                {call.held_at
                  ? new Date(call.held_at).toLocaleDateString('en-GB')
                  : call.scheduled_at
                  ? new Date(call.scheduled_at).toLocaleDateString('en-GB')
                  : '-'}
              </span>
            </div>
            {call.duration_minutes && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#636780] uppercase tracking-wide">Duration</span>
                <span className="text-sm font-medium text-[#e4e6f0]">{call.duration_minutes} min</span>
              </div>
            )}
          </div>

          <div className="border-t border-[#1c2035]" />

          {/* Links */}
          <div className="space-y-2">
            {call.recording_url && (
              <a
                href={call.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#181b27] hover:bg-[#1c2035] text-indigo-400 text-xs transition-colors"
              >
                <span>Recording</span>
                <ExternalLink style={{ width: 12, height: 12 }} />
              </a>
            )}
            {call.deck_url && (
              <a
                href={call.deck_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#181b27] hover:bg-[#1c2035] text-indigo-400 text-xs transition-colors"
              >
                <span>Deck</span>
                <ExternalLink style={{ width: 12, height: 12 }} />
              </a>
            )}
          </div>

          <div className="border-t border-[#1c2035]" />

          {/* Analysis */}
          {call.analysis ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#636780] uppercase tracking-wide">Overall Score</span>
                  <span className="text-2xl font-bold text-indigo-400">{call.analysis.overall_score}/10</span>
                </div>
                <div className="w-full bg-[#181b27] rounded-full h-1 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500"
                    style={{ width: `${(call.analysis.overall_score / 10) * 100}%` }}
                  />
                </div>
              </div>

              {call.analysis.dimensions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#636780] uppercase tracking-wide mb-2">Dimensions</p>
                  <div className="space-y-2">
                    {call.analysis.dimensions.map((d) => (
                      <div key={d.key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[#e4e6f0]">{d.key.replace(/_/g, ' ')}</span>
                          <span className="text-xs font-medium text-[#8b8fa8]">{d.score}/5</span>
                        </div>
                        <div className="w-full bg-[#181b27] rounded-full h-1 overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${(d.score / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {call.analysis.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-1">Strengths</p>
                  <ul className="space-y-1">
                    {call.analysis.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-[#e4e6f0]">• {s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {call.analysis.improvements.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-1">Improvements</p>
                  <ul className="space-y-1">
                    {call.analysis.improvements.map((i, idx) => (
                      <li key={idx} className="text-xs text-[#e4e6f0]">• {i}</li>
                    ))}
                  </ul>
                </div>
              )}

              {call.analysis.summary && (
                <div>
                  <p className="text-xs font-semibold text-[#636780] uppercase tracking-wide mb-1">Summary</p>
                  <p className="text-xs text-[#8b8fa8] leading-relaxed">{call.analysis.summary}</p>
                </div>
              )}
            </div>
          ) : call.transcript ? (
            <div className="text-center py-4">
              <p className="text-xs text-[#636780] mb-3">Not analyzed yet</p>
              <button
                onClick={handleRequestAnalysis}
                disabled={requestingAnalysis}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 text-xs rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw style={{ width: 12, height: 12 }} />
                {requestingAnalysis ? 'Analyzing...' : 'Run Analysis'}
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-[#636780]">No transcript to analyze</p>
            </div>
          )}

          <div className="border-t border-[#1c2035]" />

          {/* Transcript */}
          {call.transcript && (
            <div>
              <p className="text-xs font-semibold text-[#636780] uppercase tracking-wide mb-2">Transcript</p>
              <div className="max-h-[150px] overflow-y-auto bg-[#181b27] rounded-lg p-3 border border-[#1c2035]">
                <p className="text-xs text-[#8b8fa8] whitespace-pre-wrap leading-relaxed">{call.transcript}</p>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="text-xs font-semibold text-[#636780] uppercase tracking-wide mb-2">Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={3}
              className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-xs text-[#e4e6f0] placeholder:text-[#636780] focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Next step */}
          <div>
            <p className="text-xs font-semibold text-[#636780] uppercase tracking-wide mb-2">Next Step</p>
            <input
              type="text"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="What's next..."
              className="w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-xs text-[#e4e6f0] placeholder:text-[#636780] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#10121a] border-t border-[#1c2035] px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] rounded-lg px-4 py-2 text-xs transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleSaveNotes}
            disabled={savingNotes}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-xs font-medium transition-colors disabled:opacity-50"
          >
            {savingNotes ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
