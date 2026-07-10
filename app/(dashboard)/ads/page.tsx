'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import { KpiCard } from '@/components/kpi-card'

type AdsClient = {
  id: string
  name: string
  meta_ad_account_id: string | null
}

type DailyMetric = {
  date: string
  spend: number | null
  revenue: number | null
  roas: number | null
  purchases: number | null
  cpa: number | null
  impressions: number | null
  clicks: number | null
  ctr: number | null
}

type ClientDetail = {
  id: string
  name: string
  meta_ad_account_id: string | null
  target_roas: number | null
  target_cpa: number | null
  monthly_budget: number | null
}

type AdsDetailResponse = {
  client: ClientDetail
  metrics: DailyMetric[]
  empty: boolean
}

type Severity = 'high' | 'medium' | 'low'

type HygieneCheck = {
  key: string
  severity: Severity
  title: string
  detail: string
  affected: Array<Record<string, unknown>>
}

type RecommendationRun = {
  generated_at: string | null
  data_as_of: string | null
  checks: HygieneCheck[]
  summary: string | null
  meta_token_dead?: boolean
}

const SEVERITY_ORDER: Severity[] = ['high', 'medium', 'low']
const SEVERITY_LABEL: Record<Severity, string> = { high: 'High', medium: 'Medium', low: 'Low' }

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const SEVERITY_BADGE: Record<Severity, string> = {
  high: 'bg-red-500/15 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  low: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
}

