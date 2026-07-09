-- Entity-level (campaign / adset / ad) snapshots pulled from the Meta Marketing
-- API at recommendation time. client_metrics_daily is account-level daily only,
-- which makes operational hygiene checks (ad set left running, paused winner,
-- overlapping ad sets, delivery stalls) impossible to see. This table stores a
-- point-in-time snapshot of every campaign/adset/ad with its effective_status,
-- budget, and last-7d vs prev-7d insights, so the ads recommendations flow can
-- surface what the media buyer MISSED operationally, not ad strategy.
--
-- level is 'campaign' | 'adset' | 'ad' by convention (no CHECK constraint, so
-- Meta can add new levels without a migration). One row per entity per snapshot.

CREATE TABLE IF NOT EXISTS ad_entities_snapshot (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  snapshot_date     DATE NOT NULL,
  level             TEXT NOT NULL,
  entity_id         TEXT NOT NULL,
  entity_name       TEXT,
  effective_status  TEXT,
  daily_budget      NUMERIC,
  spend_7d          NUMERIC,
  purchases_7d      NUMERIC,
  revenue_7d        NUMERIC,
  roas_7d           NUMERIC,
  ctr_7d            NUMERIC,
  frequency         NUMERIC,
  spend_prev7d      NUMERIC,
  roas_prev7d       NUMERIC,
  raw               JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_id, snapshot_date, level, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_entities_snapshot_client_date
  ON ad_entities_snapshot (client_id, snapshot_date);

ALTER TABLE ad_entities_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_ad_entities_snapshot" ON ad_entities_snapshot FOR ALL TO authenticated USING (true) WITH CHECK (true);
