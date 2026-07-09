-- Add Instagram and Networking as pipeline source channels.
-- Also drops the unused Upwork option: it was never wired into the pipeline
-- API or UI (VALID_CHANNELS never allowed it), Upwork is tracked as its own
-- acquisition channel via the upwork_jobs table, and no pipeline_deals row
-- has ever been inserted with source_channel = 'upwork'.

ALTER TABLE pipeline_deals DROP CONSTRAINT IF EXISTS pipeline_deals_source_channel_check;
ALTER TABLE pipeline_deals ADD CONSTRAINT pipeline_deals_source_channel_check
  CHECK (source_channel IN ('cold_call','cold_email','linkedin','gov','referral','expansion','instagram','networking','other'));