interface TooltipPayloadEntry {
  name: string
  value: number
  color: string
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-[#10121a] border border-[#1c2035] rounded-lg p-3 text-sm">
      {label && <p className="text-[#636780] text-xs mb-2">{formatDate(label)}</p>}
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[#636780] capitalize">{entry.name}:</span>
          <span className="text-[#e4e6f0] tabular-nums font-medium">
            {entry.name === 'spend' ? formatMoney(entry.value) : entry.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function AdsPage() {
  const [clients, setClients] = useState<AdsClient[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [detail, setDetail] = useState<AdsDetailResponse | null>(null)
  const [loadingClients, setLoadingClients] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [run, setRun] = useState<RecommendationRun | null>(null)
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/ads', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        const list: AdsClient[] = json.clients ?? []
        const sorted = [...list].sort((a, b) => {
          const aConnected = Boolean(a.meta_ad_account_id)
          const bConnected = Boolean(b.meta_ad_account_id)
          if (aConnected !== bConnected) return aConnected ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        setClients(sorted)
        const firstConnected = sorted.find((c) => c.meta_ad_account_id)
        if (firstConnected) setSelectedId(firstConnected.id)
      })
      .finally(() => { if (!cancelled) setLoadingClients(false) })
    return () => { cancelled = true }
  }, [])

  const loadDetail = useCallback((clientId: string) => {
    setLoadingDetail(true)
    fetch(`/api/ads?client_id=${clientId}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => setDetail(json))
      .finally(() => setLoadingDetail(false))
  }, [])

  const loadRecommendation = useCallback((clientId: string) => {
    fetch(`/api/ads/recommendations?client_id=${clientId}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (json.generated_at || (Array.isArray(json.checks) && json.checks.length > 0)) {
          setRun({
            generated_at: json.generated_at ?? null,
            data_as_of: json.data_as_of ?? null,
            checks: Array.isArray(json.checks) ? json.checks : [],
            summary: json.summary ?? null,
          })
        } else {
          setRun(null)
        }
      })
      .catch(() => setRun(null))
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setDetail(null)
    setRun(null)
    setRecError(null)
    loadDetail(selectedId)
    loadRecommendation(selectedId)
  }, [selectedId, loadDetail, loadRecommendation])

  const kpis = useMemo(() => {
    const metrics = detail?.metrics ?? []
    const last7 = metrics.slice(-7)
    const spend = last7.reduce((s, r) => s + (r.spend ?? 0), 0)
    const revenue = last7.reduce((s, r) => s + (r.revenue ?? 0), 0)
    const purchases = last7.reduce((s, r) => s + (r.purchases ?? 0), 0)
    const roas = spend > 0 ? revenue / spend : null
    const cpa = purchases > 0 ? spend / purchases : null
    return { spend, revenue, roas, cpa }
  }, [detail])

  const chartData = useMemo(() => {
    return (detail?.metrics ?? []).map((m) => ({
      date: m.date,
      spend: m.spend ?? 0,
      roas: m.roas ?? 0,
    }))
  }, [detail])

  async function handleGenerateRecommendations() {
    if (!selectedId) return
    setRecLoading(true)
    setRecError(null)
    try {
      const res = await fetch('/api/ads/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: selectedId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setRecError(json.error ?? 'Failed to generate recommendations')
        return
      }
      setRun({
        generated_at: json.generated_at ?? null,
        data_as_of: json.data_as_of ?? null,
        checks: Array.isArray(json.checks) ? json.checks : [],
        summary: json.summary ?? null,
        meta_token_dead: json.meta_token_dead,
      })
    } catch (err) {
      setRecError(err instanceof Error ? err.message : 'Failed to generate recommendations')
    } finally {
      setRecLoading(false)
    }
  }

  const selectedClient = clients.find((c) => c.id === selectedId)
  const isConnected = Boolean(selectedClient?.meta_ad_account_id)

  return (
    <div className="p-6 min-h-screen bg-[#08090c]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#e4e6f0]">Paid Ads</h1>
          <p className="text-xs text-[#636780] mt-1">Media buyer workspace</p>
        </div>

        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={loadingClients || clients.length === 0}
          className="bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:border-indigo-500"
        >
          {loadingClients && <option>Loading clients...</option>}
          {!loadingClients && clients.length === 0 && <option>No clients found</option>}
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.meta_ad_account_id ? '' : ' (Not connected)'}
            </option>
          ))}
        </select>
      </div>

      {!selectedId && !loadingClients && (
        <div className="flex items-center justify-center h-64">
          <span className="text-sm text-[#636780]">Select a client to view ad performance.</span>
        </div>
      )}

      {selectedId && !isConnected && (
        <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-5 text-sm text-[#636780]">
          This client has no meta_ad_account_id on file. Connect their Meta ad account to activate ad reporting.
        </div>
      )}

      {selectedId && isConnected && (
        loadingDetail || !detail ? (
          <div className="flex items-center justify-center h-64">
            <span className="text-sm text-[#636780]">Loading ad data...</span>
          </div>
        ) : detail.empty ? (
          <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-5 text-sm text-[#636780]">
            No ad data yet. Metrics sync daily once Meta is connected.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <KpiCard label="7d Spend" value={formatMoney(kpis.spend)} accent="blue" />
              <KpiCard label="7d Revenue" value={formatMoney(kpis.revenue)} accent="green" />
              <KpiCard label="7d ROAS" value={kpis.roas !== null ? kpis.roas.toFixed(2) : '-'} accent="amber" />
              <KpiCard label="7d CPA" value={kpis.cpa !== null ? formatMoney(kpis.cpa) : '-'} accent="default" />
            </div>

            <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-5 mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#636780] mb-4">14 Day Spend / ROAS</h2>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#1c2035" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#636780' }}
                      tickFormatter={formatDate}
                    />
                    <YAxis
                      yAxisId="spend"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#636780' }}
                      width={40}
                    />
                    <YAxis
                      yAxisId="roas"
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#636780' }}
                      width={30}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#636780' }} />
                    <Bar yAxisId="spend" dataKey="spend" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    <Line
                      yAxisId="roas"
                      type="monotone"
                      dataKey="roas"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-[#636780]">AI Recommendations</h2>
                <button
                  onClick={handleGenerateRecommendations}
                  disabled={recLoading}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  {recLoading ? 'Generating...' : 'Generate recommendations'}
                </button>
              </div>

              {recError && <p className="text-xs text-red-400 mb-3">{recError}</p>}

              <p className="text-[10px] text-amber-400 mb-3">
                {run?.data_as_of
                  ? `Data as of ${formatDate(run.data_as_of)}. `
                  : 'No metrics data on file. '}
                Meta access token is dead, so numbers may be stale. Nothing here is fabricated.
              </p>

              {run ? (
                <>
                  {run.summary && (
                    <div className="bg-[#181b27] rounded-lg p-3 mb-4 text-xs text-[#8b8fa8] whitespace-pre-wrap leading-relaxed">
                      {run.summary}
                    </div>
                  )}

                  {run.checks.length === 0 ? (
                    <p className="text-xs text-[#636780]">No hygiene issues detected in the available data.</p>
                  ) : (
                    <div className="space-y-4">
                      {SEVERITY_ORDER.map((sev) => {
                        const group = run.checks.filter((c) => c.severity === sev)
                        if (group.length === 0) return null
                        return (
                          <div key={sev}>
                            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[#636780] mb-2">
                              {SEVERITY_LABEL[sev]} ({group.length})
                            </h3>
                            <div className="space-y-2">
                              {group.map((c) => (
                                <div key={c.key} className="bg-[#181b27] border border-[#1c2035] rounded-lg p-3">
                                  <div className="flex items-start gap-3">
                                    <span
                                      className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded border text-[9px] font-semibold uppercase tracking-wide ${SEVERITY_BADGE[c.severity]}`}
                                    >
                                      {c.severity}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="text-xs text-[#e4e6f0] font-medium">{c.title}</p>
                                      <p className="text-xs text-[#8b8fa8] mt-0.5">{c.detail}</p>
                                      {c.affected.length > 0 && (
                                        <ul className="mt-2 space-y-1">
                                          {c.affected.map((a, idx) => {
                                            const name = (a.client_name as string) ?? (a.entity as string) ?? ''
                                            const rest = Object.entries(a)
                                              .filter(([k]) => !['client_id', 'client_name', 'entity'].includes(k))
                                              .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`)
                                              .join(' · ')
                                            return (
                                              <li key={idx} className="text-[10px] text-[#636780] tabular-nums">
                                                <span className="text-[#8b8fa8]">{name}</span>
                                                {rest && <span> {'· '}{rest}</span>}
                                              </li>
                                            )
                                          })}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {run.generated_at && (
                    <p className="text-[10px] text-[#636780] mt-3">
                      Last run {new Date(run.generated_at).toLocaleString('en-GB')}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-[#636780]">No recommendations generated yet for this client.</p>
              )}
            </div>

            <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-5 overflow-x-auto">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#636780] mb-4">Daily Breakdown</h2>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#636780] text-left">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium text-right">Spend</th>
                    <th className="pb-2 font-medium text-right">Revenue</th>
                    <th className="pb-2 font-medium text-right">ROAS</th>
                    <th className="pb-2 font-medium text-right">CPA</th>
                    <th className="pb-2 font-medium text-right">Purchases</th>
                    <th className="pb-2 font-medium text-right">Impressions</th>
                    <th className="pb-2 font-medium text-right">Clicks</th>
                    <th className="pb-2 font-medium text-right">CTR</th>
                  </tr>
                </thead>
                <tbody className="text-[#e4e6f0] tabular-nums">
                  {[...detail.metrics].reverse().map((m) => (
                    <tr key={m.date} className="border-t border-[#1c2035]">
                      <td className="py-2">{formatDate(m.date)}</td>
                      <td className="py-2 text-right">{formatMoney(m.spend ?? 0)}</td>
                      <td className="py-2 text-right">{formatMoney(m.revenue ?? 0)}</td>
                      <td className="py-2 text-right">{m.roas !== null ? m.roas.toFixed(2) : '-'}</td>
                      <td className="py-2 text-right">{m.cpa !== null ? formatMoney(m.cpa) : '-'}</td>
                      <td className="py-2 text-right">{m.purchases ?? 0}</td>
                      <td className="py-2 text-right">{(m.impressions ?? 0).toLocaleString('en-GB')}</td>
                      <td className="py-2 text-right">{m.clicks ?? 0}</td>
                      <td className="py-2 text-right">{m.ctr !== null ? `${(m.ctr ?? 0).toFixed(2)}%` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </div>
  )
}
