#!/usr/bin/env python3
"""
activate_meetings.py
One-time activation script for the Meetings + Communications module.

Steps:
  1. Runs migration 009 SQL against Supabase via the SQL API.
  2. Lists existing clients so we can match names.
  3. Seeds recurring client_meetings from the Google Calendar schedule.

Client schedule (from Seb, 2026-07-05):
  Lalingi:            Thursday 13:00 (weekly)
  Liquidation Store:  Tuesday  13:30 (weekly)
  Disanti Studio:     Thursday 14:00 (weekly)
  Coffuel:            Monday   15:00 (weekly)

Lillys Amsterdam and Amour et Bijoux are agency-owned brands -- skipped.

Usage:
  cd /Users/sebastiansanchez/dev/august_os_v3/cold_call_os
  python3 scripts/activate_meetings.py
"""

import os
import sys
from datetime import datetime, date, timedelta, timezone
from pathlib import Path

# Load .env.local
env_file = Path(__file__).resolve().parent.parent / ".env.local"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip().strip('"'))

def _ensure(pkg, import_name=None):
    try:
        __import__(import_name or pkg)
    except ImportError:
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet",
                               "--user", "--break-system-packages", pkg])

_ensure("supabase")
_ensure("requests")

import requests
from supabase import create_client

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── Migration 009 ────────────────────────────────────────────────────────────

MIGRATION_SQL = """
-- 009_meetings_comms.sql (idempotent)

ALTER TABLE client_meetings
  ADD COLUMN IF NOT EXISTS duration_minutes  INT         DEFAULT 30,
  ADD COLUMN IF NOT EXISTS attendees         JSONB       DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS minutes_md        TEXT,
  ADD COLUMN IF NOT EXISTS minutes_sent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prep_ready_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recurrence        TEXT,
  ADD COLUMN IF NOT EXISTS outcome_note      TEXT;

ALTER TABLE client_comms_log
  ADD COLUMN IF NOT EXISTS requires_response BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS response_due_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS responded_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_breached      BOOLEAN     DEFAULT FALSE;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS comms_sla JSONB;

ALTER TABLE meeting_transcripts
  ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES client_meetings(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS team_questions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question            TEXT        NOT NULL,
  context             TEXT        NOT NULL DEFAULT '',
  client_id           UUID        REFERENCES clients(id) ON DELETE SET NULL,
  meeting_id          UUID        REFERENCES client_meetings(id) ON DELETE SET NULL,
  task_id             UUID        REFERENCES tasks(id) ON DELETE SET NULL,
  asked_by            UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  target_profile_id   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  discord_message_id  TEXT,
  answer              TEXT,
  answered_by         UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  status              TEXT        NOT NULL DEFAULT 'open',
  asked_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at         TIMESTAMPTZ
);

ALTER TABLE team_questions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'auth_all_team_questions' AND tablename = 'team_questions'
  ) THEN
    CREATE POLICY "auth_all_team_questions" ON team_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_client_comms_sla_due    ON client_comms_log(response_due_at) WHERE responded_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_comms_breached   ON client_comms_log(sla_breached) WHERE sla_breached = TRUE;
CREATE INDEX IF NOT EXISTS idx_team_questions_status   ON team_questions(status);
CREATE INDEX IF NOT EXISTS idx_team_questions_client   ON team_questions(client_id);
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_mid ON meeting_transcripts(meeting_id);
"""


def run_migration():
    print("Running migration 009...", flush=True)
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers={
            "apikey":        SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type":  "application/json",
        },
        json={"query": MIGRATION_SQL},
        timeout=30,
    )
    if resp.status_code not in (200, 201, 204):
        # Supabase doesn't expose exec_sql on the REST API -- use pg_dump approach
        # Fall back: run each ALTER TABLE statement via the PostgREST SQL endpoint
        print(f"  exec_sql not available ({resp.status_code}) -- running DDL via psql workaround")
        return run_migration_via_statements()
    print("  Migration 009 applied.", flush=True)
    return True


def run_migration_via_statements():
    """
    Run the migration by splitting into individual statements and POSTing
    each to the Supabase SQL endpoint (available in management API or via direct DB access).
    Falls back to printing the SQL for manual paste if no direct access.
    """
    # Try management API
    project_ref = SUPABASE_URL.split("//")[1].split(".")[0]
    # The management API requires a personal access token (SUPABASE_ACCESS_TOKEN),
    # which is different from the service key. Try it first.
    pat = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
    if pat:
        resp = requests.post(
            f"https://api.supabase.com/v1/projects/{project_ref}/database/query",
            headers={
                "Authorization": f"Bearer {pat}",
                "Content-Type":  "application/json",
            },
            json={"query": MIGRATION_SQL},
            timeout=30,
        )
        if resp.status_code in (200, 201, 204):
            print("  Migration 009 applied via management API.", flush=True)
            return True
        print(f"  Management API returned {resp.status_code}: {resp.text[:200]}", flush=True)

    # Last resort: just verify the table is accessible (migration may already be applied)
    print("  Could not push migration automatically.", flush=True)
    print("  Please run this SQL in the Supabase SQL editor:", flush=True)
    print("  https://supabase.com/dashboard/project/rdrrbbvhprjmpuosusca/sql/new", flush=True)
    print("", flush=True)
    print("  (SQL is in: cold_call_os/supabase/migrations/009_meetings_comms.sql)", flush=True)
    print("", flush=True)
    return False


