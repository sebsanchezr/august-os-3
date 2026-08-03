-- Track dials that never connected (no answer, voicemail, dead line, wrong number)
-- so EOD/dashboard rates can be computed off connected calls, not raw dials.
alter table eod_reports
  add column if not exists no_pickups integer not null default 0;
