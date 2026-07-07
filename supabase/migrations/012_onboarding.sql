-- Onboarding: state machine bridging Pipeline (closed won) to Accounts (handoff),
-- plus the welcome portal form and the first-week wins engine.
-- Signed unlocks the welcome portal; payment gates launch only (not the portal).

CREATE TABLE IF NOT EXISTS onboardings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID REFERENCES pipeline_deals(id) ON DELETE SET NULL,
  client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,
  company_name        TEXT NOT NULL,
  contact_name        TEXT,
  contact_email       TEXT NOT NULL,
  service             TEXT NOT NULL,
  fee_amount          NUMERIC NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'GBP',
  status              TEXT NOT NULL DEFAULT 'won'
    CHECK (status IN (
      'won','contract_sent','signed','form_completed','kickoff_booked',
      'kickoff_held','building','launched','handed_off'
    )),
  portal_token        TEXT UNIQUE NOT NULL,

  stripe_customer_id      TEXT,
  stripe_invoice_id       TEXT,
  stripe_invoice_url      TEXT,
  esign_document_id       TEXT,

  contract_sent_at    TIMESTAMPTZ,
  contract_signed_at  TIMESTAMPTZ,
  invoice_sent_at      TIMESTAMPTZ,
  invoice_paid_at      TIMESTAMPTZ,
  portal_opened_at    TIMESTAMPTZ,
  form_completed_at   TIMESTAMPTZ,
  kickoff_at          TIMESTAMPTZ,
  launched_at         TIMESTAMPTZ,
  handed_off_at       TIMESTAMPTZ,

  paid                BOOLEAN NOT NULL DEFAULT FALSE,
  health              TEXT NOT NULL DEFAULT 'green' CHECK (health IN ('green','amber','red')),
  internal_brief      TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS onboarding_forms (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id         UUID NOT NULL REFERENCES onboardings(id) ON DELETE CASCADE,
  business_overview     TEXT,
  target_audience       TEXT,
  brand_guidelines_url  TEXT,
  asset_links           TEXT,
  access_notes          TEXT,
  goals                 TEXT,
  primary_contact       TEXT,
  billing_contact       TEXT,
  timezone              TEXT,
  extra                 JSONB NOT NULL DEFAULT '{}',
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS onboarding_task_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service     TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  owner_role  TEXT,
  offset_days SMALLINT NOT NULL DEFAULT 0,
  phase       TEXT NOT NULL DEFAULT 'pre_kickoff' CHECK (phase IN ('pre_kickoff','build','launch')),
  sort        SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS client_wins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  onboarding_id UUID REFERENCES onboardings(id) ON DELETE SET NULL,
  win_text      TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('metrics','task','comms','manual')),
  day_index     SMALLINT,
  draft_message TEXT,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','sent','skipped')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS onboarding_id UUID REFERENCES onboardings(id) ON DELETE SET NULL;

ALTER TABLE onboardings ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_wins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_onboardings" ON onboardings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_onboarding_forms" ON onboarding_forms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_onboarding_task_templates" ON onboarding_task_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_client_wins" ON client_wins FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER onboardings_updated_at
  BEFORE UPDATE ON onboardings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_onboardings_status ON onboardings(status);
CREATE INDEX IF NOT EXISTS idx_onboardings_token ON onboardings(portal_token);
CREATE INDEX IF NOT EXISTS idx_onboardings_deal ON onboardings(deal_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_forms_onboarding ON onboarding_forms(onboarding_id);
CREATE INDEX IF NOT EXISTS idx_client_wins_client ON client_wins(client_id);
