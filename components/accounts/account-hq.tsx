'use client'

import { useEffect, useState } from 'react'
import { Loader2, Circle, ArrowLeft, MessageSquare, Lightbulb, AlertTriangle, FileText, Calendar, Save, X } from 'lucide-react'
import Link from 'next/link'
import { fetchAccount, updateAccount } from '@/lib/accounts-client'
import { useTaskMeta, useCurrentUserId } from '@/lib/tasks-client'
import AccountModals, { type ModalKind } from './account-modals'
import ReportView from './report-view'
import ReportHistory from './report-history'
import PastMeetings from './past-meetings'
import type { Client, ClientIssue, ClientReport, ClientMeeting, ClientMetricsDaily } from '@/lib/types'

const HEALTH_COLOUR: Record<string, string> = {
  red: 'text-red-400', amber: 'text-amber-400', green: 'text-emerald-400',
}

const SEVERITY_BADGE: Record<string, string> = {
  trust_threatening: 'bg-red-900/60 text-red-300',
  major:             'bg-amber-900/50 text-amber-300',
  minor:             'bg-[#1c2035] text-[#636780]',
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  weekly_eow:       'EOW Update',
  monday_kickoff:   'Monday Kickoff',
  meeting_prep:     'Prep Brief',
  meeting_followup: 'Follow-up',
  monthly_deep_dive: 'Monthly Deep Dive',
}

const STATUS_COLOUR: Record<string, string> = {
  pending_approval: 'text-amber-400',
  approved:         'text-emerald-400',
  sent:             'text-indigo-400',
  rejected:         'text-red-400',
}

type AccountData = {
  account: Client & { am?: { id: string; name: string; role: string } | null }
  open_tasks: Array<{ id: string; title: string; status: string; priority: string; due_date: string | null }>
  open_issues: ClientIssue[]
  pending_reports: ClientReport[]
  metrics_30d: ClientMetricsDaily[]
  upcoming_meetings: ClientMeeting[]
  recent_comms: Array<{
    id: string; direction: string; channel: string; summary: string; sentiment: string
    flags: string[]; requires_response: boolean; response_due_at: string | null
    responded_at: string | null; sla_breached: boolean; occurred_at: string
    logger: { id: string; name: string } | null
  }>
}

type TabId = 'overview' | 'report' | 'meetings' | 'reports' | 'settings'

