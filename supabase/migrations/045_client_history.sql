-- 045: client_history — daily relay log per client, merged into the account timeline.
-- Schema only. Client data seeding is applied directly to the DB, never committed to the repo.

CREATE TABLE IF NOT EXISTS client_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  category    TEXT NOT NULL DEFAULT 'update'
              CHECK (category IN ('update','milestone','payment','status_change','issue','note')),
  title       TEXT NOT NULL,
  detail      TEXT,
  created_by  TEXT NOT NULL DEFAULT 'Seb',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_history_client_time
  ON client_history (client_id, occurred_at DESC);

ALTER TABLE client_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS client_history_all ON client_history;
CREATE POLICY client_history_all ON client_history FOR ALL USING (true) WITH CHECK (true);
