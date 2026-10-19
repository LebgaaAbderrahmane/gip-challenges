/**
 * The Lost & Found migration entry point.
 *
 * The runner itself is shared, in @gip/service-core, so the concurrency fix
 * lives in one place.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig, loadLocalEnv } from '@gip/service-core';
import { migrate as runMigrations } from '@gip/service-core/migrate';

// This file lives in src/db, so the migrations directory is two levels up.
const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
);

export async function migrate(options: {
  connectionString: string;
  schema: string;
}): Promise<void> {
  return runMigrations({
    connectionString: options.connectionString,
    schema: options.schema,
    migrationsDir,
  });
}

// Run directly: `pnpm --filter @gip/lost-found-api migrate`
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  loadLocalEnv();

  const config = loadConfig(process.env, { schema: 'lost_found', requireJwt: 'none' });
  migrate({ connectionString: config.databaseUrl, schema: config.schema }).catch((error) => {
    console.error('[migrate] failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