export default function AccountHQ({ accountId }: { accountId: string }) {
  const [data, setData] = useState<AccountData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('overview')
  const [modal, setModal] = useState<ModalKind>(null)
  const { profiles } = useTaskMeta()
  const currentUserId = useCurrentUserId()

  const reload = () => {
    fetchAccount(accountId)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#636780]" size={20} />
      </div>
    )
  }

  if (error || !data) {
    return <div className="p-6 text-red-400 text-sm">{error ?? 'Account not found'}</div>
  }

  const { account, open_tasks, open_issues, pending_reports, metrics_30d, upcoming_meetings, recent_comms } = data
  const topCreatives = metrics_30d.length
    ? (metrics_30d[metrics_30d.length - 1].top_creatives ?? [])
    : []

  // 7d average ROAS
  const last7d = metrics_30d.slice(-7)
  const roasValues = last7d.flatMap((m) => m.roas != null ? [m.roas] : [])
  const avgRoas7d = roasValues.length ? roasValues.reduce((a, b) => a + b, 0) / roasValues.length : null
  const spend7d = last7d.reduce((s, m) => s + (m.spend ?? 0), 0)

  return (
    <div className="p-6 max-w-5xl">
      {/* Back */}
      <Link href="/accounts" className="flex items-center gap-1.5 text-xs text-[#636780] hover:text-[#e4e6f0] mb-4 transition-colors">
        <ArrowLeft size={13} /> All accounts
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <Circle
            size={12}
            className={`fill-current shrink-0 mt-1 ${HEALTH_COLOUR[account.health] ?? HEALTH_COLOUR.green}`}
          />
          <div>
            <h1 className="text-[#e4e6f0] font-semibold text-xl">{account.name}</h1>
            <p className="text-[#636780] text-xs mt-0.5">
              {account.am ? `AM: ${account.am.name}` : 'No AM assigned'}
              {account.mrr != null && (
                <span className="ml-3">
                  {new Intl.NumberFormat('en-GB', { style: 'currency', currency: account.currency || 'GBP', minimumFractionDigits: 0 }).format(account.mrr)}/mo
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Quick action links */}
        <div className="flex items-center gap-2">
          {pending_reports.length > 0 && (
            <Link
              href="/accounts/approvals"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-amber-700/60 hover:bg-amber-700/80 text-amber-200 border border-amber-800 transition-colors"
            >
              <FileText size={11} />
              {pending_reports.length} pending
            </Link>
          )}
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <Stat label="7d Spend" value={spend7d ? `£${spend7d.toLocaleString('en-GB', { maximumFractionDigits: 0 })}` : '--'} />
        <Stat
          label="7d Avg ROAS"
          value={avgRoas7d != null ? `${avgRoas7d.toFixed(2)}x` : '--'}
          sub={account.target_roas ? `target ${account.target_roas}x` : undefined}
          highlight={
            avgRoas7d != null && account.target_roas != null
              ? avgRoas7d < account.target_roas * 0.7 ? 'red'
              : avgRoas7d < account.target_roas * 0.95 ? 'amber' : 'green'
              : undefined
          }
        />
        <Stat label="Open tasks" value={String(open_tasks.length)} />
        <Stat label="Open issues" value={String(open_issues.length)} highlight={open_issues.length > 0 ? 'amber' : undefined} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#1c2035] mb-5">
        {([
          ['overview', 'Overview'],
          ['report', 'Weekly Report'],
          ['meetings', 'Past Meetings'],
          ['reports', 'History'],
          ['settings', 'Settings'],
        ] as [TabId, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'text-[#e4e6f0] border-indigo-500'
                : 'text-[#636780] border-transparent hover:text-[#e4e6f0]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Weekly report tab: sleek rendered metrics */}
      {tab === 'report' && (
        <ReportView account={account} metrics30d={metrics_30d} />
      )}

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Top creatives */}
          {topCreatives.length > 0 && (
            <Section title="Winning creatives this period">
              <div className="grid grid-cols-3 gap-3">
                {topCreatives.slice(0, 3).map((c: { ad_id: string; name: string; spend: number; roas: number; thumbnail_url: string | null }) => (
                  <div key={c.ad_id} className="rounded-lg border border-[#1c2035] bg-[#181b27] p-3">
                    <p className="text-[#e4e6f0] text-xs font-medium truncate">{c.name}</p>
                    <p className="text-[#636780] text-[10px] mt-1">
                      Spend: £{c.spend?.toLocaleString('en-GB', { maximumFractionDigits: 0 })} &middot; ROAS: {c.roas?.toFixed(2)}x
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Upcoming meetings */}
          {upcoming_meetings.length > 0 && (
            <Section title="Upcoming meetings">
              <div className="space-y-2">
                {upcoming_meetings.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-[#1c2035] bg-[#181b27] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-[#636780]" />
                      <span className="text-xs text-[#e4e6f0]">
                        {new Date(m.scheduled_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] text-[#636780] capitalize">{m.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Open tasks */}
          {open_tasks.length > 0 && (
            <Section title="Open tasks">
              <div className="space-y-1.5">
                {open_tasks.slice(0, 8).map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border border-[#1c2035] bg-[#181b27] px-3 py-2">
                    <span className="text-xs text-[#e4e6f0] truncate">{t.title}</span>
                    <span className="text-[10px] text-[#636780] shrink-0 ml-2">{t.status.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Open issues */}
          {open_issues.length > 0 && (
            <Section title="Open issues">
              <div className="space-y-2">
                {open_issues.map((i) => (
                  <div key={i.id} className="flex items-start justify-between rounded-lg border border-[#1c2035] bg-[#181b27] px-3 py-2 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle size={12} className="shrink-0 text-amber-400" />
                      <span className="text-xs text-[#e4e6f0] truncate">{i.description}</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${SEVERITY_BADGE[i.severity]}`}>
                      {i.severity.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Recent comms timeline */}
          {recent_comms && recent_comms.length > 0 && (
            <Section title="Recent comms">
              <div className="space-y-1.5">
                {recent_comms.map((c) => {
                  const openClock = c.requires_response && !c.responded_at
                  const breached  = c.sla_breached
                  const timeStr   = new Date(c.occurred_at).toLocaleString('en-GB', {
                    timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })
                  const CHANNEL_BADGE: Record<string, string> = {
                    whatsapp: 'bg-emerald-900/50 text-emerald-300',
                    email:    'bg-blue-900/50 text-blue-300',
                    call:     'bg-purple-900/50 text-purple-300',
                    meeting:  'bg-indigo-900/50 text-indigo-300',
                  }
                  return (
                    <div key={c.id} className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                      breached ? 'border-red-900/60 bg-red-950/20' : openClock ? 'border-amber-900/40 bg-[#181b27]' : 'border-[#1c2035] bg-[#181b27]'
                    }`}>
                      <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${CHANNEL_BADGE[c.channel] ?? 'bg-[#1c2035] text-[#636780]'}`}>
                          {c.channel.slice(0, 2).toUpperCase()}
                        </span>
                        <span className={`text-[9px] ${c.direction === 'inbound' ? 'text-indigo-400' : 'text-[#636780]'}`}>
                          {c.direction === 'inbound' ? 'IN' : 'OUT'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#b0b3c6] leading-relaxed line-clamp-2">{c.summary}</p>
                        <p className="text-[10px] text-[#3d4060] mt-0.5">{timeStr}</p>
                      </div>
                      {openClock && (
                        <span className={`text-[10px] font-medium shrink-0 ${breached ? 'text-red-400' : 'text-amber-400'}`}>
                          {breached ? 'BREACHED' : 'needs reply'}
                        </span>
                      )}
                      {c.sentiment === 'concern' && !openClock && (
                        <span className="text-[10px] text-amber-400 shrink-0">concern</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {/* Quick actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-[#1c2035]">
            <ActionButton icon={<MessageSquare size={12} />} label="Log comm" onClick={() => setModal('comm')} />
            <ActionButton icon={<Lightbulb size={12} />} label="Add talking point" onClick={() => setModal('talking_point')} />
            <ActionButton icon={<AlertTriangle size={12} />} label="Raise issue" onClick={() => setModal('issue')} />
            <ActionButton icon={<Calendar size={12} />} label="Schedule meeting" onClick={() => setModal('meeting')} />
          </div>
        </div>
      )}

      {/* Past meetings tab */}
      {tab === 'meetings' && (
        <PastMeetings clientId={accountId} />
      )}

      {/* Reports tab */}
      {tab === 'reports' && (
        <ReportHistory accountId={accountId} />
      )}

      {/* Settings tab */}
      {tab === 'settings' && data && (
        <SettingsForm
          account={data.account}
          onSaved={(patch) => {
            setData((d) => {
              if (!d) return d
              return { ...d, account: { ...d.account, ...patch } as typeof d.account }
            })
          }}
        />
      )}

      {/* Action modals */}
      <AccountModals
        kind={modal}
        account={account}
        profiles={profiles}
        currentUserId={currentUserId}
        onClose={() => setModal(null)}
        onDone={() => { setModal(null); reload() }}
      />
    </div>
  )
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: 'red' | 'amber' | 'green' }) {
  const colour = highlight
    ? { red: 'text-red-400', amber: 'text-amber-400', green: 'text-emerald-400' }[highlight]
    : 'text-[#e4e6f0]'
  return (
    <div className="rounded-xl border border-[#1c2035] bg-[#0e1017] p-3">
      <p className="text-[9px] uppercase tracking-widest text-[#636780] mb-1">{label}</p>
      <p className={`text-lg font-semibold ${colour}`}>{value}</p>
      {sub && <p className="text-[10px] text-[#3d4060] mt-0.5">{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-bold tracking-widest uppercase text-[#636780] mb-3">{title}</p>
      {children}
    </div>
  )
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#181b27] hover:bg-[#1c2035] text-[#636780] hover:text-[#e4e6f0] border border-[#1c2035] transition-colors"
    >
      {icon}
      {label}
    </button>
  )
}

// ─── Settings form ────────────────────────────────────────────────────────────

const CALL_DAYS = [
  { value: '', label: 'Not set' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
]

const CURRENCIES = ['GBP', 'EUR', 'USD']

type SettingsFormProps = {
  account: AccountData['account']
  onSaved: (updated: Partial<Client>) => void
}

function SettingsForm({ account, onSaved }: SettingsFormProps) {
  const [form, setForm] = useState({
    contact_name:       account.contact_name ?? '',
    contact_email:      account.contact_email ?? '',
    wa_group_name:      account.wa_group_name ?? '',
    meta_ad_account_id: account.meta_ad_account_id ?? '',
    target_roas:        account.target_roas != null ? String(account.target_roas) : '',
    target_cpa:         account.target_cpa != null ? String(account.target_cpa) : '',
    monthly_budget:     account.monthly_budget != null ? String(account.monthly_budget) : '',
    currency:           account.currency || 'GBP',
    call_day:           account.call_day != null ? String(account.call_day) : '',
    call_time:          account.call_time ?? '',
    start_date:         account.start_date ?? '',
    renewal_date:       account.renewal_date ?? '',
    notes:              account.notes ?? '',
    name:               account.name,
    status:             account.status,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const patch: Partial<Client> = {
        name:               form.name,
        status:             form.status as Client['status'],
        contact_name:       form.contact_name || null,
        contact_email:      form.contact_email || null,
        wa_group_name:      form.wa_group_name || null,
        meta_ad_account_id: form.meta_ad_account_id || null,
        target_roas:        form.target_roas ? Number(form.target_roas) : null,
        target_cpa:         form.target_cpa ? Number(form.target_cpa) : null,
        monthly_budget:     form.monthly_budget ? Number(form.monthly_budget) : null,
        currency:           form.currency,
        call_day:           form.call_day ? Number(form.call_day) : null,
        call_time:          form.call_time || null,
        start_date:         form.start_date || null,
        renewal_date:       form.renewal_date || null,
        notes:              form.notes || null,
      }
      await updateAccount(account.id, patch)
      onSaved(patch)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Client profile */}
      <Section title="Client profile">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client name">
            <input className={INPUT} {...field('name')} />
          </Field>
          <Field label="Status">
            <select className={INPUT} {...field('status')}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="churned">Churned</option>
            </select>
          </Field>
          <Field label="Contact name">
            <input className={INPUT} placeholder="e.g. Alex" {...field('contact_name')} />
          </Field>
          <Field label="Contact email">
            <input className={INPUT} type="email" placeholder="alex@brand.com" {...field('contact_email')} />
          </Field>
          <Field label="WA group name" hint="Label only, for team reference">
            <input className={INPUT} placeholder="e.g. August x L'alingi" {...field('wa_group_name')} />
          </Field>
        </div>
      </Section>

      {/* Performance targets */}
      <Section title="Performance targets">
        <p className="text-[10px] text-[#636780] mb-3">Used by the health score and Friday report internal brief.</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Currency">
            <select className={INPUT} {...field('currency')}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Target ROAS" hint="e.g. 3.5">
            <input className={INPUT} type="number" step="0.1" min="0" placeholder="3.5" {...field('target_roas')} />
          </Field>
          <Field label="Target CPA">
            <input className={INPUT} type="number" step="1" min="0" placeholder="25" {...field('target_cpa')} />
          </Field>
          <Field label="Monthly ad budget">
            <input className={INPUT} type="number" step="100" min="0" placeholder="5000" {...field('monthly_budget')} />
          </Field>
        </div>
      </Section>

      {/* Reporting cadence */}
      <Section title="Reporting cadence">
        <p className="text-[10px] text-[#636780] mb-3">Controls when meeting prep and Monday kickoffs are generated.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Weekly call day">
            <select className={INPUT} {...field('call_day')}>
              {CALL_DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </Field>
          <Field label="Call time (local)" hint="24h format e.g. 14:00">
            <input className={INPUT} type="time" {...field('call_time')} />
          </Field>
          <Field label="Contract start date">
            <input className={INPUT} type="date" {...field('start_date')} />
          </Field>
          <Field label="Renewal date">
            <input className={INPUT} type="date" {...field('renewal_date')} />
          </Field>
        </div>
      </Section>

      {/* Mac reporter */}
      <Section title="Mac reporter config">
        <p className="text-[10px] text-[#636780] mb-3">Required for metrics sync and Friday report generation.</p>
        <Field label="Meta ad account ID" hint="act_xxxx from Meta Business Manager">
          <input className={INPUT} placeholder="act_1234567890" {...field('meta_ad_account_id')} />
        </Field>
      </Section>

      {/* Notes */}
      <Section title="Internal notes">
        <textarea
          className={`${INPUT} resize-none`}
          rows={4}
          placeholder="Any context about the client, relationship notes, sensitivities..."
          {...field('notes')}
        />
      </Section>

      {/* Save bar */}
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        {saved && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            Saved
          </span>
        )}
      </div>
    </div>
  )
}

const INPUT = 'w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-xs text-[#e4e6f0] focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-[#3d4060]'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <label className="text-[10px] font-medium text-[#636780] uppercase tracking-wide">{label}</label>
        {hint && <span className="text-[9px] text-[#3d4060]">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
