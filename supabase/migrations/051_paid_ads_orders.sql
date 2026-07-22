-- $97 Paid Ads orders: track fulfilment status for purescale_97_order rows.
-- Orders come in from the PureScale /ads landing page (adcreatives-lp) into
-- ce_website_forms with source='purescale_97_order'. These columns let the OS
-- Paid Ads tab (and the landing page order tracker) show delivery status.

ALTER TABLE ce_website_forms ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE ce_website_forms ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
