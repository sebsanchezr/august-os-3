-- Acquisition Command Center: cross-channel prospect pipeline
-- Note: this is a NEW table, separate from `deals` (which is website-business-specific
-- tier/setup/monthly/stripe). pipeline_deals tracks paid-media agency prospects
-- across all acquisition channels (cold call, cold email, LinkedIn, gov, referral, expansion).

CREATE TABLE IF NOT EXISTS pipeline_deals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_name     TEXT NOT NULL,
  company           TEXT,
  source_channel    TEXT NOT NULL
    CHECK (source_channel IN ('cold_call','cold_email','linkedin','gov','referral','expansion','other')),
  stage             TEXT NOT NULL DEFAULT 'new'
    CHECK (stage IN ('new','contacted','positive_reply','booked','showed','proposal','won','lost')),
  mrr_value         NUMERIC NOT NULL DEFAULT 0,
  setup_value       NUMERIC NOT NULL DEFAULT 0,
  probability       INT NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  currency          TEXT DEFAULT 'GBP',
  expected_close    DATE,
  owner_profile_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  next_action       TEXT,
  next_action_due   DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security: same pattern as existing tables
ALTER TABLE pipeline_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_pipeline_deals" ON pipeline_deals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at trigger (reuses the function defined in 001_initial.sql)
CREATE TRIGGER pipeline_deals_updated_at
  BEFORE UPDATE ON pipeline_deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_stage ON pipeline_deals(stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_source_channel ON pipeline_deals(source_channel);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_expected_close ON pipeline_deals(expected_close);
