/**
 * Type augmentation for the Fastify instance.
 *
 * The database handle and the pool are decorated onto the instance when the
 * app is built, so the route handlers can reach them. Declaring them here
 * means TypeScript knows about them everywhere.
 */
import type { Database } from '@gip/service-core/db';
import type pg from 'pg';

declare module 'fastify' {
  interface FastifyInstance {
    /** The Drizzle client for this service's schema. */
    db: Database;
    /** The underlying connection pool. */
    pool: pg.Pool;
  }
}

export {};
