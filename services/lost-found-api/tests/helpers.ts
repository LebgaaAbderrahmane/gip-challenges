/**
 * Test helpers.
 *
 * The integration tests run against a REAL PostgreSQL instance, in the
 * service's own test schema. Nothing is mocked: the schema is created, the
 * migrations are applied, and the tables are truncated between suites.
 */
import { SignJWT } from 'jose';
import type { FastifyInstance } from 'fastify';

import { createDatabase, type ServiceConfig } from '@gip/service-core';

import { buildApp } from '../src/app.ts';
import { itemReports } from '../src/db/schema.ts';
import { migrate } from '../src/db/migrate.ts';

export const TEST_SCHEMA = 'lost_found_test';

/** The secret used to sign and verify tokens in the tests. */
export const TEST_SECRET = 'test-only-secret-value-that-is-long-enough-1234';

export function testConfig(overrides: Partial<ServiceConfig> = {}): ServiceConfig {
  return {
    nodeEnv: 'test',
    port: 0,
    host: '127.0.0.1',
    databaseUrl:
      process.env.TEST_DATABASE_URL ??
      'postgres://gip:gip_local_dev_only@localhost:5433/gip',
    schema: TEST_SCHEMA,
    corsOrigins: ['http://localhost:5173'],
    jwtSecret: TEST_SECRET,
    jwtExpiresIn: '15m',
    ...overrides,
  };
}

/** Builds an app against the real test database. */
export async function buildTestApp(): Promise<FastifyInstance> {
  const config = testConfig();

  await migrate({ connectionString: config.databaseUrl, schema: config.schema });

  const database = createDatabase({
    connectionString: config.databaseUrl,
    schema: config.schema,
    tables: { itemReports },
  });

  return buildApp({ config, database });
}

/** Empties the service's tables, so each suite starts from a known state. */
export async function truncateAll(app: FastifyInstance): Promise<void> {
  await app.db.execute(
    `TRUNCATE TABLE ${TEST_SCHEMA}.item_reports RESTART IDENTITY CASCADE`,
  );
}

/** Signs a token for a user, the way the auth service would. */
export async function signToken(
  userId: string,
  options: { email?: string; expiresIn?: string } = {},
): Promise<string> {
  return new SignJWT({ email: options.email ?? `${userId}@example.test` })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer('gip-auth')
    .setAudience('gip')
    .setExpirationTime(options.expiresIn ?? '15m')
    .sign(new TextEncoder().encode(TEST_SECRET));
}

/** A valid report body. */
export function reportBody(overrides: Record<string, unknown> = {}) {
  return {
    type: 'lost',
    title: 'Black leather wallet',
    description: 'A black wallet with a zip pocket and a small scratch on the back.',
    category: 'bags',
    location: 'Central station, north entrance',
    eventDate: '2026-03-14T10:30:00.000Z',
    ...overrides,
  };
}
