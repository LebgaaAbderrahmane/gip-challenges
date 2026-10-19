/**
 * The rate limit is a security control, not just a configuration value, so it
 * is tested with a limit low enough to reach.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildTestApp, credentials, truncateAll } from './helpers.ts';

let app: FastifyInstance;

beforeAll(async () => {
  // A limit of 3, so the fourth attempt is refused.
  app = await buildTestApp({ rateLimitMax: 3 });
});

afterAll(async () => {
  await app?.close();
});

describe('rate limiting', () => {
  it('refuses further attempts once the limit is reached', async () => {
    await truncateAll(app);

    const attempts: number[] = [];
    for (let i = 0; i < 5; i++) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: credentials(),
      });
      attempts.push(response.statusCode);
    }

    // The first attempts are refused as invalid credentials, and the later
    // ones as rate limited.
    expect(attempts).toContain(429);
    expect(attempts[attempts.length - 1]).toBe(429);
  });

  it('reports a rate limit with the standard envelope', async () => {
    await truncateAll(app);

    let body: unknown;
    for (let i = 0; i < 5; i++) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: credentials(),
      });
      if (response.statusCode === 429) {
        body = response.json();
        break;
      }
    }

    expect(body).toMatchObject({
      error: { code: 'RATE_LIMITED' },
    });
  });
});
