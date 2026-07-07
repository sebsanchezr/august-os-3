-- Upwork acquisition channel: job discovery, AI-drafted proposals, message thread.

CREATE TABLE IF NOT EXISTS upwork_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upwork_job_id     TEXT UNIQUE NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  budget            NUMERIC,
  budget_type       TEXT,
  proposals_count   INT,
  client_country    TEXT,
  client_size       TEXT,
  payment_verified  BOOLEAN,
  contractor_tier   TEXT,
  job_url           TEXT NOT NULL,
  raw               JSONB NOT NULL DEFAULT '{}',
  fit_score         INT,
  fit_rationale     TEXT,
  status            TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','surfaced','applied','replied','call_booked','won','passed')),
  discord_message_id TEXT,
  surfaced_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upwork_jobs_status ON upwork_jobs(status);

CREATE TABLE IF NOT EXISTS upwork_proposals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID NOT NULL REFERENCES upwork_jobs(id) ON DELETE CASCADE,
  cover_letter  TEXT NOT NULL,
  loom_script   TEXT NOT NULL,
  loom_url      TEXT,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upwork_proposals_job_id ON upwork_proposals(job_id);

CREATE TABLE IF NOT EXISTS upwork_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID NOT NULL REFERENCES upwork_jobs(id) ON DELETE CASCADE,
  direction     TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  body          TEXT NOT NULL,
  ai_generated  BOOLEAN NOT NULL DEFAULT false,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','sent','received')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upwork_messages_job_id ON upwork_messages(job_id);

ALTER TABLE upwork_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE upwork_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE upwork_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_upwork_jobs" ON upwork_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_upwork_proposals" ON upwork_proposals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_upwork_messages" ON upwork_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add upwork as a pipeline source channel
ALTER TABLE pipeline_deals DROP CONSTRAINT IF EXISTS pipeline_deals_source_channel_check;
ALTER TABLE pipeline_deals ADD CONSTRAINT pipeline_deals_source_channel_check
  CHECK (source_channel IN ('cold_call','cold_email','linkedin','gov','upwork','referral','expansion','other'));
