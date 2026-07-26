-- 055_media_assets.sql
-- Canonical library for assets produced by the media-gen engine (Fal.ai via the
-- workspace media-gen skill): statics now, video + upscales later. This is the
-- rich, searchable record. Statics are ALSO projected into
-- creative_strategy_outputs by the sync script so they render on the existing
-- /creatives grid without new UI; when a dedicated Library grid is built the
-- double-write can stop.

create table if not exists media_assets (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references clients(id) on delete set null,

  -- what it is
  kind          text not null default 'image',   -- image | video | upscale
  title         text,                             -- working title / concept
  ad_name       text,                             -- upload name, e.g. LS | Bundle | STA-ValueShock | V1 | 260726

  -- how it was made
  source        text not null default 'media-gen',-- media-gen | os-gemini
  model         text,                             -- registry key, e.g. nano-banana-pro
  fal_id        text,                             -- fal-ai/nano-banana-pro
  prompt        text,                             -- image / generation prompt
  motion_prompt text,                             -- video only
  aspect_ratio  text,
  resolution    text,
  duration_s    numeric,                          -- video only
  cost_usd      numeric,                          -- best-effort per-asset cost

  -- where it lives
  storage_path  text,                             -- path in the 'creatives' bucket
  public_url    text,                             -- public URL of the asset
  drive_file_id text,                             -- set on delivery
  drive_url     text,

  -- lifecycle + creative DNA
  status        text not null default 'draft',    -- draft | approved | delivered | live | killed
  tags          jsonb not null default '{}'::jsonb,-- {concept, angle, hook, format}

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists media_assets_client_idx on media_assets (client_id);
create index if not exists media_assets_status_idx on media_assets (status);
create index if not exists media_assets_kind_idx on media_assets (kind);
create index if not exists media_assets_created_idx on media_assets (created_at desc);
