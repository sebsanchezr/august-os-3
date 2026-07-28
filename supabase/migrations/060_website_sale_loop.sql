-- Website cold-call sale loop.
-- Extends website_builds with richer request intake + the sale/hookup lifecycle,
-- adds a per-build hookup checklist, and a newsletter list clients land on after
-- they buy a site. Schema only, no client data (repo is public).

-- ─── Richer request intake + sale lifecycle on website_builds ────────────────

ALTER TABLE website_builds
  ADD COLUMN IF NOT EXISTS owner_name            TEXT,
  ADD COLUMN IF NOT EXISTS email                 TEXT,
  ADD COLUMN IF NOT EXISTS service_area          TEXT,
  ADD COLUMN IF NOT EXISTS services              TEXT[],
  ADD COLUMN IF NOT EXISTS existing_site_url     TEXT,
  ADD COLUMN IF NOT EXISTS logo_url              TEXT,
  -- Discord id of the caller who requested it, so the "site built" post can @tag them.
  ADD COLUMN IF NOT EXISTS requested_by_discord  TEXT,
  -- Sale fields, filled when the caller closes and payment clears.
  ADD COLUMN IF NOT EXISTS sale_tier             TEXT,   -- site_1500 | site_2000
  ADD COLUMN IF NOT EXISTS sale_amount           NUMERIC,
  ADD COLUMN IF NOT EXISTS hosting_monthly       BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS stripe_session_id     TEXT,
  ADD COLUMN IF NOT EXISTS paid_at               TIMESTAMPTZ,
  -- Post-sale hookup + newsletter enrolment.
  ADD COLUMN IF NOT EXISTS hookup_status         TEXT DEFAULT 'not_started',
  -- not_started | in_progress | live
  ADD COLUMN IF NOT EXISTS newsletter_enrolled   BOOLEAN DEFAULT FALSE;

-- 'paid' and 'live' extend the existing status flow beyond 'sent'. Postgres CHECK
-- constraints can't be altered in place, so drop and re-add with the full set.
ALTER TABLE website_builds DROP CONSTRAINT IF EXISTS website_builds_status_check;
ALTER TABLE website_builds ADD CONSTRAINT website_builds_status_check CHECK (status IN (
  'requested', 'approved', 'building', 'built', 'site_approved', 'sent',
  'paid', 'live', 'rejected'
));

-- ─── Per-build hookup checklist ─────────────────────────────────────────────
-- Seeded on payment (see app/api/webhooks/stripe/route.ts). Fulfilment works
-- these to take the paid site from preview to the client's real domain.

CREATE TABLE IF NOT EXISTS website_hookup_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id    UUID REFERENCES website_builds(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  done        BOOLEAN NOT NULL DEFAULT FALSE,
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE website_hookup_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_website_hookup_tasks" ON website_hookup_tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_website_hookup_tasks_build ON website_hookup_tasks(build_id);

-- ─── Newsletter list ────────────────────────────────────────────────────────
-- Local businesses that bought a site land here. What we send them is decided
-- later; this is just the growing list + enrolment source.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name     TEXT NOT NULL,
  email             TEXT,
  city              TEXT,
  source            TEXT NOT NULL DEFAULT 'site_purchase',
  website_build_id  UUID REFERENCES website_builds(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'active',  -- active | unsubscribed
  added_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_newsletter_subscribers" ON newsletter_subscribers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_email
  ON newsletter_subscribers(lower(email)) WHERE email IS NOT NULL;
