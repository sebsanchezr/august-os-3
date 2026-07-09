-- Client aliases for calendar sync matching.
-- The team refers to clients by shorthand names that never match the
-- Google Calendar event title or the formal name stored in clients.name
-- (e.g. "Coffee" for Coffuel, "Desanti" for Disanti Studio). The calendar
-- sync cron (app/api/cron/calendar-sync/route.ts) was matching on exact
-- client name only, so almost every event silently failed to link. This
-- adds an aliases list per client so matching can check each shorthand as
-- a lowercased substring of the event title, in addition to the full name.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT '{}';

UPDATE clients SET aliases = ARRAY['coffee', 'coffuel']
  WHERE name ILIKE 'coffuel';

UPDATE clients SET aliases = ARRAY['amore', 'amour']
  WHERE name ILIKE 'amour et bijoux';

UPDATE clients SET aliases = ARRAY['desanti', 'disanti', 'desanti studio']
  WHERE name ILIKE 'disanti studio';

UPDATE clients SET aliases = ARRAY['lalingi', 'la lingi', 'lingi']
  WHERE name ILIKE 'l%alingi';

UPDATE clients SET aliases = ARRAY['liquidation', 'liquidation store', 'tls']
  WHERE name ILIKE 'liquidation store';

UPDATE clients SET aliases = ARRAY['lillys', 'lilly', 'lillys amsterdam']
  WHERE name ILIKE 'lilly%s amsterdam';

UPDATE clients SET aliases = ARRAY['kuick', 'quick cars', 'kuick cars', 'quickcars']
  WHERE name ILIKE 'kuick cars';
