-- Tracks whether each connected client ad account is readable server-side by the
-- OS Meta tokens. The meta-health cron writes this daily and pings the pulse
-- channel exactly once, when an account transitions unreadable -> readable
-- (i.e. access was just granted and server-side sync can now cover it). Avoids
-- nagging about accounts that are intentionally still on the Mac reporter.

create table if not exists meta_account_access (
  meta_ad_account_id text primary key,
  client_name        text,
  readable           boolean not null default false,
  first_readable_at  timestamptz,
  last_checked_at    timestamptz not null default now()
);
