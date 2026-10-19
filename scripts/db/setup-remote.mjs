/**
 * Sets up a hosted PostgreSQL instance for the three services.
 *
 * Creates the three schemas, the three restricted roles, and the test
 * schemas — the same layout the local Docker instance uses.
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm db:setup:remote
 *
 * The connection string needs enough privilege to create schemas and roles,
 * which is the case for a fresh Neon project's owner connection.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const initSql = readFileSync(join(here, 'db', 'init', '01-schemas.sql'), 'utf8');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

// The URL may contain credentials, so it is never printed.
const client = new pg.Client({ connectionString });

try {
  await client.connect();
  console.log('[setup] connected');

  await client.query(initSql);
  console.log('[setup] schemas and roles created');

  const { rows } = await client.query(`
    SELECT n.nspname AS schema
    FROM pg_namespace n
    WHERE n.nspname IN ('lost_found','lost_found_test','auth','auth_test','flash_sale','flash_sale_test')
    ORDER BY 1
  `);

  console.log(`[setup] ready: ${rows.map((r) => r.schema).join(', ')}`);
} catch (error) {
  console.error('[setup] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
