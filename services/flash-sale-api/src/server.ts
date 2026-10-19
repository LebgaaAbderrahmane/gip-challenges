/**
 * The development server.
 */
import { loadConfig, loadLocalEnv } from '@gip/service-core';

import { buildApp } from './app.ts';
import { migrate } from './db/migrate.ts';

async function main(): Promise<void> {
  /*
   * The local .env file, if this service has one. A variable already set in
   * the environment wins over the file, so this never overrides what the
   * hosting platform provides.
   */
  loadLocalEnv();

  let config;
  try {
    config = loadConfig(process.env, { schema: 'flash_sale', requireJwt: 'verify' });
  } catch (error) {
    console.error(`[config] ${error instanceof Error ? error.message : 'invalid configuration'}`);
    process.exit(1);
  }

  if (process.env.RUN_MIGRATIONS === 'true') {
    await migrate({ connectionString: config.databaseUrl, schema: config.schema });
  }

  const app = await buildApp({ config });

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info('docs available at /docs');
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
