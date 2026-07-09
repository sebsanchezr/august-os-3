-- Allow the Digest tag used by the daily digest cron
ALTER TABLE os_updates DROP CONSTRAINT IF EXISTS os_updates_tag_check;
ALTER TABLE os_updates ADD CONSTRAINT os_updates_tag_check
  CHECK (tag IN ('New', 'Fix', 'Building', 'Improved', 'Digest'));
