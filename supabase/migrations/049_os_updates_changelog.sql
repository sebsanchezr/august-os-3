-- Changelog cron support
-- August OS v3: lets the daily changelog cron (app/api/cron/changelog) turn new
-- GitHub commits into os_updates rows without ever double-logging a commit, and
-- gives it a durable cursor so each run only looks at commits since last time.

-- ─── os_updates.commit_sha ──────────────────────────────────────────────────

ALTER TABLE os_updates ADD COLUMN IF NOT EXISTS commit_sha TEXT;

-- Partial unique index: only enforced when a row is commit-sourced, so manual
-- logUpdate() calls without a sha are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_os_updates_commit_sha
  ON os_updates(commit_sha) WHERE commit_sha IS NOT NULL;

-- ─── system_state ────────────────────────────────────────────────────────────
-- Tiny generic key/value cursor table for cron jobs. First consumer is
-- changelog_last_commit_at (see lib/changelog-server.ts).

CREATE TABLE IF NOT EXISTS system_state (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE system_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_system_state" ON system_state FOR ALL TO authenticated USING (true) WITH CHECK (true);
