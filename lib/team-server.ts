// Server-side helpers for the Team & Staff Onboarding module.
// Used by app/api/team/onboarding/route.ts when a new onboarding is created.

export type OnboardingTaskCategory = 'admin' | 'learning_os' | 'learning_video' | 'milestone'

export type DefaultOnboardingTask = {
  title: string
  category: OnboardingTaskCategory
  url: string | null
}

// Seeded into staff_onboarding_tasks (with position = array index) whenever a
// new staff_onboardings row is created. Never seeded via SQL migration —
// keeping the checklist here means it can change without a schema migration.
export const DEFAULT_ONBOARDING_TASKS: DefaultOnboardingTask[] = [
  // admin
  { title: 'Sign freelance cold calling agreement', category: 'admin', url: null },
  { title: 'Send passport / photo ID', category: 'admin', url: null },
  { title: 'Send personal details for OS login', category: 'admin', url: null },
  { title: 'Get OS login + set password', category: 'admin', url: null },
  { title: 'Join team Discord + WhatsApp', category: 'admin', url: null },

  // learning_os
  { title: 'OS walkthrough: Cold Calling Dashboard', category: 'learning_os', url: null },
  { title: 'Learn to log calls + submit EOD report', category: 'learning_os', url: null },
  { title: 'Read call script, offer & rebuttals (Resources)', category: 'learning_os', url: null },
  { title: 'Review Websites tab — what we sell', category: 'learning_os', url: null },

  // learning_video
  { title: 'Watch: cold calling fundamentals [Juan to add link]', category: 'learning_video', url: null },
  { title: 'Watch: openers [Juan to add link]', category: 'learning_video', url: null },
  { title: 'Watch: objection handling [Juan to add link]', category: 'learning_video', url: null },
  { title: 'Watch: booking/closing [Juan to add link]', category: 'learning_video', url: null },

  // milestone
  { title: 'Intro meeting with Sales Manager', category: 'milestone', url: null },
  { title: 'First 20 calls logged', category: 'milestone', url: null },
  { title: 'Day-7 review call with CEO', category: 'milestone', url: null },
]

export const ONBOARDING_CATEGORY_LABELS: Record<OnboardingTaskCategory, string> = {
  admin: 'Admin',
  learning_os: 'Learning: OS',
  learning_video: 'Learning: Video',
  milestone: 'Milestones',
}

export const ONBOARDING_STAGE_LABELS: Record<string, string> = {
  applied: 'Applied',
  contract_sent: 'Contract Sent',
  details_collected: 'Details Collected',
  intro_booked: 'Intro Booked',
  ramp_learning: 'Ramp & Learning',
  day7_review: 'Day-7 Review',
  active: 'Active',
}

export const ONBOARDING_STAGES = [
  'applied',
  'contract_sent',
  'details_collected',
  'intro_booked',
  'ramp_learning',
  'day7_review',
  'active',
] as const
