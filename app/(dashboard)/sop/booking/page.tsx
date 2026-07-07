'use client'

import Link from 'next/link'

export default function BookingSopPage() {
  return (
    <div className="min-h-screen bg-[#08090c] px-6 py-10 print:bg-white print:text-black">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <Link href="/sop" className="text-xs text-[#636780] hover:text-indigo-400 print:hidden">&larr; Back to SOPs</Link>
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#636780] print:text-gray-500 mb-2 mt-3">August Marketing</p>
          <h1 className="text-3xl font-bold text-[#e4e6f0] print:text-black tracking-tight">Booking and Show-Up SOP</h1>
          <p className="text-sm text-[#636780] print:text-gray-500 mt-1">Standard Operating Procedure, Booking</p>
          <div className="mt-4 border-t border-[#1c2035] print:border-gray-200" />
        </div>

        {/* Section 1: Booking script */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            1 &mdash; Booking Script Essentials
          </h2>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">Ask for the slot</h3>
            <div className="border-l-2 border-indigo-500 pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4">
              <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed italic">
                &ldquo;Happy to walk you through it properly, it&apos;s a quick 20-minute strategy call so I can look
                at what you&apos;re running now and show you exactly what we&apos;d change. Does tomorrow afternoon or
                Thursday morning work better?&rdquo;
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">Key points to hit</h3>
            <div className="space-y-2">
              {[
                'Frame it as a 20-minute strategy call, not a sales call',
                'Always offer two specific time options, never leave it open-ended',
                'Confirm the best email and phone number before ending the message or call',
                'Attach or mention the agenda so they know what to expect',
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

        {/* Section 2: Show-up sequence */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            2 &mdash; Show-Up Sequence
          </h2>
          <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed mb-6">
            Every booking runs through the same automated sequence on our owned stack. No step is skipped, no matter
            how confident the lead sounded on the call.
          </p>

          {/* Step 1 */}
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black">T+0: Confirmation email</h3>
            </div>
            <div className="pl-8">
              <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed">
                Sent the instant the slot is booked. Includes the date, time, time zone, call link, and the agenda
                for the 20-minute strategy call.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black">T-24h: Reminder email</h3>
            </div>
            <div className="pl-8">
              <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed">
                Sent 24 hours before the call. Short, restates the time, and includes a one-click reschedule link so
                a conflict does not turn into a silent no-show.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black">T-3h: Reminder email</h3>
            </div>
            <div className="pl-8">
              <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed">
                A second, shorter reminder 3 hours out. This is the window where people forget mid-workday, catches
                them while the call is still easy to prepare for.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0">4</span>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black">T-1h: SMS</h3>
            </div>
            <div className="pl-8">
              <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed">
                A text 1 hour before the call, the highest-attention channel we have. Keep it to one line: the time
                and the call link, nothing else.
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0">5</span>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black">No-show rebook</h3>
            </div>
            <div className="pl-8">
              <div className="border-l-2 border-amber-500 pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4">
                <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed">
                  If the lead does not join within a few minutes of the start time, the system automatically fires an
                  offer to rebook, no manual chasing required. Speed matters here, the rebook message goes out while
                  the call is still fresh in their mind.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Section 3: Etiquette */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            3 &mdash; Meeting Etiquette
          </h2>
          <div className="space-y-2">
            {[
              'Be the last to respond in any scheduling thread, never leave the lead waiting on us',
              'Always confirm the exact slot back in writing once it is booked',
              'Attach the agenda to the confirmation so the lead knows what the 20 minutes covers',
              'Join a minute early, never make the lead wait on the call',
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
