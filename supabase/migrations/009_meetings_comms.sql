-- Meetings + Communications migration
-- August OS v3: extends client_meetings, client_comms_log, meeting_transcripts,
-- adds team_questions and comms_sla override on clients.

-- ─── Extend client_meetings ───────────────────────────────────────────────────

ALTER TABLE client_meetings
  ADD COLUMN IF NOT EXISTS duration_minutes  INT         DEFAULT 30,
  ADD COLUMN IF NOT EXISTS attendees         JSONB       DEFAULT '[]',
  -- array of email strings
  ADD COLUMN IF NOT EXISTS minutes_md        TEXT,
  -- internal minutes, Claude-drafted, human-edited before sending
  ADD COLUMN IF NOT EXISTS minutes_sent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prep_ready_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recurrence        TEXT,
  -- null | weekly | monthly; on status=done the API clones at next occurrence
  ADD COLUMN IF NOT EXISTS outcome_note      TEXT;
  -- one-liner: how did it go, feeds health

-- ─── Extend client_comms_log (SLA clock) ──────────────────────────────────────

ALTER TABLE client_comms_log
  ADD COLUMN IF NOT EXISTS requires_response BOOLEAN     DEFAULT FALSE,
  -- true for inbound messages that ask something
  ADD COLUMN IF NOT EXISTS response_due_at   TIMESTAMPTZ,
  -- computed on insert from channel SLA (WA 2h, email 24h)
  ADD COLUMN IF NOT EXISTS responded_at      TIMESTAMPTZ,
  -- set when the reply is logged, or via one-tap respond
  ADD COLUMN IF NOT EXISTS sla_breached      BOOLEAN     DEFAULT FALSE;
  -- set by sentinel cron; stays true even after late response for reporting

-- ─── Extend clients with per-client SLA overrides ────────────────────────────

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS comms_sla JSONB;
  -- e.g. {"whatsapp_hours": 4, "email_hours": 48}
  -- null = use global defaults (WA 2h, email 24h)

-- ─── Extend meeting_transcripts with meeting linkage ─────────────────────────

ALTER TABLE meeting_transcripts
  ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES client_meetings(id) ON DELETE SET NULL;
  -- set by agent when matching transcript to a scheduled meeting

-- ─── Team questions (Discord two-way loop) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS team_questions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question            TEXT        NOT NULL,
  context             TEXT        NOT NULL DEFAULT '',
  client_id           UUID        REFERENCES clients(id) ON DELETE SET NULL,
  meeting_id          UUID        REFERENCES client_meetings(id) ON DELETE SET NULL,
  task_id             UUID        REFERENCES tasks(id) ON DELETE SET NULL,
  asked_by            UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  target_profile_id   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  -- null = whole team
  discord_message_id  TEXT,
  -- the bot's posted message id for thread matching
  answer              TEXT,
  answered_by         UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  status              TEXT        NOT NULL DEFAULT 'open',
  -- open | answered | expired
  asked_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at         TIMESTAMPTZ
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE team_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_team_questions" ON team_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_client_comms_sla_due    ON client_comms_log(response_due_at) WHERE responded_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_comms_breached   ON client_comms_log(sla_breached) WHERE sla_breached = TRUE;
CREATE INDEX IF NOT EXISTS idx_team_questions_status   ON team_questions(status);
CREATE INDEX IF NOT EXISTS idx_team_questions_client   ON team_questions(client_id);
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_mid ON meeting_transcripts(meeting_id);
