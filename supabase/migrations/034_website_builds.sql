-- Website build requests: cold callers request a pre-built site for a lead,
-- Seb approves the request, the site gets built externally (Mac-side engine,
-- phase 2), then Seb approves the finished site before it's sent back to the
-- caller for the sales call.
CREATE TABLE IF NOT EXISTS website_builds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  google_url    TEXT,
  phone         TEXT,
  city          TEXT,
  niche         TEXT DEFAULT 'roofing',
  notes         TEXT,
  status        TEXT NOT NULL CHECK (status IN (
                  'requested', 'approved', 'building', 'built', 'site_approved', 'sent', 'rejected'
                )) DEFAULT 'requested',
  site_url      TEXT,
  requested_by  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE website_builds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_website_builds" ON website_builds
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_website_builds_status ON website_builds(status);
CREATE INDEX idx_website_builds_created ON website_builds(created_at DESC);
