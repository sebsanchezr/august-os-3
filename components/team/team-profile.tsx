'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, ArrowLeft, Save, ExternalLink } from 'lucide-react'
import { fetchTeamMember, updateTeamMember, type TeamMember, type TeamMemberRole, type TeamMemberStatus, type StaffOnboarding, type StaffOnboardingTask } from '@/lib/team-client'
import { ONBOARDING_STAGE_LABELS } from '@/lib/team-server'

const INPUT = 'w-full bg-[#181b27] border border-[#1c2035] rounded-lg px-3 py-2 text-xs text-[#e4e6f0] focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-[#3d4060]'
const LABEL = 'text-[10px] font-medium text-[#636780] uppercase tracking-wide mb-1 block'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-bold tracking-widest uppercase text-[#636780] mb-3">{title}</p>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      {children}
    </div>
  )
}

export default function TeamProfile({ memberId }: { memberId: string }) {
  const [member, setMember] = useState<TeamMember | null>(null)
  const [onboarding, setOnboarding] = useState<(StaffOnboarding & { tasks: StaffOnboardingTask[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = () => {
    fetchTeamMember(memberId)
      .then((d) => { setMember(d.member); setOnboarding(d.onboarding) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#636780]" size={20} />
      </div>
    )
  }

  if (error || !member) {
    return <div className="p-6 text-red-400 text-sm">{error ?? 'Team member not found'}</div>
  }

  const doneCount = onboarding?.tasks.filter((t) => t.done).length ?? 0
  const totalCount = onboarding?.tasks.length ?? 0

  return (
    <div className="p-6 max-w-3xl">
      <Link href="/team" className="flex items-center gap-1.5 text-xs text-[#636780] hover:text-[#e4e6f0] mb-4 transition-colors">
        <ArrowLeft size={13} /> All team members
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[#e4e6f0] font-semibold text-xl">{member.name}</h1>
          <p className="text-[#636780] text-xs mt-0.5">{member.title || 'No title set'}</p>
        </div>
      </div>

      {onboarding && (
        <div className="mb-6 rounded-xl border border-[#1c2035] bg-[#0e1017] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#e4e6f0] text-sm font-medium">
              Onboarding: {ONBOARDING_STAGE_LABELS[onboarding.stage] ?? onboarding.stage}
            </p>
            <Link
              href="/team/onboarding"
              className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Open board <ExternalLink size={11} />
            </Link>
          </div>
          <div className="h-1.5 rounded-full bg-[#181b27] overflow-hidden mb-1.5">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{ width: totalCount ? `${(doneCount / totalCount) * 100}%` : '0%' }}
            />
          </div>
          <p className="text-[10px] text-[#636780]">{doneCount}/{totalCount} checklist items complete</p>
        </div>
      )}

      <TeamMemberForm
        member={member}
        onSaved={(patch) => setMember((m) => (m ? { ...m, ...patch } : m))}
      />
    </div>
  )
}

function TeamMemberForm({ member, onSaved }: { member: TeamMember; onSaved: (patch: Partial<TeamMember>) => void }) {
  const [form, setForm] = useState({
    name:              member.name,
    title:             member.title ?? '',
    role:              member.role,
    status:            member.status,
    email:             member.email ?? '',
    phone:             member.phone ?? '',
    whatsapp:          member.whatsapp ?? '',
    location:          member.location ?? '',
    avatar_url:        member.avatar_url ?? '',
    login_email:       member.login_email ?? '',
    discord_user_id:   member.discord_user_id ?? '',
    start_date:        member.start_date ?? '',
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
      const patch: Partial<TeamMember> = {
        name:              form.name,
        title:             form.title || null,
        role:              form.role as TeamMemberRole,
        status:            form.status as TeamMemberStatus,
        email:             form.email || null,
        phone:             form.phone || null,
        whatsapp:          form.whatsapp || null,
        location:          form.location || null,
        avatar_url:        form.avatar_url || null,
        login_email:       form.login_email || null,
        discord_user_id:   form.discord_user_id || null,
        start_date:        form.start_date || null,
      }
      await updateTeamMember(member.id, patch)
      onSaved(patch)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Profile">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><input className={INPUT} {...field('name')} /></Field>
          <Field label="Title"><input className={INPUT} {...field('title')} /></Field>
          <Field label="Role">
            <select className={INPUT} {...field('role')}>
              <option value="cold_caller">Cold Caller</option>
              <option value="sales_manager">Sales Manager</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Status">
            <select className={INPUT} {...field('status')}>
              <option value="onboarding">Onboarding</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="offboarded">Offboarded</option>
            </select>
          </Field>
          <Field label="Location"><input className={INPUT} {...field('location')} placeholder="City, Country" /></Field>
          <Field label="Start date"><input type="date" className={INPUT} {...field('start_date')} /></Field>
          <Field label="Avatar URL"><input className={INPUT} {...field('avatar_url')} placeholder="https://..." /></Field>
        </div>
      </Section>

      <Section title="Contact">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><input type="email" className={INPUT} {...field('email')} /></Field>
          <Field label="Phone"><input className={INPUT} {...field('phone')} /></Field>
          <Field label="WhatsApp"><input className={INPUT} {...field('whatsapp')} /></Field>
          <Field label="Discord user ID"><input className={INPUT} {...field('discord_user_id')} /></Field>
        </div>
      </Section>

      <Section title="OS access">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Login email">
            <input type="email" className={INPUT} {...field('login_email')} placeholder="Used for Supabase auth" />
          </Field>
        </div>
        <p className="text-[10px] text-[#3d4060] mt-2">
          Setting a login email here does not create the Supabase auth user automatically — provision it manually
          and add the address to lib/access.ts.
        </p>
      </Section>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save
        </button>
        {saved && <span className="text-[11px] text-emerald-400">Saved</span>}
      </div>
    </div>
  )
}
