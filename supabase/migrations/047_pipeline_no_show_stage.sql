-- Add 'no_show' stage to acquisition pipeline (booked call that no-showed / cancelled)
ALTER TABLE pipeline_deals DROP CONSTRAINT IF EXISTS pipeline_deals_stage_check;
ALTER TABLE pipeline_deals ADD CONSTRAINT pipeline_deals_stage_check
  CHECK (stage IN ('new','contacted','positive_reply','booked','showed','no_show','proposal','won','lost'));
