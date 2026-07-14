-- Adds a contact email to pipeline_deals so acquisition prospects can hold the
-- address we email them at. Powers the "Send follow-up" action in the pipeline
-- deal drawer, which reads the last Gmail conversation with this address and
-- drafts a follow-up. Actual addresses live in the DB, never in source.

ALTER TABLE pipeline_deals ADD COLUMN IF NOT EXISTS contact_email TEXT;
