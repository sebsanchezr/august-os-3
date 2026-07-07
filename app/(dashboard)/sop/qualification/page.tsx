'use client'

import Link from 'next/link'

const criteria = [
  {
    label: 'Revenue fit',
    weight: '0 to 3 points',
    detail: 'Confirmed at $100k+ per month, 3 points. Under $100k or unverified, 0 to 1.',
  },
  {
    label: 'Ad spend',
    weight: '0 to 2 points',
    detail: 'Actively running paid ads with a real monthly budget, 2 points. No active ad spend, 0.',
  },
  {
    label: 'Decision-maker',
    weight: '0 to 2 points',
    detail: 'Founder, owner, or head of growth/marketing, 2 points. Junior or unclear role, 0 to 1.',
  },
  {
    label: 'Urgency',
    weight: '0 to 2 points',
    detail: 'Actively looking for creative help now, or replied fast and engaged, 2 points. Vague interest, 0 to 1.',
  },
  {
    label: 'Niche fit',
    weight: '0 to 1 point',
    detail: 'Ecommerce brand, or closely relevant B2B serving that buyer, 1 point. Otherwise 0.',
  },
]

export default function QualificationSopPage() {
  return (
    <div className="min-h-screen bg-[#08090c] px-6 py-10 print:bg-white print:text-black">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <Link href="/sop" className="text-xs text-[#636780] hover:text-indigo-400 print:hidden">&larr; Back to SOPs</Link>
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#636780] print:text-gray-500 mb-2 mt-3">August Marketing</p>
          <h1 className="text-3xl font-bold text-[#e4e6f0] print:text-black tracking-tight">Lead Qualification SOP</h1>
          <p className="text-sm text-[#636780] print:text-gray-500 mt-1">Standard Operating Procedure, Qualification</p>
          <div className="mt-4 border-t border-[#1c2035] print:border-gray-200" />
        </div>

        {/* Section 1: Scoring rubric */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            1 &mdash; Scoring Rubric, 1 to 10
          </h2>
          <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed mb-5">
            Every lead is scored 1 to 10 across five weighted criteria. The score is the single source of truth for
            what happens next: whether they get free creatives, whether they get a call, and how their outreach is
            prioritised.
          </p>
          <div className="space-y-3">
            {criteria.map((c, i) => (
              <div key={i} className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1c2035] print:border-gray-200 flex items-center justify-between">
                  <p className="text-sm font-medium text-[#e4e6f0] print:text-black">{c.label}</p>
                  <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">{c.weight}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Section 2: Thresholds */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            2 &mdash; Score Thresholds
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#10121a] print:bg-gray-50 border border-green-500/20 rounded-lg p-3">
              <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1.5">7 to 10</p>
              <p className="text-xs text-[#e4e6f0] print:text-gray-700 leading-relaxed">
                Book the call. Send free creatives immediately and offer priority scheduling.
              </p>
            </div>
            <div className="bg-[#10121a] print:bg-gray-50 border border-amber-500/20 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1.5">4 to 6</p>
              <p className="text-xs text-[#e4e6f0] print:text-gray-700 leading-relaxed">
                Nurture. Free creatives held back until revenue or urgency is confirmed in reply.
              </p>
            </div>
            <div className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] rounded-lg p-3">
              <p className="text-xs font-semibold text-[#636780] uppercase tracking-wider mb-1.5">1 to 3</p>
              <p className="text-xs text-[#e4e6f0] print:text-gray-700 leading-relaxed">
                Polite decline or generic resource, no call, no free creatives.
              </p>
            </div>
          </div>
          <div className="border-l-2 border-indigo-500 pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4 mt-4">
            <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed">
              We take a call with anyone scoring 7 or above. That is the line between a lead worth our time and one
              that is not, and it applies the same whether the lead came from cold email or LinkedIn.
            </p>
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Section 3: Hard disqualifiers */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            3 &mdash; Hard Disqualifiers
          </h2>
          <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed mb-4">
            Any of the following overrides the score entirely, the lead is disqualified regardless of how the rest
            of the rubric reads.
          </p>
          <div className="space-y-2">
            {[
              'Confirmed revenue under $100k per month, no path to that threshold in the near term',
              'No live paid ad spend and no stated plan to start',
              'Competitor, agency shopping for free work, or clearly not a real buyer',
              'Hostile, abusive, or explicitly asked to never be contacted again',
            ].map((point, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-[#e4e6f0] print:text-gray-800">
                <span className="text-red-400 mt-0.5 shrink-0">&times;</span>
                <p>{point}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Section 4: What the score gates */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            4 &mdash; What the Score Gates
          </h2>
          <div className="space-y-2">
            {[
              'Whether the lead receives the free batch of ad creatives',
              'Whether the lead gets a booked call at all',
              'Priority use of daily LinkedIn connection slots for hot, high-scoring leads',
            ].map((point, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-[#e4e6f0] print:text-gray-800">
                <span className="text-indigo-400 mt-0.5 shrink-0">&#10003;</span>
                <p>{point}</p>
              </div>
            ))}
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
