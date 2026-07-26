-- 057_creative_suggestions.sql
-- Data-driven "make this next" creative suggestions shown in the OS Creatives tab
-- when someone opens Create Creative Batch. Populated by the winning-ad analysis
-- flow (execution/analyze_winning_ads.py + execution/creative_suggestions.py):
-- each suggestion is grounded in a real signal (a proven winning format/angle from
-- the ad account or a long-running competitor), so the team is nudged toward
-- likely next winners, not random ideas.

create table if not exists creative_suggestions (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,

  title       text not null,               -- short suggestion, e.g. "Native unboxing static"
  angle       text,                         -- concept/angle
  format      text,                         -- native-ugc | static | video | ...
  rationale   text,                         -- why, in one or two sentences (the data receipt)
  evidence    jsonb not null default '{}'::jsonb, -- {source, winning_ad, roas, days_running, hook_rate}
  priority    int not null default 0,        -- higher shows first

  status      text not null default 'active',-- active | dismissed | used
  created_at  timestamptz not null default now()
);

create index if not exists creative_suggestions_client_idx on creative_suggestions (client_id);
create index if not exists creative_suggestions_status_idx on creative_suggestions (status);
