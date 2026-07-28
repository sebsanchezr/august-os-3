'use client'

import Link from 'next/link'

export default function CallerSopPage() {
  return (
    <div className="min-h-screen bg-[#08090c] px-6 py-10 print:bg-white print:text-black">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <Link href="/sop" className="text-xs text-[#636780] hover:text-indigo-400 print:hidden">&larr; Back to SOPs</Link>
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#636780] print:text-gray-500 mb-2 mt-3">August Marketing</p>
          <h1 className="text-3xl font-bold text-[#e4e6f0] print:text-black tracking-tight">Master Caller SOP</h1>
          <p className="text-sm text-[#636780] print:text-gray-500 mt-1">Standard Operating Procedure, Website Sales Team</p>
          <div className="mt-4 border-t border-[#1c2035] print:border-gray-200" />
        </div>

        {/* Intro */}
        <div className="border-l-2 border-indigo-500 pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4 mb-10">
          <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed">
            You phone UK tradespeople, mostly roofers, plus plumbers, electricians, and landscapers, and sell them a
            professional website. The offer is a one-time build of &pound;1,500 or &pound;2,000 plus &pound;75 a month
            for hosting and maintenance. This role is 100 percent commission, so your income tracks your dials. Your
            sales manager is Sebastian Garcia.
          </p>
        </div>

        {/* Section 1: Role and daily targets */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            1: Your Role and Daily Targets
          </h2>
          <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed mb-5">
            Activity is the only thing you fully control, so we track it first. Hit the numbers below every working
            day and the closes follow.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-indigo-400">100+</p>
              <p className="text-xs text-[#636780] print:text-gray-600 uppercase tracking-wider mt-1">Dials / day</p>
            </div>
            <div className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-indigo-400">15+</p>
              <p className="text-xs text-[#636780] print:text-gray-600 uppercase tracking-wider mt-1">Conversations</p>
            </div>
            <div className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-indigo-400">3+</p>
              <p className="text-xs text-[#636780] print:text-gray-600 uppercase tracking-wider mt-1">Site requests</p>
            </div>
          </div>
          <div className="space-y-2">
            {[
              'A dial is any number you ring. A conversation is a real talk with a person, not a voicemail or gatekeeper brush-off.',
              'A site request is a qualified prospect you have logged in the OS Websites tab for a build.',
              'Three qualified site requests a day is the engine of your commission. Protect that number above all else.',
            ].map((point, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-[#e4e6f0] print:text-gray-800">
                <span className="text-indigo-400 mt-0.5 shrink-0">&#10003;</span>
                <p>{point}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Section 2: Pulling leads */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            2: Pulling Your Leads
          </h2>
          <div className="space-y-2">
            {[
              'Work from your assigned lead segment only. Sebastian Garcia allocates each caller a region and trade so we never double-dial a business.',
              'Prioritise roofers first, then plumbers, electricians, and landscapers in that order.',
              'Before you dial, glance at the business on Google. A missing website, a dead Facebook page, or a rough-looking site is your opening.',
              'Mark every outcome as you go: no answer, gatekeeper, not interested, callback, or site requested. A clean list is a fast list.',
              'Never leave a callback unbooked in your own calendar. If they say ring me back Thursday, ring them back Thursday.',
            ].map((point, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-[#e4e6f0] print:text-gray-800">
                <span className="text-indigo-400 mt-0.5 shrink-0">&#10003;</span>
                <p>{point}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Section 3: Call 1 */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            3: Call One, Qualify and Request the Site
          </h2>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">The opener</h3>
            <div className="border-l-2 border-indigo-500 pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4">
              <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed italic">
                &ldquo;Hi, is that [Name]? It&apos;s [Your Name] from August Marketing, I&apos;ll be quick. I was
                looking you up online and I couldn&apos;t find a proper website for the business. We build sites
                for roofers that turn Google searches into phone calls. Have you got 60 seconds?&rdquo;
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">Qualify on three things</h3>
            <div className="space-y-3">
              {[
                {
                  n: '1',
                  t: 'Are they the right trade?',
                  d: 'Confirm they are a roofer, plumber, electrician, or landscaper actively taking work. A one-man band who wants more jobs is a perfect fit.',
                },
                {
                  n: '2',
                  t: 'Do they have no site, or a weak one?',
                  d: 'No website, a Facebook page only, or an old site that looks bad on a phone. Any of those is a yes. If they have a strong modern site, they are not a fit today.',
                },
                {
                  n: '3',
                  t: 'Are they the decision maker?',
                  d: 'You need the owner. If you are talking to a spouse, apprentice, or office admin, get the owner\'s name and the best time to reach them directly.',
                },
              ].map(({ n, t, d }, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-xs font-semibold shrink-0">{n}</span>
                  <div>
                    <p className="text-sm font-medium text-[#e4e6f0] print:text-black">{t}</p>
                    <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">Book the follow-up</h3>
            <div className="border-l-2 border-amber-500 pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4">
              <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed italic">
                &ldquo;Here&apos;s what I&apos;ll do. I&apos;m going to build you a real preview of what your website
                could look like, no charge, no obligation. Give me a day and I&apos;ll call you back to show you.
                What&apos;s the best number and email to reach you on?&rdquo;
              </p>
            </div>
            <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed mt-3">
              Do not pitch price on call one. The goal of call one is a qualified prospect, their contact details, and
              a booked time for call two. Then you log the site request.
            </p>
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Section 4: Request the site */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            4: Requesting the Site in the OS
          </h2>
          <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed mb-5">
            Open the Websites tab in the OS and create a new site request. The build engine turns your request into a
            live preview site and posts it back to you in Discord. The quality of the preview depends entirely on the
            detail you collect, so gather all of it on call one.
          </p>
          <div className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1c2035] print:border-gray-200">
              <p className="text-sm font-medium text-[#e4e6f0] print:text-black">Collect and enter every field</p>
            </div>
            <div className="px-4 py-3 space-y-2">
              {[
                'Business name, exactly as they trade under',
                'Owner name and the correct spelling',
                'Best contact phone number',
                'Best contact email',
                'City and full service area, the towns they cover',
                'Services offered, for example flat roofs, tiling, guttering, repairs, emergency call-outs',
                'Existing website or Google Business link, if any',
                'Notes: anything they said matters, years in business, standout jobs, review count, tone they want',
              ].map((point, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-[#e4e6f0] print:text-gray-800">
                  <span className="text-indigo-400 mt-0.5 shrink-0">&#10003;</span>
                  <p>{point}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="border-l-2 border-indigo-500 pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4 mt-4">
            <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed">
              Once submitted, the preview site comes back to you via Discord, usually within minutes. Have that link
              open and ready before you dial call two.
            </p>
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Section 5: Call 2 */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            5: Call Two, Present and Close
          </h2>

          {/* Step 1 */}
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black">Lead with the preview</h3>
            </div>
            <div className="pl-8">
              <div className="border-l-2 border-indigo-500 pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4">
                <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed italic">
                  &ldquo;I&apos;ve actually already built it. Let me send you the link right now, have a look on your
                  phone.&rdquo;
                </p>
              </div>
              <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed mt-3">
                Paste the preview link and go quiet for a few seconds. Let them open it and react first. Then narrate
                what the site does for them: the click-to-call button, the quote form that fires straight to their
                phone, their real reviews and job photos, and how it looks built for mobile.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black">Present the offer and close</h3>
            </div>
            <div className="pl-8">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#10121a] print:bg-gray-50 border border-green-500/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1.5">Standard build</p>
                  <p className="text-lg font-bold text-[#e4e6f0] print:text-black">&pound;1,500</p>
                  <p className="text-xs text-[#636780] print:text-gray-600 leading-relaxed mt-1">One-time, plus &pound;75 a month hosting and maintenance.</p>
                </div>
                <div className="bg-[#10121a] print:bg-gray-50 border border-indigo-500/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1.5">Premium build</p>
                  <p className="text-lg font-bold text-[#e4e6f0] print:text-black">&pound;2,000</p>
                  <p className="text-xs text-[#636780] print:text-gray-600 leading-relaxed mt-1">One-time, plus &pound;75 a month hosting and maintenance.</p>
                </div>
              </div>
              <div className="border-l-2 border-amber-500 pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4">
                <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed italic">
                  &ldquo;This is yours, live on your own domain, for a one-time [1,500 or 2,000] and then just
                  &pound;75 a month to host it and keep it updated. One extra job pays for the whole thing. Shall I
                  get you set up now?&rdquo;
                </p>
              </div>
              <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed mt-3">
                Ask for the sale directly and then stop talking. Never discount the &pound;75 a month. If price is the
                only blocker, move on the build fee, not the monthly.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black">Send the correct Stripe link</h3>
            </div>
            <div className="pl-8">
              <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed">
                Pick the Stripe payment link that matches the price they agreed, &pound;1,500 or &pound;2,000, from the
                Resources tab or the pinned links in Discord. Send it while they are still on the phone. Never end the
                call without the link sent.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0">4</span>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black">Confirm payment live</h3>
            </div>
            <div className="pl-8">
              <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed">
                Stay on the call while they pay. Walk them through it, answer any wobble, and wait for the payment to
                confirm before you wrap up. A link sent is not a deal. A payment confirmed is.
              </p>
            </div>
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Section 6: Handover */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            6: Handover After Payment
          </h2>
          <div className="space-y-2">
            {[
              'The moment payment confirms, mark the deal as won in the OS so the build and go-live pipeline kicks off.',
              'Hand the client to the hookup so the domain, go-live, and content are taken from here. Post the handover in the right Discord channel with the client name and preview link.',
              'Add the client to the local-businesses newsletter so they stay warm and hear about future services.',
              'Confirm you captured any job photos, logo, and domain preference so the hookup has what they need on day one.',
            ].map((point, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-[#e4e6f0] print:text-gray-800">
                <span className="text-green-400 mt-0.5 shrink-0">&#10003;</span>
                <p>{point}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Section 7: Discord etiquette */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            7: Discord Etiquette
          </h2>
          <div className="space-y-2">
            {[
              'Discord is the team nerve centre. Keep it open all day, every working day.',
              'Log site requests and closes in the channels they belong in, never in random threads.',
              'When a preview site is posted back to you, react or reply so the team knows you have it.',
              'Post your daily numbers when asked. Sebastian Garcia tracks activity from Discord.',
              'Keep it professional and no client contact details in public channels beyond what the workflow needs.',
              'If you are stuck on a call or an objection, ask in the team channel. Someone has closed it before.',
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
