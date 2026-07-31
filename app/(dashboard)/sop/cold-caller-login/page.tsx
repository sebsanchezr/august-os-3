'use client'

import Link from 'next/link'

export default function ColdCallerLoginSopPage() {
  return (
    <div className="min-h-screen bg-[#08090c] px-6 py-10 print:bg-white print:text-black">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <Link href="/sop" className="text-xs text-[#636780] hover:text-indigo-400 print:hidden">&larr; Back to SOPs</Link>
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#636780] print:text-gray-500 mb-2 mt-3">August Marketing</p>
          <h1 className="text-3xl font-bold text-[#e4e6f0] print:text-black tracking-tight">Cold Caller OS Login & Workflow</h1>
          <p className="text-sm text-[#636780] print:text-gray-500 mt-1">Your complete guide to August OS, day-to-day tasks, and the sales process.</p>
          <div className="mt-4 border-t border-[#1c2035] print:border-gray-200" />
        </div>

        {/* ─── Welcome ──────────────────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">Welcome to August OS</h2>
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed">
              You have access to <strong>cold calling only</strong>. Your login shows you four sections: Dashboard, End-of-Day Reports (EOD), Websites, and Resources. Everything you need to book calls, track your progress, and request deliverables lives here.
            </p>
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* ─── SECTION 1: Dashboard ──────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">1. Dashboard: Your Daily Snapshot</h2>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">What you see when you log in</h3>
            <div className="space-y-4">
              {[
                { title: 'Today\'s metrics', desc: 'Calls made today, conversations started, demos booked, paid agreements signed. This feeds into your EOD report.' },
                { title: 'Weekly summary', desc: 'Rolling totals: calls this week, booking rate %, qualified leads, closures. Compares to your targets.' },
                { title: 'Your pipeline', desc: 'Prospects in three columns: First Call, Follow-up, Agreed to Demo. Drag names across as they progress.' },
                { title: 'Recent activity', desc: 'Your last 10 logged activities. Use this to spot what you did yesterday and pick up where you left off.' },
              ].map((item, i) => (
                <div key={i} className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-[#e4e6f0] print:text-black">{item.title}</p>
                  <p className="text-sm text-[#636780] print:text-gray-600 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">Morning routine (5 minutes)</h3>
            <div className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-lg p-4">
              <ol className="space-y-2">
                {[
                  'Open the Dashboard tab. Check today\'s target vs. your current count.',
                  'Open Updates tab (top nav) — see yesterday\'s summary: calls made across the team, replies in, demos booked.',
                  'Check your pipeline: Who did you leave on a follow-up? When? Call them first.',
                  'Scan recent activity: did anyone reply to you overnight via WhatsApp or email? Respond first.',
                  'Load your cold-calling script and Objections SOP (both in the SOP section) — review once, then you\'re ready.',
                ].map((point, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-indigo-400 font-semibold shrink-0">{i + 1}.</span>
                    <p className="text-sm text-[#e4e6f0] print:text-gray-800">{point}</p>
                  </div>
                ))}
              </ol>
            </div>
          </div>

        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* ─── SECTION 2: EOD Reports (CRITICAL) ───────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">2. End-of-Day Reports (EOD) — Most Important</h2>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed">
              <strong>This is how we track your performance, pay commission, and spot trends.</strong> Every call, every conversation, every outcome gets logged in EOD. Skip it and it looks like you didn't work. Be precise.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">What goes in EOD</h3>
            <div className="space-y-4">
              {[
                {
                  field: 'Calls made',
                  desc: 'Count every outbound call you dialed today. Include no-answers and busy signals. That is effort.',
                  example: 'Dialed 32 numbers, reached 14 people.'
                },
                {
                  field: 'Conversations started',
                  desc: 'People you spoke to, had at least 30 seconds of dialogue. Excludes "Not interested, bye."',
                  example: 'Had real pitch conversations with 14 prospects.'
                },
                {
                  field: 'Demos / calls booked',
                  desc: 'Confirmed meetings or follow-up calls scheduled in calendars. Write the count and list names or companies.',
                  example: 'Booked 3 demos: ABC Roofing (Fri 2pm), XYZ Guttering (Mon 10am), Local Repairs (Tue 3pm).'
                },
                {
                  field: 'Objections hit & solutions used',
                  desc: 'What pushback did you get? How did you handle it? This trains the team.',
                  example: '"Not interested" hit 8x → used social proof objection response (50+ sites built). Converted 2 to callbacks.'
                },
                {
                  field: 'Leads to follow up',
                  desc: 'Names of hot prospects who said "maybe later" or asked you to ring back. These go into your pipeline for tomorrow.',
                  example: 'Bob at Local Ltd: call back Wed. Sarah at Smith Repairs: follow-up email sent.'
                },
                {
                  field: 'Notes & blockers',
                  desc: 'Anything unusual? Did your phone die? Are you running out of leads? Flag it so Seb or Juan can help.',
                  example: 'Lead list stale — last 50 were old phone numbers. Need fresh data for tomorrow.'
                },
              ].map((item, i) => (
                <div key={i} className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-indigo-400 print:text-indigo-600">{item.field}</p>
                  <p className="text-sm text-[#636780] print:text-gray-600 mt-1">{item.desc}</p>
                  <div className="mt-2 p-2 bg-[#0a0c11] print:bg-gray-100 rounded border border-[#1c2035] print:border-gray-300">
                    <p className="text-xs text-[#a0a3b8] print:text-gray-700 italic">{item.example}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">When to submit EOD</h3>
            <div className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-lg p-4">
              <p className="text-sm text-[#e4e6f0] print:text-gray-800 mb-3"><strong>Every day by 5pm UK time.</strong> This is non-negotiable — it's how Seb and Juan know if you're on track.</p>
              <p className="text-sm text-[#636780] print:text-gray-600">
                If you close a demo after 5pm, you can log it in the next day's report. But don't batch multiple days — report daily so we spot trends and you can course-correct.
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">Why EOD matters</h3>
            <ul className="space-y-2">
              {[
                'Proves you worked — hours logged translate to commission.',
                'Spots trends — if objection X keeps hitting, we brief you on better responses.',
                'Tracks what\'s working — we see which lead sources convert best, which objection responses close deals.',
                'Keeps you accountable — you see your booking rate, we see if you\'re on pace to hit target.',
              ].map((point, i) => (
                <li key={i} className="flex gap-2 text-sm text-[#e4e6f0] print:text-gray-800">
                  <span className="text-indigo-400 shrink-0">✓</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* ─── SECTION 3: Websites Tab ───────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">3. Websites Tab: After You Book the Sale</h2>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">When you're in a sales call and they say "yes"</h3>
            <div className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed">
                You've closed the sale. Payment is confirmed. Now you need to capture their requirements so the build team can deliver fast.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-[#e4e6f0] print:text-black mb-2">Step 1: Open Websites tab</h4>
                <p className="text-sm text-[#636780] print:text-gray-600">Click the Websites section in your nav. Hit "New Request".</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-[#e4e6f0] print:text-black mb-2">Step 2: Fill in client details</h4>
                <ul className="space-y-2 ml-4">
                  {[
                    'Company name',
                    'Contact name & email',
                    'Phone number (they\'ll see this on the site)',
                    'Service area (e.g. "Greater London" or "South-West UK")',
                    'Specialisms (e.g. "Flat roofs, guttering, fascia")',
                  ].map((item, i) => (
                    <li key={i} className="text-sm text-[#e4e6f0] print:text-gray-800">
                      <span className="text-indigo-400 shrink-0">•</span> {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-medium text-[#e4e6f0] print:text-black mb-2">Step 3: Collect content</h4>
                <p className="text-sm text-[#636780] print:text-gray-600 mb-2">
                  In the same WhatsApp group you created, ask them to send:
                </p>
                <ul className="space-y-2 ml-4">
                  {[
                    'Team photos',
                    'Before/after job photos',
                    'Van or truck photos',
                    'Logo if they have one',
                  ].map((item, i) => (
                    <li key={i} className="text-sm text-[#e4e6f0] print:text-gray-800">
                      <span className="text-indigo-400 shrink-0">•</span> {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-medium text-[#e4e6f0] print:text-black mb-2">Step 4: Domain choice</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1.5">They have one</p>
                    <p className="text-xs text-[#e4e6f0] print:text-gray-700 leading-relaxed">
                      Ask them to share login or add August as domain manager in the group chat.
                    </p>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1.5">They need one</p>
                    <p className="text-xs text-[#e4e6f0] print:text-gray-700 leading-relaxed">
                      Suggest <span className="font-mono text-[10px]">[company]-roofing.co.uk</span>. August buys it and bills them.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-[#e4e6f0] print:text-black mb-2">Step 5: Submit and alert the team</h4>
                <p className="text-sm text-[#636780] print:text-gray-600">
                  Click "Submit Request". A notification goes to the build team and Seb. They start within 24 hours. The client gets a WhatsApp update in your group chat.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
            <p className="text-sm text-[#e4e6f0] print:text-gray-800">
              <strong>Timeline for the client:</strong> Website is live and on their domain within 72 hours of request submitted. You stay in the group chat and give updates. After handoff to build team, your job is to keep the client happy until the site is live.
            </p>
          </div>

        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* ─── SECTION 4: Resources ──────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">4. Resources Tab: Your Toolkit</h2>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">What you'll find here</h3>
            <div className="space-y-4">
              {[
                {
                  title: 'Stripe payment links',
                  desc: 'Clickable links for each package price (£950, £1,495, £1,995). Send on the call while they\'re saying "yes". Mark it as "urgent" in Stripe so it goes to the front of their inbox.'
                },
                {
                  title: 'WhatsApp templates',
                  desc: 'Pre-written messages for first contact, intro after payment, domain handoff, build updates, site-live announcement. Copy-paste and personalize.'
                },
                {
                  title: 'Lead lists',
                  desc: 'Fresh roofing company databases, contact details, phone numbers. Download here and import to your dialer.'
                },
                {
                  title: 'Objection playbook',
                  desc: 'Every common objection and the best response. Open this when you get stuck. You\'ll recognize the patterns.'
                },
                {
                  title: 'Cold-call script',
                  desc: 'The opening, key points, and closing questions. Memorize this, then make it your own.'
                },
                {
                  title: 'Helpful links',
                  desc: 'Stripe dashboard, lead provider login, CRM, team contact numbers.'
                },
              ].map((item, i) => (
                <div key={i} className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-[#e4e6f0] print:text-black">{item.title}</p>
                  <p className="text-sm text-[#636780] print:text-gray-600 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* ─── SECTION 5: The Sales Process ──────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">5. The Sales Process: From Dial to Signed</h2>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">Phase 1: Outbound Call (Days 1–3)</h3>
            <div className="space-y-3">
              {[
                { stage: 'Dial', action: 'Call from your list. Your opening line is in the SOP section — use it.' },
                { stage: 'Pitch', action: 'Quick 2-minute pitch: name, offer (built 50+ sites), pain point (lead generation problem), call-to-action (10-minute call).' },
                { stage: 'Objection', action: 'They push back. Use the Objections SOP. Most common ones are "I\'ve got a website" and "Not interested." You have 3–5 counter-arguments per objection.' },
                { stage: 'Booking', action: 'If they say yes, book a demo call and get it in their calendar. Confirm via SMS/WhatsApp immediately after.' },
              ].map((item, i) => (
                <div key={i} className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-indigo-400 print:text-indigo-600 uppercase tracking-wider">{item.stage}</p>
                  <p className="text-sm text-[#e4e6f0] print:text-gray-800 mt-1">{item.action}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">Phase 2: Demo Call (Days 3–7)</h3>
            <div className="space-y-3">
              {[
                { stage: 'Prep', action: 'Review your notes on this prospect: pain point, objections from first call, size (how many jobs/month?). Show you listened.' },
                { stage: 'Walk through', action: 'Show a site example. Point out the booking form, location targeting, mobile optimization. Ask: "Does this match what you were looking for?"' },
                { stage: 'Social proof', action: 'Share ROI: "One of our clients went from zero leads to 8 inbound in the first month. Most break even in 30 days."' },
                { stage: 'Pricing', action: 'Show three tiers (£950 / £1,495 / £1,995) with what\'s included. Let them choose.' },
                { stage: 'Close', action: 'Send the payment link. Get payment confirmed on the call. Do not hang up until it\'s done.' },
              ].map((item, i) => (
                <div key={i} className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-green-400 print:text-green-600 uppercase tracking-wider">{item.stage}</p>
                  <p className="text-sm text-[#e4e6f0] print:text-gray-800 mt-1">{item.action}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">Phase 3: Handoff (After Payment)</h3>
            <div className="space-y-3">
              {[
                { stage: 'WhatsApp group', action: 'Create group with client + Seb. Intro: "Hi [Name], this is your direct line to August, 24/7 access. Meet the team — Seb and I will get your site live in 72 hours."' },
                { stage: 'Expectations', action: 'Set the timeline: "Site goes live on your domain by [Date]. We\'ll update you every step."' },
                { stage: 'Content collection', action: 'Ask for photos and details in the group. Log it in the Websites tab in the OS.' },
                { stage: 'Build team takes over', action: 'Build starts within 24 hours. Your job now: keep the client updated and happy, flag any problems to Seb.' },
                { stage: 'Site goes live', action: 'Build team posts the live site URL in the group. Client clicks it, site is theirs, domain is theirs, you and Seb remain their support contact.' },
              ].map((item, i) => (
                <div key={i} className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-400 print:text-amber-600 uppercase tracking-wider">{item.stage}</p>
                  <p className="text-sm text-[#e4e6f0] print:text-gray-800 mt-1">{item.action}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
            <p className="text-sm font-medium text-[#e4e6f0] print:text-gray-800 mb-2"><strong>Calls to action by stage:</strong></p>
            <ul className="text-sm text-[#e4e6f0] print:text-gray-800 space-y-1">
              <li>Days 1–3: "Let's book a quick call so I can show you exactly what we do."</li>
              <li>Days 3–7: "If this fits, I can get you set up today with a deposit and timeline."</li>
              <li>Demo call: "Payment link is live in the chat. You can start today."</li>
              <li>After payment: "Welcome to August. Let's build something that brings you leads."</li>
            </ul>
          </div>

        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* ─── SECTION 6: Key Numbers & Targets ──────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">6. Your Targets & Commission</h2>

          <div className="space-y-4">
            <div className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-[#e4e6f0] print:text-black">Calls per day</p>
              <p className="text-2xl font-bold text-indigo-400 mt-1">20</p>
              <p className="text-xs text-[#636780] print:text-gray-600 mt-2">Minimum. Include attempts, busy, no-answers. Track in EOD daily.</p>
            </div>

            <div className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-[#e4e6f0] print:text-black">Conversation-to-booking rate</p>
              <p className="text-2xl font-bold text-green-400 mt-1">~15–20%</p>
              <p className="text-xs text-[#636780] print:text-gray-600 mt-2">Book 3–4 demos from 20 calls. Below that? You need better objection handling or lead quality.</p>
            </div>

            <div className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-[#e4e6f0] print:text-black">Booking-to-close rate</p>
              <p className="text-2xl font-bold text-purple-400 mt-1">~50–70%</p>
              <p className="text-xs text-[#636780] print:text-gray-600 mt-2">Half your demos = sales. 3 demos → 1–2 sales typical.</p>
            </div>

            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
              <p className="text-sm font-medium text-[#e4e6f0] print:text-gray-800 mb-2"><strong>Commission:</strong></p>
              <ul className="text-sm text-[#e4e6f0] print:text-gray-800 space-y-1">
                <li><strong>15%</strong> on deals you close yourself</li>
                <li><strong>20%</strong> on deals you close + handle website build relationship</li>
                <li>Paid weekly on confirmed revenue (payment cleared)</li>
              </ul>
            </div>
          </div>

        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* ─── Support ───────────────────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">Questions? Always ask.</h2>
          <div className="space-y-3">
            <div className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-[#e4e6f0] print:text-black">Juan (Sales Manager)</p>
              <p className="text-xs text-[#636780] print:text-gray-600 mt-1">Objection help, lead quality, strategy, booking tactics. WhatsApp or Discord.</p>
            </div>
            <div className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-[#e4e6f0] print:text-black">Seb (CEO/Founder)</p>
              <p className="text-xs text-[#636780] print:text-gray-600 mt-1">Big picture questions, system issues, client escalations, commission clarity.</p>
            </div>
          </div>
        </section>

        <div className="mt-8 flex gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
          >
            Print / Save as PDF
          </button>
        </div>

        <div className="mt-10 pt-6 border-t border-[#1c2035] print:border-gray-200">
          <p className="text-xs text-[#636780] print:text-gray-400">August Marketing. Internal use only. Version 1.0 — Jul 29 2026</p>
        </div>

      </div>
    </div>
  )
}
