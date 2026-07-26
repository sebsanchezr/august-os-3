-- 058_offer_orders.sql
-- Fulfilment queue for the PureScale $97 offer (10 ad creatives in 24h).
--
-- A buyer pays via Stripe, then submits the GHL intake form. GHL posts that form
-- to purescale /api/ghl-webhook, which inserts a row here. A Mac-side worker
-- (execution/offer_orders.py, driven by directives/fulfil_offer_order.md) claims
-- the row, onboards the brand (lightweight client record + Drive folder), builds
-- the 10 creatives with the media-gen engine, delivers to Drive, and completes it.
--
-- Distinct from creative_requests: that queue serves RETAINED clients from a client
-- profile in the OS. This one serves one-off $97 buyers who have no client record,
-- no ad-account access and no history — everything we know arrives on the form.
--
-- The SLA clock runs from created_at (intake submitted), NOT from payment: buyers
-- routinely pay and fill the form hours later, and we promise one business day of
-- knowing what to build.

create table if not exists offer_orders (
  id              uuid primary key default gen_random_uuid(),

  -- who bought
  brand_name      text not null,
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  ghl_contact_id  text,                               -- back-reference into the CRM

  -- what they told us on the intake form
  store_url       text,                               -- their shop (Shopify -> grab_shopify_products.py)
  best_ad_url     text,                               -- the control we must beat
  product_focus   text,                               -- hero product / what to feature
  monthly_ad_spend text,                              -- also the upsell qualifier
  notes           text,                               -- anything off-limits, brand rules

  -- lifecycle
  status          text not null default 'pending',    -- pending | processing | delivered | failed
  claimed_at      timestamptz,
  delivered_at    timestamptz,
  error           text,

  -- results
  client_id       uuid references clients(id) on delete set null,  -- lightweight record if created
  drive_folder_url text,
  result          jsonb not null default '{}'::jsonb, -- {media_asset_ids, drive_links, notes}

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists offer_orders_status_idx on offer_orders (status);
create index if not exists offer_orders_created_idx on offer_orders (created_at desc);
create index if not exists offer_orders_email_idx on offer_orders (contact_email);

-- Service-role only: the webhook and the worker both use the service key. No
-- anon/authenticated policies — buyer data must never be readable from a browser.
alter table offer_orders enable row level security;
