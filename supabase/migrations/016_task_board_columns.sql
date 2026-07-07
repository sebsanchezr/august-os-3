-- Redefine the Creative Pipeline and Ops task board columns.
--
-- New columns, in order:
--   Creative Pipeline: Brief, Editing, Revision, Approved by Client, Sent to Media Buyer, Live
--   Ops:               Brief, In Progress, Review, Completed
--
-- `status` is plain TEXT (no enum/check constraint), so no DB constraint
-- needs to be dropped or recreated -- the app layer (lib/types.ts,
-- app/api/tasks/*) is the source of truth for valid values. This migration
-- only remaps existing rows off statuses that no longer exist, so no data is
-- silently orphaned, and updates the default + documentation comment.

-- Creative track: ready_to_upload -> approved_by_client, uploaded -> sent_to_media_buyer
UPDATE tasks SET status = 'approved_by_client'  WHERE track = 'creative' AND status = 'ready_to_upload';
UPDATE tasks SET status = 'sent_to_media_buyer' WHERE track = 'creative' AND status = 'uploaded';

-- Ops track: backlog/this_week -> brief, blocked -> review, done -> completed
UPDATE tasks SET status = 'brief'     WHERE track = 'ops' AND status IN ('backlog', 'this_week');
UPDATE tasks SET status = 'review'    WHERE track = 'ops' AND status = 'blocked';
UPDATE tasks SET status = 'completed' WHERE track = 'ops' AND status = 'done';

-- Ops tasks no longer carry a blocked_reason once "blocked" is not a column.
UPDATE tasks SET blocked_reason = NULL WHERE track = 'ops' AND blocked_reason IS NOT NULL;

-- New shared default: both tracks now start on "Brief".
ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'brief';

COMMENT ON COLUMN tasks.status IS
  'creative statuses: brief | editing | revision | approved_by_client | sent_to_media_buyer | live. '
  'ops statuses: brief | in_progress | review | completed.';
