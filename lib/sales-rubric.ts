// Sales Call Rubric: dimensions and SOP framework text
// Drawn from the four Genflow sales-call lessons

export const SALES_RUBRIC = {
  discovery: [
    { key: 'rapport', label: 'Rapport' },
    { key: 'research_shown', label: 'Research Shown' },
    { key: 'problem_clarity', label: 'Problem Clarity' },
    { key: 'value_first', label: 'Value First' },
    { key: 'deck_as_guide', label: 'Deck as Guide (Not Script)' },
    { key: 'engagement_read', label: 'Engagement Read' },
    { key: 'next_step_locked', label: 'Next Step Locked' },
  ],
  pitch: [
    { key: 'recap_warmup', label: 'Recap & Warmup' },
    { key: 'feedback_gauge', label: 'Feedback Gauge' },
    { key: 'tailored_solution', label: 'Tailored Solution' },
    { key: 'roi_linked_price', label: 'ROI-Linked Price' },
    { key: 'objection_handling', label: 'Objection Handling' },
    { key: 'clear_timeline', label: 'Clear Timeline' },
    { key: 'next_step_sent', label: 'Next Step Sent' },
  ],
  followup: [
    { key: 'deck_sent', label: 'Deck Sent' },
    { key: 'summary_clarity', label: 'Summary Clarity' },
    { key: 'momentum_proof', label: 'Momentum Proof' },
    { key: 'call_confirmed', label: 'Call Confirmed' },
  ],
  onboarding: [
    { key: 'agreement_signed', label: 'Agreement Signed' },
    { key: 'timeline_clear', label: 'Timeline Clear' },
    { key: 'first_step_sent', label: 'First Step Sent' },
  ],
}

export type SalesRubricKey = keyof typeof SALES_RUBRIC

export const SALES_FRAMEWORK = `
## Sales Call Framework (Discovery + Pitch)

### Call 1: Discovery
- Focus on understanding the client and showing value
- Let the deck drive conversation, not replace it
- Show relevant proof and industry-specific material
- Keep it conversational, watch body language
- Do NOT lead with price; redirect to understanding needs
- Frame your service as bespoke, tailored to them
- Close by locking in the second meeting time

Key points: build trust, show you've researched them, make the problem obvious, demonstrate value without mentioning price.

### Call 2: Pitch
- Start with small talk and warmth
- Say how you've been thinking about their project
- Ask for feedback on the first call
- Present slides showing what you can do
- List specific services
- Describe communication and workflow
- Share pricing, linking it to ROI
- Handle objections openly and honestly
- If ready, send agreement and next steps same day

Key points: finalize alignment, move toward closing, make the process feel clear and achievable.

### Between Calls
- Send the deck and summary within 24 hours
- Keep proving value with examples
- Reconfirm the second call time
- Help them share internally

### Closing the Deal
- Present the timeline clearly
- Send agreement and next-step materials
- The process: call 1, deck sent, call 2, onboarding within a week
`

export const MVP_DECK_FRAMEWORK = `
## Most Valuable Pitch Deck

The deck exists to make the prospect feel like it was made for them. It is your second voice in the room.

Slide structure (10-20 max):
1. Cover slide (add their logo for personalization)
2-4. Agency overview (2-3 slides: who you are, past clients, success highlights)
5. Client highlight (1 slide: something positive you noticed about them)
6-8. Problem discovery (2-3 slides: specific issues you found, tailored to them, not generic)
9-11. Solution proposal (2-3 slides: specific, achievable plan to fix each problem)
12-15. Value-driven examples (3-4 slides: case studies, examples, relevant wins only)
16-17. Risk mitigation (1-2 slides: how you've planned to de-risk working together)
18-19. Process & timeline (1-2 slides: brief roadmap, touchpoints, no pricing)

Design: clean and simple, let visuals and data tell the story. One option if applicable is fine; multiple options show flexibility.

Do NOT include:
- Vague process labels or trendy abbreviations
- Your agency mission or generic brand statements
- Pricing or multiple package options
- A salesy 'next steps' section

Goal: the prospect should feel understood and see your solution as the obvious answer.
`
