-- Backfill the real UI/UX updates that shipped since 8 Jul (the Updates page
-- had only auto-digest rows after that date, and the digest is no longer shown
-- there). Each row is guarded by title so re-runs do not duplicate. Dates are
-- approximate, spaced across the period the work landed.
INSERT INTO os_updates (title, description, tag, created_at)
SELECT * FROM (VALUES
  ('Ads, Creatives, Websites and Fulfilment sections added',
   'Four new sections in the side menu: run paid ads, manage creatives, track website builds and see fulfilment at a glance, all inside the OS.',
   'New', NOW() - INTERVAL '4 days'),
  ('Creative image generation engine',
   'Generate static ad creatives on demand from a brief, plus data-driven recommendations that turn last week''s performance into the next concepts to test.',
   'New', NOW() - INTERVAL '3 days'),
  ('New-client modal',
   'Add a client straight from the accounts grid with a quick modal instead of the old multi-step flow.',
   'Improved', NOW() - INTERVAL '3 days'),
  ('"Sent for Approval" status for creative tasks',
   'Creative tasks now have a Sent for Approval stage between Revision and Approved, so it is clear what is waiting on the client.',
   'Improved', NOW() - INTERVAL '2 days'),
  ('Cleaner side menu',
   'Section headers use monochrome icons and sub-items are pared back, so the navigation reads calmer and faster to scan.',
   'Improved', NOW() - INTERVAL '2 days'),
  ('Team SOP guide page',
   'A new /sop/os-guide page: the operating manual for how the whole OS is run, linked from the menu.',
   'New', NOW() - INTERVAL '1 day'),
  ('Recurring team meetings on the Meetings page',
   'The Meetings hub now shows the standing weekly calls (team priorities, Coffuel, Liquidation Store, Disanti Studio) instead of just one, so the week ahead is always populated.',
   'Improved', NOW() - INTERVAL '2 hours'),
  ('Completed tasks show a green due date',
   'On the Tasks list, a task marked completed now shows its due date in green like a live one, instead of staying red when it is past due.',
   'Fix', NOW() - INTERVAL '1 hour'),
  ('Completed tasks auto-archive after 7 days',
   'Finished tasks now clear off the board a week after completion (was 14 days), so the active views stay focused on live work. Nothing is deleted, everything is restorable from the Archive.',
   'Improved', NOW() - INTERVAL '30 minutes')
) AS v(title, description, tag, created_at)
WHERE NOT EXISTS (SELECT 1 FROM os_updates o WHERE o.title = v.title);
