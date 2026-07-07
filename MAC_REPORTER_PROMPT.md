# Mac Reporter Prompt (self-contained)

Paste everything inside the code fence below into a fresh Claude Code session on the Mac,
in whatever workspace already holds your Meta ad account code and TrendTrak client.
It references nothing on the other machine. The two machines connect only through Supabase.

To get this onto the Mac: AirDrop this file, or paste the fenced block into a note and open it there.

---

````
You are building a standalone Python service called "reporter" for August, a marketing
agency. It runs ONLY on this Mac, where the Meta ad account API tokens and TrendTrak
competitor API live. It talks to a shared Supabase project over the internet. There is a
separate Next.js app (the "OS") on another machine that reads the same Supabase and handles
human approval and delivery. You never touch that app; you only read and write Supabase rows.

Do NOT look for any "cold_call_os" repo or plan file on this machine. Everything you need is
in this prompt. Build the reporter in a new reporter/ directory inside THIS workspace, and
reuse the Meta ad account + TrendTrak client code that already exists in THIS workspace.
Locate that existing ad code first and reuse its auth; do not re-implement API auth.

ENVIRONMENT (add these to a .env this Mac loads, ask me for the values if not present):
  SUPABASE_URL            - the shared Supabase project URL
  SUPABASE_SERVICE_KEY    - Supabase service role key (bypasses RLS, full read/write)
  ANTHROPIC_API_KEY       - for drafting client-facing copy

SUPABASE SCHEMA (already migrated, do not create tables, just read/write these):

  clients (you READ these columns):
    id UUID, name TEXT, status TEXT (active|paused|churned),
    meta_ad_account_id TEXT (act_xxxx, skip client if null),
    trendtrak_ids TEXT[], target_roas NUMERIC, target_cpa NUMERIC,
    monthly_budget NUMERIC, currency TEXT (default GBP),
    contact_name TEXT, am_profile_id UUID, call_day SMALLINT (1=Mon..5=Fri), call_time TIME

  client_metrics_daily (you UPSERT on unique (client_id, date)):
    client_id UUID, date DATE, spend NUMERIC, revenue NUMERIC, roas NUMERIC,
    purchases INT, cpa NUMERIC, impressions BIGINT, clicks INT, ctr NUMERIC,
    top_creatives JSONB  = [{ad_id, name, spend, roas, thumbnail_url}],
    competitor_notes JSONB = TrendTrak highlights for that day

  client_reports (you INSERT drafts; the OS handles approval + sending):
    client_id UUID, type TEXT
      (weekly_eow | monday_kickoff | meeting_prep | meeting_followup | monthly_deep_dive),
    period_start DATE, period_end DATE, metrics JSONB (frozen numbers used),
    draft_md TEXT (internal brief for the founder), client_message TEXT (WA-ready text),
    status TEXT -- always insert as 'pending_approval'
    -- do NOT set approved_by/approved_at/sent_at; the OS owns those

  client_talking_points (you READ unconsumed, then mark consumed):
    id UUID, client_id UUID, point TEXT, consumed_by_report UUID (null = unconsumed)
    -- after using them in a report, set consumed_by_report = the report id you inserted

  client_meetings (you READ schedule, UPDATE prep/followup links):
    id UUID, client_id UUID, type TEXT (weekly|monthly|adhoc), scheduled_at TIMESTAMPTZ,
    status TEXT (scheduled|done|cancelled), transcript_id UUID,
    prep_report_id UUID, followup_report_id UUID

  tasks (you READ per client, and INSERT action items from meeting follow-ups):
    id UUID, title TEXT, description TEXT, track TEXT, department TEXT, client_id UUID,
    assignee_id UUID, status TEXT, priority TEXT, due_date DATE, source TEXT, completed_at TIMESTAMPTZ
    -- to create a follow-up action item, insert:
    --   track='ops', department='client', status='backlog', source='meeting',
    --   client_id=<client>, assignee_id=<client's am_profile_id>, priority='normal'
    -- open tasks = status NOT IN ('done','live') AND deleted_at IS NULL AND archived_at IS NULL
    -- completed this week = completed_at within the last 7 days

BUILD THESE FILES:

1. reporter/lib.py: shared helpers.
   - supabase client from SUPABASE_URL + SUPABASE_SERVICE_KEY
   - meta_insights(ad_account_id, since, until) -> spend, revenue, purchases, roas, cpa,
     impressions, clicks, ctr, plus top N ads by spend with name, roas, thumbnail_url
     (reuse the existing Meta code in this workspace)
   - trendtrak_highlights(trendtrak_ids, date) -> competitor notes (reuse existing code)
   - draft_with_claude(system, data_payload) calling model claude-sonnet-4-6, temperature 0.4.
     RULES for all client-facing copy: UK English, warm but concise, absolutely no em-dashes
     (hard company rule), and never invent a number -- every figure must come from the data
     payload, and if a figure is missing, omit that line rather than guess.

