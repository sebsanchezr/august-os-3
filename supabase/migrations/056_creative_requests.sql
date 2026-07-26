-- 056_creative_requests.sql
-- Intake queue for the "Create Creative Batch" button on a client profile.
-- The OS form writes a queued row (with any uploaded reference creatives + extra
-- context). A Mac-side worker following directives/generate_creative_batch.md
-- picks it up, pulls the client's Meta ad-account data + TrendTrack intel, uses
-- the reference, generates the creatives (media-gen), files them in media_assets,
-- and delivers to the client's organised Drive. The worker updates status/result.

create table if not exists creative_requests (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references clients(id) on delete cascade,
  requested_by  uuid,

  title         text,                                -- batch name, e.g. "Aug week 1 - beauty box"
  context       text,                                -- free-text brief / extra context from the form
  reference_paths jsonb not null default '[]'::jsonb, -- storage paths of uploaded reference creatives
  reference_urls  jsonb not null default '[]'::jsonb, -- public URLs of the same
  extra_links   jsonb not null default '[]'::jsonb,  -- extra Drive/reference folder links pasted in

  -- what to pull + produce
  pull_meta       boolean not null default true,     -- ingest the client's ad-account performance
  pull_trendtrack boolean not null default true,     -- ingest TrendTrack winning-ad / store intel
  count           int not null default 6,            -- how many creatives to make
  format          text not null default 'static',    -- static | video (video deferred)
  platform        text not null default 'Meta',      -- delivery platform subfolder

  -- lifecycle
  status        text not null default 'queued',      -- queued | processing | done | failed
  result        jsonb not null default '{}'::jsonb,  -- {media_asset_ids, drive_links, notes}
  error         text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists creative_requests_client_idx on creative_requests (client_id);
create index if not exists creative_requests_status_idx on creative_requests (status);
create index if not exists creative_requests_created_idx on creative_requests (created_at desc);
