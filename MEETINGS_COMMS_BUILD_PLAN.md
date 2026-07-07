# August OS: Client Meetings + Communications Build Plan

Planned by Fable. Executed by Opus/Sonnet/Haiku per the phase assignments at the bottom.
Do not deviate from this spec without flagging to Seb first.

Hard rule: no em-dashes anywhere in code comments, UI copy, notifications, or client-facing text.

Source SOPs: Genflow lessons on client reporting, client communications (SLAs), and performance issues. The principles are encoded into the system below so the OS enforces them instead of people remembering them.

---

## 1. Decision Summary

- Build on what exists. client_meetings, client_comms_log, client_reports (meeting_prep / meeting_followup types), the ICS invite route, meeting_transcripts, and /api/tasks/inbound are already live. This build adds the lifecycle around them, not new foundations.
- Meetings get a full lifecycle: scheduled -> prepped -> held -> minuted -> actioned. Every stage is automated or one-click. The AM never walks into a call cold and the client never waits more than same-day for minutes.
- Comms becomes an SLA engine, not a log. Every inbound client message starts a response clock (2h WhatsApp, 24h email, per the Genflow SLA framework). Breaches ping Discord before the client notices. Manual logging stays (WA groups cannot be auto-captured on the official API) but is reduced to two taps.
- Discord goes two-way. Outbound webhooks stay for notifications. A small bot (same pattern as agents/03_reply_handler's approval loop) handles team questions: the OS posts a question to Discord, the team answers in-thread, the answer lands back in the OS attached to the client/meeting/task it came from.
- One post-meeting pipeline: transcript -> minutes draft + client followup message + extracted action items -> single Discord/OS approval -> minutes emailed to client same day, tasks created, comms log updated. This extends agent 06_meeting_tasks rather than adding a second transcript consumer.
- The Genflow standards (SLAs, minutes same day, structured answers: context, process, options, recommendation) get published as /sop pages so the team is trained on the same rules the system enforces.

## 2. Database (migration 009_meetings_comms.sql)

Follow the conventions in 006_accounts.sql (RLS: FOR ALL TO authenticated USING (true)).

### client_meetings (extend, do not recreate)
Add columns:
- duration_minutes int default 30
- attendees jsonb default '[]'        (emails invited, from the invite route)
- minutes_md text null                (internal minutes, Claude-drafted, human-edited)
- minutes_sent_at timestamptz null    (when minutes were emailed to the client)
- prep_ready_at timestamptz null      (when the prep pack was generated)
- recurrence text null                (null | weekly | monthly; on status=done the API clones the meeting at the next occurrence using clients.call_day / call_time)
- outcome_note text null              (one-liner: how did it go, feeds health)

### client_comms_log (extend for SLA tracking)
Add columns:
- requires_response boolean default false   (set true on inbound messages that ask something)
- response_due_at timestamptz null          (computed on insert from channel SLA)
- responded_at timestamptz null             (set when the outbound reply is logged, or one-tap "responded" on the timeline)
- sla_breached boolean default false        (set by the sentinel cron when now > response_due_at and responded_at is null; kept true even after late response, for reporting)

Channel SLAs (constants in lib, mirrored in the SOP): whatsapp 2h, email 24h, call same day, meeting n/a. Per-client overrides via a new clients.comms_sla jsonb null column (e.g. {"whatsapp_hours": 4}). Do not build an SLA admin UI; jsonb edit in client settings tab is enough.

### team_questions
The Discord two-way loop.
- id uuid PK default gen_random_uuid()
- question text not null
- context text default ''             (why it is being asked)
- client_id uuid null references clients(id)
- meeting_id uuid null references client_meetings(id)
- task_id uuid null references tasks(id)
- asked_by uuid null references profiles(id)
- target_profile_id uuid null references profiles(id)   (null = whole team)
- discord_message_id text null        (the bot's posted message, for thread matching)
- answer text null
- answered_by uuid null references profiles(id)
- status text not null default 'open' (open | answered | expired)
- asked_at timestamptz default now()
- answered_at timestamptz null

Indexes: client_comms_log (response_due_at) where responded_at is null; team_questions (status); client_meetings (scheduled_at, status).

### meeting_transcripts (extend)
Add: meeting_id uuid null references client_meetings(id). The post-meeting agent sets this when it matches a transcript to a scheduled meeting (by client name in title + closest scheduled_at within 24h). Unmatched transcripts still process (adhoc calls) and create an adhoc client_meetings row when the client is identifiable.

## 3. API routes

Follow existing patterns (supabase-server.ts admin client, fire-and-forget Discord).

Meetings:
- GET /api/meetings                  cross-client list: upcoming (default), past, filters: client_id, type, from/to dates. Joins client name, prep report status, followup report status. Powers the Meetings hub.
- PATCH /api/accounts/[id]/meetings  (exists) extend allowed fields: minutes_md, minutes_sent_at, outcome_note, recurrence, duration_minutes.
- POST /api/meetings/[id]/send-minutes   renders minutes_md to the client email template, sends via Resend to attendees, sets minutes_sent_at, logs an outbound client_comms_log row (channel=email). Refuses if the linked followup report is not approved.
- On status -> done with recurrence set: clone to next occurrence (same rule shape as task recurrence).

Comms:
- POST /api/accounts/[id]/comms      (exists) extend: accept requires_response; compute response_due_at from channel SLA + client override. Logging an outbound comm auto-resolves the oldest open inbound clock for that client (sets responded_at).
- POST /api/comms/[id]/respond       one-tap: mark responded now.
- GET /api/comms/inbox               all open response clocks across clients, ordered by due soonest. Powers the Comms inbox.

Team questions:
- GET/POST /api/questions            create (posts to Discord via the bot's webhook with a distinctive embed), list open/answered.
- POST /api/questions/inbound        service-key auth (X-Agent-Key, same AGENT_INBOUND_KEY): the bot posts answers back here with discord_message_id + answer + discord_user_id (mapped to profiles.discord_user_id for answered_by).

## 4. UI

Nav (components/nav.tsx): under FULFILMENT add "Meetings" between Tasks and Accounts. Comms inbox lives inside Accounts as a new sub-item "Comms". Match the dark theme exactly, same as always.

### /meetings (hub)
- "This week" strip at top: cards per meeting (client, day/time, type, prep status dot: grey none / amber generating / green ready).
- Below: upcoming list and past list (tabs). Row: client, datetime, type, prep / minutes / followup / actions status chips.
- Quick actions per row: open prep, schedule (reuses MeetingModal + invite route), join notes.
- Meeting detail is a slide-over (same pattern as tasks): four tabs.
  - Prep: the meeting_prep report rendered (metrics vs prior period, open tasks for the client, open issues, unconsumed talking points, last meeting's action items with done/not-done status pulled live from tasks where meeting_ref matches, agenda draft). Editable agenda saved to client_meetings.agenda.
  - Minutes: minutes_md editor (textarea + markdown preview), "Send to client" button (calls send-minutes, disabled until followup report approved). Shows sent timestamp after.
  - Actions: tasks created from this meeting (tasks.meeting_ref = transcript file id), with status.
  - Transcript: raw transcript text if available, else "not yet processed".

### /accounts/comms (inbox)
- Open response clocks, due soonest first. Row: client, channel icon, summary, time remaining (countdown, red when < 25% remains, flashing "BREACHED" state after). One-tap "Responded" button, "Log reply" opens the existing comm modal prefilled as outbound.
- Second section: team questions (open ones with time since asked, answered ones with the answer inline).
- Client HQ (account-hq.tsx): the existing comms timeline gains the SLA state per entry and a "Needs response" toggle on the log modal (defaults on for inbound).

### Approvals (/accounts/approvals, exists)
meeting_followup reports appear here already by type. Add: approving a meeting_followup also unlocks the send-minutes button and pings Discord with "Minutes for [client] approved, ready to send".

## 5. Automation (agents + crons)

All crons live in lead_pipeline/scripts with the existing launchd pattern. All agent -> OS writes go through the inbound endpoints with AGENT_INBOUND_KEY.

### 07_meeting_prep (cron, daily 16:00 UK)
For every client_meetings row scheduled in the next 36h without prep_ready_at:
1. Pull: client_metrics_daily last 7d vs prior 7d, open tasks (client_id), open issues, unconsumed talking_points, previous meeting's minutes_md and action item statuses.
2. Sonnet drafts the prep pack as a meeting_prep client_report (draft_md) and an agenda (written to client_meetings.agenda if empty).
3. Set prep_ready_at, mark consumed talking points, Discord ping the AM: "Prep ready for [client] tomorrow 14:00" with link.
Also sends meeting reminders: Discord ping to the AM 2h before each meeting with the prep link.

### 06_meeting_tasks (extend the existing agent, do not fork)
Current: Drive poll 3x daily, Haiku extracts action items, Discord approval, tasks via inbound API. Extend to the full post-meeting pipeline:
1. Match transcript to a client_meetings row (client name + nearest scheduled_at within 24h). Set meeting_transcripts.meeting_id and client_meetings.transcript_id. No match but client identifiable: create an adhoc meeting row, status done.
2. Sonnet drafts two artifacts from the transcript: (a) minutes_md written to client_meetings (structure: what was discussed, decisions, metrics mentioned, action items with owners, risks/concerns raised, next steps), and (b) a client-facing followup message saved as a meeting_followup client_report, status pending_approval. Same-day rule from the SOP: this runs on every poll, so minutes exist within hours of the transcript landing.
3. Action item extraction and Discord approval loop unchanged; approved items become tasks with meeting_ref set.
4. Log a client_comms_log row (channel=meeting, direction=inbound, summary = one-line meeting outcome). If the transcript contains trigger words (confused, disappointed, frustrating, plus the existing flag list), set flags and fire notifyClientFlag. This is the Genflow early-warning system running on every call automatically.
5. Set client_meetings.status = done.

### 08_comms_sentinel (cron, every 30 min, 08:00 to 20:00 UK)
1. SLA sweep: client_comms_log rows with requires_response, no responded_at, now past response_due_at: set sla_breached, Discord alert to the accounts webhook mentioning the AM ("[client] WhatsApp from 11:20 is past the 2h SLA"). Warn at 75% of the window ("30 min left to reply to [client]").
2. Quiet-client sweep (daily at 09:00 run only): clients with last_client_contact older than 5 days get a "go touch base" Discord nudge with a suggested proactive update (from latest metrics). The SOP rule: if clients chase us, we already failed.
3. Question expiry: team_questions open past 24h re-ping Discord with the target mentioned; past 48h mark expired and alert Seb.

### 09_team_bot (long-running Discord bot, agents/)
Small discord.py bot, token in env DISCORD_BOT_TOKEN, one channel (env DISCORD_QUESTIONS_CHANNEL_ID). Same supervision as other long-running agents.
- Outbound: when POST /api/questions creates a row, the API hits the bot's lightweight HTTP endpoint (localhost) or the bot polls team_questions every 60s for rows without discord_message_id (polling is simpler and stateless; do polling). Posts an embed: question, context, client chip, asked by, mentions target or @here.
- Inbound: first reply in the message's thread (or reply-to) from a profile-mapped discord_user_id becomes the answer: POST /api/questions/inbound. Bot reacts with a checkmark and edits the embed to show answered.
- Scope discipline: this bot does questions only. Do not grow it into a general command bot in this build.

## 6. Comms standards (published to /sop, enforced by the system)

Haiku drafts two SOP pages from the Genflow material, Seb edits before publishing:
- Client Communications: channel SLAs (WA 2h, email 24h ack, minutes same day), the answer structure (context, process, options, recommendation), close-the-loop rule, proactive updates before being asked, positive tone, quality checklist before sending (timely, clear, explains why, next steps, removes uncertainty).
- Client Meetings: cadence per client, prep pack review before every call, agenda always set, minutes same day via the approval queue, every commitment becomes a task in the meeting thread, trigger words escalate to an issue.
Internal comms rule set in the same page: Discord is the work channel, blocked tasks and client flags get responded to within 2h working hours, meeting prep pings are acknowledged with a reaction.

## 7. Health score linkage

The nightly health recompute (planned in the accounts build) gains inputs from this module: sla_breached count last 14d, meetings held vs scheduled last 30d, minutes_sent_at latency, sentiment trend from comms log, open trust_threatening issues. Weighting decided at implementation, but breaches and missed minutes must be able to drag a client to amber on their own. Communication failures are the leading churn indicator per the SOP, so the score must feel them.

## 8. Env vars (new)

- DISCORD_BOT_TOKEN            team questions bot
- DISCORD_QUESTIONS_CHANNEL_ID team questions channel
- (existing reused: DISCORD_ACCOUNTS_WEBHOOK_URL, DISCORD_TASKS_WEBHOOK_URL, RESEND_API_KEY, RESEND_FROM_EMAIL, AGENT_INBOUND_KEY)

## 9. Constraints and honest limits

- WhatsApp group messages cannot be auto-captured (official Cloud API has no group access; unofficial bridges are ban-risk and banned from this codebase). The SLA clock therefore depends on the AM logging inbound WA in two taps. The daily digest and the quiet-client sweep are the backstop. If logging discipline fails, revisit with an email-first client comms policy, not a WA workaround.
- Email inbound is not auto-captured either (Resend is send-only). Same two-tap logging applies. A forwarding-address parser is a possible later phase; out of scope now.
- The team bot is the first long-running Discord process in the stack. Keep it tiny, restart-safe (all state in Supabase), and supervised by launchd.

## 10. Build phases and model assignments

Phase 1 (Sonnet): migration 009, API extensions (meetings hub route, send-minutes, comms SLA logic, respond endpoint, inbox route, questions routes). Business rules exactly as section 3.
Phase 2 (Opus): Meetings hub UI + meeting slide-over (4 tabs) + Comms inbox + SLA states on the HQ timeline + approvals hook. Highest-polish surface, pixel-match the theme.
Phase 3 (Sonnet): 07_meeting_prep cron + 08_comms_sentinel cron, launchd plists, Discord messages as compact embeds.
Phase 4 (Sonnet): 06_meeting_tasks extension (matching, minutes, followup report, comms log, trigger words). Haiku stays the runtime extractor for action items; Sonnet runtime for minutes drafting.
Phase 5 (Sonnet): 09_team_bot + questions inbound wiring, end-to-end test with a real question.
Phase 6 (Haiku): the two /sop pages drafted from section 6 for Seb's edit.

Definition of done per phase: works end to end against live Supabase, no console errors, matches this spec, demo in Discord. Phase order is dependency order; 1 and 6 can start together.
