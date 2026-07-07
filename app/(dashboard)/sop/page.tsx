'use client'

import Link from 'next/link'

const sops = [
  {
    href: '/sop/cold-call',
    title: 'Cold Call SOP',
    description: 'Opening line, objection handling, and the post-payment onboarding sequence.',
  },
  {
    href: '/sop/cold-email',
    title: 'Cold Email Acquisition SOP',
    description: 'Free creatives lead magnet, volume ramp, reply tiers, and deliverability rules.',
  },
  {
    href: '/sop/linkedin',
    title: 'LinkedIn Outreach SOP',
    description: 'ICP targeting, daily connection caps, and relationship-first messaging voice.',
  },
  {
    href: '/sop/qualification',
    title: 'Lead Qualification SOP',
    description: 'The 1-10 scoring rubric that gates free creatives, calls, and booking priority.',
  },
  {
    href: '/sop/booking',
    title: 'Booking and Show-Up SOP',
    description: 'Booking script, confirmation and reminder cadence, and no-show rebook flow.',
  },
  {
    href: '/sop/sales-call',
    title: 'Sales Call Framework',
    description: 'Two-call process for consultative selling: discovery call for value, pitch call for close.',
  },
  {
    href: '/sop/sales-deck',
    title: 'Most Valuable Pitch Deck',
    description: 'How to build a custom deck that makes the prospect feel understood and the solution obvious.',
  },
]

export default function SopIndexPage() {
  return (
    <div className="min-h-screen bg-[#08090c] px-6 py-10 print:bg-white print:text-black">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#636780] print:text-gray-500 mb-2">August Marketing</p>
          <h1 className="text-3xl font-bold text-[#e4e6f0] print:text-black tracking-tight">August Marketing SOPs</h1>
          <p className="text-sm text-[#636780] print:text-gray-500 mt-1">Standard Operating Procedures, internal use only</p>
          <div className="mt-4 border-t border-[#1c2035] print:border-gray-200" />
        </div>

        {/* SOP list */}
        <div className="space-y-3">
          {sops.map((sop) => (
            <Link
              key={sop.href}
              href={sop.href}
              className="block bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-xl px-5 py-4 hover:border-indigo-500/50 transition-colors"
            >
              <h2 className="text-sm font-semibold text-[#e4e6f0] print:text-black">{sop.title}</h2>
              <p className="text-sm text-[#636780] print:text-gray-500 mt-1">{sop.description}</p>
            </Link>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-[#1c2035] print:border-gray-200">
          <p className="text-xs text-[#636780] print:text-gray-400">August Marketing, internal use only</p>
        </div>

      </div>
    </div>
  )
}
