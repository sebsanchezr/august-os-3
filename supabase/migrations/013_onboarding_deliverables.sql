-- Adds the free-text Deliverables field captured on "Start Onboarding" and
-- merged into the contract's Statement of Work (Schedule 1). The contract's
-- Start Date is the date campaigns go live (an event, not a fixed date at
-- signing time) so there is no corresponding start_date column here.

ALTER TABLE onboardings
  ADD COLUMN IF NOT EXISTS deliverables TEXT;
