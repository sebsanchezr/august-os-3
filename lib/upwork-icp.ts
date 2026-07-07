// Positioning + proof points used by AI when drafting Upwork proposals and Loom
// scripts. Keep this the single source of truth so every application stays
// on-brand and factually consistent.

export const UPWORK_ICP = {
  agency: 'August Marketing',
  services: ['Paid ads (Meta/Google)', 'Ad creative production', 'Cold email + SMS lead gen', 'Web development'],
  idealClientSignals: [
    'Budget above $2,000',
    'Fewer than 5 proposals so far (early to the job)',
    'Expert contractor tier',
    'Payment verified',
    'Small team (roughly 5-10 people)',
  ],
  proofPoints: [
    'Run paid ad accounts and creative pipelines for multiple active retainer clients',
    'Weekly, data-driven creative iteration based on real ad performance, not guesswork',
    'Built 50+ conversion-focused sites for service businesses',
    'Typical turnaround: first draft creative or campaign live within days, not weeks',
  ],
  bookingUrl: 'https://cal.com/augustmarketing/discovery-call',
  voice: 'Direct, confident, no fluff. No em-dashes. Short paragraphs. Sounds like a founder, not a template.',
}

export type UpworkIcp = typeof UPWORK_ICP
