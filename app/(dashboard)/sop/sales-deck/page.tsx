'use client'

export default function SalesDeckSopPage() {
  return (
    <div className="min-h-screen bg-[#08090c] px-6 py-10 print:bg-white print:text-black">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#636780] print:text-gray-500 mb-2">August Marketing</p>
          <h1 className="text-3xl font-bold text-[#e4e6f0] print:text-black tracking-tight">Most Valuable Pitch Deck</h1>
          <p className="text-sm text-[#636780] print:text-gray-500 mt-1">How to build a custom deck that closes deals</p>
          <div className="mt-4 border-t border-[#1c2035] print:border-gray-200" />
        </div>

        {/* Purpose */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-4">Purpose</h2>
          <p className="text-sm text-[#e4e6f0] print:text-gray-800 mb-4">
            The deck is your second voice in the room. It exists to make the prospect feel like it was built for them. It is not a corporate deck, not a template, and not about you.
          </p>
          <p className="text-sm text-[#e4e6f0] print:text-gray-800">
            The goal: the prospect should feel understood and see your solution as the obvious answer.
          </p>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Before You Design */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-4">Before You Design</h2>
          <div className="space-y-3 text-sm text-[#e4e6f0] print:text-gray-800">
            <ul className="space-y-2">
              <li>• Analyze the prospect. Review their website, products, content, and competitors</li>
              <li>• Look for gaps and weak points. What are they not doing well?</li>
              <li>• Define the angle. What problem are you solving, and why you?</li>
              <li>• Know the outcome before you start designing</li>
            </ul>
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Slide Structure */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-4">Slide Structure</h2>
          <p className="text-sm text-[#636780] print:text-gray-500 mb-4">10-20 slides maximum, unless the situation truly needs more.</p>
          <div className="space-y-5">
            {[
              { num: '1', title: 'Cover Slide', desc: 'Keep it clean and sharp. Add the client\'s logo to personalize it.' },
              { num: '2-4', title: 'Agency Overview (2-3 slides)', desc: 'Briefly introduce your agency. Include past clients and success highlights. Think big wins, not fluff.' },
              { num: '5', title: 'Client Highlight (1 slide)', desc: 'Acknowledge something awesome about the client. Make it authentic and relevant to the work you\'re about to pitch.' },
              { num: '6-8', title: 'Problem Discovery (2-3 slides)', desc: 'Clearly outline the main issues you\'ve identified. Make sure these resonate with what the client suspects or has openly discussed.' },
              { num: '9-11', title: 'Solution Proposal (2-3 slides)', desc: 'Introduce your plan to tackle each problem. Focus on specific, achievable outcomes, not generic process.' },
              { num: '12-15', title: 'Value-Driven Examples (3-4 slides)', desc: 'Showcase expertise through case studies and examples. This is where you prove impact. Only include relevant wins.' },
              { num: '16-17', title: 'Risk Mitigation (1-2 slides)', desc: 'Address concerns about working with you. Explain how your agency has planned to de-risk the engagement.' },
              { num: '18-19', title: 'Process & Timeline (1-2 slides)', desc: 'Provide a brief roadmap for implementation. Include timelines and touchpoints, but keep it focused on process, not price.' },
            ].map((slide) => (
              <div key={slide.num}>
                <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-1">{slide.num}. {slide.title}</h3>
                <p className="text-sm text-[#636780] print:text-gray-600">{slide.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* Design Guidelines */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-4">Design Guidelines</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-1">Keep It Simple</h3>
              <p className="text-sm text-[#e4e6f0] print:text-gray-800">
                Clean backgrounds, consistent fonts, minimal text per slide. Let visuals and data tell the story.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-1">Customization Matters</h3>
              <p className="text-sm text-[#e4e6f0] print:text-gray-800">
                Every slide should feel built for this prospect. Generic slides stand out and undermine your message.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-1">One Clear Path</h3>
              <p className="text-sm text-[#e4e6f0] print:text-gray-800">
                Present one tailored approach. Multiple options can confuse and show you're uncertain.
              </p>
            </div>
          </div>
        </section>

        <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />

        {/* What NOT to Include */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-4">What NOT to Include</h2>
          <div className="space-y-2 text-sm text-[#e4e6f0] print:text-gray-800">
            <ul className="space-y-1">
              <li>• Generic slides like "Our Mission" or broad brand statements</li>
              <li>• Vague process labels or trendy abbreviations that don't mean anything</li>
              <li>• Multiple package options or pricing</li>
              <li>• A salesy "Next Steps" section in the deck (the close happens in conversation)</li>
              <li>• Unrelated testimonials or random case studies</li>
            </ul>
          </div>
        </section>

        {/* Deck as a Tool */}
        <section className="mb-10 bg-[#10121a] print:bg-gray-50 border border-[#1c2035] print:border-gray-200 rounded-xl px-5 py-4">
          <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">The Deck as a Tool</h3>
          <ul className="space-y-2 text-sm text-[#e4e6f0] print:text-gray-800">
            <li>• It is a guide, not a script. You guide the conversation, not read the slides</li>
            <li>• Stop at places that make sense to spark conversation</li>
            <li>• Watch for body language. If they're engaged, go deeper. If not, move on</li>
            <li>• The best deck is one that the prospect feels was built for them and feels like a conversation, not a presentation</li>
          </ul>
        </section>

        <div className="mt-10 pt-6 border-t border-[#1c2035] print:border-gray-200">
          <p className="text-xs text-[#636780] print:text-gray-400">August Marketing, internal use only</p>
        </div>
      </div>
    </div>
  )
}
