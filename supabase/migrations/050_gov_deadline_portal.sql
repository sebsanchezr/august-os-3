-- Gov Contracts: submission deadline + portal fields.
-- The engine now captures a tender's submission deadline and the portal URL a
-- bid must be submitted through (with a coarse portal_kind classifier). These
-- surface in the Bid Manager cockpit so every actionable tender shows when and
-- where to submit. All three are nullable: renewal plays have no deadline and
-- older rows predate portal extraction.
ALTER TABLE gov_tenders ADD COLUMN IF NOT EXISTS deadline    DATE;
ALTER TABLE gov_tenders ADD COLUMN IF NOT EXISTS portal      TEXT;
ALTER TABLE gov_tenders ADD COLUMN IF NOT EXISTS portal_kind TEXT;

CREATE INDEX IF NOT EXISTS idx_gov_tenders_deadline ON gov_tenders(deadline);
