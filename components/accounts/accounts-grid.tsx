'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Plus, Circle, TrendingUp, AlertTriangle, Users, Calendar, CheckSquare, Trash2, X } from 'lucide-react'
import { fetchAccounts, deleteAccount, createAccount, type AccountListItem } from '@/lib/accounts-client'
import type { Client } from '@/lib/types'

const HEALTH_COLOUR: Record<string, string> = {
  red:   'text-red-400',
  amber: 'text-amber-400',
  green: 'text-emerald-400',
}

const HEALTH_BG: Record<string, string> = {
  red:   'border-red-900/40 bg-red-950/20',
  amber: 'border-amber-900/40 bg-amber-950/10',
  green: 'border-[#1c2035] bg-[#0e1017]',
}

const HEALTH_SORT: Record<string, number> = { red: 0, amber: 1, green: 2 }

function fmt(n: number | null | undefined, currency = 'GBP'): string {
  if (n == null) return '--'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 0 }).format(n)
}

function relativeDate(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'yesterday'
  return `${diff}d ago`
}

function nextMeetingLabel(m: AccountListItem['next_meeting']): string {
  if (!m) return 'none scheduled'
  const d = new Date(m.scheduled_at)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function AccountsGrid() {
  const [accounts, setAccounts] = useState<AccountListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [healthFilter, setHealthFilter] = useState<'all' | 'red' | 'amber' | 'green'>('all')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showNewClient, setShowNewClient] = useState(false)

  function refreshAccounts() {
    setLoading(true)
    fetchAccounts()
      .then((data) => {
        const sorted = [...data].sort((a, b) => {
          const h = (HEALTH_SORT[a.health] ?? 2) - (HEALTH_SORT[b.health] ?? 2)
          if (h !== 0) return h
          return a.name.localeCompare(b.name)
        })
        setAccounts(sorted)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteAccount(id)
      setAccounts((prev) => prev.filter((a) => a.id !== id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDeletingId(null)
      setConfirmingId(null)
    }
  }

  useEffect(() => {
    refreshAccounts()
  }, [])

  const displayed = healthFilter === 'all'
    ? accounts
    : accounts.filter((a) => a.health === healthFilter)

  const counts = {
    red:   accounts.filter((a) => a.health === 'red').length,
    amber: accounts.filter((a) => a.health === 'amber').length,
    green: accounts.filter((a) => a.health === 'green').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#636780]" size={20} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-red-400 text-sm">
        Failed to load accounts: {error}
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[#e4e6f0] font-semibold text-lg">Accounts</h1>
          <p className="text-[#636780] text-xs mt-0.5">{accounts.length} active clients</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/accounts/approvals"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            <CheckSquare size={12} />
            Approvals
          </Link>
          <Link
            href="/accounts/issues"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#181b27] hover:bg-[#1c2035] text-[#e4e6f0] border border-[#1c2035] transition-colors"
          >
            <AlertTriangle size={12} />
            Issues
          </Link>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#181b27] hover:bg-[#1c2035] text-[#e4e6f0] border border-[#1c2035] transition-colors"
            onClick={() => setShowNewClient(true)}
          >
            <Plus size={12} />
            New client
          </button>
        </div>
      </div>

      {/* Health summary bar */}
      <div className="flex items-center gap-3 mb-5">
        {(['all', 'red', 'amber', 'green'] as const).map((h) => {
          const count = h === 'all' ? accounts.length : counts[h]
          const active = healthFilter === h
          return (
            <button
              key={h}
              onClick={() => setHealthFilter(h)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                active
                  ? 'bg-[#181b27] border-[#3d4060] text-[#e4e6f0]'
                  : 'border-transparent text-[#636780] hover:text-[#e4e6f0]'
              }`}
            >
              {h !== 'all' && (
                <Circle
                  size={8}
                  className={`fill-current ${HEALTH_COLOUR[h]}`}
                />
              )}
              {h === 'all' ? 'All' : h.charAt(0).toUpperCase() + h.slice(1)}
              <span className="ml-1 text-[#3d4060]">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {displayed.map((account) => (
          <Link
            key={account.id}
            href={`/accounts/${account.id}`}
            className={`group relative block min-w-0 rounded-xl border p-4 transition-all hover:border-[#3d4060] ${HEALTH_BG[account.health] ?? HEALTH_BG.green}`}
          >
            {/* Name + health */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0 flex-1">
                <p className="text-[#e4e6f0] font-medium text-sm truncate">{account.name}</p>
                {account.am && (
                  <p className="text-[#636780] text-xs mt-0.5 flex items-center gap-1 min-w-0">
                    <Users size={10} className="shrink-0" />
                    <span className="truncate">{(account.am as { name: string }).name}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 mt-1">
                {confirmingId === account.id ? (
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={deletingId === account.id}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(account.id) }}
                      className="rounded px-1.5 py-0.5 text-[10px] bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50"
                    >
                      {deletingId === account.id ? '...' : 'Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmingId(null) }}
                      className="rounded px-1.5 py-0.5 text-[10px] bg-[#181b27] hover:bg-[#1c2035] text-[#636780] border border-[#1c2035] transition-colors"
                    >
                      No
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label="Delete client"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmingId(account.id) }}
                    className="text-[#3d4060] hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
                <Circle
                  size={10}
                  className={`fill-current ${HEALTH_COLOUR[account.health] ?? HEALTH_COLOUR.green}`}
                />
              </div>
            </div>

            {/* 7d metrics: always render, uniform across all clients */}
            {!account.meta_ad_account_id ? (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <Metric label="Spend 7d" value="Not connected" muted />
                <Metric label="Revenue 7d" value="Not connected" muted />
                <Metric label="ROAS 7d" value="Not connected" muted />
              </div>
            ) : !account.metrics_7d ? (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <Metric label="Spend 7d" value="No data yet" muted />
                <Metric label="Revenue 7d" value="No data yet" muted />
                <Metric label="ROAS 7d" value="No data yet" muted />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <Metric label="Spend 7d" value={fmt(account.metrics_7d.spend, account.currency)} />
                <Metric label="Revenue 7d" value={fmt(account.metrics_7d.revenue, account.currency)} />
                <Metric
                  label="ROAS 7d"
                  value={account.metrics_7d.roas_avg != null ? `${account.metrics_7d.roas_avg.toFixed(2)}x` : '--'}
                  highlight={
                    account.target_roas != null && account.metrics_7d.roas_avg != null
                      ? account.metrics_7d.roas_avg < account.target_roas * 0.7
                        ? 'red'
                        : account.metrics_7d.roas_avg < account.target_roas * 0.95
                        ? 'amber'
                        : 'green'
                      : undefined
                  }
                />
              </div>
            )}

            {/* Footer: contact recency, tasks, meeting */}
            <div className="flex items-center justify-between text-[10px] text-[#636780] pt-2 border-t border-[#1c2035]">
              <span>Contact {relativeDate(account.last_client_contact)}</span>
              <span className="flex items-center gap-2">
                {account.open_task_count > 0 && (
                  <span className="flex items-center gap-0.5">
                    <TrendingUp size={9} /> {account.open_task_count}t
                  </span>
                )}
                {account.open_issue_count > 0 && (
                  <span className="flex items-center gap-0.5 text-amber-400">
                    <AlertTriangle size={9} /> {account.open_issue_count}i
                  </span>
                )}
                <span className="flex items-center gap-0.5">
                  <Calendar size={9} /> {nextMeetingLabel(account.next_meeting)}
                </span>
              </span>
            </div>
          </Link>
        ))}
      </div>

      {displayed.length === 0 && (
        <div className="text-center text-[#636780] text-sm py-16">
          No {healthFilter !== 'all' ? healthFilter + ' ' : ''}accounts found.
        </div>
      )}

      {showNewClient && (
        <NewClientModal
          onClose={() => setShowNewClient(false)}
          onSaved={() => {
            setShowNewClient(false)
            refreshAccounts()
          }}
        />
      )}
    </div>
  )
}

// ─── New client modal ───────────────────────────────────────────────────────

const VALID_SERVICES = [
  { value: 'paid_ads', label: 'Paid ads' },
  { value: 'creatives', label: 'Creatives' },
] as const

function NewClientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [services, setServices] = useState<string[]>([])
  const [status, setStatus] = useState<Client['status']>('active')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  function toggleService(value: string) {
    setServices((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Client name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createAccount({
        name: name.trim(),
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        services,
        status,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-[#636780]'
  const labelCls = 'block text-xs font-medium text-[#636780] uppercase tracking-wider mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-[#1c2035] bg-[#10121a] p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[#e4e6f0] font-medium text-sm">New client</h2>
          <button onClick={onClose} className="text-[#636780] hover:text-[#e4e6f0] transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Name *</label>
            <input
              ref={nameRef}
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client / brand name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Contact name</label>
              <input
                className={inputCls}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className={labelCls}>Contact email</label>
              <input
                className={inputCls}
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="jane@client.com"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Services</label>
            <div className="flex gap-2">
              {VALID_SERVICES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleService(s.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                    services.includes(s.value)
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                      : 'bg-[#181b27] border-[#1c2035] text-[#636780] hover:border-[#3d4060] hover:text-[#e4e6f0]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Status</label>
            <select
              className={inputCls}
              value={status}
              onChange={(e) => setStatus(e.target.value as Client['status'])}
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="churned">Churned</option>
            </select>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27] rounded-lg px-3 py-2 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              {saving ? 'Creating...' : 'Create client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Metric({ label, value, highlight, muted }: { label: string; value: string; highlight?: 'red' | 'amber' | 'green'; muted?: boolean }) {
  const colour = muted
    ? 'text-[#3d4060] italic'
    : highlight
    ? { red: 'text-red-400', amber: 'text-amber-400', green: 'text-emerald-400' }[highlight]
    : 'text-[#e4e6f0]'
  return (
    <div>
      <p className="text-[9px] text-[#636780] uppercase tracking-wide">{label}</p>
      <p className={`text-xs font-medium ${colour}`}>{value}</p>
    </div>
  )
}
