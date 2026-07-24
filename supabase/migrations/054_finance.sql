-- Finance — owner-only consolidated monthly P&L
-- August OS v3: adds finance_transactions (categorized ledger across Tide +
-- Lillys/Revolut + Stripe) and finance_months (per-month summary + lock).
-- Access is owner-only at the APP layer (lib/access.ts FULL_ACCESS + the
-- requireOwner guard in lib/access-server.ts on /api/finance/*). RLS below is
-- the repo-standard authenticated policy; it does NOT enforce owner-only, so
-- the API guard is the real gate.
-- Money is GBP major units (pounds), matching clients.mrr / stripe.ts.

-- ─── Ledger ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS finance_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month        DATE NOT NULL,               -- first day of the P&L month, e.g. 2026-06-01
  txn_date     DATE,                         -- actual transaction date
  source       TEXT NOT NULL,                -- tide | revolut_lillys | stripe | cash | personal
  direction    TEXT NOT NULL DEFAULT 'out',  -- in | out
  category     TEXT NOT NULL,
  -- revenue | cost_of_sales | team | contractors | acquisition_tools |
  -- delivery_tools | overhead | regulatory | owner_drawings |
  -- internal_transfer | store_excluded
  treatment    TEXT NOT NULL,
  -- revenue | opex | drawings | eliminated | excluded (drives the P&L math)
  label        TEXT NOT NULL,
  counterparty TEXT,
  amount       NUMERIC NOT NULL,             -- GBP major units, always positive
  is_agency    BOOLEAN NOT NULL DEFAULT TRUE,-- false = Lillys store, carved out
  client_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
  flag         TEXT,                         -- open item to resolve
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Per-month summary + lock ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS finance_months (
  month             DATE PRIMARY KEY,        -- 2026-06-01
  status            TEXT NOT NULL DEFAULT 'draft', -- draft | final
  revenue_total     NUMERIC,
  cost_total        NUMERIC,
  operating_profit  NUMERIC,
  operating_margin  NUMERIC,                 -- profit / revenue, 0..1
  owner_drawings    NUMERIC,
  sustainable_draw  NUMERIC,                 -- = operating_profit
  narrative         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Row Level Security (standard authenticated policy; NOT owner-only) ──────

ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_months       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_finance_transactions" ON finance_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_finance_months"       ON finance_months       FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_finance_transactions_month    ON finance_transactions(month);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_source   ON finance_transactions(source);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_category ON finance_transactions(category);

-- ─── Seed: June 2026 (final, reconciled) ────────────────────────────────────
-- Source of truth: "AM Agency Workspace 2" finance/june_2026_pnl.md
-- Revenue £5,040 · real cost £2,401.77 · profit £2,638.23 (~52%) · drawings £3,500

INSERT INTO finance_months (month, status, revenue_total, cost_total, operating_profit, operating_margin, owner_drawings, sustainable_draw, narrative)
VALUES ('2026-06-01', 'final', 5040.00, 2401.77, 2638.23, 0.523, 3500.00, 2638.23,
  'June ran at ~52% operating margin on £5,040 real revenue. Business made ~£2,638; balances dipped only because drawings (£3,500) ran ~£860 ahead of profit. Open flags: classify Lillys Stripe £37.88. Instantly duplicate now cancelled on Lillys. AIB2B moved to £180/mo subscription. Family payroll treated as owner drawings (management view; tax filing is A1''s call).')
ON CONFLICT (month) DO NOTHING;

-- Revenue (treatment=revenue, direction=in)
INSERT INTO finance_transactions (month, txn_date, source, direction, category, treatment, label, counterparty, amount, is_agency, client_id) VALUES
  ('2026-06-01','2026-06-01','stripe','in','revenue','revenue','Liquidation Store retainer','Stripe charge',2400.00,true,(SELECT id FROM clients WHERE name ILIKE '%liquidation%' LIMIT 1)),
  ('2026-06-01','2026-06-01','stripe','in','revenue','revenue','L''alingi retainer','Stripe charge',1440.00,true,(SELECT id FROM clients WHERE name ILIKE '%alingi%' LIMIT 1)),
  ('2026-06-04','2026-06-04','revolut_lillys','in','revenue','revenue','DiSanti fee','O+A LABEL / DI SANTI ADS',1200.00,true,(SELECT id FROM clients WHERE name ILIKE '%santi%' LIMIT 1));

-- Cost of sales
INSERT INTO finance_transactions (month, txn_date, source, direction, category, treatment, label, counterparty, amount) VALUES
  ('2026-06-01','2026-06-04','stripe','out','cost_of_sales','opex','Stripe fees','Stripe',88.72);

-- Team & contractors
INSERT INTO finance_transactions (month, txn_date, source, direction, category, treatment, label, counterparty, amount) VALUES
  ('2026-06-01','2026-06-01','tide','out','team','opex','Taij (media buyer)','Taij Agginie-Elliott',708.00),
  ('2026-06-01','2026-06-02','tide','out','contractors','opex','Wise (overseas contractor)','TransferWise',287.33),
  ('2026-06-01','2026-06-17','tide','out','contractors','opex','Upwork','Upwork',84.29),
  ('2026-06-01','2026-06-01','revolut_lillys','out','contractors','opex','Gladys (VA)','Amadi Oluwaranmilowo Gladys',132.00);

-- Acquisition tools
INSERT INTO finance_transactions (month, txn_date, source, direction, category, treatment, label, counterparty, amount, notes) VALUES
  ('2026-06-01','2026-06-12','tide','out','acquisition_tools','opex','Apollo.io','Apollo.io',81.52,NULL),
  ('2026-06-01','2026-06-25','tide','out','acquisition_tools','opex','AIB2B','AIB2B Automation',102.00,'AI/token-bot build; now flat £180/mo subscription'),
  ('2026-06-01','2026-06-17','tide','out','acquisition_tools','opex','Instantly','Instantly',36.44,NULL),
  ('2026-06-01','2026-06-22','tide','out','acquisition_tools','opex','Beanstalk Consulting','Beanstalk',14.74,NULL),
  ('2026-06-01','2026-06-25','revolut_lillys','out','acquisition_tools','opex','AIB2B','AIB2B Automation',102.00,'AI/token-bot build; now flat £180/mo subscription'),
  ('2026-06-01','2026-06-05','revolut_lillys','out','acquisition_tools','opex','Whop (client acquisition)','Whop',72.21,NULL),
  ('2026-06-01','2026-06-17','revolut_lillys','out','acquisition_tools','opex','Instantly','Instantly',32.06,'Duplicate sub — now cancelled on Lillys'),
  ('2026-06-01','2026-06-04','revolut_lillys','out','acquisition_tools','opex','Million Verifier','Million Verifier',29.00,NULL),
  ('2026-06-01','2026-06-30','revolut_lillys','out','acquisition_tools','opex','Pre-warm Outlook','Pre-warm Outlook',12.55,NULL);

-- Delivery / AI tools
INSERT INTO finance_transactions (month, txn_date, source, direction, category, treatment, label, counterparty, amount) VALUES
  ('2026-06-01','2026-06-13','revolut_lillys','out','delivery_tools','opex','Anthropic (Claude)','Anthropic',308.61),
  ('2026-06-01','2026-06-16','tide','out','delivery_tools','opex','TrendTrack','TrendTrack',53.44),
  ('2026-06-01','2026-06-26','tide','out','delivery_tools','opex','Apify','Apify',35.60),
  ('2026-06-01','2026-06-16','tide','out','delivery_tools','opex','Webflow','Webflow',26.12),
  ('2026-06-01','2026-06-14','tide','out','delivery_tools','opex','CapCut','CapCut',21.99),
  ('2026-06-01','2026-06-30','revolut_lillys','out','delivery_tools','opex','Moonshot AI','Moonshot Ai Pte. Ltd.',3.93);

-- Overhead / regulatory
INSERT INTO finance_transactions (month, txn_date, source, direction, category, treatment, label, counterparty, amount) VALUES
  ('2026-06-01','2026-06-22','tide','out','overhead','opex','A1 Accountancy','A1 Accountancy',80.00),
  ('2026-06-01','2026-06-15','tide','out','overhead','opex','Virgin Media','Virgin Media',34.00),
  ('2026-06-01','2026-06-01','tide','out','overhead','opex','Tide fees','Tide',8.22),
  ('2026-06-01','2026-06-29','tide','out','regulatory','opex','ICO data-protection','Information Commissioner',47.00);

-- Owner drawings (family payroll + cash)
INSERT INTO finance_transactions (month, txn_date, source, direction, category, treatment, label, counterparty, amount) VALUES
  ('2026-06-01','2026-06-16','tide','out','owner_drawings','drawings','Family payroll — Panimbo (0001)','R Panimbo',350.00),
  ('2026-06-01','2026-06-16','tide','out','owner_drawings','drawings','Family payroll — Ordonez (0003)','J Ordonez Alvar',590.00),
  ('2026-06-01','2026-06-16','tide','out','owner_drawings','drawings','Family payroll — Alvarez (0004)','O Alvarez Mendoza',410.00),
  ('2026-06-01','2026-06-16','tide','out','owner_drawings','drawings','Family payroll — Ferreira (0005)','M Ferreira De Freitas',730.00),
  ('2026-06-01','2026-06-16','tide','out','owner_drawings','drawings','Family payroll — Espinoza (0006)','S Espinoza Herrera',360.00),
  ('2026-06-01','2026-06-16','tide','out','owner_drawings','drawings','Family payroll — Aristizabal (0006-AM)','S Aristizabal',560.00),
  ('2026-06-01','2026-06-25','tide','out','owner_drawings','drawings','Cash withdrawal','NatWest ATM',500.00);

-- Eliminated (internal transfer) + Lillys store carve-out (excluded from agency P&L)
INSERT INTO finance_transactions (month, txn_date, source, direction, category, treatment, label, counterparty, amount, is_agency, flag) VALUES
  ('2026-06-01','2026-06-01','revolut_lillys','out','internal_transfer','eliminated','Lilly''s + Amour internal transfer','August Spotlight Enterprise Ltd',58.00,true,NULL),
  ('2026-06-01','2026-06-01','revolut_lillys','in','store_excluded','excluded','Shopify store payouts','Shopify Inc',1445.01,false,NULL),
  ('2026-06-01','2026-06-23','revolut_lillys','out','store_excluded','excluded','Shopify store bill','Shopify',189.22,false,NULL),
  ('2026-06-01','2026-06-22','revolut_lillys','out','store_excluded','excluded','A1 (Lilly + house)','A1 Accountancy',70.00,false,NULL),
  ('2026-06-01','2026-06-09','revolut_lillys','out','store_excluded','excluded','GBP→EUR exchange','Revolut',6.00,false,NULL),
  ('2026-06-01','2026-06-23','revolut_lillys','out','store_excluded','excluded','Stripe MOS (unclassified)','Stripe',37.88,false,'Classify: Klaviyo/store or agency tool'),
  ('2026-06-01','2026-06-26','revolut_lillys','out','store_excluded','excluded','Revolut plan fee','Revolut',10.00,false,'Agency or store split');