2. reporter/metrics_sync.py: daily. For each active client with meta_ad_account_id, pull
   yesterday's metrics + top 3 creatives + TrendTrak notes and UPSERT client_metrics_daily
   on (client_id, date). Idempotent. Support --since YYYY-MM-DD to backfill a range.

3. reporter/friday_report.py: per active client, gather last 7 days + month-to-date from
   client_metrics_daily (fetch live from Meta if rows are missing), top creatives, tasks
   completed this week and still-open tasks, unconsumed talking points, and targets from
   the clients row. Then produce TWO artifacts via draft_with_claude:
     (a) client_message: use EXACTLY this template, dropping any section with no data:

         Hey {first_name}, end of week update from the August team

         This week
         Spend: {spend} | Revenue: {revenue} | ROAS: {roas} (target {target_roas}) | CPA: {cpa}
         {one line on what drove performance}

         Winning creative
         {top creative name + one line on why it is winning}

         Done this week
         - {completed items}

         Next week
         - {planned tests / launches}

         Needs your input
         - {outstanding client-side actions. omit whole section if none}

         Next call: {meeting date/time if known}
         Any questions before the weekend, just message here.

     (b) draft_md: the INTERNAL brief. This is a separate document — more analytical, not
         shown to the client. It must contain:
           - MTD spend vs monthly_budget pacing (are we on track?)
           - 7-day ROAS vs target (are we hitting it?)
           - TrendTrak competitor moves (what are competitors testing?)
           - What we tested this week and why (from tasks + talking points)
           - What worked and why (from creative performance + Nick's principles)
           - What didn't and hypotheses for why
           - Health flags and any concerns
           - SUGGESTIONS section (see below)

         SUGGESTIONS section — this is the brain of the internal report. Before generating:
           1. Read the 5 most recent knowledge_base rows with source='nick_theriot'
              and the 3 most recent rows with source='research'.
           2. Use these as context. Nick Theriot's core principles (from his content):
              broad targeting (no audience restrictions), CBO campaigns, letting the algorithm
              find buyers, creative variation as the main lever, advantage+ placements,
              testing new creative angles weekly. Apply these as a lens when writing suggestions.
           3. Write 3-5 specific, actionable suggestions for next week grounded in:
              - This client's actual performance data
              - What Nick's recent content recommends
              - Current Meta best practices from research

         The internal brief is for Seb and the team only. Be direct, flag anything uncertain,
         and always link suggestions back to evidence.

   Insert one client_reports row (type='weekly_eow', status='pending_approval',
   period_start/period_end = the 7-day window, metrics = the frozen JSON you used,
   client_message = the WA-ready client message, draft_md = the internal brief).
   Then set consumed_by_report on the talking points you used. Send nothing anywhere.

4. reporter/monday_kickoff.py: per client, a short week-ahead message from open tasks + next
   scheduled meeting. Insert client_reports (type='monday_kickoff', status='pending_approval').

5. reporter/meeting_prep.py: find client_meetings that are 20-28h away with no prep_report_id.
   Build a prep brief (performance since last meeting, open actions, suggested agenda) and
   insert client_reports (type='meeting_prep', status='pending_approval'); set the meeting's
   prep_report_id to the new row.

6. reporter/post_meeting.py: find client_meetings with status='done', a transcript_id set,
   and no followup_report_id. Draft minutes + action items. Insert the action items as tasks
   (see tasks rules above, assignee = client's am_profile_id), draft a client follow-up
   message, insert client_reports (type='meeting_followup', status='pending_approval'), and
   set the meeting's followup_report_id.

7. reporter/setup_reporter_cron.sh: install macOS launchd jobs (StartCalendarInterval),
   logging to a logs/ dir, passing ALL env vars through the plist EnvironmentVariables:
     com.august.reporter.metrics        daily 06:00
     com.august.reporter.friday         Friday 12:00
     com.august.reporter.monday         Monday 07:30
     com.august.reporter.prep           hourly 08:00-18:00
     com.august.reporter.followup       every 15 minutes
     com.august.reporter.nick_theriot   daily 07:00  (runs nick_theriot_agent.py)
     com.august.reporter.research       Monday 07:30 (runs research_agent.py)

   NOTE: nick_theriot_agent.py and research_agent.py already exist in reporter/ in this
   repo on the OTHER machine. Copy them here or recreate them. They need:
     NICK_THERIOT_CHANNEL_ID in env (find the UC... channel ID from YouTube source)
     BRAVE_SEARCH_API_KEY (optional, for research_agent — improves search quality)

KNOWLEDGE BASE TABLE (already migrated in Supabase):
  knowledge_base (id, source, source_ref, title, content, tags[], published_at, ingested_at)
  Read with: supabase.table("knowledge_base").select("*").order("ingested_at", desc=True).limit(8).execute()
  Filter by source: .eq("source","nick_theriot") or .eq("source","research")

BEFORE installing any cron: run metrics_sync.py --since <14 days ago> for ONE client, then
friday_report.py --client <that id> --dry-run that prints both the client_message and the
draft_md to stdout WITHOUT inserting. Show me that dry-run output for approval first.
````
