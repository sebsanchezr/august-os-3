-- Cold Email tables migration
-- Part of August OS v3: cold email pipeline, events, bookings, metrics

-- ce_leads: one row per prospect email
CREATE TABLE IF NOT EXISTS ce_leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  first_name    TEXT,
  last_name     TEXT,
  company       TEXT,
  website       TEXT,
  niche         TEXT,
  source        TEXT,
  campaign      TEXT,
  quality_score INT,
  status        TEXT NOT NULL DEFAULT 'new',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ce_pipeline: one active stage row per lead
CREATE TABLE IF NOT EXISTS ce_pipeline (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID REFERENCES ce_leads(id) ON DELETE CASCADE,
  stage           TEXT NOT NULL DEFAULT 'new_reply',
  stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  value           NUMERIC,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ce_events: immutable audit log for all lead activity
CREATE TABLE IF NOT EXISTS ce_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID REFERENCES ce_leads(id) ON DELETE SET NULL,
  type        TEXT NOT NULL,
  payload     JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ce_bookings: cal.com booking records
CREATE TABLE IF NOT EXISTS ce_bookings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    UUID REFERENCES ce_leads(id) ON DELETE SET NULL,
  cal_uid    TEXT UNIQUE,
  name       TEXT,
  email      TEXT,
  phone      TEXT,
  start_time TIMESTAMPTZ,
  end_time   TIMESTAMPTZ,
  status     TEXT NOT NULL DEFAULT 'confirmed',
  raw        JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ce_metrics_daily: daily campaign roll-up from Instantly
CREATE TABLE IF NOT EXISTS ce_metrics_daily (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date      DATE NOT NULL,
  campaign  TEXT NOT NULL,
  sent      INT NOT NULL DEFAULT 0,
  replies   INT NOT NULL DEFAULT 0,
  positives INT NOT NULL DEFAULT 0,
  bounces   INT NOT NULL DEFAULT 0,
  booked    INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date, campaign)
);

-- ce_website_forms: form submissions from purescale / apply pages
CREATE TABLE IF NOT EXISTS ce_website_forms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business   TEXT,
  revenue    TEXT,
  spend      TEXT,
  timeline   TEXT,
  first_name TEXT,
  last_name  TEXT,
  email      TEXT,
  phone      TEXT,
  source     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security: same pattern as existing tables
ALTER TABLE ce_leads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_pipeline       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_metrics_daily  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_website_forms  ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users have full access (service role bypasses RLS)
CREATE POLICY "auth_all_ce_leads"         ON ce_leads         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_ce_pipeline"      ON ce_pipeline      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_ce_events"        ON ce_events        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_ce_bookings"      ON ce_bookings      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_ce_metrics_daily" ON ce_metrics_daily FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_ce_website_forms" ON ce_website_forms FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes for common query patterns
CREATE INDEX idx_ce_leads_email      ON ce_leads(email);
CREATE INDEX idx_ce_leads_status     ON ce_leads(status);
CREATE INDEX idx_ce_leads_campaign   ON ce_leads(campaign);
CREATE INDEX idx_ce_pipeline_lead    ON ce_pipeline(lead_id);
CREATE INDEX idx_ce_pipeline_stage   ON ce_pipeline(stage);
CREATE INDEX idx_ce_events_lead      ON ce_events(lead_id);
CREATE INDEX idx_ce_events_occurred  ON ce_events(occurred_at DESC);
CREATE INDEX idx_ce_events_type      ON ce_events(type);
CREATE INDEX idx_ce_bookings_lead    ON ce_bookings(lead_id);
CREATE INDEX idx_ce_metrics_date     ON ce_metrics_daily(date DESC);
