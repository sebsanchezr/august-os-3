-- Gov Contracts tracking: mirrors gov_engine/data/gov_tracker.csv (the Python
-- engine's source of truth) into Supabase so the OS can show a dashboard and
-- Bid Manager. gov_engine/gov_supabase.py upserts into these tables on every
-- cron run; nothing in the OS writes back into the CSV.

-- gov_tenders: one row per notice, upserted on notice_id (matches gov_tracker
-- .py FIELDS/STATUSES exactly — keep these in sync if the Python schema changes).
CREATE TABLE IF NOT EXISTS gov_tenders (
  notice_id       TEXT PRIMARY KEY,
  title           TEXT,
  authority       TEXT,
  buyer_name      TEXT,
  buyer_email     TEXT,
  incumbent       TEXT,
  award_value_gbp NUMERIC,
  contract_start  DATE,
  contract_end    DATE,
  cpv             TEXT,
  notice_url      TEXT,
  status          TEXT NOT NULL,
  campaign_id     TEXT,
  date_added      DATE,
  last_update     DATE,
  notes           TEXT,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- gov_instantly_daily: daily snapshot of the gov campaign's Instantly
-- analytics (cumulative campaign totals, same numbers gov_optimizer.py
-- already collects into performance_history.json).
CREATE TABLE IF NOT EXISTS gov_instantly_daily (
  date               DATE PRIMARY KEY,
  emails_sent_total  INT NOT NULL DEFAULT 0,
  opens_total        INT NOT NULL DEFAULT 0,
  replies_total      INT NOT NULL DEFAULT 0,
  clicks_total       INT NOT NULL DEFAULT 0,
  bounced_total      INT NOT NULL DEFAULT 0,
  opportunities_total INT NOT NULL DEFAULT 0,
  synced_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gov_tenders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE gov_instantly_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_gov_tenders"         ON gov_tenders         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_gov_instantly_daily" ON gov_instantly_daily FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_gov_tenders_status        ON gov_tenders(status);
CREATE INDEX idx_gov_tenders_contract_end  ON gov_tenders(contract_end);
CREATE INDEX idx_gov_tenders_date_added    ON gov_tenders(date_added);
CREATE INDEX idx_gov_tenders_last_update   ON gov_tenders(last_update);
