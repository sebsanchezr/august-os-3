-- ce_metrics_daily: add a stable Instantly campaign identifier
-- 004_cold_email.sql only stores "campaign" as a free-text label (used by the
-- Python engine for niche names like "hvac"/"medspas"). The Instantly sync
-- cron (app/api/cron/instantly-sync) needs a stable id per Instantly campaign
-- so renamed campaigns still upsert onto the same rows, and so new campaigns
-- flow in automatically without a hardcoded name mapping.

ALTER TABLE ce_metrics_daily ADD COLUMN IF NOT EXISTS campaign_id   TEXT;
ALTER TABLE ce_metrics_daily ADD COLUMN IF NOT EXISTS campaign_name TEXT;

-- Partial unique index: only enforced for rows that carry a campaign_id
-- (i.e. rows written by the Instantly sync). Existing rows written by the
-- Python engine have no campaign_id and keep relying on the original
-- UNIQUE(date, campaign) constraint from 004_cold_email.sql.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ce_metrics_daily_date_campaign_id
  ON ce_metrics_daily(date, campaign_id)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ce_metrics_campaign_id ON ce_metrics_daily(campaign_id);
