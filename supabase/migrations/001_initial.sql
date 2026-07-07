-- Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- callers
CREATE TABLE IF NOT EXISTS callers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- call_leads
CREATE TABLE IF NOT EXISTS call_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT,
  niche TEXT,
  website TEXT,
  quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 10),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','no_answer','not_interested','callback','booked','closed','dead')),
  caller_id UUID REFERENCES callers(id) ON DELETE SET NULL,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- call_activity
CREATE TABLE IF NOT EXISTS call_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES call_leads(id) ON DELETE CASCADE,
  caller_id UUID REFERENCES callers(id) ON DELETE SET NULL,
  outcome TEXT NOT NULL
    CHECK (outcome IN ('dial','no_answer','not_interested','callback','positive','booked')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- bookings
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES call_leads(id) ON DELETE SET NULL,
  caller_id UUID REFERENCES callers(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  phone TEXT,
  call_time TIMESTAMPTZ,
  demo_url TEXT,
  prep_doc_url TEXT,
  status TEXT NOT NULL DEFAULT 'booked'
    CHECK (status IN ('booked','showed','no_show','closed','lost')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- deals
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES call_leads(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  tier TEXT NOT NULL CHECK (tier IN ('full_1995','website_950','custom')),
  setup_amount NUMERIC NOT NULL DEFAULT 0,
  monthly_amount NUMERIC NOT NULL DEFAULT 0,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('full','deposit','clearpay')),
  stripe_ref TEXT,
  status TEXT NOT NULL DEFAULT 'deposit_paid'
    CHECK (status IN ('deposit_paid','paid','live')),
  closed_at TIMESTAMPTZ DEFAULT NOW(),
  caller_id UUID REFERENCES callers(id) ON DELETE SET NULL
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER call_leads_updated_at
  BEFORE UPDATE ON call_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE callers ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Policies: all authenticated users can read/write
CREATE POLICY "auth_all_callers" ON callers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_call_leads" ON call_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_call_activity" ON call_activity FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_bookings" ON bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_deals" ON deals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_call_activity_created ON call_activity(created_at DESC);
CREATE INDEX idx_call_activity_caller ON call_activity(caller_id);
CREATE INDEX idx_call_leads_status ON call_leads(status);
CREATE INDEX idx_call_leads_caller ON call_leads(caller_id);
CREATE INDEX idx_bookings_status ON bookings(status);
