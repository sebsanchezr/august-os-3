'use client'

import Link from 'next/link'

const objections = [
  {
    q: '"I get enough work from word of mouth"',
    reframe: 'Word of mouth is exactly why you need this. When someone recommends you, the first thing they do is Google you. If they find nothing, or a dead Facebook page, some of them just ring the next roofer. A site catches the work you have already earned.',
    ask: 'When someone gets your name off a mate, where do they go to check you out?',
    close: 'Let me show you what they would see right now, then what they could see. No cost to look.',
  },
  {
    q: '"It is too expensive / I cannot afford it"',
    reframe: 'It is a one-time build and then &pound;75 a month, less than a tank of diesel. One extra job pays for the whole thing, and this is built to bring you more than one.',
    ask: 'What is one roofing job worth to you, a few hundred, a few grand?',
    close: 'So if this lands you a single extra job, it has paid for itself and then some. Shall I get you set up?',
  },
  {
    q: '"I already have a website"',
    reframe: 'Good, so you know the value. The question is whether it is working. Most trade sites are years old and look rough on a phone, which is where nearly all your customers are searching from.',
    ask: 'When did you last update it, and have you pulled it up on your own phone recently?',
    close: 'Have a look at the one I have built for you, no obligation, then you can decide which one you would rather send customers to.',
  },
  {
    q: '"My nephew / mate does my website"',
    reframe: 'Family and mates are great for a favour, but a favour gets done when they have time, not when you need it. We build it in days and keep it updated the same day you ask, every time.',
    ask: 'How quickly does it get sorted when you need a change made?',
    close: 'Look at what I have built, and if it beats what you have, we take the whole headache off your plate for &pound;75 a month. Fair?',
  },
  {
    q: '"I do not have time for this"',
    reframe: 'That is the whole point, you do none of the work. We build it, we host it, we update it. All I need is a couple of minutes now and you never touch it again.',
    ask: 'If I did all the heavy lifting and it just started bringing you calls, would that be worth two minutes?',
    close: 'Give me your best email and I will send the preview across right now, takes you ten seconds to look.',
  },
  {
    q: '"Just send me some info / email me"',
    reframe: 'I can do better than an email. I have built you an actual working preview of your site, so instead of reading about it you can just look at it.',
    ask: 'Are you near your phone now? I will send the link so we can look together.',
    close: 'Give me two minutes to walk you through it, and if it is not for you, no harm done.',
  },
  {
    q: '"How do I know this is not a scam"',
    reframe: 'Totally fair, you should be careful. We are August Marketing, a UK company, and you pay through Stripe, the same secure checkout the big brands use. Nothing goes live until you have seen the site and paid, and the monthly is rolling with no lock-in.',
    ask: 'Would it help if I sent you the preview first so you can see the real thing before any money changes hands?',
    close: 'Have a look at the site I built you, and once you are happy I will send you a secure Stripe link. You are in control the whole way.',
  },
  {
    q: '"I need to think about it / speak to my wife or partner"',
    reframe: 'Of course, it is your business. Most people who say that just have one or two questions in the back of their mind. Let me clear those now so you are not deciding in the dark.',
    ask: 'What is the one thing you would need to be sure of before you said yes?',
    close: 'Tell you what, I will hold your preview live so you can show them tonight, and I will ring you tomorrow. What time works?',
  },
  {
    q: '"I am too busy / it is my busy season"',
    reframe: 'Busy season is exactly when you are turning work away and losing the overflow. A site catches those leads while you are up a ladder, instead of them going to the next name on Google.',
    ask: 'How many enquiries do you reckon you miss when you are flat out on jobs?',
    close: 'This runs in the background and catches them for you. Two minutes now, and it is working for you all through your busy season.',
  },
]

export default function ObjectionsSopPage() {
  return (
    <div className="min-h-screen bg-[#08090c] px-6 py-10 print:bg-white print:text-black">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <Link href="/sop" className="text-xs text-[#636780] hover:text-indigo-400 print:hidden">&larr; Back to SOPs</Link>
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#636780] print:text-gray-500 mb-2 mt-3">August Marketing</p>
          <h1 className="text-3xl font-bold text-[#e4e6f0] print:text-black tracking-tight">Objection Handling Playbook</h1>
          <p className="text-sm text-[#636780] print:text-gray-500 mt-1">Standard Operating Procedure, UK Roofer Objections</p>
          <div className="mt-4 border-t border-[#1c2035] print:border-gray-200" />
        </div>

        {/* Intro */}
        <div className="border-l-2 border-indigo-500 pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4 mb-10">
          <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed">
            Every objection follows the same four beats. Acknowledge and reframe, ask a question that gets them talking,
            then close back to the next step. Do not argue, agree first, then turn it. Learn these until they are second
            nature.
          </p>
        </div>

        {/* Objection cards */}
        <section className="mb-10">
          <div className="space-y-5">
            {objections.map((o, i) => (
              <div key={i} className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1c2035] print:border-gray-200">
                  <p className="text-sm font-medium text-[#e4e6f0] print:text-black italic">{o.q}</p>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">Reframe</p>
                    <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: o.reframe }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Ask back</p>
                    <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed italic">{o.ask}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1">Close line</p>
                    <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: o.close }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Golden rules */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            Golden Rules
          </h2>
          <div className="space-y-2">
            {[
              'Agree before you turn. Never make them wrong for the objection.',
              'The preview site is your strongest answer to almost everything. Get it in front of them.',
              'After you ask a question, stop talking. Let the silence do the work.',
              'Never discount the &pound;75 a month. Move on the build fee only if you must.',
              'A stall is not a no. Book a firm time and follow up.',
            ].map((point, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-[#e4e6f0] print:text-gray-800">
                <span className="text-indigo-400 mt-0.5 shrink-0">&#10003;</span>
                <p dangerouslySetInnerHTML={{ __html: point }} />
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
