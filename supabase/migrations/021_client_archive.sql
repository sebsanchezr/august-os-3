-- 021_client_archive.sql
-- Soft-delete support for clients (accounts). Mirrors the tasks table convention:
-- records are never hard-deleted; archived_at is set instead and filtered out of lists.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_clients_archived_at ON clients(archived_at);
