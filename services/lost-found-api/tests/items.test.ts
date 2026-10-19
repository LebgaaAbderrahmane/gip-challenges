/**
 * Integration tests for the Lost & Found API.
 *
 * These run against a real PostgreSQL instance. The application is the real
 * one — the only thing replaced is the server, and the requests go through
 * Fastify's inject, which exercises the full stack: routing, validation,
 * authentication, the database and the error handler.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';

import { buildTestApp, reportBody, signToken, truncateAll, TEST_SECRET } from './helpers.ts';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await app?.close();
});

beforeEach(async () => {
  await truncateAll(app);
});

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

describe('POST /api/items', () => {
  it('creates a report and returns it', async () => {
    const token = await signToken('user-1');

    const response = await app.inject({
      method: 'POST',
      url: '/api/items',
      headers: auth(token),
      payload: reportBody(),
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.id).toBeTruthy();
    expect(body.title).toBe('Black leather wallet');
    expect(body.status).toBe('open');
    // The owner comes from the token, never from the body.
    expect(body.ownerId).toBe('user-1');
  });

  it('takes the owner from the token and ignores any owner in the body', async () => {
    const token = await signToken('real-owner');

    const response = await app.inject({
      method: 'POST',
      url: '/api/items',
      headers: auth(token),
      payload: { ...reportBody(), ownerId: 'someone-else' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().ownerId).toBe('real-owner');
  });

  it('requires a token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/items',
      payload: reportBody(),
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a token signed with the wrong key', async () => {
    const forged = await new SignJWT({ email: 'attacker@example.test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('attacker')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode('a-completely-different-secret-value-1234'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/items',
      headers: auth(forged),
      payload: reportBody(),
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects an expired token', async () => {
    const expired = await signToken('user-1', { expiresIn: '-1m' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/items',
      headers: auth(expired),
      payload: reportBody(),
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects a token that names a different algorithm', async () => {
    // The `alg: none` attack: a token claiming it needs no signature.
    const none = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }) +
        '.' +
        Buffer.from(JSON.stringify({ sub: 'attacker' })).toString('base64url'),
    ).toString('base64url');

    const response = await app.inject({
      method: 'POST',
      url: '/api/items',
      headers: auth(none),
      payload: reportBody(),
    });

    expect(response.statusCode).toBe(401);
  });

  it.each([
    ['a missing title', { title: undefined }],
    ['an empty title', { title: '   ' }],
    ['a missing description', { description: undefined }],
    ['an invalid type', { type: 'stolen' }],
    ['a missing location', { location: undefined }],
    ['an invalid date', { eventDate: 'not-a-date' }],
  ])('rejects %s', async (_label, override) => {
    const token = await signToken('user-1');
    const payload = reportBody();
    for (const [key, value] of Object.entries(override)) {
      if (value === undefined) delete (payload as Record<string, unknown>)[key];
      else (payload as Record<string, unknown>)[key] = value;
    }

    const response = await app.inject({
      method: 'POST',
      url: '/api/items',
      headers: auth(token),
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a title longer than the limit', async () => {
    const token = await signToken('user-1');
    const response = await app.inject({
      method: 'POST',
      url: '/api/items',
      headers: auth(token),
      payload: reportBody({ title: 'x'.repeat(200) }),
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /api/items', () => {
  const seed = async (count: number, owner = 'user-1') => {
    const token = await signToken(owner);
    for (let i = 0; i < count; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/items',
        headers: auth(token),
        payload: reportBody({ title: `Item ${i}`, location: `Place ${i}` }),
      });
    }
  };

  it('lists reports with a pagination envelope', async () => {
    await seed(3);

    const response = await app.inject({ method: 'GET', url: '/api/items' });
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.data).toHaveLength(3);
    expect(body.pagination).toMatchObject({ page: 1, limit: 20, total: 3 });
  });

  it('paginates', async () => {
    await seed(5);

    const first = await app.inject({ method: 'GET', url: '/api/items?page=1&limit=2' });
    expect(first.json().data).toHaveLength(2);
    expect(first.json().pagination).toMatchObject({ page: 1, limit: 2, total: 5, totalPages: 3 });

    const last = await app.inject({ method: 'GET', url: '/api/items?page=3&limit=2' });
    expect(last.json().data).toHaveLength(1);
  });

  it('rejects a limit above the maximum', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/items?limit=1000' });
    expect(response.statusCode).toBe(400);
  });

  it('filters by type', async () => {
    const token = await signToken('user-1');
    await app.inject({
      method: 'POST', url: '/api/items', headers: auth(token),
      payload: reportBody({ type: 'lost', title: 'A lost key' }),
    });
    await app.inject({
      method: 'POST', url: '/api/items', headers: auth(token),
      payload: reportBody({ type: 'found', title: 'A found key' }),
    });

    const lost = await app.inject({ method: 'GET', url: '/api/items?type=lost' });
    expect(lost.json().data).toHaveLength(1);
    expect(lost.json().data[0].title).toBe('A lost key');
  });

  it('filters by category', async () => {
    const token = await signToken('user-1');
    await app.inject({
      method: 'POST', url: '/api/items', headers: auth(token),
      payload: reportBody({ category: 'electronics' }),
    });
    await app.inject({
      method: 'POST', url: '/api/items', headers: auth(token),
      payload: reportBody({ category: 'keys' }),
    });

    const response = await app.inject({ method: 'GET', url: '/api/items?category=keys' });
    expect(response.json().data).toHaveLength(1);
    expect(response.json().data[0].category).toBe('keys');
  });

  it('searches the title, description and location', async () => {
    const token = await signToken('user-1');
    await app.inject({
      method: 'POST', url: '/api/items', headers: auth(token),
      payload: reportBody({ title: 'Umbrella', description: 'Blue and folding', location: 'Library' }),
    });

    expect((await app.inject({ method: 'GET', url: '/api/items?q=umbrella' })).json().data).toHaveLength(1);
    expect((await app.inject({ method: 'GET', url: '/api/items?q=folding' })).json().data).toHaveLength(1);
    expect((await app.inject({ method: 'GET', url: '/api/items?q=library' })).json().data).toHaveLength(1);
    expect((await app.inject({ method: 'GET', url: '/api/items?q=zzz' })).json().data).toHaveLength(0);
  });

  it('does not let a wildcard in the search match everything', async () => {
    const token = await signToken('user-1');
    await app.inject({
      method: 'POST', url: '/api/items', headers: auth(token),
      payload: reportBody({ title: 'Wallet' }),
    });

    const response = await app.inject({ method: 'GET', url: '/api/items?q=%25' });
    expect(response.json().data).toHaveLength(0);
  });

  it('sorts by the requested field and direction', async () => {
    const token = await signToken('user-1');
    await app.inject({
      method: 'POST', url: '/api/items', headers: auth(token),
      payload: reportBody({ title: 'A', eventDate: '2026-01-01T00:00:00.000Z' }),
    });
    await app.inject({
      method: 'POST', url: '/api/items', headers: auth(token),
      payload: reportBody({ title: 'B', eventDate: '2026-06-01T00:00:00.000Z' }),
    });

    const ascending = await app.inject({
      method: 'GET', url: '/api/items?sort=eventDate&direction=asc',
    });
    expect(ascending.json().data.map((r: { title: string }) => r.title)).toEqual(['A', 'B']);

    const descending = await app.inject({
      method: 'GET', url: '/api/items?sort=eventDate&direction=desc',
    });
    expect(descending.json().data.map((r: { title: string }) => r.title)).toEqual(['B', 'A']);
  });
});

describe('GET /api/items/:id', () => {
  it('returns a report', async () => {
    const token = await signToken('user-1');
    const created = await app.inject({
      method: 'POST', url: '/api/items', headers: auth(token), payload: reportBody(),
    });
    const { id } = created.json();

    const response = await app.inject({ method: 'GET', url: `/api/items/${id}` });
    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(id);
  });

  it('returns 404 for an unknown id', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/items/00000000-0000-4000-8000-000000000000',
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('rejects an id that is not a uuid', async () => {
    // The parameter is validated as a UUID, so a malformed id is a client
    // error rather than a missing resource.
    const response = await app.inject({ method: 'GET', url: '/api/items/not-a-uuid' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/items/:id', () => {
  it('lets the owner update their report', async () => {
    const token = await signToken('owner-1');
    const created = await app.inject({
      method: 'POST', url: '/api/items', headers: auth(token), payload: reportBody(),
    });
    const { id } = created.json();

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/items/${id}`,
      headers: auth(token),
      payload: { title: 'Updated title' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().title).toBe('Updated title');
  });

  it('refuses to let another user update the report', async () => {
    const ownerToken = await signToken('owner-1');
    const created = await app.inject({
      method: 'POST', url: '/api/items', headers: auth(ownerToken), payload: reportBody(),
    });
    const { id } = created.json();

    const intruderToken = await signToken('someone-else');
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/items/${id}`,
      headers: auth(intruderToken),
      payload: { title: 'Hijacked' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('requires a token', async () => {
    const token = await signToken('owner-1');
    const created = await app.inject({
      method: 'POST', url: '/api/items', headers: auth(token), payload: reportBody(),
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/items/${created.json().id}`,
      payload: { title: 'No token' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects an empty update', async () => {
    const token = await signToken('owner-1');
    const created = await app.inject({
      method: 'POST', url: '/api/items', headers: auth(token), payload: reportBody(),
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/items/${created.json().id}`,
      headers: auth(token),
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it('validates the fields it does update', async () => {
    const token = await signToken('owner-1');
    const created = await app.inject({
      method: 'POST', url: '/api/items', headers: auth(token), payload: reportBody(),
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/items/${created.json().id}`,
      headers: auth(token),
      payload: { title: '' },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('PATCH /api/items/:id/recover', () => {
  it('lets the owner mark the report recovered', async () => {
    const token = await signToken('owner-1');
    const created = await app.inject({
      method: 'POST', url: '/api/items', headers: auth(token), payload: reportBody(),
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/items/${created.json().id}/recover`,
      headers: auth(token),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('recovered');
  });

  it('refuses to let another user recover the report', async () => {
    const ownerToken = await signToken('owner-1');
    const created = await app.inject({
      method: 'POST', url: '/api/items', headers: auth(ownerToken), payload: reportBody(),
    });

    const intruderToken = await signToken('someone-else');
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/items/${created.json().id}/recover`,
      headers: auth(intruderToken),
    });

    expect(response.statusCode).toBe(403);
  });

  it('rejects recovering a report twice', async () => {
    const token = await signToken('owner-1');
    const created = await app.inject({
      method: 'POST', url: '/api/items', headers: auth(token), payload: reportBody(),
    });
    const id = created.json().id;

    await app.inject({
      method: 'PATCH', url: `/api/items/${id}/recover`, headers: auth(token),
    });
    const second = await app.inject({
      method: 'PATCH', url: `/api/items/${id}/recover`, headers: auth(token),
    });

    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('INVALID_STATE');
  });
});

describe('GET /health', () => {
  it('reports the real state, including the database', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      service: 'lost-found-api',
      database: 'ok',
    });
  });

  it('discloses no credentials or connection details', async () => {
    const body = (await app.inject({ method: 'GET', url: '/health' })).body;
    expect(body).not.toContain(TEST_SECRET);
    expect(body).not.toContain('postgres://');
    expect(body).not.toContain('5433');
  });
});

describe('the OpenAPI document', () => {
  it('describes every route', async () => {
    const response = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(response.statusCode).toBe(200);

    const paths = Object.keys(response.json().paths);
    expect(paths).toContain('/api/items');
    expect(paths).toContain('/api/items/{id}');
    expect(paths).toContain('/api/items/{id}/recover');
    expect(paths).toContain('/health');
  });

  it('documents the bearer security scheme', async () => {
    const response = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(response.json().components.securitySchemes).toHaveProperty('bearerAuth');
  });
});

describe('error handling', () => {
  it('returns a consistent envelope for an unknown route', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toHaveProperty('error.code');
    expect(response.json().error).toHaveProperty('message');
    expect(response.json().error).toHaveProperty('details');
  });

  it('never leaks a stack trace', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/items/not-a-uuid' });
    // The patterns a real stack trace contains, rather than any occurrence of
    // the letters "at" — which appear in ordinary words like "format".
    expect(response.body).not.toContain('\n    at ');
    expect(response.body).not.toContain('node_modules');
    expect(response.body).not.toContain('Object.');
    expect(response.body).not.toContain('.ts:');
  });
});
