'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import type { Onboarding, OnboardingForm } from '@/lib/types'

const ROADMAP = [
  { day: 'Day 0', label: 'You complete the form + book kickoff' },
  { day: 'Day 1-2', label: 'We build your internal strategy' },
  { day: 'Day 3-4', label: 'Kickoff call — you meet the team' },
  { day: 'Day 5-10', label: 'Build phase' },
  { day: 'Day 10-14', label: 'Launch — you hear from us every day in week one' },
]

type FormState = {
  business_overview: string
  target_audience: string
  brand_guidelines_url: string
  asset_links: string
  access_notes: string
  goals: string
  primary_contact: string
  billing_contact: string
  timezone: string
}

function emptyForm(existing: OnboardingForm | null): FormState {
  return {
    business_overview: existing?.business_overview ?? '',
    target_audience: existing?.target_audience ?? '',
    brand_guidelines_url: existing?.brand_guidelines_url ?? '',
    asset_links: existing?.asset_links ?? '',
    access_notes: existing?.access_notes ?? '',
    goals: existing?.goals ?? '',
    primary_contact: existing?.primary_contact ?? '',
    billing_contact: existing?.billing_contact ?? '',
    timezone: existing?.timezone ?? '',
  }
}

export default function WelcomePortal({
  onboarding,
  existingForm,
}: {
  onboarding: Onboarding
  existingForm: OnboardingForm | null
}) {
  const firstName = (onboarding.contact_name ?? onboarding.company_name).split(' ')[0]
  const [form, setForm] = useState<FormState>(emptyForm(existingForm))
  const [submitted, setSubmitted] = useState(!!existingForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const vslUrl = process.env.NEXT_PUBLIC_VSL_EMBED_URL
  const calUrl = process.env.NEXT_PUBLIC_CAL_KICKOFF_EVENT_URL

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/onboarding/portal/${onboarding.portal_token}/form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Something went wrong submitting the form')
      }
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  function field(key: keyof FormState) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    }
  }

  return (
    <div className="min-h-screen bg-[#08090c] text-[#e4e6f0]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          Welcome to August, {firstName}. Let's build something serious.
        </h1>
        <p className="text-sm text-[#8b8fa8] leading-relaxed mb-10">
          You're officially in. This page is your launchpad: watch the 2-minute video, complete your
          onboarding form, and book your kickoff call. Do those three things and we handle everything else.
        </p>

        {vslUrl && (
          <div className="mb-12 rounded-xl overflow-hidden border border-[#1c2035] aspect-video bg-[#10121a]">
            <iframe src={vslUrl} className="w-full h-full" allow="autoplay; fullscreen" title="Welcome video" />
          </div>
        )}

        <div className="mb-12">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#636780] mb-4">Your next 14 days</h2>
          <div className="space-y-3">
            {ROADMAP.map((step) => (
              <div key={step.day} className="flex items-start gap-3 border-l-2 border-l-indigo-500 pl-3">
                <span className="text-xs font-semibold text-indigo-400 w-16 shrink-0">{step.day}</span>
                <span className="text-sm text-[#c4c6d8]">{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#636780] mb-1">
            Step 1: The onboarding form
          </h2>
          <p className="text-xs text-[#636780] mb-5">
            This is the only form you'll ever fill in with us. Everything we need to launch, collected once.
          </p>

          {submitted ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
              <CheckCircle2 size={16} />
              Form received — thank you. You can still update it below any time before your kickoff call.
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <Field label="Tell us about your business" hint="What you do, who you serve">
              <textarea rows={3} className={inputClass} {...field('business_overview')} />
            </Field>
            <Field label="Who is your target audience?">
              <textarea rows={2} className={inputClass} {...field('target_audience')} />
            </Field>
            <Field label="Goals for this partnership">
              <textarea rows={2} className={inputClass} {...field('goals')} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Brand guidelines link">
                <input className={inputClass} placeholder="Dropbox / Drive link" {...field('brand_guidelines_url')} />
              </Field>
              <Field label="Asset links">
                <input className={inputClass} placeholder="Content, logos, photos" {...field('asset_links')} />
              </Field>
            </div>
            <Field label="Access we'll need" hint="Ad accounts, Business Manager, logins to grant">
              <textarea rows={2} className={inputClass} {...field('access_notes')} />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Primary contact">
                <input className={inputClass} {...field('primary_contact')} />
              </Field>
              <Field label="Billing contact">
                <input className={inputClass} {...field('billing_contact')} />
              </Field>
              <Field label="Timezone">
                <input className={inputClass} placeholder="Europe/London" {...field('timezone')} />
              </Field>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? 'Saving...' : submitted ? 'Update form' : 'Submit form'}
            </button>
          </form>
        </div>

        <div className="mb-12">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#636780] mb-1">
            Step 2: Book your kickoff call
          </h2>
          <p className="text-xs text-[#636780] mb-5">
            You'll meet the team delivering your work, see our initial strategy, and leave knowing exactly
            what happens and when.
          </p>
          {calUrl ? (
            <div className="rounded-xl overflow-hidden border border-[#1c2035] bg-[#10121a]" style={{ height: 700 }}>
              <iframe
                src={`${calUrl}?embed=true&onboardingId=${onboarding.id}&name=${encodeURIComponent(onboarding.contact_name ?? '')}&email=${encodeURIComponent(onboarding.contact_email)}`}
                className="w-full h-full"
                title="Book kickoff call"
              />
            </div>
          ) : (
            <p className="text-xs text-[#636780] italic">Booking link coming soon.</p>
          )}
        </div>

        <p className="text-xs text-[#636780]">
          Questions before the call? Reply to any email from us — a human answers same day.
        </p>
      </div>
    </div>
  )
}

const inputClass =
  'w-full bg-[#10121a] border border-[#1c2035] rounded-lg px-3 py-2 text-sm text-[#e4e6f0] placeholder:text-[#3d4060] focus:outline-none focus:border-indigo-500'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#8b8fa8] mb-1.5">
        {label}
        {hint && <span className="text-[#3d4060] font-normal"> — {hint}</span>}
      </label>
      {children}
    </div>
  )
}
