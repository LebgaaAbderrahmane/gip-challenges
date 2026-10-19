/**
 * Test helpers for the Flash Sale API.
 */
import type { FastifyInstance } from 'fastify';

import { createDatabase, type ServiceConfig } from '@gip/service-core';

import { buildApp } from '../src/app.ts';
import { migrate } from '../src/db/migrate.ts';
import { products } from '../src/db/schema.ts';

export const TEST_SCHEMA = 'flash_sale_test';

export const TEST_SECRET = 'test-only-secret-value-that-is-long-enough-1234';

export function testConfig(overrides: Partial<ServiceConfig> = {}): ServiceConfig {
  return {
    nodeEnv: 'test',
    port: 0,
    host: '127.0.0.1',
    databaseUrl:
      process.env.TEST_DATABASE_URL ??
      'postgres://flash_sale_test_role:gip_local_dev_only@localhost:5433/gip',
    schema: TEST_SCHEMA,
    corsOrigins: ['http://localhost:5173'],
    jwtSecret: TEST_SECRET,
    jwtIssuer: 'gip-auth',
    jwtAudience: 'gip',
    jwtExpiresIn: '15m',
    rateLimitMax: 10_000,
    ...overrides,
  };
}

export async function buildTestApp(
  overrides: Partial<ServiceConfig> = {},
): Promise<FastifyInstance> {
  const config = testConfig(overrides);

  await migrate({ connectionString: config.databaseUrl, schema: config.schema });

  const database = createDatabase({
    connectionString: config.databaseUrl,
    schema: config.schema,
    tables: { products },
  });

  return buildApp({ config, database });
}

/** Empties the service's tables. */
export async function truncateAll(app: FastifyInstance): Promise<void> {
  await app.db.execute(
    `TRUNCATE TABLE ${TEST_SCHEMA}.orders, ${TEST_SCHEMA}.products RESTART IDENTITY CASCADE`,
  );
}

/** Inserts a product and returns it. */
export async function insertProduct(
  app: FastifyInstance,
  product: { name?: string; priceCents?: number; stock: number },
): Promise<{ id: string; stock: number; priceCents: number; name: string }> {
  const [row] = await app.db
    .insert(products)
    .values({
      name: product.name ?? 'Test product',
      description: 'A product for the tests.',
      priceCents: product.priceCents ?? 1_000,
      stock: product.stock,
    })
    .returning();

  return row;
}

/** The demo customer header, for a request with no token. */
export const demoCustomer = (id: string) => ({
  'x-demo-customer': id,
});
