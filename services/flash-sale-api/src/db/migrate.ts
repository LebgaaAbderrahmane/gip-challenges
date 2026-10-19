/**
 * The Flash Sale migration entry point.
 *
 * The runner itself is shared, in @gip/service-core, so the concurrency fix
 * lives in one place.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from '@gip/service-core';
import { migrate as runMigrations } from '@gip/service-core/migrate';

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

// Run directly: `pnpm --filter @gip/flash-sale-api migrate`
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  const config = loadConfig(process.env, { schema: 'flash_sale', requireJwt: 'none' });
  migrate({ connectionString: config.databaseUrl, schema: config.schema }).catch((error) => {
    console.error('[migrate] failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
