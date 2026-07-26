'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, UploadCloud, X, Sparkles, ExternalLink, FileText, Image as ImageIcon, TrendingUp, Lightbulb } from 'lucide-react'

type Suggestion = {
  id: string
  title: string
  angle: string | null
  format: string | null
  rationale: string | null
  evidence: Record<string, unknown> | null
}

type CreativeRequest = {
  id: string
  title: string | null
  context: string | null
  count: number
  format: string
  platform: string
  status: string
  result: { drive_links?: string[]; notes?: string; media_asset_ids?: string[] } | null
  error: string | null
  reference_urls: string[] | null
  created_at: string
}

const STATUS_BADGE: Record<string, string> = {
  queued:     'bg-amber-900/40 text-amber-300',
  processing: 'bg-indigo-900/50 text-indigo-300',
  done:       'bg-emerald-900/50 text-emerald-300',
  failed:     'bg-red-900/40 text-red-300',
}

export default function CreativesTab({
  clientId,
  clientName,
  metaConnected,
}: {
  clientId: string
  clientName: string
  metaConnected: boolean
}) {
  const [title, setTitle] = useState('')
  const [context, setContext] = useState('')
  const [extraLinks, setExtraLinks] = useState('')
  const [count, setCount] = useState(6)
  const [format, setFormat] = useState('static')
  const [platform, setPlatform] = useState('Meta')
  const [pullMeta, setPullMeta] = useState(true)
  const [pullTrend, setPullTrend] = useState(true)
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null)
  const [requests, setRequests] = useState<CreativeRequest[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const loadHistory = useCallback(() => {
    fetch(`/api/creatives/request?client_id=${clientId}`)
      .then((r) => r.json())
      .then((d) => setRequests(d.requests ?? []))
      .catch(() => setRequests([]))
      .finally(() => setLoadingHistory(false))
  }, [clientId])

  useEffect(() => { loadHistory() }, [loadHistory])

  useEffect(() => {
    fetch(`/api/creatives/suggestions?client_id=${clientId}`)
      .then((r) => r.json())
      .then((d) => setSuggestions(d.suggestions ?? []))
      .catch(() => setSuggestions([]))
  }, [clientId])

  const useSuggestion = (s: Suggestion) => {
    setTitle(s.title)
    if (s.format === 'video' || s.format === 'static') setFormat(s.format)
    setContext((prev) => {
      const line = `Suggested direction: ${s.title}${s.angle ? ` (${s.angle})` : ''}. ${s.rationale ?? ''}`.trim()
      return prev ? `${prev}\n${line}` : line
    })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const addFiles = (list: FileList | null) => {
    if (!list) return
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 6))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const submit = async () => {
    setSubmitting(true)
    setFlash(null)
    try {
      const fd = new FormData()
      fd.append('client_id', clientId)
      fd.append('title', title)
      fd.append('context', context)
      fd.append('extra_links', extraLinks)
      fd.append('count', String(count))
      fd.append('format', format)
      fd.append('platform', platform)
      fd.append('pull_meta', String(pullMeta))
      fd.append('pull_trendtrack', String(pullTrend))
      files.forEach((f) => fd.append('reference', f))

      const res = await fetch('/api/creatives/request', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setFlash({ ok: true, msg: data.message || 'Batch queued.' })
      setTitle(''); setContext(''); setExtraLinks(''); setFiles([])
      loadHistory()
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : 'Something went wrong' })
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full bg-[#0f1220] border border-[#1c2035] rounded-lg px-3 py-2 text-xs text-[#e4e6f0] placeholder-[#4a4e68] focus:border-indigo-500 focus:outline-none'

  return (
    <div className="space-y-6">
      {/* ── Winning-creative suggestions (data-grounded) ──────────── */}
      {suggestions.length > 0 && (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-emerald-400" />
            <h3 className="text-xs font-semibold text-emerald-300">Suggested winning creatives</h3>
            <span className="text-[10px] text-[#636780]">grounded in what&apos;s working</span>
          </div>
          <p className="text-[10px] text-[#636780] mb-3">Based on this account&apos;s top ROAS ads and the longest-running competitor ads. Click one to prefill a batch.</p>
          <div className="grid grid-cols-2 gap-2">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => useSuggestion(s)}
                className="text-left rounded-lg border border-[#1c2035] bg-[#181b27] hover:border-emerald-700/60 p-3 transition-colors group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#e4e6f0]">
                    <Lightbulb size={12} className="text-amber-300" /> {s.title}
                  </span>
                  {s.format && <span className="text-[9px] uppercase tracking-wide text-[#636780] bg-[#0f1220] px-1.5 py-0.5 rounded">{s.format}</span>}
                </div>
                {s.rationale && <p className="text-[10px] text-[#8b90ad] mt-1.5 line-clamp-3">{s.rationale}</p>}
                <span className="text-[10px] text-emerald-400 mt-1.5 inline-block opacity-0 group-hover:opacity-100 transition-opacity">Use this →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Create batch ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#1c2035] bg-[#181b27] p-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={15} className="text-indigo-400" />
          <h3 className="text-sm font-semibold text-[#e4e6f0]">Create new batch of creatives</h3>
        </div>
        <p className="text-[11px] text-[#636780] mb-4">
          Queues an AI creative batch for {clientName}. The engine pulls the ad-account data
          {pullTrend ? ', TrendTrack intel' : ''} and your reference below, generates the creatives,
          and delivers them to the client&apos;s Drive. You approve before anything goes live.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-[#636780] mb-1">Batch name</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Aug week 1 - beauty box" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[#636780] mb-1"># Creatives</label>
              <input type="number" min={1} max={30} className={inputCls} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[#636780] mb-1">Format</label>
              <select className={inputCls} value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="static">Static</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[#636780] mb-1">Platform</label>
              <select className={inputCls} value={platform} onChange={(e) => setPlatform(e.target.value)}>
                <option value="Meta">Meta</option>
                <option value="TikTok">TikTok</option>
              </select>
            </div>
          </div>
        </div>

        {/* Drag + drop reference */}
        <label className="block text-[10px] uppercase tracking-wide text-[#636780] mb-1">Reference creatives (most recent ad, image or .md)</label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`rounded-lg border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
            dragging ? 'border-indigo-500 bg-indigo-500/5' : 'border-[#242a42] hover:border-[#33395a]'
          }`}
        >
          <UploadCloud size={20} className="mx-auto text-[#636780] mb-1" />
          <p className="text-[11px] text-[#8b90ad]">Drag & drop, or click to upload. Images or a Markdown brief.</p>
          <input ref={inputRef} type="file" multiple accept="image/*,.md,.txt,.pdf" className="hidden"
            onChange={(e) => addFiles(e.target.files)} />
        </div>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 bg-[#0f1220] border border-[#1c2035] rounded-md px-2 py-1 text-[10px] text-[#b8bcd4]">
                {f.type.startsWith('image') ? <ImageIcon size={11} /> : <FileText size={11} />}
                {f.name.length > 26 ? f.name.slice(0, 24) + '…' : f.name}
                <button onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, j) => j !== i)) }}>
                  <X size={11} className="text-[#636780] hover:text-red-400" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-[#636780] mb-1">Context / brief</label>
            <textarea className={`${inputCls} h-20 resize-none`} value={context} onChange={(e) => setContext(e.target.value)}
              placeholder="Angle, offer, must-haves, what worked last time…" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-[#636780] mb-1">Extra reference folders / links</label>
            <textarea className={`${inputCls} h-20 resize-none`} value={extraLinks} onChange={(e) => setExtraLinks(e.target.value)}
              placeholder="Drive links, one per line…" />
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3">
          <label className={`inline-flex items-center gap-2 text-[11px] cursor-pointer ${metaConnected ? 'text-[#b8bcd4]' : 'text-[#4a4e68]'}`}>
            <input type="checkbox" checked={pullMeta && metaConnected} disabled={!metaConnected} onChange={(e) => setPullMeta(e.target.checked)} className="accent-indigo-500" />
            Pull ad-account data {metaConnected ? '' : '(not connected)'}
          </label>
          <label className="inline-flex items-center gap-2 text-[11px] text-[#b8bcd4] cursor-pointer">
            <input type="checkbox" checked={pullTrend} onChange={(e) => setPullTrend(e.target.checked)} className="accent-indigo-500" />
            Pull TrendTrack intel
          </label>
        </div>

        {flash && (
          <div className={`mt-3 text-[11px] rounded-lg px-3 py-2 ${flash.ok ? 'bg-emerald-900/30 text-emerald-300' : 'bg-red-900/30 text-red-300'}`}>
            {flash.msg}
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting}
          className="mt-4 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg px-4 py-2 transition-colors"
        >
          {submitting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          Generate new creatives
        </button>
      </div>

      {/* ── History ──────────────────────────────────────────────── */}
      <div>
        <h4 className="text-xs font-semibold text-[#8b90ad] uppercase tracking-wide mb-3">Recent batches</h4>
        {loadingHistory ? (
          <div className="flex items-center gap-2 text-[#636780] text-xs"><Loader2 size={14} className="animate-spin" /> Loading…</div>
        ) : requests.length === 0 ? (
          <p className="text-[#636780] text-xs">No batches yet. Create your first above.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="rounded-lg border border-[#1c2035] bg-[#181b27] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-[#e4e6f0] font-medium truncate">{r.title || `${r.count} ${r.format}s`}</p>
                    <p className="text-[10px] text-[#636780] mt-0.5">
                      {r.count} × {r.format} · {r.platform} · {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[9px] font-semibold uppercase tracking-wide px-2 py-1 rounded ${STATUS_BADGE[r.status] ?? 'bg-[#1c2035] text-[#636780]'}`}>
                    {r.status}
                  </span>
                </div>
                {r.context && <p className="text-[10px] text-[#8b90ad] mt-2 line-clamp-2">{r.context}</p>}
                {r.error && <p className="text-[10px] text-red-300 mt-2">{r.error}</p>}
                {r.result?.drive_links && r.result.drive_links.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {r.result.drive_links.map((l, i) => (
                      <a key={i} href={l} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300">
                        <ExternalLink size={10} /> Drive {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