# ─── Meeting schedule ──────────────────────────────────────────────────────────

# day_of_week: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
CLIENT_SCHEDULE = [
    {"name_hint": "alingi",             "day": 3, "hour": 13, "minute": 0,  "type": "weekly"},
    {"name_hint": "liquidation",        "day": 1, "hour": 13, "minute": 30, "type": "weekly"},
    {"name_hint": "disanti",            "day": 3, "hour": 14, "minute": 0,  "type": "weekly"},
    {"name_hint": "coffuel",            "day": 0, "hour": 15, "minute": 0,  "type": "weekly"},
]

AGENCY_BRANDS = ["lillys amsterdam", "amour et bijoux"]


def next_weekday(day_of_week: int) -> date:
    """Return the date of the next occurrence of day_of_week from today (inclusive)."""
    today = date.today()
    days_ahead = day_of_week - today.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return today + timedelta(days=days_ahead)


def seed_meetings(clients: list[dict], migration_ok: bool = False) -> None:
    print("\nSeeding recurring client meetings...", flush=True)

    # Skip agency-owned brands
    active_clients = [
        c for c in clients
        if not any(brand in c["name"].lower() for brand in AGENCY_BRANDS)
    ]

    for schedule in CLIENT_SCHEDULE:
        hint = schedule["name_hint"].lower()
        matched = next(
            (c for c in active_clients if hint in c["name"].lower()),
            None
        )
        if not matched:
            print(f"  WARNING: No client found matching '{hint}' -- skipping", flush=True)
            continue

        # Check if any scheduled meeting already exists for this client
        existing = supabase.table("client_meetings") \
            .select("id, scheduled_at") \
            .eq("client_id", matched["id"]) \
            .eq("status", "scheduled") \
            .execute().data or []

        if existing:
            print(f"  {matched['name']}: already has {len(existing)} recurring meeting(s) -- skipping", flush=True)
            continue

        # Compute next occurrence
        next_date = next_weekday(schedule["day"])
        scheduled_at = datetime(
            next_date.year, next_date.month, next_date.day,
            schedule["hour"], schedule["minute"], 0,
            tzinfo=timezone.utc,
        ).isoformat()

        row = {
            "client_id":    matched["id"],
            "type":         schedule["type"],
            "scheduled_at": scheduled_at,
            "status":       "scheduled",
        }
        # Include new columns only if migration 009 has been applied
        if migration_ok:
            row["recurrence"]       = "weekly"
            row["duration_minutes"] = 30
            row["attendees"]        = []

        result = supabase.table("client_meetings").insert(row).execute()
        if result.data:
            day_name = ["Mon", "Tue", "Wed", "Thu", "Fri"][schedule["day"]]
            print(f"  Created: {matched['name']} -- {day_name} {schedule['hour']:02d}:{schedule['minute']:02d} UK (weekly, first: {next_date})", flush=True)
        else:
            print(f"  ERROR inserting meeting for {matched['name']}", flush=True)


def main():
    print("=== August OS Meetings + Communications Activation ===\n", flush=True)

    # Step 1: migration
    migration_ok = run_migration()

    # Step 2: fetch active clients
    print("\nFetching active clients...", flush=True)
    result = supabase.table("clients").select("id, name, status").eq("status", "active").execute()
    clients = result.data or []

    if not clients:
        print("  No active clients found. Add clients first then re-run.", flush=True)
        sys.exit(1)

    print(f"  Found {len(clients)} active clients:", flush=True)
    for c in clients:
        flag = " (agency brand - will skip)" if any(b in c["name"].lower() for b in AGENCY_BRANDS) else ""
        print(f"    - {c['name']}{flag}", flush=True)

    # Step 3: seed meetings
    seed_meetings(clients, migration_ok=migration_ok)

    # Step 4: install cron jobs
    print("\n=== Cron setup ===", flush=True)
    cron_script = Path(__file__).resolve().parent.parent.parent / "lead_pipeline" / "scripts" / "setup_meetings_cron.sh"
    env_file_root = Path(__file__).resolve().parent.parent.parent / ".env"

    if env_file_root.exists():
        print(f"  .env found at {env_file_root}", flush=True)
    else:
        print(f"  Creating .env at {env_file_root} for cron scripts...", flush=True)
        env_content = f"""NEXT_PUBLIC_SUPABASE_URL={SUPABASE_URL}
SUPABASE_SERVICE_KEY={SUPABASE_KEY}
DISCORD_ACCOUNTS_WEBHOOK_URL={os.environ.get('DISCORD_ACCOUNTS_WEBHOOK_URL', '')}
DISCORD_TASKS_WEBHOOK_URL={os.environ.get('DISCORD_TASKS_WEBHOOK_URL', '')}
AGENT_INBOUND_KEY={os.environ.get('AGENT_INBOUND_KEY', '')}
OS_URL=https://augustosv3.vercel.app
"""
        env_file_root.write_text(env_content)
        print(f"  Written. Fill in Discord webhook URLs if not already set.", flush=True)

    print(f"\n  To install cron jobs, run:", flush=True)
    print(f"    bash {cron_script}", flush=True)

    if not migration_ok:
        print("\n  IMPORTANT: Push migration 009 manually before the crons will work.", flush=True)

    print("\n=== Done ===\n", flush=True)


if __name__ == "__main__":
    main()
