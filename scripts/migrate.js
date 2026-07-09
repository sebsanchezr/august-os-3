// Applies pending SQL files in supabase/migrations/ against DATABASE_URL.
// Tracks applied filenames in a _migrations table so re-runs (from either Mac) are safe.
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const dir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await client.query('SELECT filename FROM _migrations');
  const applied = new Set(rows.map(r => r.filename));
  const pending = files.filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log('No pending migrations.');
    await client.end();
    return;
  }

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`Applying ${file}...`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  OK`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  FAILED: ${err.message}`);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log(`Applied ${pending.length} migration(s).`);
}

main();
