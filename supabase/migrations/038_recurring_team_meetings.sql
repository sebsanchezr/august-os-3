-- Recurring weekly meetings from Seb's Google Calendar, seeded directly so the
-- Meetings hub is populated regardless of whether the Google Calendar sync is
-- configured (it is currently blocked). Four standing calls:
--   Mon 12:00  Team priorities call   (internal, no client)
--   Mon 15:00  Coffuel call
--   Tue 13:30  Liquidation store call
--   Thu 14:00  Disanti studio call
--
-- Two schema changes make the internal team call representable:
--   1. client_meetings.title  - optional display name shown on the Meetings
--      page/slide-over instead of, or alongside, the client name.
--   2. client_meetings.client_id becomes nullable so an internal team meeting
--      that maps to no client can still be stored.
--
-- Idempotent: safe to re-run. Existing instances at the same timestamp are not
-- duplicated. Anchored to the week of 2026-07-13 (a Monday) and rolls 8 weeks
-- forward. recurrence='weekly' so each call clones to its next occurrence when
-- marked done, keeping the schedule rolling on its own.

ALTER TABLE client_meetings ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE client_meetings ALTER COLUMN client_id DROP NOT NULL;

-- Set the standing call day/time on the three client rows so the accounts grid
-- "next meeting" and the calendar-sync alias matching line up with reality.
UPDATE clients SET call_day = 1, call_time = TIME '15:00' WHERE name ILIKE 'coffuel';
UPDATE clients SET call_day = 2, call_time = TIME '13:30' WHERE name ILIKE 'liquidation store';
UPDATE clients SET call_day = 4, call_time = TIME '14:00' WHERE name ILIKE 'disanti studio';

DO $$
DECLARE
  v_coffuel     UUID;
  v_liquidation UUID;
  v_disanti     UUID;
  v_ts          TIMESTAMPTZ;
  i             INT;
BEGIN
  SELECT id INTO v_coffuel     FROM clients WHERE name ILIKE 'coffuel'           ORDER BY created_at LIMIT 1;
  SELECT id INTO v_liquidation FROM clients WHERE name ILIKE 'liquidation store' ORDER BY created_at LIMIT 1;
  SELECT id INTO v_disanti     FROM clients WHERE name ILIKE 'disanti studio'    ORDER BY created_at LIMIT 1;

  FOR i IN 0..7 LOOP
    -- Team priorities call: Monday 12:00, internal (no client).
    v_ts := (TIMESTAMP '2026-07-13 12:00:00' + (i * INTERVAL '7 days')) AT TIME ZONE 'Europe/London';
    IF NOT EXISTS (SELECT 1 FROM client_meetings WHERE title = 'Team priorities call' AND scheduled_at = v_ts) THEN
      INSERT INTO client_meetings (client_id, title, type, scheduled_at, duration_minutes, status, recurrence)
      VALUES (NULL, 'Team priorities call', 'weekly', v_ts, 60, 'scheduled', 'weekly');
    END IF;

    -- Coffuel call: Monday 15:00.
    IF v_coffuel IS NOT NULL THEN
      v_ts := (TIMESTAMP '2026-07-13 15:00:00' + (i * INTERVAL '7 days')) AT TIME ZONE 'Europe/London';
      IF NOT EXISTS (SELECT 1 FROM client_meetings WHERE client_id = v_coffuel AND scheduled_at = v_ts) THEN
        INSERT INTO client_meetings (client_id, title, type, scheduled_at, duration_minutes, status, recurrence)
        VALUES (v_coffuel, 'Coffuel call', 'weekly', v_ts, 60, 'scheduled', 'weekly');
      END IF;
    END IF;

    -- Liquidation store call: Tuesday 13:30.
    IF v_liquidation IS NOT NULL THEN
      v_ts := (TIMESTAMP '2026-07-14 13:30:00' + (i * INTERVAL '7 days')) AT TIME ZONE 'Europe/London';
      IF NOT EXISTS (SELECT 1 FROM client_meetings WHERE client_id = v_liquidation AND scheduled_at = v_ts) THEN
        INSERT INTO client_meetings (client_id, title, type, scheduled_at, duration_minutes, status, recurrence)
        VALUES (v_liquidation, 'Liquidation store call', 'weekly', v_ts, 60, 'scheduled', 'weekly');
      END IF;
    END IF;

    -- Disanti studio call: Thursday 14:00.
    IF v_disanti IS NOT NULL THEN
      v_ts := (TIMESTAMP '2026-07-16 14:00:00' + (i * INTERVAL '7 days')) AT TIME ZONE 'Europe/London';
      IF NOT EXISTS (SELECT 1 FROM client_meetings WHERE client_id = v_disanti AND scheduled_at = v_ts) THEN
        INSERT INTO client_meetings (client_id, title, type, scheduled_at, duration_minutes, status, recurrence)
        VALUES (v_disanti, 'Disanti studio call', 'weekly', v_ts, 60, 'scheduled', 'weekly');
      END IF;
    END IF;
  END LOOP;
END $$;
