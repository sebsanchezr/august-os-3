-- Calendar sync migration
-- August OS v3: adds the column needed to dedupe Google Calendar events
-- when the Monday sync cron upserts them into client_meetings.

ALTER TABLE client_meetings
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;
  -- Google Calendar event id. Set by /api/cron/calendar-sync. Null for
  -- meetings created manually or by the transcript pipeline (adhoc).

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_meetings_google_event
  ON client_meetings(google_event_id)
  WHERE google_event_id IS NOT NULL;
