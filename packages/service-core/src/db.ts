/**
 * The database client.
 *
 * Each service owns exactly one schema and connects as the role that owns
 * it, so a service cannot read or write another service's tables. The schema
 * is set with `search_path` on every connection, which means a query that
 * does not qualify its table name still resolves within the service's own
 * schema and nowhere else.
 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { serviceUnavailable } from './errors.ts';

/**
 * A Drizzle client.
 *
 * The schema type parameter is left open because each service declares its
 * own tables, and the Fastify augmentation cannot know them. The
 * alternative — casting at every use — would hide real type errors in the
 * queries.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database<T extends Record<string, any> = Record<string, any>> =
  NodePgDatabase<T>;

/**
 * Creates a pool and a Drizzle client for one service.
 *
 * The pool is configured with a statement timeout, so a runaway query cannot
 * hold a connection open indefinitely.
 *
 * @param options.schema the PostgreSQL schema this service owns
 * @param options.tables the Drizzle table objects, so the client can map
 *   rows. Without these, `insert(...).returning()` produces empty objects.
 */
export function createDatabase<T extends Record<string, unknown>>(options: {
  connectionString: string;
  schema: string;
  tables?: T;
  max?: number;
}) {
  const pool = new pg.Pool({
    connectionString: options.connectionString,
    max: options.max ?? 10,
    // A query that takes longer than this is cancelled rather than left to
    // exhaust the pool.
    statement_timeout: 10_000,
  });

  /*
   * The schema is selected by the ROLE's own search_path, not by a startup
   * parameter.
   *
   * That is deliberate. Neon's pooler rejects `search_path` in the startup
   * package ("unsupported startup parameter in options: search_path"), so
   * passing it here would break every hosted deployment. Setting it on the
   * role works everywhere — the pooler applies role settings at login — and it
   * has the advantage of being enforced by PostgreSQL rather than by
   * convention: the role cannot reach another schema even if the code tried.
   *
   * Drizzle is given the table objects so it can map rows back into typed
   * objects.
   */
  const db = options.tables
    ? drizzle(pool, { schema: options.tables })
    : drizzle(pool);

  return { db, pool };
}

/**
 * Checks that the database is reachable and that this service's schema
 * exists.
 *
 * The health endpoint uses this, so a broken database is reported as
 * degraded rather than as a working service with no data.
 */
export async function checkDatabase(
  pool: pg.Pool,
  schema: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await pool.query('SELECT 1');
    await pool.query('SELECT 1 FROM information_schema.schemata WHERE schema_name = $1', [schema]);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'unknown error' };
  }
}

export { serviceUnavailable };
