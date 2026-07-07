# August OS: Task Manager Build Plan

Planned by Fable. Executed by Opus/Sonnet/Haiku per the phase assignments at the bottom.
Do not deviate from this spec without flagging to Seb first.

Hard rule: no em-dashes anywhere in code comments, UI copy, or notifications.

---

## 1. Decision Summary

- Build the task manager inside August OS (cold_call_os) as a new "Tasks" section, replacing Notion. One login, one place, same dark UI, sits next to the pipelines the tasks are about.
- Storage is the existing Supabase Postgres. Tasks are never hard deleted: soft delete only, done tasks auto-archive out of view but stay queryable forever. Weekly pg_dump backup via the existing launchd cron infra.
- Notifications: Discord is the primary channel (webhooks are free, reliable, and the team already gets agent output there). WhatsApp via Composio is a secondary daily digest. Important constraint: the official WhatsApp Cloud API (which Composio wraps) cannot post into group chats, only 1:1 messages, so WA notifications go to individual team members, not the group. Do not use unofficial WA bridges (ban risk).
- Meeting notes: a new agent (06_meeting_tasks) polls the Google Drive "Meet Recordings" transcripts folder, extracts action items with Haiku, and posts a Discord approval embed. Approved items become tasks automatically.

## 2. Database (migration 005_tasks.sql)

Follow the conventions in supabase/migrations/004_cold_email.sql (RLS: FOR ALL TO authenticated USING (true)).

### profiles
Maps auth users to display identity. Needed for assignment.
- id uuid PK (= auth.users.id)
- name text
- role text  (owner | media_buyer | editor | account_manager | admin)
- discord_user_id text null   (for @mentions in notifications)
- whatsapp_number text null   (E.164, for Composio digest)
- active boolean default true
- created_at timestamptz default now()

### clients
Lightweight now, becomes the base of the Account Management build later. Do not over-build.
- id uuid PK default gen_random_uuid()
- name text not null
- status text default 'active'  (active | paused | churned)
- services text[] default '{}'  (paid_ads, creatives)
- created_at timestamptz default now()

### tasks
One table for everything. Department + client link give all the slicing needed. Do NOT create separate tables per service.
- id uuid PK default gen_random_uuid()
- title text not null
- description text default ''
- track text not null default 'ops'  (creative | ops)  -- which board the task lives on; determines the valid status set
- department text not null  (creative | paid_ads | client | company | admin | ceo)
- client_id uuid null references clients(id)
- assignee_id uuid null references profiles(id)
- created_by uuid null references profiles(id)
- status text not null default 'backlog'
  Ops track statuses:      backlog | this_week | in_progress | blocked | review | done
  Creative track statuses: brief | editing | revision | ready_to_upload | uploaded | live
  API validates status against track. Terminal states (done, live) set completed_at.
- priority text not null default 'normal'  (urgent | high | normal | low)
- due_date date null
- blocked_reason text null
- source text not null default 'manual'  (manual | meeting | agent | recurring)
- meeting_ref text null  (Drive file id of source transcript)
- recurrence text null   (null | daily | weekly | monthly; when a recurring task is completed, the API clones it with the next due_date)
- tags text[] default '{}'
- position int default 0  (ordering within a kanban column)
- completed_at timestamptz null
- archived_at timestamptz null  (set automatically 14 days after completed_at)
- deleted_at timestamptz null   (soft delete; no DELETE statements anywhere in the app)
- created_at timestamptz default now()
- updated_at timestamptz default now()

Indexes: (status, archived_at), (assignee_id), (client_id), (due_date).

### task_comments
- id uuid PK, task_id uuid FK, author_id uuid FK profiles, body text, created_at timestamptz

### task_events  (immutable audit log, mirrors ce_events pattern)
- id uuid PK, task_id uuid FK, actor_id uuid null, type text (created | status_change | assigned | commented | edited | archived | restored), payload jsonb, occurred_at timestamptz default now()
Every mutation in the API writes an event row. This is the "nothing is ever lost" guarantee: even edits and status flips are reconstructable.

