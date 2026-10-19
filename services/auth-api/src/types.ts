/**
 * Type augmentation for the Fastify instance.
 */
import type { Database } from '@gip/service-core/db';
import type { ServiceConfig } from '@gip/service-core/config';
import type pg from 'pg';

declare module 'fastify' {
  interface FastifyInstance {
    /** The Drizzle client for this service's schema. */
    db: Database;
    /** The underlying connection pool. */
    pool: pg.Pool;
    /** The validated configuration for this service. */
    config: ServiceConfig;
  }
}

export {};
