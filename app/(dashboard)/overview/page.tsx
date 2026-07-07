'use client'

import Link from 'next/link'
import {
  Phone, FileText, Linkedin, Mail, TrendingUp, KanbanSquare, BookOpen,
  ArrowRight, ClipboardList, CheckSquare, AlertTriangle,
  CalendarDays, PhoneCall, Rocket, Briefcase,
} from 'lucide-react'

const navGroups = [
  {
    label: 'Acquisition',
    items: [
      { label: 'Command Center', href: '/acquisition', icon: TrendingUp },
      { label: 'Pipeline', href: '/pipeline', icon: KanbanSquare },
      { label: 'Cold Calling', href: '/dashboard', icon: Phone },
      { label: 'Cold Email', href: '/cold-email', icon: Mail },
      { label: 'LinkedIn', href: '/linkedin', icon: Linkedin },
      { label: 'Sales Calls', href: '/sales', icon: PhoneCall },
    ],
  },
  {
    label: 'Fulfilment',
    items: [
      { label: 'Tasks', href: '/tasks', icon: KanbanSquare },
      { label: 'Meetings', href: '/meetings', icon: CalendarDays },
      { label: 'Onboarding', href: '/onboarding', icon: Rocket },
      { label: 'Client Accounts', href: '/accounts', icon: Briefcase },
      { label: 'Approvals', href: '/accounts/approvals', icon: CheckSquare },
      { label: 'Issues', href: '/accounts/issues', icon: AlertTriangle },
    ],
  },
  {
    label: 'Resources',
    items: [
      { label: 'Playbooks & SOPs', href: '/sop', icon: BookOpen },
      { label: 'Call Resources', href: '/resources', icon: FileText },
      { label: 'EOD Reports', href: '/eod', icon: ClipboardList },
    ],
  },
]

const stats = [
  { value: '2018', label: 'Founded' },
  { value: '80+', label: 'Brands worked with' },
  { value: '$500M+', label: 'Brand revenue generated' },
]

export default function OverviewPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="mb-10 text-center pt-6">
        <p className="text-[10px] font-semibold tracking-[0.25em] text-indigo-400 uppercase mb-3">
          August Marketing · Est. 2018
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#e4e6f0] tracking-tight mb-3">
          Welcome to August OS
        </h1>
        <p className="text-sm text-[#8b8fa8] max-w-xl mx-auto leading-relaxed">
          Since 2018, we&apos;ve been building brands, running acquisition, and closing deals
          for the businesses that trust us to grow them. This is home base &mdash; everything
          you need lives here.
        </p>

        <div className="flex items-center justify-center gap-8 mt-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-[#e4e6f0]">{s.value}</p>
              <p className="text-[10px] text-[#636780] uppercase tracking-wide mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 2026 Mission */}
      <section className="mb-6 rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.07] to-transparent p-6">
        <p className="text-[10px] font-semibold tracking-[0.13em] text-indigo-400 uppercase mb-2">
          2026 Mission
        </p>
        <h2 className="text-lg font-semibold text-[#e4e6f0] mb-2">
          Back on track. Built to last.
        </h2>
        <p className="text-sm text-[#8b8fa8] leading-relaxed max-w-2xl">
          2026 is the year we tighten everything up &mdash; sharper acquisition, cleaner delivery,
          and no more running the business out of scattered docs and spreadsheets. This OS is
          part of that: one system for how we find clients, win them, deliver for them, and keep them.
          Every team, every process, one place.
        </p>
      </section>

      {/* Personal note */}
      <section className="mb-10 rounded-xl border border-[#1c2035] bg-[#10121a] p-6">
        <p className="text-[10px] font-semibold tracking-[0.13em] text-[#636780] uppercase mb-3">
          A note from Seb
        </p>
        <p className="text-sm text-[#c4c7d6] leading-relaxed max-w-2xl">
          I&apos;ve spent the last couple of months building this out for you. It&apos;s everything
          we do at August, in one place, built so we can move faster and stop losing things
          in the cracks. Treat it like the Bible &mdash; use it every day, keep it updated, and
          let&apos;s build something we&apos;re proud of this year.
        </p>
        <p className="text-sm text-[#e4e6f0] font-medium mt-4">&mdash; Seb</p>
      </section>

      {/* Navigation */}
      <section>
        <p className="text-[10px] font-semibold tracking-[0.13em] text-[#636780] uppercase mb-4">
          Get around
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {navGroups.map((group) => (
            <div
              key={group.label}
              className="rounded-xl border border-[#1c2035] bg-[#10121a] p-5"
            >
              <h3 className="text-sm font-semibold text-[#e4e6f0] mb-3">{group.label}</h3>
              <div className="flex flex-col gap-1">
                {group.items.map(({ label, href, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[#8b8fa8] hover:text-[#e4e6f0] hover:bg-[#181b27] transition-colors group"
                  >
                    <Icon className="h-[14px] w-[14px] text-[#636780] group-hover:text-indigo-400 shrink-0 transition-colors" />
                    <span className="truncate">{label}</span>
                    <ArrowRight className="h-[12px] w-[12px] ml-auto text-[#3d4060] group-hover:text-[#e4e6f0] shrink-0 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
