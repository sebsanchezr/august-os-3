'use client'

import Link from 'next/link'

export default function ColdEmailSopPage() {
  return (
    <div className="min-h-screen bg-[#08090c] px-6 py-10 print:bg-white print:text-black">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <Link href="/sop" className="text-xs text-[#636780] hover:text-indigo-400 print:hidden">&larr; Back to SOPs</Link>
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#636780] print:text-gray-500 mb-2 mt-3">August Marketing</p>
          <h1 className="text-3xl font-bold text-[#e4e6f0] print:text-black tracking-tight">Cold Email Acquisition SOP</h1>
          <p className="text-sm text-[#636780] print:text-gray-500 mt-1">Standard Operating Procedure, Cold Email</p>
          <div className="mt-4 border-t border-[#1c2035] print:border-gray-200" />
        </div>

        {/* Section 1: The Offer */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            1 &mdash; The Offer
          </h2>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">Lead magnet</h3>
            <div className="border-l-2 border-indigo-500 pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4">
              <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed italic">
                We lead with a free batch of ad creatives, no strings attached. It proves the work before we ask for
                anything. Once a lead sees the quality, we upsell into the paid package: $1,500 for a set of 10 ads.
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">Ideal customer profile</h3>
            <div className="space-y-2">
              {[
                'Ecommerce brands doing $100k+ per month in revenue',
                'Actively running paid ads, so creative fatigue is a real problem for them',
                'A named decision-maker we can reach directly (founder, head of growth, marketing lead)',
              ].map((point, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-xs font-semibold shrink-0">{i + 1}</span>
                  <p className="text-sm text-[#e4e6f0] print:text-gray-800">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Section 2: Volume and Ramp */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            2 &mdash; Volume and Ramp
          </h2>
          <div className="space-y-2 mb-4">
            {[
              'Target: 1,000 emails sent per day at full ramp',
              'Target outcome: 5 to 7 booked calls per week from that volume',
              'Ramp gradually, never jump straight to full volume on a fresh domain or inbox',
            ].map((point, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-0.5 h-5 w-5 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-xs font-semibold shrink-0">{i + 1}</span>
                <p className="text-sm text-[#e4e6f0] print:text-gray-800">{point}</p>
              </div>
            ))}
          </div>
          <div className="border-l-2 border-amber-500 pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4">
            <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed">
              Inbox math rule: prefer 40 inboxes sending 25 emails a day over 25 inboxes sending 40 a day. More
              inboxes at a lower per-inbox volume protects deliverability and keeps every domain looking natural.
            </p>
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Section 3: Reply Handling */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            3 &mdash; Reply Handling, Tiered Autonomy
          </h2>

          <div className="space-y-5">
            <div className="bg-[#10121a] print:bg-gray-50 border border-green-500/20 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1c2035] print:border-gray-200">
                <p className="text-sm font-medium text-green-400 print:text-black">Auto-sent in the founder&apos;s voice</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed">
                  Positive replies, asset requests, not-now replies, and out-of-office replies get a reply drafted
                  and sent automatically in the founder&apos;s voice. No approval step, these patterns are safe and
                  well understood.
                </p>
              </div>
            </div>

            <div className="bg-[#10121a] print:bg-gray-50 border border-amber-500/20 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1c2035] print:border-gray-200">
                <p className="text-sm font-medium text-amber-400 print:text-black">Approve-first</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed">
                  Objections stay approve-first. A draft is prepared but a human signs off before it sends. Objections
                  carry more risk of a wrong tone or a bad fact, so they get a human check.
                </p>
              </div>
            </div>

            <div className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1c2035] print:border-gray-200">
                <p className="text-sm font-medium text-[#e4e6f0] print:text-black">Always escalate to the founder</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed">
                  Any thread that reaches 3 or more messages deep goes straight to the founder, regardless of tone or
                  category. Deep threads mean the lead is engaged and deserves a real human on the other end.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Section 4: Qualification Gate */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            4 &mdash; Qualification Gate
          </h2>
          <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed mb-4">
            Every inbound reply gets run through the qualification scorer, rated 1 to 10. The score decides who gets
            the free creatives and who gets a polite decline. See the Lead Qualification SOP for the full rubric.
          </p>
          <Link href="/sop/qualification" className="text-sm text-indigo-400 hover:text-indigo-300 print:hidden">
            View Lead Qualification SOP &rarr;
          </Link>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Section 5: Deliverability */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            5 &mdash; Deliverability Rules
          </h2>
          <div className="space-y-2">
            {[
              'Verify every send batch with MillionVerifier before it goes out, no exceptions',
              'No warmup shortcuts: every new inbox goes through a full warmup period before joining active sending',
              'Prefer more inboxes at lower daily volume (40 inboxes at 25/day) over fewer inboxes at higher volume (25 inboxes at 40/day)',
              'Monitor bounce and spam complaint rates daily, pull any inbox that trips a threshold out of rotation immediately',
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
