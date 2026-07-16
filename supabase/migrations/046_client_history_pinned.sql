-- 046: pin important client_history entries to the top of the Timeline tab.
ALTER TABLE client_history ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;
