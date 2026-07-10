-- Creative generation (Generate Statics) migration
-- Backs the "Generate Statics" button on the Creative Hub. Each button press
-- creates ONE creative_generations row that captures the request (brief, angle,
-- count) and, once the nano banana image API (Gemini gemini-2.5-flash-image)
-- has run, the batch outcome (status + results jsonb of public image URLs).
--
-- This is a batch-level record. Per-image rows also land in
-- creative_strategy_outputs (migration 035) so generated statics flow straight
-- into the existing creatives pipeline grid.

CREATE TABLE IF NOT EXISTS creative_generations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID REFERENCES clients(id) ON DELETE CASCADE,
  requested_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  brief         TEXT,
  angle         TEXT,
  count         SMALLINT DEFAULT 4,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'done', 'failed')),
  error         TEXT,
  results       JSONB DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creative_generations_client ON creative_generations(client_id);

ALTER TABLE creative_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_creative_generations"
  ON creative_generations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Public storage bucket for generated statics ───────────────────────────
-- The route also creates this bucket if missing via the storage API, so this
-- is belt and braces for environments where the migration runs first.
INSERT INTO storage.buckets (id, name, public)
VALUES ('creatives', 'creatives', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_read_creatives"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'creatives');

CREATE POLICY "auth_write_creatives"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'creatives');

CREATE POLICY "auth_update_creatives"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'creatives')
  WITH CHECK (bucket_id = 'creatives');
