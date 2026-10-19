/**
 * Integration tests for the Authentication API.
 *
 * The brief asks for "secured signup/login endpoints & JWT issuing and
 * verification". These tests run against a real PostgreSQL instance and
 * exercise the real application.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';

import {
  buildTestApp,
  credentials,
  GOOD_PASSWORD,
  truncateAll,
  TEST_SECRET,
} from './helpers.ts';

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

describe('POST /api/auth/signup', () => {
  it('creates an account and returns it', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: credentials(),
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.id).toBeTruthy();
    expect(body.email).toBe('ada@example.test');
    expect(body.createdAt).toBeTruthy();
  });

  it('never returns the password hash', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: credentials(),
    });

    expect(response.body).not.toContain('passwordHash');
    expect(response.body).not.toContain('argon2');
    expect(response.body).not.toContain(GOOD_PASSWORD);
  });

  it('stores a hash, never the password', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: credentials(),
    });

    const [row] = await app.db.select().from(
      (await import('../src/db/schema.ts')).users,
    );

    expect(row.passwordHash).not.toBe(GOOD_PASSWORD);
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('rejects a duplicate email', async () => {
    await app.inject({
      method: 'POST', url: '/api/auth/signup', payload: credentials(),
    });
    const second = await app.inject({
      method: 'POST', url: '/api/auth/signup', payload: credentials(),
    });

    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('CONFLICT');
  });

  it('treats a differently-cased email as the same account', async () => {
    await app.inject({
      method: 'POST', url: '/api/auth/signup', payload: credentials({ email: 'ada@example.test' }),
    });
    const second = await app.inject({
      method: 'POST', url: '/api/auth/signup', payload: credentials({ email: '  ADA@Example.Test ' }),
    });

    expect(second.statusCode).toBe(409);
  });

  it('normalises the stored email', async () => {
    const response = await app.inject({
      method: 'POST', url: '/api/auth/signup',
      payload: credentials({ email: '  Ada@EXAMPLE.test  ' }),
    });

    expect(response.json().email).toBe('ada@example.test');
  });

  it.each([
    ['a missing email', { email: undefined }],
    ['a malformed email', { email: 'not-an-email' }],
    ['a missing password', { password: undefined }],
    ['a short password', { password: 'short' }],
  ])('rejects %s', async (_label, override) => {
    const payload = credentials();
    for (const [key, value] of Object.entries(override)) {
      if (value === undefined) delete (payload as Record<string, unknown>)[key];
      else (payload as Record<string, unknown>)[key] = value;
    }

    const response = await app.inject({
      method: 'POST', url: '/api/auth/signup', payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await app.inject({
      method: 'POST', url: '/api/auth/signup', payload: credentials(),
    });
  });

  it('issues a token for the right credentials', async () => {
    const response = await app.inject({
      method: 'POST', url: '/api/auth/login', payload: credentials(),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.token).toBeTruthy();
    expect(body.tokenType).toBe('Bearer');
    expect(body.user.email).toBe('ada@example.test');
    expect(body.user.passwordHash).toBeUndefined();
  });

  it('issues a token that /me accepts', async () => {
    const login = await app.inject({
      method: 'POST', url: '/api/auth/login', payload: credentials(),
    });

    const me = await app.inject({
      method: 'GET', url: '/api/auth/me', headers: auth(login.json().token),
    });

    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe('ada@example.test');
  });

  it('rejects a wrong password with 401', async () => {
    const response = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: credentials({ password: 'not-the-right-password' }),
    });

    expect(response.statusCode).toBe(401);
  });

  it('gives the same message whether the account exists or the password is wrong', async () => {
    const wrongPassword = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: credentials({ password: 'not-the-right-password' }),
    });

    const noAccount = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: credentials({ email: 'nobody@example.test' }),
    });

    // The messages must be identical, or the endpoint becomes a way to find
    // out which addresses are registered.
    expect(wrongPassword.json().error.message).toBe(noAccount.json().error.message);
    expect(wrongPassword.json().error.code).toBe(noAccount.json().error.code);
  });

  it('rejects a malformed email with 400', async () => {
    const response = await app.inject({
      method: 'POST', url: '/api/auth/login', payload: credentials({ email: 'nope' }),
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(async () => {
    await app.inject({
      method: 'POST', url: '/api/auth/signup', payload: credentials(),
    });
  });

  const token = async () => {
    const login = await app.inject({
      method: 'POST', url: '/api/auth/login', payload: credentials(),
    });
    return login.json().token;
  };

  it('requires a token', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a malformed token', async () => {
    const response = await app.inject({
      method: 'GET', url: '/api/auth/me', headers: auth('not-a-token'),
    });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a token signed with the wrong key', async () => {
    const forged = await new SignJWT({ email: 'attacker@example.test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('00000000-0000-4000-8000-000000000000')
      .setIssuedAt()
      .setIssuer('gip-auth')
      .setAudience('gip')
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode('a-completely-different-secret-value-1234'));

    const response = await app.inject({
      method: 'GET', url: '/api/auth/me', headers: auth(forged),
    });
    expect(response.statusCode).toBe(401);
  });

  it('rejects an expired token', async () => {
    const expired = await new SignJWT({ email: 'ada@example.test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('00000000-0000-4000-8000-000000000000')
      .setIssuedAt()
      .setIssuer('gip-auth')
      .setAudience('gip')
      .setExpirationTime('-1m')
      .sign(new TextEncoder().encode(TEST_SECRET));

    const response = await app.inject({
      method: 'GET', url: '/api/auth/me', headers: auth(expired),
    });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a token whose algorithm is not the pinned one', async () => {
    const none = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }) +
        '.' +
        Buffer.from(JSON.stringify({ sub: 'attacker' })).toString('base64url'),
    ).toString('base64url');

    const response = await app.inject({
      method: 'GET', url: '/api/auth/me', headers: auth(none),
    });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a token from the wrong issuer', async () => {
    const wrongIssuer = await new SignJWT({ email: 'ada@example.test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('00000000-0000-4000-8000-000000000000')
      .setIssuedAt()
      .setIssuer('somebody-else')
      .setAudience('gip')
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode(TEST_SECRET));

    const response = await app.inject({
      method: 'GET', url: '/api/auth/me', headers: auth(wrongIssuer),
    });
    expect(response.statusCode).toBe(401);
  });

  it('returns the user for a valid token', async () => {
    const response = await app.inject({
      method: 'GET', url: '/api/auth/me', headers: auth(await token()),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().email).toBe('ada@example.test');
    expect(response.json().passwordHash).toBeUndefined();
  });
});

describe('GET /api/auth/verify', () => {
  it('reports a valid token as valid', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/signup', payload: credentials() });
    const login = await app.inject({
      method: 'POST', url: '/api/auth/login', payload: credentials(),
    });

    const response = await app.inject({
      method: 'GET', url: '/api/auth/verify', headers: auth(login.json().token),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().valid).toBe(true);
  });

  it('rejects a token with no user behind it', async () => {
    const orphan = await new SignJWT({ email: 'ghost@example.test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('00000000-0000-4000-8000-000000000000')
      .setIssuedAt()
      .setIssuer('gip-auth')
      .setAudience('gip')
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode(TEST_SECRET));

    const response = await app.inject({
      method: 'GET', url: '/api/auth/verify', headers: auth(orphan),
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('the root route', () => {
  /*
   * The base URL is the first thing anyone pastes into a browser. A 404
   * there reads as a broken service rather than as an API with no root
   * resource, so the root says what this is and where to go next.
   */
  it('says what the service is and where to go', async () => {
    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: 'auth-api',
      title: 'Authentication API',
      links: {
        documentation: '/docs',
        specification: '/openapi.json',
        health: '/health',
      },
    });
  });
});

