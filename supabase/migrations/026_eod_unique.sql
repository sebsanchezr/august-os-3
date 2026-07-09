-- Prevent duplicate/double-counted EOD submissions per caller per day.
-- The API now upserts on (report_date, caller_name); before adding the unique
-- constraint we need to dedupe any rows that already violate it.

-- Keep only the most recently created row per (report_date, caller_name).
-- Tie-break on id when created_at is identical.
DELETE FROM eod_reports a
USING eod_reports b
WHERE a.report_date = b.report_date
  AND a.caller_name = b.caller_name
  AND (
    a.created_at < b.created_at
    OR (a.created_at = b.created_at AND a.id < b.id)
  );

ALTER TABLE eod_reports
  ADD CONSTRAINT eod_reports_date_caller_unique UNIQUE (report_date, caller_name);
