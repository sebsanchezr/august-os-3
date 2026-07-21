-- Team & Staff Onboarding
-- August OS v3: adds team_members, staff_onboardings, staff_onboarding_tasks.
-- No personal data is seeded here (repo is public) — team_members rows are
-- created through the app UI, staff_onboarding_tasks are seeded from the
-- DEFAULT_ONBOARDING_TASKS constant in lib/team-server.ts at onboarding-create time.

-- ─── Team members ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS team_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  title            TEXT,
  role             TEXT NOT NULL DEFAULT 'cold_caller',
  -- cold_caller | sales_manager | other
  email            TEXT,
  phone            TEXT,
  whatsapp         TEXT,
  location         TEXT,
  avatar_url       TEXT,
  login_email      TEXT,
  -- email used for their August OS Supabase auth login (see lib/access.ts)
  discord_user_id  TEXT,
  status           TEXT NOT NULL DEFAULT 'onboarding',
  -- onboarding | active | paused | offboarded
  start_date       DATE,
  commission_notes TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Staff onboarding pipeline (kanban) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_onboardings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id    UUID REFERENCES team_members(id) ON DELETE SET NULL,
  candidate_name    TEXT,
  role              TEXT NOT NULL DEFAULT 'cold_caller',
  stage             TEXT NOT NULL DEFAULT 'applied',
  -- applied | contract_sent | details_collected | intro_booked | ramp_learning | day7_review | active
  intro_meeting_at  TIMESTAMPTZ,
  day7_review_at    TIMESTAMPTZ,
  contract_url      TEXT,
  welcome_sent      BOOLEAN NOT NULL DEFAULT FALSE,
  notes             TEXT,
  position          INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Onboarding checklist tasks (seeded from lib/team-server.ts) ───────────

CREATE TABLE IF NOT EXISTS staff_onboarding_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id UUID REFERENCES staff_onboardings(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'admin',
  -- admin | learning_os | learning_video | milestone
  url           TEXT,
  done          BOOLEAN NOT NULL DEFAULT FALSE,
  position      INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE team_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_onboardings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_onboarding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_team_members"          ON team_members          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_staff_onboardings"     ON staff_onboardings     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_staff_onboarding_tasks" ON staff_onboarding_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_team_members_status          ON team_members(status);
CREATE INDEX IF NOT EXISTS idx_staff_onboardings_team_member ON staff_onboardings(team_member_id);
CREATE INDEX IF NOT EXISTS idx_staff_onboardings_stage       ON staff_onboardings(stage);
CREATE INDEX IF NOT EXISTS idx_staff_onboarding_tasks_onboarding ON staff_onboarding_tasks(onboarding_id);
