'use client'

import Link from 'next/link'

export default function LinkedinSopPage() {
  return (
    <div className="min-h-screen bg-[#08090c] px-6 py-10 print:bg-white print:text-black">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <Link href="/sop" className="text-xs text-[#636780] hover:text-indigo-400 print:hidden">&larr; Back to SOPs</Link>
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#636780] print:text-gray-500 mb-2 mt-3">August Marketing</p>
          <h1 className="text-3xl font-bold text-[#e4e6f0] print:text-black tracking-tight">LinkedIn Outreach SOP</h1>
          <p className="text-sm text-[#636780] print:text-gray-500 mt-1">Standard Operating Procedure, LinkedIn</p>
          <div className="mt-4 border-t border-[#1c2035] print:border-gray-200" />
        </div>

        {/* Section 1: Who we target */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            1 &mdash; Who We Target
          </h2>

          <div className="mb-4">
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">Target profile</h3>
            <div className="space-y-2">
              {[
                'Founders and operators at ecommerce brands doing $100k+ per month',
                'Closely relevant B2B founders and operators, e.g. agencies or tools serving that same ecommerce buyer',
                'Someone with real budget authority, not a general marketing coordinator',
              ].map((point, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-xs font-semibold shrink-0">{i + 1}</span>
                  <p className="text-sm text-[#e4e6f0] print:text-gray-800">{point}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-l-2 border-amber-500 pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4">
            <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed">
              Do not target generic &ldquo;information technology and services&rdquo; profiles. That industry tag is a
              magnet for irrelevant matches and drags reply quality down. Filter it out explicitly at the list-building
              stage.
            </p>
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Section 2: Daily caps */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            2 &mdash; Daily Caps and Cadence
          </h2>
          <div className="space-y-2">
            {[
              '10 connection invites per day, hard cap, enforced by Auto Connect',
              'Once-daily runs only, the outreach tool fires a single batch per day',
              'No 5-minute crons and no rapid-fire batches, that pattern gets accounts flagged',
            ].map((point, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-0.5 h-5 w-5 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-xs font-semibold shrink-0">{i + 1}</span>
                <p className="text-sm text-[#e4e6f0] print:text-gray-800">{point}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Section 3: Voice */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            3 &mdash; Connect and DM Voice
          </h2>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">Example connect note</h3>
            <div className="border-l-2 border-indigo-500 pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4">
              <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed italic">
                &ldquo;hey [name], saw you&apos;re running the show at [brand], love what you&apos;re doing with the
                product drops. curious how you&apos;re thinking about creative volume as you scale ad spend?&rdquo;
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {[
              'Relationship-first, curious tone, zero pitch in the first message',
              'Keep it 40 to 70 words',
              'End with one open question, never a call-to-action or a link',
              'Lowercase, conversational cadence, write like a real message, not a marketing email',
            ].map((point, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-[#e4e6f0] print:text-gray-800">
                <span className="text-indigo-400 mt-0.5 shrink-0">&#10003;</span>
                <p>{point}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Section 4: Hot leads */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            4 &mdash; Hot Lead Priority
          </h2>
          <div className="border-l-2 border-green-500 pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4">
            <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed">
              A lead who has given a positive reply, or already has a call booked, gets priority use of the daily
              connection slots. Warm relationships come before cold list expansion every single day.
            </p>
          </div>
        </section>

        {/* Print button, hidden when printing */}
        <div className="mt-8 flex gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
          >
            Print / Save as PDF
          </button>
        </div>

        <div className="mt-10 pt-6 border-t border-[#1c2035] print:border-gray-200">
          <p className="text-xs text-[#636780] print:text-gray-400">August Marketing, internal use only</p>
        </div>

      </div>
    </div>
  )
}
