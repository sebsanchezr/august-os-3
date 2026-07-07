-- Task Manager migration
-- August OS v3: profiles, clients, tasks, comments, events
-- Two tracks: creative (brief -> editing -> revision -> ready_to_upload -> uploaded -> live)
--             ops (backlog -> this_week -> in_progress -> blocked -> review -> done)

-- profiles: maps auth users to display identity and notification channels
CREATE TABLE IF NOT EXISTS profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'admin',
  -- role options: owner | media_buyer | editor | account_manager | admin
  discord_user_id   TEXT,
  whatsapp_number   TEXT,
  active            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- clients: lightweight client registry (base for Account Management build)
CREATE TABLE IF NOT EXISTS clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active',
  -- status options: active | paused | churned
  services    TEXT[] NOT NULL DEFAULT '{}',
  -- service options: paid_ads | creatives
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- tasks: single table for all task types across both tracks
CREATE TABLE IF NOT EXISTS tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  track           TEXT NOT NULL DEFAULT 'ops',
  -- track options: creative | ops
  department      TEXT NOT NULL DEFAULT 'admin',
  -- creative track: creative
  -- ops track: paid_ads | client | company | admin | ceo
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  assignee_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'backlog',
  -- creative statuses: brief | editing | revision | ready_to_upload | uploaded | live
  -- ops statuses:      backlog | this_week | in_progress | blocked | review | done
  priority        TEXT NOT NULL DEFAULT 'normal',
  -- priority options: urgent | high | normal | low
  due_date        DATE,
  blocked_reason  TEXT,
  source          TEXT NOT NULL DEFAULT 'manual',
  -- source options: manual | meeting | agent | recurring
  meeting_ref     TEXT,
  -- Drive file id of the source transcript
  recurrence      TEXT,
  -- recurrence options: null | daily | weekly | monthly
  tags            TEXT[] NOT NULL DEFAULT '{}',
  position        INT NOT NULL DEFAULT 0,
  completed_at    TIMESTAMPTZ,
  archived_at     TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  -- soft delete: no hard DELETE statements anywhere in the app
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- task_comments: comments on tasks with author attribution
CREATE TABLE IF NOT EXISTS task_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- task_events: immutable audit log, mirrors ce_events pattern
-- every mutation in the API writes an event row
CREATE TABLE IF NOT EXISTS task_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type        TEXT NOT NULL,
  -- type options: created | status_change | assigned | commented | edited | archived | restored | deleted
  payload     JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- meeting_transcripts: tracks processed Google Drive transcript files for the meeting agent
CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id         TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  meeting_date    DATE,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tasks_extracted INT NOT NULL DEFAULT 0
);

-- Row Level Security
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_transcripts ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users have full access (service role bypasses RLS)
CREATE POLICY "auth_all_profiles"            ON profiles            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_clients"             ON clients             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_tasks"               ON tasks               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_task_comments"       ON task_comments       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_task_events"         ON task_events         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_meeting_transcripts" ON meeting_transcripts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes for common query patterns
CREATE INDEX idx_tasks_track        ON tasks(track);
CREATE INDEX idx_tasks_status       ON tasks(status);
CREATE INDEX idx_tasks_assignee     ON tasks(assignee_id);
CREATE INDEX idx_tasks_client       ON tasks(client_id);
CREATE INDEX idx_tasks_department   ON tasks(department);
CREATE INDEX idx_tasks_due_date     ON tasks(due_date);
CREATE INDEX idx_tasks_deleted      ON tasks(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_archived     ON tasks(archived_at) WHERE archived_at IS NULL;
CREATE INDEX idx_task_comments_task ON task_comments(task_id);
CREATE INDEX idx_task_events_task   ON task_events(task_id);
CREATE INDEX idx_task_events_time   ON task_events(occurred_at DESC);

-- Seed: team profiles
-- Note: these require the auth.users rows to exist first.
-- Run this seed AFTER creating the four user accounts via Supabase Auth dashboard
-- or via the seed script in lead_pipeline/scripts/seed_team_profiles.py.
-- Template (fill in actual UUIDs from auth.users after account creation):
--
-- INSERT INTO profiles (id, name, role) VALUES
--   ('<sebastian-uuid>', 'Sebastian', 'owner'),
--   ('<taij-uuid>',      'Taij',      'media_buyer'),
--   ('<alvin-uuid>',     'Alvin',     'editor'),
--   ('<juan-uuid>',      'Juan',      'account_manager')
-- ON CONFLICT (id) DO NOTHING;

-- Seed: clients
INSERT INTO clients (name, status, services) VALUES
  ('L''alingi',          'active', ARRAY['paid_ads', 'creatives']),
  ('Liquidation Store',  'active', ARRAY['paid_ads', 'creatives']),
  ('Coffuel',            'active', ARRAY['paid_ads', 'creatives']),
  ('Lilly''s Amsterdam', 'active', ARRAY['paid_ads', 'creatives']),
  ('Amour et Bijoux',    'active', ARRAY['paid_ads', 'creatives']),
  ('Disanti Studio',     'active', ARRAY['paid_ads', 'creatives'])
ON CONFLICT DO NOTHING;
