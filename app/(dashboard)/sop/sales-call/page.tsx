'use client'

import Link from 'next/link'
import { SALES_RUBRIC } from '@/lib/sales-rubric'

export default function SalesCallSopPage() {
  return (
    <div className="min-h-screen bg-[#08090c] px-6 py-10 print:bg-white print:text-black">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#636780] print:text-gray-500 mb-2">August Marketing</p>
          <h1 className="text-3xl font-bold text-[#e4e6f0] print:text-black tracking-tight">Sales Call Framework</h1>
          <p className="text-sm text-[#636780] print:text-gray-500 mt-1">Two-call process for consultative selling</p>
          <div className="mt-4 border-t border-[#1c2035] print:border-gray-200" />
        </div>

        {/* The Framework */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            Call 1: Discovery
          </h2>
          <div className="space-y-4 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-2">Before the Call</h3>
              <ul className="space-y-2 text-sm text-[#e4e6f0] print:text-gray-800">
                <li>• Analyze the prospect's brand, website, content, and competitors</li>
                <li>• Look for gaps and opportunities specific to their situation</li>
                <li>• Define your angle: what problem are you solving, and why you?</li>
                <li>• Prepare a custom deck built for them, not a generic template</li>
                <li>• Professional setup: clean background, camera at eye level, relevant tab shared only</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-2">During Call 1</h3>
              <ul className="space-y-2 text-sm text-[#e4e6f0] print:text-gray-800">
                <li>• Be the first to join and say hello</li>
                <li>• Introduce yourself in 60 seconds, then listen</li>
                <li>• State the objective, keeping it client-focused</li>
                <li>• Guide them through the slides. Explain, don't read</li>
                <li>• Stop at natural moments to spark conversation</li>
                <li>• Show value and your research without mentioning price</li>
                <li>• If the conversation is going well, speak freely don't force the slides</li>
                <li>• End by saying it was a strong conversation</li>
                <li>• Lock in the second call time before you hang up</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-2">Handling Price Questions</h3>
              <p className="text-sm text-[#e4e6f0] print:text-gray-800 mb-2">
                Do NOT lead with price. If they ask:
              </p>
              <ul className="space-y-2 text-sm text-[#e4e6f0] print:text-gray-800">
                <li>• Gently redirect: "Great question. Let me first understand what you need, then pricing makes sense."</li>
                <li>• Frame as bespoke: "Every situation is different. Once I know more, I can give you an accurate number."</li>
                <li>• Price objections are usually value-clarity gaps, not price alone</li>
              </ul>
            </div>
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Call 2 */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            Between Calls
          </h2>
          <div className="space-y-3 text-sm text-[#e4e6f0] print:text-gray-800 mb-8">
            <ul className="space-y-2">
              <li>• Send the deck and a summary within 24 hours</li>
              <li>• Include one sentence per main point discussed, so they can share internally</li>
              <li>• Keep proving value: send examples, ideas, relevant wins</li>
              <li>• Reconfirm the second call time in your message</li>
            </ul>
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            Call 2: Pitch and Close
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-2">During Call 2</h3>
              <ul className="space-y-2 text-sm text-[#e4e6f0] print:text-gray-800">
                <li>• Start with small talk to warm up the conversation</li>
                <li>• Say how you've been thinking about their project</li>
                <li>• Ask for feedback on the first call. Gauge their thoughts</li>
                <li>• Present slides showing what you can do for them</li>
                <li>• List specific services you can provide</li>
                <li>• Describe how communication and workflow will look</li>
                <li>• Share pricing, linking it to the ROI they'll get</li>
                <li>• Open up for Q&A to address concerns</li>
                <li>• If ready to proceed, send agreement and next steps same day</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-2">Handling Objections</h3>
              <p className="text-sm text-[#e4e6f0] print:text-gray-800 mb-2">Common objections and reframes:</p>
              <ul className="space-y-2 text-sm text-[#e4e6f0] print:text-gray-800">
                <li>• "Too expensive" → "Let's look at the ROI. What does one extra deal per month mean to you?"</li>
                <li>• "We're not sure it will work" → "That's why we start with clear benchmarks and measure from day one."</li>
                <li>• "We need to think about it" → "What questions do you have? Let's sort them now so the decision is easy."</li>
                <li>• Don't push hard. Be consultative. Open answers calm objections</li>
              </ul>
            </div>
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Rubric */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
            What We Score You On
          </h2>
          <p className="text-sm text-[#636780] print:text-gray-500 mb-4">
            After every call, the OS analyzes the transcript against these dimensions. Know the bar.
          </p>
          <div className="space-y-4">
            {Object.entries(SALES_RUBRIC).map(([callType, dimensions]) => (
              <div key={callType}>
                <h3 className="text-xs font-semibold text-[#e4e6f0] uppercase tracking-wide mb-2 capitalize">
                  {callType === 'discovery' ? 'Call 1: Discovery' : callType === 'pitch' ? 'Call 2: Pitch' : callType}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {dimensions.map((d) => (
                    <div key={d.key} className="text-xs px-3 py-2 rounded bg-[#181b27] border border-[#1c2035] text-[#8b8fa8]">
                      {d.label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Key principles */}
        <section className="mb-10 bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-xl px-5 py-4">
          <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">Key Principles</h3>
          <ul className="space-y-2 text-sm text-[#e4e6f0] print:text-gray-800">
            <li>• Sell by consulting, not by pushing</li>
            <li>• Value should be undeniable before price is discussed</li>
            <li>• The deck supports the conversation; it does not replace it</li>
            <li>• Professional presentation and preparation matter a lot</li>
            <li>• The process works: call 1 (value), deck sent, call 2 (price + close), onboarding within a week</li>
          </ul>
        </section>

        <div className="mt-10 pt-6 border-t border-[#1c2035] print:border-gray-200">
          <p className="text-xs text-[#636780] print:text-gray-400">August Marketing, internal use only</p>
          <p className="text-xs text-[#636780] print:text-gray-400 mt-1">Check your sales insights to see how your calls score on each dimension</p>
        </div>
      </div>
    </div>
  )
}
