-- pending_changes: approval queue for the NON-task things the meeting agent
-- (agents/06_meeting_tasks/meeting_agent.py) extracts from a call transcript --
-- client issues, a health read, and a weekly-focus note. Tasks keep flowing
-- through pending_meeting_tasks (migration 041); this is its sibling for
-- everything that mutates the client profile.
--
-- The agent POSTs proposals to /api/pending-changes/inbound (X-Agent-Key), which
-- inserts them here as status='pending'. Seb reviews them on /accounts/approvals;
-- approving applies the payload into the live table (client_issues / clients).
-- Nothing touches the client profile until a human approves.

-- "What we're focused on for this client this week" -- set from an approved
-- weekly_focus proposal, shown on the client profile.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS weekly_focus TEXT;

CREATE TABLE IF NOT EXISTS pending_changes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID REFERENCES clients(id) ON DELETE CASCADE,
  meeting_id    UUID REFERENCES client_meetings(id) ON DELETE SET NULL,
  source        TEXT NOT NULL DEFAULT 'meeting',

  kind          TEXT NOT NULL,
  -- kind options: issue | health | weekly_focus

  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- issue:        { category, severity, description, root_cause }
  -- health:       { from, to, reason }
  -- weekly_focus: { text }

  summary       TEXT,           -- one-line label for the approval card
  quote         TEXT,           -- supporting quote from the transcript

  status        TEXT NOT NULL DEFAULT 'pending',
  -- status options: pending | approved | rejected

  applied_ref   UUID,           -- id of the row created on approval (issue)
  approved_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at   TIMESTAMPTZ,
  rejection_note TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_changes_status ON pending_changes(status);
CREATE INDEX IF NOT EXISTS idx_pending_changes_client ON pending_changes(client_id);

ALTER TABLE pending_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_pending_changes" ON pending_changes;
CREATE POLICY "auth_all_pending_changes" ON pending_changes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
