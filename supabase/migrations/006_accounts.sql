-- Account Management migration
-- August OS v3: extends clients, adds client_metrics_daily, client_reports,
-- client_meetings, client_comms_log, client_issues, client_talking_points

-- ─── Extend clients table ──────────────────────────────────────────────────

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS contact_name        TEXT,
  ADD COLUMN IF NOT EXISTS contact_email       TEXT,
  ADD COLUMN IF NOT EXISTS wa_group_name       TEXT,
  -- human label of the client WA group, for AM reference only
  ADD COLUMN IF NOT EXISTS mrr                 NUMERIC,
  ADD COLUMN IF NOT EXISTS currency            TEXT DEFAULT 'GBP',
  ADD COLUMN IF NOT EXISTS start_date          DATE,
  ADD COLUMN IF NOT EXISTS renewal_date        DATE,
  ADD COLUMN IF NOT EXISTS am_profile_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- account manager owning this client
  ADD COLUMN IF NOT EXISTS meta_ad_account_id  TEXT,
  -- act_xxxx format, consumed by the Mac reporter
  ADD COLUMN IF NOT EXISTS trendtrak_ids       TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_roas         NUMERIC,
  ADD COLUMN IF NOT EXISTS target_cpa          NUMERIC,
  ADD COLUMN IF NOT EXISTS monthly_budget      NUMERIC,
  ADD COLUMN IF NOT EXISTS call_day            SMALLINT,
  -- 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri, weekly call day
  ADD COLUMN IF NOT EXISTS call_time           TIME,
  ADD COLUMN IF NOT EXISTS health              TEXT NOT NULL DEFAULT 'green',
  -- green | amber | red  (recomputed nightly by health cron)
  ADD COLUMN IF NOT EXISTS last_client_contact TIMESTAMPTZ,
  -- last inbound or outbound comm logged; drives contact-recency health score
  ADD COLUMN IF NOT EXISTS notes               TEXT;

-- ─── Daily per-client performance snapshot ─────────────────────────────────

CREATE TABLE IF NOT EXISTS client_metrics_daily (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  spend            NUMERIC,
  revenue          NUMERIC,
  roas             NUMERIC,
  purchases        INT,
  cpa              NUMERIC,
  impressions      BIGINT,
  clicks           INT,
  ctr              NUMERIC,
  top_creatives    JSONB,
  -- [{ad_id, name, spend, roas, thumbnail_url}]
  competitor_notes JSONB,
  -- TrendTrak highlights for that day
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, date)
);

-- ─── Client report drafts (every generated artifact) ───────────────────────

CREATE TABLE IF NOT EXISTS client_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type             TEXT NOT NULL,
  -- weekly_eow | monday_kickoff | meeting_prep | meeting_followup | monthly_deep_dive
  period_start     DATE,
  period_end       DATE,
  metrics          JSONB,
  -- frozen numbers used when drafting (never re-fetched after insert)
  draft_md         TEXT,
  -- internal brief shown to Seb: MTD pacing, TrendTrak, flags, hedges
  client_message   TEXT,
  -- exact WA-ready text to forward to the client
  status           TEXT NOT NULL DEFAULT 'pending_approval',
  -- pending_approval | approved | sent | rejected
  rejection_note   TEXT,
  approved_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at      TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Weekly / monthly meeting schedule ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_meetings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type                TEXT NOT NULL DEFAULT 'weekly',
  -- weekly | monthly | adhoc
  scheduled_at        TIMESTAMPTZ NOT NULL,
  agenda              TEXT,
  prep_report_id      UUID REFERENCES client_reports(id) ON DELETE SET NULL,
  transcript_id       UUID REFERENCES meeting_transcripts(id) ON DELETE SET NULL,
  followup_report_id  UUID REFERENCES client_reports(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'scheduled',
  -- scheduled | done | cancelled
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Comms log (powers health score + early-warning detection) ──────────────

CREATE TABLE IF NOT EXISTS client_comms_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  direction   TEXT NOT NULL,
  -- inbound | outbound
  channel     TEXT NOT NULL DEFAULT 'whatsapp',
  -- whatsapp | email | call | meeting
  summary     TEXT NOT NULL,
  sentiment   TEXT DEFAULT 'neutral',
  -- positive | neutral | concern
  flags       TEXT[] DEFAULT '{}',
  -- trigger words: confused, disappointed, frustrating, cost_question, ...
  logged_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Issue tracker (Genflow resolution SOP) ────────────────────────────────

CREATE TABLE IF NOT EXISTS client_issues (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  category         TEXT NOT NULL,
  -- financial_reporting | performance | execution_quality | communication |
  -- process | client_side | value_for_money | personality_clash
  severity         TEXT NOT NULL DEFAULT 'minor',
  -- minor | major | trust_threatening
  description      TEXT NOT NULL,
  root_cause       TEXT,
  resolution       TEXT,
  process_fix      TEXT,
  -- required before status can be set to resolved
  owner_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'open',
  -- open | resolving | resolved
  raised_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ
);

-- ─── Talking points (team drops these during the week, consumed by Friday) ──

CREATE TABLE IF NOT EXISTS client_talking_points (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  point              TEXT NOT NULL,
  added_by           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  consumed_by_report UUID REFERENCES client_reports(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE client_metrics_daily   ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_meetings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_comms_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_issues          ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_talking_points  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_client_metrics_daily"   ON client_metrics_daily   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_client_reports"         ON client_reports         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_client_meetings"        ON client_meetings        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_client_comms_log"       ON client_comms_log       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_client_issues"          ON client_issues          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_client_talking_points"  ON client_talking_points  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_client_metrics_client_date ON client_metrics_daily(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_client_reports_client      ON client_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_client_reports_status      ON client_reports(status);
CREATE INDEX IF NOT EXISTS idx_client_reports_type        ON client_reports(type);
CREATE INDEX IF NOT EXISTS idx_client_meetings_client     ON client_meetings(client_id);
CREATE INDEX IF NOT EXISTS idx_client_meetings_scheduled  ON client_meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_client_meetings_status     ON client_meetings(status);
CREATE INDEX IF NOT EXISTS idx_client_comms_client        ON client_comms_log(client_id);
CREATE INDEX IF NOT EXISTS idx_client_comms_occurred      ON client_comms_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_issues_client       ON client_issues(client_id);
CREATE INDEX IF NOT EXISTS idx_client_issues_status       ON client_issues(status);
CREATE INDEX IF NOT EXISTS idx_client_talking_points_client ON client_talking_points(client_id);
CREATE INDEX IF NOT EXISTS idx_client_talking_points_consumed ON client_talking_points(consumed_by_report) WHERE consumed_by_report IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_health             ON clients(health);
CREATE INDEX IF NOT EXISTS idx_clients_am                 ON clients(am_profile_id);
