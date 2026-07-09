-- Agency-level (house) Meta ad account performance, separate from
-- client_metrics_daily (which is per-client). Populated by the meta-sync
-- cron only when AGENCY_META_AD_ACCOUNT_ID is configured, and surfaced on
-- the Acquisition Command Center as the "Paid Ads" section.

CREATE TABLE IF NOT EXISTS agency_ads_daily (
  date         DATE PRIMARY KEY,
  spend        NUMERIC DEFAULT 0,
  impressions  BIGINT DEFAULT 0,
  clicks       BIGINT DEFAULT 0,
  ctr          NUMERIC,
  leads        INT DEFAULT 0,
  purchases    INT DEFAULT 0,
  revenue      NUMERIC DEFAULT 0,
  synced_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agency_ads_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_agency_ads_daily" ON agency_ads_daily FOR ALL TO authenticated USING (true) WITH CHECK (true);
