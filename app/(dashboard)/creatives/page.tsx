'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, ExternalLink, ChevronDown, ChevronUp, Trash2, Sparkles, Check, Image as ImageIcon, X,
  Loader2, Copy, Wand2, RefreshCw,
} from 'lucide-react'
import {
  ASSET_KINDS,
  type AssetKind,
  type ClientOption,
  type CreativeAssetWithClient,
  type StrategyItem,
  type CreativeOutput,
} from '@/lib/creatives'

type OutputWithClient = CreativeOutput & { client: { id: string; name: string } | null }

type Tab = 'strategies' | 'library'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  approved: 'Approved',
  generating: 'Generating',
  delivered: 'Delivered',
}

const STATUS_COLOURS: Record<string, string> = {
  draft: 'bg-amber-500/15 text-amber-400',
  approved: 'bg-indigo-500/15 text-indigo-400',
  generating: 'bg-purple-500/15 text-purple-400',
  delivered: 'bg-emerald-500/15 text-emerald-400',
}

const KIND_LABELS: Record<AssetKind, string> = {
  drive: 'Drive',
  figma: 'Figma',
  brief: 'Brief',
  asset: 'Asset',
  inspiration: 'Inspiration',
  other: 'Other',
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function OutputGrid({
  items, copiedUrl, onCopy,
}: {
  items: OutputWithClient[]
  copiedUrl: string | null
  onCopy: (url: string) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map(o => (
        <div key={o.id} className="rounded-lg border border-[#1c2035] bg-[#08090c] overflow-hidden">
          {o.image_url ? (
            <a href={o.image_url} target="_blank" rel="noopener noreferrer" className="block aspect-square bg-[#0d0f16]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.image_url} alt={o.concept_title ?? 'Generated static'} className="w-full h-full object-cover" />
            </a>
          ) : (
            <div className="aspect-square flex items-center justify-center p-2 text-center">
              <span className="text-[10px] text-red-400">{o.error ?? 'Failed'}</span>
            </div>
          )}
          <div className="p-2">
            <p className="text-[11px] text-[#e4e6f0] truncate" title={o.concept_title ?? ''}>{o.concept_title ?? 'Untitled'}</p>
            {o.image_url && (
              <div className="flex items-center gap-2 mt-1.5">
                <a
                  href={o.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-[#636780] hover:text-indigo-400"
                >
                  <ExternalLink className="h-3 w-3" /> Open
                </a>
                <button
                  onClick={() => onCopy(o.image_url as string)}
                  className="flex items-center gap-1 text-[10px] text-[#636780] hover:text-indigo-400"
                >
                  <Copy className="h-3 w-3" /> {copiedUrl === o.image_url ? 'Copied' : 'Copy URL'}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CreativesPage() {
  const [tab, setTab] = useState<Tab>('strategies')
  const [clients, setClients] = useState<ClientOption[]>([])

  const [strategyItems, setStrategyItems] = useState<StrategyItem[]>([])
  const [strategiesLoading, setStrategiesLoading] = useState(true)
  const [strategiesError, setStrategiesError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [busyStrategyId, setBusyStrategyId] = useState<string | null>(null)
  const [genNote, setGenNote] = useState<Record<string, string>>({})

  const [showNewStrategy, setShowNewStrategy] = useState(false)
  const [newStrategy, setNewStrategy] = useState({ client_id: '', focus: '', notes: '' })
  const [creatingStrategy, setCreatingStrategy] = useState(false)
  const [newStrategyError, setNewStrategyError] = useState<string | null>(null)

  const [outputs, setOutputs] = useState<OutputWithClient[]>([])
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const [quick, setQuick] = useState({ client_id: '', brief: '', quantity: 2 })
  const [quickBusy, setQuickBusy] = useState(false)
  const [quickError, setQuickError] = useState<string | null>(null)
  const [quickDone, setQuickDone] = useState<string | null>(null)

  // Generate Statics: grounded, DB-context nano banana generation (Feature 1).
  const [showStatics, setShowStatics] = useState(false)
  const [statics, setStatics] = useState({ client_id: '', brief: '', angle: '', count: 4 })
  const [staticsBusy, setStaticsBusy] = useState(false)
  const [staticsError, setStaticsError] = useState<string | null>(null)
  const [staticsDone, setStaticsDone] = useState<string | null>(null)
  const [staticsResults, setStaticsResults] = useState<{ index: number; image_url: string | null; error: string | null }[]>([])

  const [assets, setAssets] = useState<CreativeAssetWithClient[]>([])
  const [assetsLoading, setAssetsLoading] = useState(true)
  const [assetsError, setAssetsError] = useState<string | null>(null)
  const [showAddLink, setShowAddLink] = useState(false)
  const [newAsset, setNewAsset] = useState({ client_id: '', title: '', kind: 'drive' as AssetKind, url: '', notes: '' })
  const [addingAsset, setAddingAsset] = useState(false)
  const [newAssetError, setNewAssetError] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Research grounding availability per client (TrendTrack ads + Shopify products).
  const [research, setResearch] = useState<Record<string, { trendtrack: number; shopify: number; hasAny: boolean }>>({})

  const fetchResearch = useCallback(async (clientId: string) => {
    if (!clientId || research[clientId]) return
    try {
      const res = await fetch(`/api/creatives?scope=research&client_id=${clientId}`)
      if (res.ok) {
        const d = await res.json()
        if (d.research) setResearch(prev => ({ ...prev, [clientId]: d.research }))
      }
    } catch { /* non-blocking; grounding line just stays hidden */ }
  }, [research])

  const fetchClients = useCallback(async () => {
    const res = await fetch('/api/creatives?scope=clients')
    if (res.ok) {
      const d = await res.json()
      setClients(d.clients ?? [])
    }
  }, [])

  const fetchStrategies = useCallback(async () => {
    setStrategiesLoading(true)
    setStrategiesError(null)
    try {
      const res = await fetch('/api/creatives?scope=strategies')
      const d = await res.json()
      if (!res.ok) { setStrategiesError(d.error ?? 'Failed to load strategies'); return }
      setStrategyItems(d.items ?? [])
    } catch {
      setStrategiesError('Failed to load strategies')
    } finally {
      setStrategiesLoading(false)
    }
  }, [])

  const fetchAssets = useCallback(async () => {
    setAssetsLoading(true)
    setAssetsError(null)
    try {
      const res = await fetch('/api/creatives?scope=assets')
      const d = await res.json()
      if (!res.ok) { setAssetsError(d.error ?? 'Failed to load creative library'); return }
      setAssets(d.assets ?? [])
    } catch {
      setAssetsError('Failed to load creative library')
    } finally {
      setAssetsLoading(false)
    }
  }, [])

  const fetchOutputs = useCallback(async () => {
    const res = await fetch('/api/creatives?scope=outputs')
    if (res.ok) {
      const d = await res.json()
      setOutputs(d.outputs ?? [])
    }
  }, [])

  useEffect(() => {
    fetchClients()
    fetchStrategies()
    fetchAssets()
    fetchOutputs()
  }, [fetchClients, fetchStrategies, fetchAssets, fetchOutputs])

  // Probe research grounding whenever a client is picked in either generator.
  useEffect(() => { if (quick.client_id) fetchResearch(quick.client_id) }, [quick.client_id, fetchResearch])
  useEffect(() => { if (statics.client_id) fetchResearch(statics.client_id) }, [statics.client_id, fetchResearch])

  // Subtle one-liner describing what grounds this client's generated concepts.
  function researchLine(clientId: string) {
    if (!clientId) return null
    const r = research[clientId]
    if (!r) return <p className="text-[11px] text-[#636780] mt-1">Checking research grounding...</p>
    const text = r.hasAny
      ? `Research grounding: TrendTrack (${r.trendtrack} ad${r.trendtrack === 1 ? '' : 's'}), Shopify (${r.shopify} product${r.shopify === 1 ? '' : 's'})`
      : 'Research grounding: profile only'
    return <p className="text-[11px] text-[#636780] mt-1">{text}</p>
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(url)
      setTimeout(() => setCopiedUrl(prev => (prev === url ? null : prev)), 1500)
    } catch { /* clipboard blocked; ignore */ }
  }

  async function runQuickGenerate() {
    if (!quick.client_id || !quick.brief.trim()) {
      setQuickError('Pick a client and describe the statics you need.')
      return
    }
    setQuickBusy(true)
    setQuickError(null)
    setQuickDone(null)
    try {
      const res = await fetch('/api/creatives/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: quick.client_id, brief: quick.brief, quantity: quick.quantity }),
      })
      const d = await res.json()
      if (!res.ok || !d.delivered) {
        setQuickError(d.error ?? 'Generation failed.')
        return
      }
      setQuickDone(`Generated ${d.generated} static${d.generated === 1 ? '' : 's'}${d.failed ? `, ${d.failed} failed` : ''}.`)
      setQuick(q => ({ ...q, brief: '' }))
      fetchOutputs()
    } catch {
      setQuickError('Generation failed.')
    } finally {
      setQuickBusy(false)
    }
  }

  async function runGenerateStatics() {
    if (!statics.client_id) {
      setStaticsError('Pick a client to generate statics for.')
      return
    }
    setStaticsBusy(true)
    setStaticsError(null)
    setStaticsDone(null)
    setStaticsResults([])
    try {
      const res = await fetch('/api/creatives/generate-statics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: statics.client_id,
          brief: statics.brief,
          angle: statics.angle,
          count: statics.count,
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        // A no-AI-imagery rule refusal (422) comes back with a clear message.
        setStaticsError(d.error ?? 'Generation failed.')
        if (Array.isArray(d.results)) setStaticsResults(d.results)
        return
      }
      setStaticsResults(Array.isArray(d.results) ? d.results : [])
      setStaticsDone(`Generated ${d.generated} static${d.generated === 1 ? '' : 's'}${d.failed ? `, ${d.failed} failed` : ''}.`)
      fetchOutputs()
    } catch {
      setStaticsError('Generation failed.')
    } finally {
      setStaticsBusy(false)
    }
  }

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function submitNewStrategy() {
    if (!newStrategy.client_id || !newStrategy.focus.trim()) {
      setNewStrategyError('Pick a client and describe this week\'s focus.')
      return
    }
    setCreatingStrategy(true)
    setNewStrategyError(null)
    try {
      const res = await fetch('/api/creatives/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStrategy),
      })
      const d = await res.json()
      if (!res.ok) { setNewStrategyError(d.error ?? 'Failed to draft strategy'); return }
      setShowNewStrategy(false)
      setNewStrategy({ client_id: '', focus: '', notes: '' })
      fetchStrategies()
    } catch {
      setNewStrategyError('Failed to draft strategy')
    } finally {
      setCreatingStrategy(false)
    }
  }

  async function approveStrategy(id: string) {
    setBusyStrategyId(id)
    try {
      const res = await fetch(`/api/creatives/strategy/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      if (res.ok) fetchStrategies()
    } finally {
      setBusyStrategyId(null)
    }
  }

  async function generateStatics(id: string) {
    setBusyStrategyId(id)
    setGenNote(prev => ({ ...prev, [id]: 'Generating statics, this can take up to a minute...' }))
    try {
      const res = await fetch('/api/creatives/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy_id: id }),
      })
      const d = await res.json()
      if (d.delivered) {
        setGenNote(prev => ({ ...prev, [id]: `Generated ${d.generated} static${d.generated === 1 ? '' : 's'}${d.failed ? `, ${d.failed} failed` : ''}.` }))
        fetchStrategies()
        fetchOutputs()
      } else {
        setGenNote(prev => ({ ...prev, [id]: d.error ?? 'Generation failed.' }))
        fetchStrategies()
      }
    } catch {
      setGenNote(prev => ({ ...prev, [id]: 'Generation failed.' }))
      fetchStrategies()
    } finally {
      setBusyStrategyId(null)
    }
  }

  async function submitNewAsset() {
    if (!newAsset.client_id || !newAsset.title.trim()) {
      setNewAssetError('Pick a client and give the link a title.')
      return
    }
    setAddingAsset(true)
    setNewAssetError(null)
    try {
      const res = await fetch('/api/creatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAsset),
      })
      const d = await res.json()
      if (!res.ok) { setNewAssetError(d.error ?? 'Failed to add link'); return }
      setShowAddLink(false)
      setNewAsset({ client_id: '', title: '', kind: 'drive', url: '', notes: '' })
      fetchAssets()
    } catch {
      setNewAssetError('Failed to add link')
    } finally {
      setAddingAsset(false)
    }
  }

  async function deleteAsset(id: string) {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id)
      return
    }
    setDeleteConfirmId(null)
    const res = await fetch(`/api/creatives?id=${id}`, { method: 'DELETE' })
    if (res.ok) setAssets(prev => prev.filter(a => a.id !== id))
  }

  const assetsByClient = new Map<string, CreativeAssetWithClient[]>()
  for (const a of assets) {
    const key = a.client?.id ?? 'unknown'
    const list = assetsByClient.get(key) ?? []
    list.push(a)
    assetsByClient.set(key, list)
  }

  return (
    <div className="p-6 min-h-full">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-[#e4e6f0]">Creative Hub</h1>
        <div className="flex gap-1 bg-[#10121a] border border-[#1c2035] rounded-lg p-1">
          {(['strategies', 'library'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                tab === t ? 'bg-indigo-600 text-white' : 'text-[#636780] hover:text-[#e4e6f0]'
              }`}
            >
              {t === 'strategies' ? "This Week's Strategies" : 'Creative Library'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'strategies' && (
        <div>
          {/* Generate Statics: grounded nano banana generation from client DB context. */}
          <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-4 mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-emerald-400" />
                <p className="text-sm font-medium text-[#e4e6f0]">Generate Statics</p>
                <span className="text-xs text-[#636780]">grounded in the client&apos;s brand notes and onboarding</span>
              </div>
              <button
                onClick={() => setShowStatics((v) => !v)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
              >
                {showStatics ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {showStatics ? 'Close' : 'Generate Statics'}
              </button>
            </div>

            {showStatics && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                  <select
                    value={statics.client_id}
                    onChange={(e) => setStatics((s) => ({ ...s, client_id: e.target.value }))}
                    className="bg-[#08090c] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Select client...</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select
                    value={statics.count}
                    onChange={(e) => setStatics((s) => ({ ...s, count: Number(e.target.value) }))}
                    className="bg-[#08090c] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} image{n === 1 ? '' : 's'}</option>)}
                  </select>
                </div>
                {researchLine(statics.client_id)}
                <input
                  value={statics.angle}
                  onChange={(e) => setStatics((s) => ({ ...s, angle: e.target.value }))}
                  placeholder="Angle, e.g. social proof, founder story, summer resort"
                  className="w-full bg-[#08090c] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <textarea
                  value={statics.brief}
                  onChange={(e) => setStatics((s) => ({ ...s, brief: e.target.value }))}
                  placeholder="Optional brief, e.g. hero product on colour block, urgent sale tone, 4:5 for feed"
                  rows={2}
                  className="w-full bg-[#08090c] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
                <button
                  onClick={runGenerateStatics}
                  disabled={staticsBusy}
                  className="flex items-center justify-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {staticsBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><ImageIcon className="h-4 w-4" /> Generate Statics</>}
                </button>
                {staticsError && <p className="text-xs text-red-400">{staticsError}</p>}
                {staticsDone && <p className="text-xs text-emerald-400">{staticsDone}</p>}
                {staticsResults.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                    {staticsResults.map((r) => (
                      <div key={r.index} className="rounded-lg border border-[#1c2035] bg-[#08090c] overflow-hidden">
                        {r.image_url ? (
                          <a href={r.image_url} target="_blank" rel="noopener noreferrer" className="block aspect-square bg-[#0d0f16]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={r.image_url} alt={`Static ${r.index + 1}`} className="w-full h-full object-cover" />
                          </a>
                        ) : (
                          <div className="aspect-square flex items-center justify-center p-2 text-center">
                            <span className="text-[10px] text-red-400">{r.error ?? 'Failed'}</span>
                          </div>
                        )}
                        {r.image_url && (
                          <div className="p-2">
                            <a
                              href={r.image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                              className="flex items-center gap-1 text-[10px] text-[#636780] hover:text-emerald-400"
                            >
                              <ExternalLink className="h-3 w-3" /> Open / download
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Generate: statics in minutes, no weekly strategy needed. */}
          <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-b from-indigo-500/[0.07] to-transparent p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Wand2 className="h-4 w-4 text-indigo-400" />
              <p className="text-sm font-medium text-[#e4e6f0]">Quick Generate</p>
              <span className="text-xs text-[#636780]">statics in minutes, no strategy needed</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={quick.client_id}
                    onChange={(e) => setQuick(q => ({ ...q, client_id: e.target.value }))}
                    className="bg-[#08090c] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Select client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select
                    value={quick.quantity}
                    onChange={(e) => setQuick(q => ({ ...q, quantity: Number(e.target.value) }))}
                    className="bg-[#08090c] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} image{n === 1 ? '' : 's'}</option>)}
                  </select>
                </div>
                {researchLine(quick.client_id)}
                <textarea
                  value={quick.brief}
                  onChange={(e) => setQuick(q => ({ ...q, brief: e.target.value }))}
                  placeholder="What statics do you need? e.g. bold product-on-colour ad for the summer sale, price 29.99, urgent tone"
                  rows={2}
                  className="w-full bg-[#08090c] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>
              <button
                onClick={runQuickGenerate}
                disabled={quickBusy}
                className="flex items-center justify-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 self-start sm:h-full sm:min-w-[8rem]"
              >
                {quickBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Wand2 className="h-4 w-4" /> Generate</>}
              </button>
            </div>
            {quickError && <p className="text-xs text-red-400 mt-2">{quickError}</p>}
            {quickDone && <p className="text-xs text-emerald-400 mt-2">{quickDone}</p>}
            {(() => {
              const adhoc = outputs.filter(o => !o.strategy_id && o.client_id === quick.client_id)
              return quick.client_id && adhoc.length > 0 ? (
                <div className="mt-3">
                  <p className="text-[11px] text-[#636780] mb-2">Recent Quick Generate results</p>
                  <OutputGrid items={adhoc} copiedUrl={copiedUrl} onCopy={copyUrl} />
                </div>
              ) : null
            })()}
          </div>

          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-[#636780]">One strategy per client per week. Approve a draft, then queue statics.</p>
            <button
              onClick={() => setShowNewStrategy(v => !v)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500"
            >
              <Plus className="h-3.5 w-3.5" /> New Strategy
            </button>
          </div>

          {showNewStrategy && (
            <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-4 mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#e4e6f0]">Draft a new strategy</p>
                <button onClick={() => setShowNewStrategy(false)} className="text-[#636780] hover:text-[#e4e6f0]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <select
                value={newStrategy.client_id}
                onChange={(e) => setNewStrategy(s => ({ ...s, client_id: e.target.value }))}
                className="w-full bg-[#08090c] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <textarea
                value={newStrategy.focus}
                onChange={(e) => setNewStrategy(s => ({ ...s, focus: e.target.value }))}
                placeholder="What should this week focus on? e.g. UGC angles for summer sale"
                rows={2}
                className="w-full bg-[#08090c] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
              <textarea
                value={newStrategy.notes}
                onChange={(e) => setNewStrategy(s => ({ ...s, notes: e.target.value }))}
                placeholder="Optional notes for the AI (constraints, assets available, etc.)"
                rows={2}
                className="w-full bg-[#08090c] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
              {newStrategyError && <p className="text-xs text-red-400">{newStrategyError}</p>}
              <button
                onClick={submitNewStrategy}
                disabled={creatingStrategy}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" /> {creatingStrategy ? 'Drafting...' : 'Draft with AI'}
              </button>
            </div>
          )}

          {strategiesLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-sm text-[#636780]">Loading strategies...</span>
            </div>
          ) : strategiesError ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-[#1c2035] bg-[#10121a]">
              <p className="text-sm text-red-400">{strategiesError}</p>
            </div>
          ) : strategyItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-[#1c2035] bg-[#10121a]">
              <p className="text-sm text-[#636780]">No clients yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {strategyItems.map(({ client, strategy }) => (
                <div key={client.id} className="rounded-xl border border-[#1c2035] bg-[#10121a] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-[#e4e6f0]">{client.name}</p>
                        {strategy ? (
                          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${STATUS_COLOURS[strategy.status] ?? ''}`}>
                            {STATUS_LABELS[strategy.status] ?? strategy.status}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#636780]/15 text-[#636780]">
                            No strategy
                          </span>
                        )}
                      </div>
                      {strategy?.focus && <p className="text-xs text-[#636780]">{strategy.focus}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {strategy && strategy.status === 'draft' && (
                        <button
                          onClick={() => approveStrategy(strategy.id)}
                          disabled={busyStrategyId === strategy.id}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                      )}
                      {strategy && strategy.status === 'approved' && (
                        <button
                          onClick={() => generateStatics(strategy.id)}
                          disabled={busyStrategyId === strategy.id}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#181b27] text-[#e4e6f0] hover:bg-[#1c2035] disabled:opacity-50"
                        >
                          {busyStrategyId === strategy.id
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                            : <><ImageIcon className="h-3.5 w-3.5" /> Generate statics</>}
                        </button>
                      )}
                      {strategy && strategy.status === 'generating' && (
                        <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-purple-500/15 text-purple-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...
                        </span>
                      )}
                      {strategy && strategy.status === 'delivered' && (
                        <button
                          onClick={() => generateStatics(strategy.id)}
                          disabled={busyStrategyId === strategy.id}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#181b27] text-[#e4e6f0] hover:bg-[#1c2035] disabled:opacity-50"
                        >
                          {busyStrategyId === strategy.id
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Working...</>
                            : <><RefreshCw className="h-3.5 w-3.5" /> Regenerate</>}
                        </button>
                      )}
                      {strategy?.strategy_md && (
                        <button
                          onClick={() => toggleExpanded(strategy.id)}
                          className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg text-[#636780] hover:text-[#e4e6f0]"
                        >
                          {expanded.has(strategy.id) ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {strategy && genNote[strategy.id] && (
                    <p className="text-xs text-[#636780] mt-2">{genNote[strategy.id]}</p>
                  )}

                  {strategy?.strategy_md && expanded.has(strategy.id) && (
                    <div className="mt-3 bg-[#08090c] rounded-lg p-3">
                      <p className="text-xs text-[#e4e6f0] whitespace-pre-wrap leading-relaxed">{strategy.strategy_md}</p>
                    </div>
                  )}

                  {strategy && (() => {
                    const stratOutputs = outputs.filter(o => o.strategy_id === strategy.id)
                    return stratOutputs.length > 0 ? (
                      <div className="mt-3">
                        <OutputGrid items={stratOutputs} copiedUrl={copiedUrl} onCopy={copyUrl} />
                      </div>
                    ) : null
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'library' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-[#636780]">Drive links, briefs, and inspiration, grouped by client.</p>
            <button
              onClick={() => setShowAddLink(v => !v)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500"
            >
              <Plus className="h-3.5 w-3.5" /> Add link
            </button>
          </div>

          {showAddLink && (
            <div className="rounded-xl border border-[#1c2035] bg-[#10121a] p-4 mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#e4e6f0]">Add a creative link</p>
                <button onClick={() => setShowAddLink(false)} className="text-[#636780] hover:text-[#e4e6f0]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newAsset.client_id}
                  onChange={(e) => setNewAsset(a => ({ ...a, client_id: e.target.value }))}
                  className="bg-[#08090c] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select
                  value={newAsset.kind}
                  onChange={(e) => setNewAsset(a => ({ ...a, kind: e.target.value as AssetKind }))}
                  className="bg-[#08090c] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {ASSET_KINDS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                </select>
              </div>
              <input
                value={newAsset.title}
                onChange={(e) => setNewAsset(a => ({ ...a, title: e.target.value }))}
                placeholder="Title, e.g. Brand assets folder"
                className="w-full bg-[#08090c] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <input
                value={newAsset.url}
                onChange={(e) => setNewAsset(a => ({ ...a, url: e.target.value }))}
                placeholder="URL"
                className="w-full bg-[#08090c] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <input
                value={newAsset.notes}
                onChange={(e) => setNewAsset(a => ({ ...a, notes: e.target.value }))}
                placeholder="Optional notes"
                className="w-full bg-[#08090c] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {newAssetError && <p className="text-xs text-red-400">{newAssetError}</p>}
              <button
                onClick={submitNewAsset}
                disabled={addingAsset}
                className="text-xs px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {addingAsset ? 'Adding...' : 'Add link'}
              </button>
            </div>
          )}

          {assetsLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-sm text-[#636780]">Loading creative library...</span>
            </div>
          ) : assetsError ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-[#1c2035] bg-[#10121a]">
              <p className="text-sm text-red-400">{assetsError}</p>
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-[#1c2035] bg-[#10121a]">
              <p className="text-sm text-[#636780]">No creative links yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(assetsByClient.entries()).map(([clientId, list]) => (
                <div key={clientId} className="rounded-xl border border-[#1c2035] bg-[#10121a] p-4">
                  <p className="text-sm font-medium text-[#e4e6f0] mb-3">{list[0].client?.name ?? 'Unknown client'}</p>
                  <div className="space-y-2">
                    {list.map(asset => (
                      <div key={asset.id} className="flex items-start justify-between gap-3 bg-[#08090c] rounded-lg p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400">
                              {KIND_LABELS[asset.kind]}
                            </span>
                            <span className="text-xs text-[#636780]">{fmtDate(asset.created_at)}</span>
                          </div>
                          {asset.url ? (
                            <a
                              href={asset.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-[#e4e6f0] hover:text-indigo-400 flex items-center gap-1.5"
                            >
                              {asset.title}
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : (
                            <p className="text-sm text-[#e4e6f0]">{asset.title}</p>
                          )}
                          {asset.notes && <p className="text-xs text-[#636780] mt-1">{asset.notes}</p>}
                        </div>
                        <button
                          onClick={() => deleteAsset(asset.id)}
                          className={`shrink-0 text-xs px-2 py-1.5 rounded-lg flex items-center gap-1 ${
                            deleteConfirmId === asset.id
                              ? 'bg-red-500/15 text-red-400'
                              : 'text-[#636780] hover:text-[#e4e6f0]'
                          }`}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> {deleteConfirmId === asset.id ? 'Confirm' : ''}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
