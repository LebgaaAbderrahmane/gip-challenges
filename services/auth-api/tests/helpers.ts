/**
 * Test helpers for the Authentication API.
 *
 * The integration tests run against a REAL PostgreSQL instance, in the
 * service's own test schema, with the same restricted role production uses.
 */
import type { FastifyInstance } from 'fastify';

import { createDatabase, type ServiceConfig } from '@gip/service-core';

import { buildApp } from '../src/app.ts';
import { migrate } from '../src/db/migrate.ts';
import { users } from '../src/db/schema.ts';

export const TEST_SCHEMA = 'auth_test';

/** The secret used to sign and verify tokens in the tests. */
export const TEST_SECRET = 'test-only-secret-value-that-is-long-enough-1234';

export function testConfig(overrides: Partial<ServiceConfig> = {}): ServiceConfig {
  return {
    nodeEnv: 'test',
    port: 0,
    host: '127.0.0.1',
    databaseUrl:
      process.env.TEST_DATABASE_URL ??
      'postgres://auth_test_role:gip_local_dev_only@localhost:5433/gip',
    schema: TEST_SCHEMA,
    corsOrigins: ['http://localhost:5173'],
    jwtSecret: TEST_SECRET,
    jwtIssuer: 'gip-auth',
    jwtAudience: 'gip',
    jwtExpiresIn: '15m',
    // The rate limit is generous here, so the suite is not throttled by its
    // own cases. The limiting itself is tested separately, with a low limit.
    rateLimitMax: 10_000,
    ...overrides,
  };
}

/**
 * Builds an app against the real test database.
 *
 * The overrides matter: a test that needs a low rate limit has to be able to
 * ask for one, or it can never reach the limit.
 */
export async function buildTestApp(
  overrides: Partial<ServiceConfig> = {},
): Promise<FastifyInstance> {
  const config = testConfig(overrides);

  await migrate({ connectionString: config.databaseUrl, schema: config.schema });

  const database = createDatabase({
    connectionString: config.databaseUrl,
    schema: config.schema,
    tables: { users },
  });

  return buildApp({ config, database });
}

export async function truncateAll(app: FastifyInstance): Promise<void> {
  await app.db.execute(`TRUNCATE TABLE ${TEST_SCHEMA}.users RESTART IDENTITY CASCADE`);
}

/** A password long enough to satisfy the policy. */
export const GOOD_PASSWORD = 'correct-horse-battery-staple';

/** Valid signup credentials. */
export const credentials = (overrides: Record<string, unknown> = {}) => ({
  email: 'ada@example.test',
  password: GOOD_PASSWORD,
  ...overrides,
});
