-- Leads captured by the quote form on a generated demo site. Each demo is a
-- separate throwaway Vercel project, so its form posts cross-origin back to
-- the OS (see app/api/website-leads/route.ts, CORS-open, no auth).

CREATE TABLE IF NOT EXISTS website_leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id    UUID REFERENCES website_builds(id) ON DELETE SET NULL,
  name        TEXT,
  phone       TEXT,
  postcode    TEXT,
  job_type    TEXT,
  message     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE website_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_website_leads" ON website_leads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_website_leads_build ON website_leads(build_id);

-- v2 build engine: persist the real research (Apify phone/address/photos/
-- rating/reviews) alongside site_design, so an amend reuses it instead of
-- re-scraping, and so the row itself has the real contact details for the
-- caller even before the site link is opened.
ALTER TABLE website_builds
  ADD COLUMN IF NOT EXISTS research_data JSONB;
