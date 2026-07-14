
// Task Manager types
export type TaskTrack = 'creative' | 'ops'
export type CreativeStatus = 'brief' | 'editing' | 'revision' | 'sent_for_approval' | 'approved_by_client' | 'sent_to_media_buyer' | 'live'
export type OpsStatus = 'brief' | 'in_progress' | 'review' | 'completed'
export type TaskStatus = CreativeStatus | OpsStatus
export type TaskDepartment = 'creative' | 'paid_ads' | 'client' | 'company' | 'admin' | 'ceo'
export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low'
export type TaskSource = 'manual' | 'meeting' | 'agent' | 'recurring'
export type ProfileRole = 'owner' | 'media_buyer' | 'editor' | 'account_manager' | 'admin'

export type Profile = {
  id: string
  name: string
  role: ProfileRole
  discord_user_id: string | null
  whatsapp_number: string | null
  email: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type Client = {
  id: string
  name: string
  status: 'active' | 'paused' | 'churned'
  services: string[]
  // Account Management fields (migration 006)
  contact_name: string | null
  contact_email: string | null
  wa_group_name: string | null
  mrr: number | null
  currency: string
  start_date: string | null
  renewal_date: string | null
  am_profile_id: string | null
  meta_ad_account_id: string | null
  trendtrak_ids: string[]
  target_roas: number | null
  target_cpa: number | null
  monthly_budget: number | null
  call_day: number | null
  call_time: string | null
  health: 'green' | 'amber' | 'red'
  last_client_contact: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // joined
  am?: Pick<Profile, 'id' | 'name'> | null
}

// ─── Account Management types ─────────────────────────────────────────────────

export type ClientHealthStatus = 'green' | 'amber' | 'red'

export type ClientReportType =
  | 'weekly_eow'
  | 'monday_kickoff'
  | 'meeting_prep'
  | 'meeting_followup'
  | 'monthly_deep_dive'

export type ClientReportStatus = 'pending_approval' | 'approved' | 'sent' | 'rejected'

export type ClientReport = {
  id: string
  client_id: string
  type: ClientReportType
  period_start: string | null
  period_end: string | null
  metrics: Record<string, unknown> | null
  draft_md: string | null
  client_message: string | null
  status: ClientReportStatus
  rejection_note: string | null
  approved_by: string | null
  approved_at: string | null
  sent_at: string | null
  created_at: string
  discord_notified_at: string | null
  clients?: Pick<Client, 'id' | 'name' | 'health'>
  approver?: Pick<Profile, 'id' | 'name'> | null
}

export type ClientMeetingType = 'weekly' | 'monthly' | 'adhoc'
export type ClientMeetingStatus = 'scheduled' | 'done' | 'cancelled'

export type ClientMeeting = {
  id: string
  // null for internal team meetings that map to no client (migration 038)
  client_id: string | null
  // optional display name, e.g. "Team priorities call" (migration 038)
  title: string | null
  type: ClientMeetingType
  scheduled_at: string
  agenda: string | null
  prep_report_id: string | null
  transcript_id: string | null
  followup_report_id: string | null
  status: ClientMeetingStatus
  // migration 009 fields
  duration_minutes: number
  attendees: string[]
  minutes_md: string | null
  minutes_sent_at: string | null
  prep_ready_at: string | null
  recurrence: 'weekly' | 'monthly' | null
  outcome_note: string | null
  // migration 020 field
  cancellation_reason: string | null
  created_at: string
  updated_at: string
  clients?: Pick<Client, 'id' | 'name'>
  prep_report?: Pick<ClientReport, 'id' | 'status'> | null
  followup_report?: Pick<ClientReport, 'id' | 'status'> | null
}

export type PendingMeetingTaskStatus = 'pending' | 'approved' | 'rejected'

export type PendingMeetingTask = {
  id: string
  meeting_id: string | null
  meeting_title: string | null
  source_file_id: string | null
  title: string
  description: string
  suggested_assignee_role: string | null
  suggested_department: string | null
  suggested_client_name: string | null
  due_hint: string | null
  quote: string | null
  status: PendingMeetingTaskStatus
  created_at: string
  reviewed_at: string | null
}

export type ClientCommDirection = 'inbound' | 'outbound'
export type ClientCommChannel = 'whatsapp' | 'email' | 'call' | 'meeting'
export type ClientCommSentiment = 'positive' | 'neutral' | 'concern'

export type ClientCommsLog = {
  id: string
  client_id: string
  direction: ClientCommDirection
  channel: ClientCommChannel
  summary: string
  sentiment: ClientCommSentiment
  flags: string[]
  logged_by: string | null
  occurred_at: string
  // migration 009 SLA fields
  requires_response: boolean
  response_due_at: string | null
  responded_at: string | null
  sla_breached: boolean
  logger?: Pick<Profile, 'id' | 'name'> | null
}

export type TeamQuestionStatus = 'open' | 'answered' | 'expired'

export type TeamQuestion = {
  id: string
  question: string
  context: string
  client_id: string | null
  meeting_id: string | null
  task_id: string | null
  asked_by: string | null
  target_profile_id: string | null
  discord_message_id: string | null
  answer: string | null
  answered_by: string | null
  status: TeamQuestionStatus
  asked_at: string
  answered_at: string | null
  clients?: Pick<Client, 'id' | 'name'> | null
  asker?: Pick<Profile, 'id' | 'name'> | null
  target?: Pick<Profile, 'id' | 'name'> | null
  answerer?: Pick<Profile, 'id' | 'name'> | null
}

export type ClientIssueCategory =
  | 'financial_reporting'
  | 'performance'
  | 'execution_quality'
  | 'communication'
  | 'process'
  | 'client_side'
  | 'value_for_money'
  | 'personality_clash'

export type ClientIssueSeverity = 'minor' | 'major' | 'trust_threatening'
export type ClientIssueStatus = 'open' | 'resolving' | 'resolved'

export type ClientIssue = {
  id: string
  client_id: string
  category: ClientIssueCategory
  severity: ClientIssueSeverity
  description: string
  root_cause: string | null
  resolution: string | null
  process_fix: string | null
  owner_profile_id: string | null
  status: ClientIssueStatus
  raised_at: string
  resolved_at: string | null
  owner?: Pick<Profile, 'id' | 'name'> | null
}

export type ClientTalkingPoint = {
  id: string
  client_id: string
  point: string
  added_by: string | null
  consumed_by_report: string | null
  created_at: string
  adder?: Pick<Profile, 'id' | 'name'> | null
}

export type ClientMetricsDaily = {
  id: string
  client_id: string
  date: string
  spend: number | null
  revenue: number | null
  roas: number | null
  purchases: number | null
  cpa: number | null
  impressions: number | null
  clicks: number | null
  ctr: number | null
  top_creatives: Array<{ ad_id: string; name: string; spend: number; roas: number; thumbnail_url: string | null }> | null
  competitor_notes: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type ClientCreativeAsset = {
  id: string
  client_id: string
  title: string
  kind: string
  url: string | null
  notes: string | null
  created_at: string
}

export const CLIENT_ISSUE_CATEGORY_LABELS: Record<ClientIssueCategory, string> = {
  financial_reporting: 'Financial / Reporting',
  performance:         'Performance',
  execution_quality:   'Execution Quality',
  communication:       'Communication',
  process:             'Process',
  client_side:         'Client-side',
  value_for_money:     'Value for Money',
  personality_clash:   'Personality Clash',
}

export const CLIENT_COMM_TRIGGER_WORDS = [
  'confused', 'disappointing', 'disappointed', 'frustrating', 'frustrated',
  'worried', 'concerned', 'unhappy', 'expensive', 'cost', 'price', 'slow',
  'where is', 'what happened',
]

export type Task = {
  id: string
  title: string
  description: string
  track: TaskTrack
  department: TaskDepartment
  client_id: string | null
  assignee_id: string | null
  created_by: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  blocked_reason: string | null
  source: TaskSource
  meeting_ref: string | null
  recurrence: 'daily' | 'weekly' | 'monthly' | null
  tags: string[]
  position: number
  completed_at: string | null
  archived_at: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  // media buyer + other tags alongside the single assignee (migration 031)
  collaborator_ids?: string[]
  // joined
  profiles?: Pick<Profile, 'id' | 'name' | 'role'>
  creator?: Pick<Profile, 'id' | 'name'>
  clients?: Pick<Client, 'id' | 'name' | 'status'>
  collaborator_profiles?: Pick<Profile, 'id' | 'name' | 'role'>[]
}

export type TaskComment = {
  id: string
  task_id: string
  author_id: string | null
  body: string
  created_at: string
  profiles?: Pick<Profile, 'id' | 'name'>
}

export type TaskEvent = {
  id: string
  task_id: string
  actor_id: string | null
  type: 'created' | 'status_change' | 'assigned' | 'commented' | 'edited' | 'archived' | 'restored' | 'deleted'
  payload: Record<string, unknown>
  occurred_at: string
  profiles?: Pick<Profile, 'id' | 'name'>
}

export const CREATIVE_COLUMNS: { status: CreativeStatus; label: string }[] = [
  { status: 'brief',               label: 'Brief' },
  { status: 'editing',             label: 'Editing' },
  { status: 'revision',            label: 'Revision' },
  { status: 'sent_for_approval',   label: 'Sent for Approval' },
  { status: 'approved_by_client',  label: 'Approved by Client' },
  { status: 'sent_to_media_buyer', label: 'Sent to Media Buyer' },
  { status: 'live',                label: 'Live' },
]

export const OPS_COLUMNS: { status: OpsStatus; label: string }[] = [
  { status: 'brief',       label: 'Brief' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'review',      label: 'Review' },
  { status: 'completed',   label: 'Completed' },
]

export const PRIORITY_COLOURS: Record<TaskPriority, string> = {
  urgent: '#ef4444',
  high:   '#f97316',
  normal: '#6366f1',
  low:    '#636780',
}

// Existing types below
export type Caller = { id: string; name: string; email: string; active: boolean; created_at: string }
export type LeadStatus = 'pending' | 'no_answer' | 'not_interested' | 'callback' | 'booked' | 'closed' | 'dead'
export type CallOutcome = 'dial' | 'no_answer' | 'not_interested' | 'callback' | 'positive' | 'booked'
export type BookingStatus = 'booked' | 'showed' | 'no_show' | 'closed' | 'lost'
export type DealTier = 'full_1995' | 'website_950' | 'custom'
export type DealStatus = 'deposit_paid' | 'paid' | 'live'
export type PaymentType = 'full' | 'deposit' | 'clearpay'
export type CallLead = {
  id: string; company: string; phone: string; city: string | null; niche: string | null
  website: string | null; quality_score: number | null; status: LeadStatus
  caller_id: string | null; source: string | null; created_at: string; updated_at: string
  callers?: Caller
}
export type CallActivity = {
  id: string; lead_id: string; caller_id: string; outcome: CallOutcome
  notes: string | null; created_at: string; callers?: Caller; call_leads?: CallLead
}
export type BookingSource = 'cold_call' | 'cal_com' | 'referral' | 'other'
export type Booking = {
  id: string; lead_id: string | null; caller_id: string | null; business_name: string
  phone: string | null; call_time: string | null; demo_url: string | null
  prep_doc_url: string | null; status: BookingStatus; source: BookingSource | null
  niche: string | null; created_at: string
  callers?: Caller; deals?: Deal[]
}
export type Deal = {
  id: string; lead_id: string | null; booking_id: string | null; tier: DealTier
  setup_amount: number; monthly_amount: number; payment_type: PaymentType
  stripe_ref: string | null; status: DealStatus; closed_at: string; caller_id: string | null
}
export type DashboardMetrics = {
  calls_made: number; positive_replies: number; calls_booked: number; deals_closed: number
  setup_revenue: number; monthly_revenue: number; close_rate: number; book_rate: number
  prev_calls_made: number; prev_positive_replies: number; prev_calls_booked: number
  prev_deals_closed: number; prev_setup_revenue: number
}
export type CallerStats = { caller_id: string; caller_name: string; calls: number; positives: number; booked: number; closed: number; revenue: number }
export type TrendPoint = { date: string; calls: number; booked: number; closed: number }
export type RecentActivity = { id: string; type: 'call' | 'booking' | 'deal'; description: string; caller_name: string | null; created_at: string }

// Acquisition Command Center + cross-channel pipeline types

export type SourceChannel = 'cold_call' | 'cold_email' | 'linkedin' | 'gov' | 'referral' | 'expansion' | 'instagram' | 'networking' | 'other'

// Upwork acquisition channel

export type UpworkJobStatus = 'new' | 'surfaced' | 'applied' | 'replied' | 'call_booked' | 'won' | 'passed'

export type UpworkJob = {
  id: string
  upwork_job_id: string
  title: string
  description: string
  budget: number | null
  budget_type: string | null
  proposals_count: number | null
  client_country: string | null
  client_size: string | null
  payment_verified: boolean | null
  contractor_tier: string | null
  job_url: string
  raw: Record<string, unknown>
  fit_score: number | null
  fit_rationale: string | null
  status: UpworkJobStatus
  discord_message_id: string | null
  surfaced_at: string | null
  created_at: string
  upwork_proposals?: UpworkProposal[]
  upwork_messages?: UpworkMessage[]
}

export type UpworkProposal = {
  id: string
  job_id: string
  cover_letter: string
  loom_script: string
  loom_url: string | null
  sent_at: string | null
  created_at: string
}

export type UpworkMessage = {
  id: string
  job_id: string
  direction: 'inbound' | 'outbound'
  body: string
  ai_generated: boolean
  status: 'draft' | 'approved' | 'sent' | 'received'
  created_at: string
}
export type PipelineStage = 'new' | 'contacted' | 'positive_reply' | 'booked' | 'showed' | 'proposal' | 'won' | 'lost'

export type PipelineDeal = {
  id: string
  prospect_name: string
  company: string | null
  contact_email: string | null
  source_channel: SourceChannel
  stage: PipelineStage
  mrr_value: number
  setup_value: number
  probability: number
  currency: string
  expected_close: string | null
  owner_profile_id: string | null
  owner: { id: string; name: string } | null
  next_action: string | null
  next_action_due: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ChannelFunnel = {
  sourced: number
  contacted: number
  positive_reply: number
  booked: number
  showed: number
  won: number
}

export type ChannelROI = {
  channel: string
  booked: number
  won: number
  new_mrr: number
}

export type AcquisitionKPIs = {
  new_prospects: number
  booked_calls: number
  show_rate: number
  close_rate: number
  new_mrr: number
}

// Gov Contracts types

export type GovTenderStatus =
  | 'found' | 'off_scope' | 'no_bid' | 'no_contact_email'
  | 'pushed_to_instantly' | 'replied' | 'meeting' | 'bid_drafted'
  | 'submitted' | 'won' | 'lost'

export type GovTender = {
  notice_id: string
  title: string | null
  authority: string | null
  buyer_name: string | null
  buyer_email: string | null
  incumbent: string | null
  award_value_gbp: number | null
  contract_start: string | null
  contract_end: string | null
  cpv: string | null
  notice_url: string | null
  status: GovTenderStatus
  campaign_id: string | null
  date_added: string | null
  last_update: string | null
  notes: string | null
  bid_document_path: string | null
}

export type GovInstantlyDaily = {
  date: string
  emails_sent_total: number
  opens_total: number
  replies_total: number
  clicks_total: number
  bounced_total: number
  opportunities_total: number
}

export type GovDashboard = {
  by_status: Record<string, number>
  outreach_count: number
  bids_count: number
  win_rate: number
  instantly: GovInstantlyDaily | null
  instantly_series: GovInstantlyDaily[]
  updated_at: string | null
}

export type AcquisitionRollup = {
  window: string
  window_start: string
  generated_at: string
  currency: string
  currency_note: string
  channels: {
    cold_call: ChannelFunnel
    cold_email: ChannelFunnel
    linkedin: ChannelFunnel
    gov: ChannelFunnel & { note: string }
  }
  blended: ChannelFunnel
  kpis: AcquisitionKPIs
  roi: ChannelROI[]
}

// Sales Calls types

export type SalesCallType = 'discovery' | 'pitch' | 'followup' | 'onboarding'
export type SalesCallStatus = 'scheduled' | 'held' | 'analyzed' | 'no_show' | 'cancelled'
export type SalesCallOutcome = 'advanced' | 'stalled' | 'won' | 'lost' | 'rebook'
export type SalesCallTranscriptSource = 'manual' | 'drive'

export type SalesCallAnalysisDimension = {
  key: string
  score: number
  note: string
}

export type SalesCallAnalysisObjection = {
  objection: string
  handled_well: boolean
  note: string
}

export type SalesCallAnalysis = {
  call_type: SalesCallType
  overall_score: number
  dimensions: SalesCallAnalysisDimension[]
  strengths: string[]
  improvements: string[]
  objections: SalesCallAnalysisObjection[]
  outcome_read: 'advanced' | 'stalled' | 'at_risk' | 'likely_close'
  summary: string
  sop_gaps: string[]
}

// ─── Onboarding types ──────────────────────────────────────────────────────

export type OnboardingStatus =
  | 'won' | 'contract_sent' | 'signed' | 'form_completed' | 'kickoff_booked'
  | 'kickoff_held' | 'building' | 'launched' | 'handed_off'

export type OnboardingHealth = 'green' | 'amber' | 'red'

export type Onboarding = {
  id: string
  deal_id: string | null
  client_id: string | null
  company_name: string
  contact_name: string | null
  contact_email: string
  service: string
  deliverables: string | null
  fee_amount: number
  currency: string
  status: OnboardingStatus
  portal_token: string
  stripe_customer_id: string | null
  stripe_invoice_id: string | null
  stripe_invoice_url: string | null
  esign_document_id: string | null
  contract_sent_at: string | null
  contract_signed_at: string | null
  invoice_sent_at: string | null
  invoice_paid_at: string | null
  portal_opened_at: string | null
  form_completed_at: string | null
  kickoff_at: string | null
  launched_at: string | null
  handed_off_at: string | null
  paid: boolean
  health: OnboardingHealth
  internal_brief: string | null
  notes: string | null
  created_at: string
  updated_at: string
  pipeline_deals?: Pick<PipelineDeal, 'id' | 'prospect_name'> | null
  clients?: Pick<Client, 'id' | 'name'> | null
}

export type OnboardingForm = {
  id: string
  onboarding_id: string
  business_overview: string | null
  target_audience: string | null
  brand_guidelines_url: string | null
  asset_links: string | null
  access_notes: string | null
  goals: string | null
  primary_contact: string | null
  billing_contact: string | null
  timezone: string | null
  extra: Record<string, unknown>
  submitted_at: string
}

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  won:             'Won',
  contract_sent:   'Contract Sent',
  signed:          'Signed',
  form_completed:  'Form Completed',
  kickoff_booked:  'Kickoff Booked',
  kickoff_held:    'Kickoff Held',
  building:        'Building',
  launched:        'Launched',
  handed_off:      'Handed Off',
}

export const ONBOARDING_STATUS_ORDER: OnboardingStatus[] = [
  'won', 'contract_sent', 'signed', 'form_completed', 'kickoff_booked',
  'kickoff_held', 'building', 'launched', 'handed_off',
]

export type SalesCall = {
  id: string
  deal_id: string
  call_type: SalesCallType
  sequence: number
  status: SalesCallStatus
  scheduled_at: string | null
  held_at: string | null
  duration_minutes: number | null
  owner_profile_id: string | null
  recording_url: string | null
  deck_url: string | null
  transcript: string | null
  transcript_source: SalesCallTranscriptSource
  drive_file_id: string | null
  analysis: SalesCallAnalysis | null
  outcome: SalesCallOutcome | null
  next_step: string | null
  next_step_due: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // joined
  pipeline_deals?: PipelineDeal | null
  owner?: Pick<Profile, 'id' | 'name'> | null
}

// ─── OS Updates (team changelog) ───────────────────────────────────────────────
export type OsUpdateTag = 'New' | 'Fix' | 'Building' | 'Improved' | 'Digest'

export type OsUpdate = {
  id: string
  title: string
  description: string | null
  tag: OsUpdateTag | null
  created_at: string
}
