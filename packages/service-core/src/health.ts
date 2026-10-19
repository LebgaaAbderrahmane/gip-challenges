/**
 * The health endpoint.
 *
 * It reports the real state of the service, including whether the database
 * is reachable. A health check that only says "the process is alive" is
 * useless for deciding whether to send traffic.
 *
 * It never discloses credentials, host names, connection strings or stack
 * traces — only whether a dependency is healthy.
 */
import type { FastifyInstance } from 'fastify';

import { checkDatabase } from './db.ts';
import type pg from 'pg';

export interface HealthOptions {
  pool: pg.Pool;
  schema: string;
  service: string;
  version?: string;
}

export function registerHealth(app: FastifyInstance, options: HealthOptions): void {
  app.get('/health', async (_request, reply) => {
    const database = await checkDatabase(options.pool, options.schema);
    const healthy = database.ok;

    return reply.code(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      service: options.service,
      version: options.version ?? '1.0.0',
      database: healthy ? 'ok' : 'unavailable',
      uptimeSeconds: Math.round(process.uptime()),
    });
  });
}
