-- L'Alingi recurring weekly meeting.
-- L'Alingi is an existing client (luxury fashion, GCC/US paid media). This
-- seeds a standing weekly call every Thursday at 13:00 Europe/London and
-- generates the next 8 instances so the Meetings hub is populated even before
-- the Google Calendar sync picks up any real events. recurrence='weekly' means
-- the meetings API clones the meeting to the next occurrence when it is marked
-- done, so the schedule keeps rolling forward on its own.
--
-- Idempotent: safe to run more than once. It finds L'Alingi (or creates a
-- client row if none exists), sets its weekly call day/time, and only inserts
-- meeting instances that are not already present at that timestamp.

DO $$
DECLARE
  v_client_id UUID;
  v_ts        TIMESTAMPTZ;
  i           INT;
BEGIN
  -- Find L'Alingi by name (any apostrophe/casing), else create the client.
  SELECT id INTO v_client_id
  FROM clients
  WHERE name ILIKE 'l%alingi'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO clients (name, status, services, call_day, call_time)
    VALUES ('L''Alingi', 'active', ARRAY['paid_ads'], 4, TIME '13:00')
    RETURNING id INTO v_client_id;
  ELSE
    UPDATE clients
    SET call_day = 4, call_time = TIME '13:00'
    WHERE id = v_client_id;
  END IF;

  -- Generate the next 8 Thursdays at 13:00 Europe/London, starting 2026-07-09.
  -- Postgres resolves the IANA zone name, so BST/GMT transitions are handled.
  FOR i IN 0..7 LOOP
    v_ts := (TIMESTAMP '2026-07-09 13:00:00' + (i * INTERVAL '7 days'))
            AT TIME ZONE 'Europe/London';

    IF NOT EXISTS (
      SELECT 1 FROM client_meetings
      WHERE client_id = v_client_id AND scheduled_at = v_ts
    ) THEN
      INSERT INTO client_meetings (client_id, type, scheduled_at, duration_minutes, status, recurrence)
      VALUES (v_client_id, 'weekly', v_ts, 60, 'scheduled', 'weekly');
    END IF;
  END LOOP;
END $$;
