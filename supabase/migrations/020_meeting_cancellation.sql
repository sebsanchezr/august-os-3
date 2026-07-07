-- Meeting cancellation support.
-- Adds a reason column so cancelling a meeting (e.g. contact on holiday) can
-- carry context, surfaced in the slide-over and the Discord cancellation ping.

ALTER TABLE client_meetings
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
