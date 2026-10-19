/**
 * The migration runner.
 *
 * Migrations are plain SQL files applied in order and recorded in a
 * migrations table, so running them twice is safe. The service owns its
 * schema and nothing else — it never touches another service's tables.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { loadConfig } from '@gip/service-core';

// This file lives in src/db, so the migrations directory is two levels up.
const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
);

export async function migrate(options: { connectionString: string; schema: string }): Promise<void> {
  const client = new pg.Client({ connectionString: options.connectionString });
  await client.connect();

  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${options.schema}`);

    // The search path decides where unqualified CREATE statements land.
    // Without this the enum types would be created in "public" instead of in
    // the schema this service owns.
    await client.query(`SET search_path TO ${options.schema}, public`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${options.schema}.migrations (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const applied = new Set(
      (
        await client.query(`SELECT name FROM ${options.schema}.migrations`)
      ).rows.map((row: { name: string }) => row.name),
    );

    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = await readFile(join(migrationsDir, file), 'utf8');

      // The migration and its record are applied together, so a failure
      // cannot leave a half-applied migration marked as done.
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO ${options.schema}.migrations (name) VALUES ($1)`,
          [file],
        );
        await client.query('COMMIT');
        console.log(`[migrate] applied ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log(`[migrate] ${options.schema} is up to date (${files.length} migration(s))`);
  } finally {
    await client.end();
  }
}

// Run directly: `pnpm --filter @gip/lost-found-api migrate`
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  const config = loadConfig(process.env, { schema: 'lost_found', requireJwt: 'none' });
  migrate({ connectionString: config.databaseUrl, schema: config.schema }).catch((error) => {
    console.error('[migrate] failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
