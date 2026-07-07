-- EOD reports table
CREATE TABLE IF NOT EXISTS eod_reports (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date      DATE    NOT NULL,
  caller_name      TEXT    NOT NULL,
  calls_made       INTEGER NOT NULL DEFAULT 0,
  positive_replies INTEGER NOT NULL DEFAULT 0,
  calls_booked     INTEGER NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE eod_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_eod_reports" ON eod_reports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_eod_reports_date ON eod_reports(report_date DESC);
