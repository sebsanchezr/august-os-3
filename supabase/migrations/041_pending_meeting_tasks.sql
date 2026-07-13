-- Real human approval gate for meeting-extracted action items.
-- Replaces the old "auto-approve after N hours unless you delete a local
-- JSON file" mechanism in agents/06_meeting_tasks/meeting_agent.py with an
-- explicit pending/approved/rejected row Seb reviews in the OS
-- (/accounts/approvals) before anything lands in the real `tasks` table.

CREATE TABLE IF NOT EXISTS pending_meeting_tasks (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id               UUID REFERENCES client_meetings(id) ON DELETE SET NULL,
  meeting_title            TEXT,
  source_file_id           TEXT,
  -- Drive doc id the task came from (Drive poll) or the doc id extracted
  -- from a "meeting notes" email link (Gmail poll). Null for manual backfills.
  title                    TEXT NOT NULL,
  description              TEXT NOT NULL DEFAULT '',
  suggested_assignee_role  TEXT,
  suggested_department     TEXT,
  suggested_client_name    TEXT,
  due_hint                 TEXT,
  quote                    TEXT,
  status                   TEXT NOT NULL DEFAULT 'pending',
  -- pending | approved | rejected
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_meeting_tasks_status ON pending_meeting_tasks(status);

ALTER TABLE pending_meeting_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_pending_meeting_tasks" ON pending_meeting_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