### Track and department fit
Creative track (core service fulfilment, the priority board):
- Ad creative production and go-live. Editors own brief -> editing -> revision -> ready_to_upload. Media buyers own ready_to_upload -> uploaded -> live. Every creative task must have client_id set.
- Handoff rule: when status hits ready_to_upload, the Discord notifier pings the assigned media buyer (assignee_id may be reassigned from editor to media buyer at handoff, or use a second field; keep it simple: the API reassigns to the client's media buyer if configured, else pings the channel).

Ops track (everything else):
- paid_ads: media buyer non-creative work (launches, budget changes, optimisations, reporting)
- client: client-specific deliverables and requests (always set client_id)
- company: internal growth/infrastructure work
- admin: adhoc and admin team tasks
- ceo: Seb's tasks

## 3. API routes (app/api/tasks/...)

Follow the pattern in app/api/cold-email/pipeline/route.ts (server client from lib/supabase-server.ts).

- GET/POST /api/tasks          list (filters: status, assignee, department, client, include_archived) / create
- PATCH /api/tasks/[id]        update fields, status moves, soft delete (sets deleted_at), restore
- POST /api/tasks/[id]/comments
- GET /api/tasks/meta          profiles + clients for dropdowns
- POST /api/tasks/inbound      service-key-authenticated endpoint for agents (meeting agent, future automations) to create tasks. Auth: header X-Agent-Key checked against env AGENT_INBOUND_KEY.

Business rules in the API layer:
- status -> done sets completed_at and, if recurrence set, clones the task with next due_date, status this_week.
- status -> blocked requires blocked_reason.
- Every mutation inserts a task_events row.

## 4. UI (app/(dashboard)/tasks/...)

New nav section "Tasks" in components/nav.tsx, above Coming Soon items. Match the existing dark theme exactly (#08090c / #181b27 / #1c2035, text #e4e6f0, lucide-react icons). Sleekness is the top requirement: minimal chrome, fast inline editing, no modals where a popover will do.

Pages:
- /tasks              One page, two board tabs at the top: "Creative Pipeline" (default, columns = creative statuses) and "Ops" (columns = ops statuses). Cards show title, assignee avatar initial, priority dot, client chip, due date (red if overdue). Drag between columns updates status. Filter bar: My Tasks toggle, department pills, client select, assignee select. Creative Pipeline is the default tab because core service fulfilment comes first.
- /tasks/list         Same data as a dense sortable table (for weekly planning). Inline edit of status/assignee/due date.
- /tasks/[id]         Slide-over panel, not a page navigation: full detail, description, comments, event history. Opens from card click.
- /tasks/archive      Read-only list of archived + soft-deleted tasks with restore button. Proof that nothing disappears.
- Quick add: a single input at the top of the board ("Task title, tab to set assignee/client") plus keyboard shortcut N. Creating a task must take under 5 seconds.

Reuse existing kanban patterns from /pipeline where possible.

## 5. Notifications

### Discord (primary, build first)
New env DISCORD_TASKS_WEBHOOK_URL. A notifier module fires on:
- task assigned to you (mentions discord_user_id if set)
- task marked blocked (mentions creator)
- creative task hits ready_to_upload (pings the media buyer / channel: "X for [client] is ready to go live")
- comment on a task you own

Team note: Discord is the work channel. Whole team gets onboarded onto the Discord server (part of the SOP rollout). Slack was considered and rejected: free tier deletes history after 90 days and paid adds cost for nothing Discord does not already do here. WA remains for quick chat plus the daily digest.
Plus a daily 08:30 UK digest (cron script in lead_pipeline/scripts, same launchd pattern as setup_daily_cron.sh): due today, overdue, blocked, done yesterday, grouped by assignee. Keep messages to compact embeds.

### WhatsApp via Composio (secondary, phase 4)
Script lead_pipeline/scripts/14_tasks_wa_digest.py: pulls the same daily digest and sends one message per active team member with a whatsapp_number, through Seb's existing Composio WhatsApp connection. 1:1 only (Cloud API limitation, no groups). If Composio's WA connection turns out to be Seb's personal number rather than a Business Cloud API sender, flag to Seb before building; do not work around with unofficial libraries.
No per-event WA pings: one digest per day maximum, so it never becomes noise.

## 6. Meeting notes agent (agents/06_meeting_tasks)

Blueprint + Python script, same shape as 03_reply_handler (Discord approval loop).

Flow, fully automatic after every call:
1. Poll Google Drive (service account or OAuth, Drive API free) three times daily at 09:00, 15:00 and 21:00 UK for new files in the Meet Recordings / Transcripts folder (6 clients, roughly one call each per week; no need for tighter polling). Track processed file ids in a small Supabase table (meeting_transcripts: file_id, title, meeting_date, processed_at, tasks_extracted int).
2. Export the Google Doc transcript as plain text.
3. Haiku extracts action items as JSON: [{title, suggested_assignee, suggested_department, suggested_client, due_hint, quote}]. Prompt it to be conservative: only clear commitments, include the supporting quote.
4. Post one Discord embed per meeting to the approvals channel: meeting title, date, numbered task list with quotes. Reactions or buttons: approve all, or per-item approve/skip, plus an edit path (reply with corrections, agent re-parses).
5. Approved items POST to /api/tasks/inbound with source=meeting and meeting_ref set.

Transcript source decision: Google Meet built-in transcription requires Workspace Business Standard or above. Since meetings are already being transcribed, transcripts land in Drive as Docs, so this pipeline needs zero new tools. If that ever breaks, the best free fallback is Fathom (free tier, unlimited meetings, transcripts + summaries) or tl;dv free tier; both would need their export path wired into step 1.

## 7. Data safety and retention

- Soft delete only, enforced in the API. RLS stays permissive (trusted small team) but the UI exposes no hard delete.
- Auto-archive: nightly cron sets archived_at on tasks completed more than 14 days ago. Archived tasks stay in Postgres forever; the archive page and API filters can always reach them. Volume is a non-issue: 50,000 task rows is a few MB against Supabase free tier's 500 MB (roughly 1% per year of heavy use). Decision 2026-07-04: no permanent purge. Seb raised a 30-day hard delete; rejected because storage impact is negligible and completed-task history feeds client scope disputes, team reviews, and the future Account Management reporting. Revisit only if the database ever nears free-tier limits.
- Weekly backup: lead_pipeline/scripts/15_backup_supabase.sh runs pg_dump of the task tables (and the rest) to a dated file in Google Drive or a local backups/ folder, via launchd. Free-tier Supabase has no point-in-time recovery, so this is the safety net.
- task_events gives row-level history on top of backups.

## 8. Notion migration

One-time script: export current Notion board to CSV, map columns to the tasks schema (status mapping documented in the script), insert via service key with created_by = Seb. Run once, verify counts in the UI, then freeze the Notion board (read-only) for two weeks before deleting it.

## 9. Operating cadence (becomes the SOP once the build settles)

Not micromanagement: the system tracks outcomes and due dates, never hours. Nobody chases anyone; the OS does the surfacing.
- Task creation: anything that takes more than 15 minutes or involves another person becomes a task at the moment it appears (meeting agent handles calls automatically).
- Daily, 2 minutes per person: check My Tasks, move statuses, flag blockers. The 08:30 digest is the prompt.
- Monday, 20 minutes: Seb/lead sweeps backlog to this_week on the list view, confirms owners and due dates.
- Friday, 10 minutes: clear review column, mark done, note anything slipping.
- Client requests: logged as department=client with client_id before work starts (scope creep control).
- Blocked is a first-class status and pings Discord immediately: blockers get solved in hours, not standups.

## 10. Build phases and model assignments

Phase 1 (Sonnet): migration 005_tasks.sql, seed profiles for current team, API routes with business rules + event logging.
Phase 2 (Opus): Tasks UI (board, list, slide-over, archive, quick add). This is the highest-polish surface; match existing theme pixel-for-pixel.
Phase 3 (Sonnet): Discord notifier + daily digest cron + auto-archive cron + backup script.
Phase 4 (Sonnet): 06_meeting_tasks agent (Drive poll, Haiku extraction, Discord approval, inbound API). Haiku runs the extraction at runtime.
Phase 5 (Haiku): Notion CSV import script, SOP doc draft from section 9.

Definition of done per phase: works end to end against the live Supabase project, no console errors, matches this spec, demo message in Discord.
