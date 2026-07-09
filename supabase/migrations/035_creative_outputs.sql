-- Creative outputs migration
-- Stores every generated static image produced by the ad creative engine.
-- Two production paths write here:
--   1. Weekly strategy generation: an approved creative_strategies row is parsed
--      into 3 concepts and each concept produces an image (strategy_id set).
--   2. Quick Generate (ad hoc): a media buyer types a freeform brief and picks a
--      quantity. No weekly strategy row is created, so strategy_id is NULL and
--      only client_id ties the output to a client.
--
-- Images are generated via the Gemini image API (nano banana) with an OpenAI
-- gpt-image-1 fallback, uploaded to the public 'creative-outputs' storage
-- bucket, and the public URL is stamped here.

CREATE TABLE IF NOT EXISTS creative_strategy_outputs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id    UUID REFERENCES creative_strategies(id) ON DELETE CASCADE,
  client_id      UUID REFERENCES clients(id) ON DELETE CASCADE,
  concept_index  INT,
  concept_title  TEXT,
  prompt_used    TEXT,
  image_url      TEXT,
  storage_path   TEXT,
  status         TEXT DEFAULT 'generated',
  error          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creative_outputs_strategy ON creative_strategy_outputs(strategy_id);
CREATE INDEX IF NOT EXISTS idx_creative_outputs_client   ON creative_strategy_outputs(client_id);

ALTER TABLE creative_strategy_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_creative_strategy_outputs"
  ON creative_strategy_outputs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Storage bucket for generated statics ──────────────────────────────────
-- Public bucket: these are ad creatives the team opens in the browser and
-- hands to the media buyer, so public URLs are fine (no client PII in an image).
INSERT INTO storage.buckets (id, name, public)
VALUES ('creative-outputs', 'creative-outputs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_read_creative_outputs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'creative-outputs');

CREATE POLICY "auth_write_creative_outputs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'creative-outputs');

CREATE POLICY "auth_update_creative_outputs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'creative-outputs')
  WITH CHECK (bucket_id = 'creative-outputs');
