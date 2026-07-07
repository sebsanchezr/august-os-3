-- Sales Calls: learning loop off every sales call transcript
-- Attached to pipeline_deals (prospects), not clients. Lifecycle: discovery call (1) -> pitch call (2) -> onboarding (3).

CREATE TABLE IF NOT EXISTS sales_calls (
  id                uuid primary key default gen_random_uuid(),
  deal_id           uuid not null references pipeline_deals(id) on delete cascade,
  call_type         text not null default 'discovery'
    check (call_type in ('discovery','pitch','followup','onboarding')),
  sequence          int not null default 1,
  status            text not null default 'scheduled'
    check (status in ('scheduled','held','analyzed','no_show','cancelled')),
  scheduled_at      timestamptz,
  held_at           timestamptz,
  duration_minutes  int,
  owner_profile_id  uuid references profiles(id) on delete set null,
  recording_url     text,
  deck_url          text,
  transcript        text,
  transcript_source text default 'manual' check (transcript_source in ('manual','drive')),
  drive_file_id     text unique,
  analysis          jsonb,
  outcome           text check (outcome in ('advanced','stalled','won','lost','rebook')),
  next_step         text,
  next_step_due     date,
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

ALTER TABLE sales_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_sales_calls" ON sales_calls FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER sales_calls_updated_at
  BEFORE UPDATE ON sales_calls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_sales_calls_deal ON sales_calls(deal_id);
CREATE INDEX IF NOT EXISTS idx_sales_calls_status ON sales_calls(status);
CREATE INDEX IF NOT EXISTS idx_sales_calls_owner ON sales_calls(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_sales_calls_scheduled ON sales_calls(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sales_calls_drive_file ON sales_calls(drive_file_id);
