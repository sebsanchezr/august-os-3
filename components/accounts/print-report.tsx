'use client'

import { useEffect, useState } from 'react'
import { Loader2, Printer } from 'lucide-react'
import { fetchAccount, fetchReports } from '@/lib/accounts-client'
import type { Client, ClientMetricsDaily, ClientReport } from '@/lib/types'

// Printable report page — opens in a new tab from History.
// ?view=client (default) shows the clean client-facing version.
// ?view=internal shows the internal version with findings and suggestions.

type AccountData = {
  account: Client & { am?: { id: string; name: string } | null }
  metrics_30d: ClientMetricsDaily[]
}

function money(n: number | null | undefined, currency = 'GBP'): string {
  if (n == null) return '--'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

function x(n: number | null | undefined): string {
  if (n == null) return '--'
  return `${n.toFixed(2)}x`
}

export default function PrintReport({ accountId }: { accountId: string }) {
  const [data, setData] = useState<AccountData | null>(null)
  const [reports, setReports] = useState<ClientReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'client' | 'internal'>('client')

  useEffect(() => {
    // Read ?view= from URL
    const params = new URLSearchParams(window.location.search)
    if (params.get('view') === 'internal') setView('internal')
  }, [])

  useEffect(() => {
    Promise.all([
      fetchAccount(accountId),
      fetchReports(accountId),
    ])
      .then(([acc, reps]) => {
        setData(acc as AccountData)
        setReports(reps)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [accountId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    )
  }

  if (error || !data) {
    return <div className="p-8 text-red-500">{error ?? 'Not found'}</div>
  }

  const { account, metrics_30d } = data
  const currency = account.currency || 'GBP'

  const sorted = [...metrics_30d].sort((a, b) => a.date.localeCompare(b.date))
  const last7 = sorted.slice(-7)

  const spend7 = last7.reduce((s, r) => s + (r.spend ?? 0), 0)
  const revenue7 = last7.reduce((s, r) => s + (r.revenue ?? 0), 0)
  const purchases7 = last7.reduce((s, r) => s + (r.purchases ?? 0), 0)
  const roas7Values = last7.flatMap((r) => r.roas != null ? [r.roas] : [])
  const avgRoas7 = roas7Values.length ? roas7Values.reduce((a, b) => a + b) / roas7Values.length : null

  const weekStart = last7[0]?.date ?? ''
  const weekEnd = last7[last7.length - 1]?.date ?? ''
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  // Latest approved/sent weekly report — contains Claude-generated narrative
  const latestEow = [...reports]
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .find((r) => r.type === 'weekly_eow')

  const clientMessage = latestEow?.client_message ?? null
  const internalDraft = latestEow?.draft_md ?? null

  return (
    <div className="bg-white min-h-screen">
      {/* Toolbar — hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-100 px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Report for</span>
          <span className="font-semibold text-gray-900">{account.name}</span>
          <span className="text-gray-300">|</span>
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('client')}
              className={`px-3 py-1 rounded-md text-xs transition-colors ${
                view === 'client' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Client view
            </button>
            <button
              onClick={() => setView('internal')}
              className={`px-3 py-1 rounded-md text-xs transition-colors ${
                view === 'internal' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Internal view
            </button>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
        >
          <Printer size={14} /> Save as PDF
        </button>
      </div>

      {view === 'client' ? (
        <ClientReport
          account={account}
          currency={currency}
          spend7={spend7}
          revenue7={revenue7}
          purchases7={purchases7}
          avgRoas7={avgRoas7}
          weekStart={weekStart}
          weekEnd={weekEnd}
          today={today}
          clientMessage={clientMessage}
        />
      ) : (
        <InternalReport
          account={account}
          currency={currency}
          spend7={spend7}
          revenue7={revenue7}
          purchases7={purchases7}
          avgRoas7={avgRoas7}
          weekStart={weekStart}
          weekEnd={weekEnd}
          today={today}
          internalDraft={internalDraft}
          clientMessage={clientMessage}
        />
      )}

      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Client-facing report ─────────────────────────────────────────────────────
// Sleek, narrative-only. No tables, no screenshots.
// If the Mac has generated a client_message for the latest EOW, use that.
// Otherwise render a clean metrics + blank narrative scaffold.

type ClientReportProps = {
  account: Client & { am?: { id: string; name: string } | null }
  currency: string
  spend7: number; revenue7: number; purchases7: number; avgRoas7: number | null
  weekStart: string; weekEnd: string; today: string
  clientMessage: string | null
}

function ClientReport({ account, currency, spend7, revenue7, purchases7, avgRoas7, weekStart, weekEnd, today, clientMessage }: ClientReportProps) {
  // If we have a Mac-generated message, render it directly.
  // Otherwise show the structured scaffold.
  if (clientMessage) {
    return (
      <div className="max-w-2xl mx-auto px-10 py-14">
        <Header name={account.name} weekStart={weekStart} weekEnd={weekEnd} today={today} />
        {/* Render the WA message as a clean email-style block */}
        <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap mt-8">
          {clientMessage}
        </div>
        <ReportFooter name={account.name} today={today} />
      </div>
    )
  }

  // Scaffold when no Mac report exists yet
  return (
    <div className="max-w-2xl mx-auto px-10 py-14">
      <Header name={account.name} weekStart={weekStart} weekEnd={weekEnd} today={today} />

      {/* Top metrics — 3 numbers only */}
      <div className="grid grid-cols-3 gap-4 my-8">
        <MetricBox label="Ad Spend" value={money(spend7, currency)} />
        <MetricBox label="Revenue" value={money(revenue7, currency)} />
        <MetricBox
          label="ROAS"
          value={avgRoas7 != null ? `${avgRoas7.toFixed(2)}x` : '--'}
          sub={account.target_roas ? `Target ${account.target_roas}x` : undefined}
        />
      </div>

      <NarrativeSection title="What we tested this week" placeholder="Add talking points and the Mac reporter will populate this." />
      <NarrativeSection title="What worked well" placeholder="Driven by creative performance data from the Mac reporter." />
      <NarrativeSection title="What we're watching" placeholder="Any creative or audience that's underperforming." />
      <NarrativeSection title="Next week" placeholder="Tests launching, creatives going live, budget changes." />

      <ReportFooter name={account.name} today={today} />
    </div>
  )
}

// ─── Internal report ──────────────────────────────────────────────────────────
// Same structure plus findings + suggestions (populated by Mac reporter + knowledge base).

type InternalReportProps = ClientReportProps & {
  internalDraft: string | null
}

function InternalReport({ account, currency, spend7, revenue7, purchases7, avgRoas7, weekStart, weekEnd, today, internalDraft, clientMessage }: InternalReportProps) {
  return (
    <div className="max-w-2xl mx-auto px-10 py-14">
      <Header name={account.name} weekStart={weekStart} weekEnd={weekEnd} today={today} label="Internal" />

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4 my-8">
        <MetricBox label="Ad Spend" value={money(spend7, currency)} />
        <MetricBox label="Revenue" value={money(revenue7, currency)} />
        <MetricBox
          label="ROAS"
          value={avgRoas7 != null ? `${avgRoas7.toFixed(2)}x` : '--'}
          sub={account.target_roas ? `Target ${account.target_roas}x` : undefined}
        />
      </div>

      {internalDraft ? (
        /* Mac-generated internal brief */
        <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap mt-4">
          {internalDraft}
        </div>
      ) : (
        /* Scaffold */
        <>
          <NarrativeSection title="What we tested this week" placeholder="Populated by talking points + completed tasks from the Mac reporter." />
          <NarrativeSection title="What worked" placeholder="Performance data + creative analysis." />
          <NarrativeSection title="What didn't" placeholder="Underperforming creatives or audiences." />
          <NarrativeSection title="Findings & hypotheses" placeholder="Why something worked or didn't — for team learning." />
          <div className="mt-8 p-5 bg-indigo-50 rounded-xl border border-indigo-100">
            <p className="text-[10px] font-bold tracking-widest uppercase text-indigo-400 mb-1">Suggestions (AI · Nick Theriot knowledge base)</p>
            <p className="text-sm text-indigo-700 italic">
              This section is populated by the Mac reporter using Nick Theriot transcripts and recent Meta ads research as context. Run the Friday report generator to see suggestions here.
            </p>
          </div>
        </>
      )}

      {/* Client message reference */}
      {clientMessage && (
        <div className="mt-10 pt-8 border-t border-gray-100">
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-3">Approved client message</p>
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 whitespace-pre-wrap">{clientMessage}</div>
        </div>
      )}

      <ReportFooter name={account.name} today={today} label="Internal" />
    </div>
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Header({ name, weekStart, weekEnd, today, label }: { name: string; weekStart: string; weekEnd: string; today: string; label?: string }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        {label && <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-1">{label}</p>}
        <h1 className="text-3xl font-bold text-gray-900">{name}</h1>
        <p className="text-gray-400 text-sm mt-1">
          {weekStart && weekEnd ? `${weekStart} to ${weekEnd}` : 'Weekly report'}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-400 mb-0.5">August Marketing</p>
        <p className="text-xs text-gray-400">{today}</p>
      </div>
    </div>
  )
}

function MetricBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-center py-5 border border-gray-100 rounded-xl bg-gray-50">
      <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function NarrativeSection({ title, placeholder }: { title: string; placeholder: string }) {
  return (
    <div className="mb-7">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">{title}</h2>
      <p className="text-sm text-gray-300 italic">{placeholder}</p>
    </div>
  )
}

function ReportFooter({ name, today, label }: { name: string; today: string; label?: string }) {
  return (
    <div className="mt-12 pt-6 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-300">
      <span>August Marketing {label ? `· ${label} ` : ''}· {name}</span>
      <span>{today}</span>
    </div>
  )
}