describe('the health endpoint', () => {
  it('reports the real state', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      service: 'auth-api',
      database: 'ok',
    });
  });

  it('discloses no credentials', async () => {
    const body = (await app.inject({ method: 'GET', url: '/health' })).body;
    expect(body).not.toContain(TEST_SECRET);
    expect(body).not.toContain('postgres://');
  });
});

describe('the OpenAPI document', () => {
  it('describes every route', async () => {
    const response = await app.inject({ method: 'GET', url: '/openapi.json' });
    const paths = Object.keys(response.json().paths);

    expect(paths).toContain('/api/auth/signup');
    expect(paths).toContain('/api/auth/login');
    expect(paths).toContain('/api/auth/me');
    expect(paths).toContain('/api/auth/verify');
    expect(paths).toContain('/health');
  });

  it('does not describe a password hash on the user', async () => {
    const response = await app.inject({ method: 'GET', url: '/openapi.json' });
    const spec = response.body;
    expect(spec).not.toContain('passwordHash');
    expect(spec).not.toContain('password_hash');
  });
});

describe('error handling', () => {
  it('returns a consistent envelope for an unknown route', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toHaveProperty('error.code');
  });

  it('never leaks a stack trace', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(response.body).not.toContain('\n    at ');
    expect(response.body).not.toContain('node_modules');
  });
});
