'use client'

export default function SopPage() {
  return (
    <div className="min-h-screen bg-[#08090c] px-6 py-10 print:bg-white print:text-black">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#636780] print:text-gray-500 mb-2">August Marketing</p>
          <h1 className="text-3xl font-bold text-[#e4e6f0] print:text-black tracking-tight">Caller SOP</h1>
          <p className="text-sm text-[#636780] print:text-gray-500 mt-1">Standard Operating Procedure: Cold Calling</p>
          <div className="mt-4 border-t border-[#1c2035] print:border-gray-200" />
        </div>

        {/* Section 1: The Call */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            1: The Call
          </h2>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">Opening line</h3>
            <div className="border-l-2 border-indigo-500 pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4">
              <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed italic">
                &ldquo;Hi, is that [Name]? It&apos;s [Your Name] from August Marketing, I won&apos;t take up too much
                of your time. I was looking at your website and I had a few ideas that could help bring in more
                roofing leads. Would you be open to a quick 10-minute call to run you through them?&rdquo;
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">Key points to hit</h3>
            <div className="space-y-2">
              {[
                'Mention you\'ve built 50+ roofing sites, lead with social proof',
                'The website pays for itself with just 1–2 extra jobs',
                'Quick turnaround: 5 working days live',
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

        {/* Section 2: Objections */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            2: Handling Objections
          </h2>
          <div className="space-y-5">
            {[
              {
                q: '"We already have a website"',
                a: 'Brilliant, do you know how many leads it\'s generating per month? Most sites we look at aren\'t set up to convert. We specialise in roofing specifically, so we know exactly what local customers search for and how to turn those visits into calls.',
              },
              {
                q: '"Not interested / too busy"',
                a: 'Totally get that, I\'ll be quick. We build roofing sites that rank locally and bring calls in. Took one of our clients from zero online presence to 8 inbound leads in the first month. If even one extra job comes from it, it pays for itself. Worth 5 minutes?',
              },
              {
                q: '"How much does it cost?"',
                a: 'We have options from £950 all the way to £1,995, and we offer a £500 deposit to get started. The site pays for itself with one extra job, and most of our clients see that within the first 30 days. We also include 3 months of free hosting so there\'s no ongoing cost to worry about upfront.',
              },
            ].map(({ q, a }, i) => (
              <div key={i} className="bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1c2035] print:border-gray-200">
                  <p className="text-sm font-medium text-[#e4e6f0] print:text-black italic">{q}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed">{a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Section 3: After the Call */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            3: After Payment is Confirmed
          </h2>

          {/* Step 1 */}
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black">Send the payment link on the call</h3>
            </div>
            <div className="pl-8">
              <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed">
                Don&apos;t let the call end without payment confirmed. Send the Stripe link while they&apos;re still on the phone.
                Use the links in the Resources tab.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black">Create the WhatsApp group chat</h3>
            </div>
            <div className="pl-8 space-y-2">
              {[
                'Create a WhatsApp group with the client and add the CEO immediately.',
                'Introduce everyone: "Hi [Name], welcome to August, this is your direct line to us. Any questions, any time."',
                'Make clear they have 24/7 access. This sets the tone and builds trust straight away.',
              ].map((point, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-[#e4e6f0] print:text-gray-800">
                  <span className="text-green-400 mt-0.5 shrink-0">-</span>
                  <p>{point}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3 */}
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black">Sort the domain</h3>
            </div>
            <div className="pl-8">
              <div className="border-l-2 border-amber-500 pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4 mb-4">
                <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed italic">
                  &ldquo;Do you already have a domain name for the website, something like yourbusiness.co.uk?&rdquo;
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#10121a] print:bg-gray-50 border border-green-500/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1.5">They have one</p>
                  <p className="text-xs text-[#e4e6f0] print:text-gray-700 leading-relaxed">
                    Ask them to share login details in the group chat or add August as domain manager. We handle the DNS.
                  </p>
                </div>
                <div className="bg-[#10121a] print:bg-gray-50 border border-amber-500/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1.5">They need one</p>
                  <p className="text-xs text-[#e4e6f0] print:text-gray-700 leading-relaxed">
                    Suggest names on the call, e.g. <span className="font-mono">[company]-roofing.co.uk</span> or <span className="font-mono">[area]roofing.co.uk</span>. Check live on GoDaddy. We purchase and bill back.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0">4</span>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black">Set expectations + collect content</h3>
            </div>
            <div className="pl-8">
              <div className="border-l-2 border-indigo-500 pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4 mb-4">
                <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed italic">
                  &ldquo;We aim to have your website live within 72 hours, fully built, on your domain, ready to take
                  calls. We&apos;ll keep you updated in the group chat every step of the way.&rdquo;
                </p>
              </div>
              <div className="space-y-2">
                {[
                  'Ask for photos they want on the site: team, past jobs, vans, before/afters',
                  'Confirm their phone number and email to display on the site',
                  'Check their service areas and any specialisms (flat roofs, guttering, etc.)',
                ].map((point, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-[#e4e6f0] print:text-gray-800">
                    <span className="text-indigo-400 mt-0.5 shrink-0">✓</span>
                    <p>{point}</p>
                  </div>
                ))}
              </div>
            </div>
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
