-- Bid document storage for gov contracts. gov_engine drafts bids as markdown
-- and renders them to PDF locally (gov_engine/bid_pdf.py); planning_notices.py
-- now uploads that PDF to Supabase Storage and stamps the path here so the OS
-- can show a "View bid PDF" link. Seb can also upload a revised PDF straight
-- from the OS (app/api/gov-contracts/bids/document/route.ts).

ALTER TABLE gov_tenders ADD COLUMN IF NOT EXISTS bid_document_path TEXT;

-- Private bucket: bid PDFs are confidential, so they're served via short
-- lived signed URLs (see the document API route) rather than public URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('gov-bid-documents', 'gov-bid-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_read_gov_bid_documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'gov-bid-documents');

CREATE POLICY "auth_write_gov_bid_documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'gov-bid-documents');

CREATE POLICY "auth_update_gov_bid_documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'gov-bid-documents')
  WITH CHECK (bucket_id = 'gov-bid-documents');
