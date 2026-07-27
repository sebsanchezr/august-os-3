-- 059_task_status_backfill.sql
--
-- Board cleanup, 27 Jul 2026.
--
-- Background: the original TASKS_BUILD_PLAN spec'd ops statuses as
-- backlog | this_week | in_progress | blocked | review | done. The enum in
-- lib/types.ts was later narrowed to brief | in_progress | review | completed
-- (creative: brief | editing | revision | sent_for_approval |
-- approved_by_client | sent_to_media_buyer | live), but existing rows were
-- never migrated. task-board.tsx groups with `if (map[t.status])`, so every
-- row in a legacy status was silently dropped from the kanban: 61 of 81 live
-- tasks were invisible on the board while still showing in List view.
--
-- This backfill maps the legacy vocabulary onto the real enum. Idempotent:
-- re-running matches nothing once applied.

-- Ops track: backlog and this_week both collapse into the Brief intake column.
update tasks
   set status = 'brief', updated_at = now()
 where track = 'ops'
   and status in ('backlog', 'this_week')
   and deleted_at is null;

-- Ops track: 'done' was the spec'd terminal status, the app uses 'completed'.
-- Rows left in 'done' can never be seen by the task-archive cron (which looks
-- for 'completed'/'live'), so they linger on the board forever.
update tasks
   set status = 'completed', updated_at = now()
 where track = 'ops'
   and status = 'done'
   and deleted_at is null;

-- Creative track: backlog is not a creative status, Brief is the intake column.
update tasks
   set status = 'brief', updated_at = now()
 where track = 'creative'
   and status = 'backlog'
   and deleted_at is null;

-- Creative track: rows parked in the ops-only 'this_week' that already carry a
-- completed_at are finished work, so they belong in the terminal 'live' column.
update tasks
   set status = 'live', updated_at = now()
 where track = 'creative'
   and status = 'this_week'
   and completed_at is not null
   and deleted_at is null;

-- Any remaining creative 'this_week' rows are unfinished, so they go to Brief.
update tasks
   set status = 'brief', updated_at = now()
 where track = 'creative'
   and status = 'this_week'
   and deleted_at is null;

-- Priority: 'medium' is not in the TaskPriority enum
-- (urgent | high | normal | low), so PRIORITY_COLOURS lookups return undefined
-- and the priority dot renders blank.
update tasks
   set priority = 'normal', updated_at = now()
 where priority = 'medium'
   and deleted_at is null;
