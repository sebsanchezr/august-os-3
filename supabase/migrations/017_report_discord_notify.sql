-- August OS v3: track Discord notification state on client_reports.
-- The Mac reporter inserts client_reports rows directly into Supabase
-- (bypassing this app), so there's no in-app POST route to hook a Discord
-- notification onto. Instead, a cron job (see app/api/cron/report-approvals)
-- polls for rows that haven't been announced yet and flips this timestamp
-- once notifyReportReady() has fired.

ALTER TABLE client_reports
  ADD COLUMN IF NOT EXISTS discord_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_client_reports_pending_unnotified
  ON client_reports (status, discord_notified_at)
  WHERE status = 'pending_approval' AND discord_notified_at IS NULL;
