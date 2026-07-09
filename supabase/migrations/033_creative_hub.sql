-- Creative Hub migration
-- One place for all creative info per client (Drive links, briefs, inspiration)
-- plus the weekly AI creative strategy flow: form -> AI draft -> owner approval
-- -> static generation (nano banana image API, gated behind GEMINI_API_KEY).

-- ─── Creative library: links and files per client ──────────────────────────

CREATE TABLE IF NOT EXISTS client_creative_assets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID REFERENCES clients(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  kind        TEXT CHECK (kind IN ('drive', 'figma', 'brief', 'asset', 'inspiration', 'other')) DEFAULT 'drive',
  url         TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Weekly creative strategy per client ───────────────────────────────────

CREATE TABLE IF NOT EXISTS creative_strategies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID REFERENCES clients(id) ON DELETE CASCADE,
  week_start    DATE NOT NULL,
  focus         TEXT,
  strategy_md   TEXT,
  status        TEXT CHECK (status IN ('draft', 'approved', 'generating', 'delivered')) DEFAULT 'draft',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  approved_at   TIMESTAMPTZ,
  UNIQUE (client_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_creative_assets_client   ON client_creative_assets(client_id);
CREATE INDEX IF NOT EXISTS idx_creative_strategies_client_week ON creative_strategies(client_id, week_start);

ALTER TABLE client_creative_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_strategies    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_client_creative_assets" ON client_creative_assets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_creative_strategies"    ON creative_strategies    FOR ALL TO authenticated USING (true) WITH CHECK (true);
