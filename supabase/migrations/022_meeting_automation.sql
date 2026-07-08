-- Meeting automation pipeline: post-meeting transcript polling + follow-up.
-- Adds idempotency flags so the 30-min meeting-followup cron never double-posts.
--
-- Note on prep: prep_ready_at (migration 009) already serves as the
-- "prep pack sent to Discord" guard for the meeting-prep cron, so no separate
-- prep_sent_at column is added here. These columns cover the post-meeting half
-- of the lifecycle that had no storage yet.

ALTER TABLE client_meetings
  ADD COLUMN IF NOT EXISTS transcript_found_at   TIMESTAMPTZ,
  -- set when the followup cron matches a transcript email to this meeting
  ADD COLUMN IF NOT EXISTS post_meeting_sent_at  TIMESTAMPTZ,
  -- set when the post-meeting client message has been posted to Discord
  ADD COLUMN IF NOT EXISTS post_meeting_message  TEXT,
  -- the copy-paste client follow-up message drafted from the transcript
  ADD COLUMN IF NOT EXISTS followup_checked_at   TIMESTAMPTZ;
  -- last time the followup cron looked for a transcript for this meeting
  -- (used to throttle Gmail lookups; not an idempotency guard on its own)

-- Fast lookup for the followup cron: meetings past their end without a
-- post-meeting message yet.
CREATE INDEX IF NOT EXISTS idx_client_meetings_followup
  ON client_meetings(scheduled_at)
  WHERE post_meeting_sent_at IS NULL;
