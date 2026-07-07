-- Knowledge base for the internal report suggestion engine.
-- Populated by the Mac reporter: Nick Theriot transcripts + weekly research.
-- Claude reads recent entries as context when generating internal reports.

CREATE TABLE IF NOT EXISTS knowledge_base (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source       TEXT NOT NULL,
  -- nick_theriot | meta_blog | research | manual
  source_ref   TEXT,
  -- YouTube video ID, URL, article slug, etc.
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  -- full transcript or article text
  tags         TEXT[] DEFAULT '{}',
  -- e.g. ['broad_targeting', 'creative_testing', 'cbo', 'advantage_plus']
  published_at TIMESTAMPTZ,
  ingested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, source_ref)
);

ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_knowledge_base" ON knowledge_base FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_kb_source      ON knowledge_base(source);
CREATE INDEX IF NOT EXISTS idx_kb_ingested    ON knowledge_base(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_published   ON knowledge_base(published_at DESC);
