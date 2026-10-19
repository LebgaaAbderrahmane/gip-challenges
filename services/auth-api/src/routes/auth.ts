/**
 * The authentication routes.
 *
 * Signup and login, with Argon2id password hashing and JWT issuing.
 */
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';

import {
  ERROR_CODES,
  badRequest,
  conflict,
  unauthorized,
} from '@gip/service-core';

import { users, type PublicUser } from '../db/schema.ts';
import { hashPassword, issueToken, normalizeEmail, verifyPassword } from '../lib/crypto.ts';
import {
  errorResponseSchema,
  publicUserSchema,
  tokenResponseSchema,
  tokenVerificationSchema,
} from '../schemas.ts';

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 200;

const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .min(3, 'The email address is required.')
    .max(320, 'The email address is too long.')
    .email('That does not look like an email address.'),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
    .max(MAX_PASSWORD_LENGTH, `The password must be at most ${MAX_PASSWORD_LENGTH} characters.`),
});

/** The user as the API returns it. The hash is deliberately absent. */
function toPublicUser(user: { id: string; email: string; createdAt: Date }): PublicUser {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Creates an account.
   *
   * A duplicate email is a 409. The response does not say whether the
   * account exists to anybody who does not already know the address — but a
   * duplicate is a case where the caller already supplied the address, so
   * the conflict is the useful answer.
   */
  app.post(
    '/api/auth/signup',
    {
      config: { rateLimit: { max: app.config.rateLimitMax ?? 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['auth'],
        summary: 'Create an account',
        description:
          'Creates an account and returns it. The password is hashed with Argon2id and is never returned or stored in plain text.',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            // The format is documented rather than declared as `format:
            // 'email'`, because Fastify's own validator runs before the
            // handler and would reject an address with surrounding
            // whitespace — which the normalisation is there to allow. Zod
            // enforces the real rule.
            email: {
              type: 'string',
              description:
                'The email address. Whitespace is trimmed and the address is lowercased before it is stored.',
            },
            password: { type: 'string', minLength: MIN_PASSWORD_LENGTH },
          },
        },
        response: {
          201: { ...publicUserSchema, description: 'The created account' },
          400: { ...errorResponseSchema, description: 'The request is not valid' },
          409: { ...errorResponseSchema, description: 'That email is already registered' },
        },
      },
    },
    async (request, reply) => {
      const parsed = credentialsSchema.safeParse(request.body);
      if (!parsed.success) {
        throw badRequest(
          'The account details are not valid.',
          parsed.error.issues.map((issue) => ({
            path: `body.${issue.path.join('.')}`,
            message: issue.message,
          })),
        );
      }

      const email = normalizeEmail(parsed.data.email);

      const existing = await app.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existing.length > 0) {
        throw conflict(
          ERROR_CODES.CONFLICT,
          'That email address is already registered.',
        );
      }

      const passwordHash = await hashPassword(parsed.data.password);

      const [created] = await app.db
        .insert(users)
        .values({ email, passwordHash })
        .returning();

      return reply.code(201).send(toPublicUser(created));
    },
  );

  /**
   * Exchanges credentials for a token.
   *
   * The failure message is the same whether the account does not exist or
   * the password is wrong, so the endpoint cannot be used to discover which
   * addresses are registered.
   *
   * A dummy hash is verified when the account does not exist, so the response
   * takes the same time either way. Without it, a missing account would
   * return noticeably faster than a wrong password, which is a timing oracle.
   */
  app.post(
    '/api/auth/login',
    {
      config: { rateLimit: { max: app.config.rateLimitMax ?? 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['auth'],
        summary: 'Sign in',
        description:
          'Exchanges an email and password for a short-lived access token. The failure message is the same whether the account exists or the password is wrong.',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              description:
                'The email address. Whitespace is trimmed and the address is lowercased before it is looked up.',
            },
            password: { type: 'string' },
          },
        },
        response: {
          200: { ...tokenResponseSchema, description: 'An access token and the user' },
          400: { ...errorResponseSchema, description: 'The request is not valid' },
          401: { ...errorResponseSchema, description: 'The credentials are not valid' },
          429: { ...errorResponseSchema, description: 'Too many attempts' },
        },
      },
    },
    async (request) => {
      const parsed = credentialsSchema.safeParse(request.body);
      if (!parsed.success) {
        throw badRequest(
          'The credentials are not valid.',
          parsed.error.issues.map((issue) => ({
            path: `body.${issue.path.join('.')}`,
            message: issue.message,
          })),
        );
      }

      const email = normalizeEmail(parsed.data.email);

      const [user] = await app.db.select().from(users).where(eq(users.email, email)).limit(1);

      if (!user) {
        // Spend the same time hashing as a real check would, so the response
        // time does not reveal whether the account exists.
        await verifyPassword(await getDummyHash(), parsed.data.password);
        throw unauthorized('The email address or password is not correct.');
      }

      const valid = await verifyPassword(user.passwordHash, parsed.data.password);
      if (!valid) {
        throw unauthorized('The email address or password is not correct.');
      }

      const token = await issueToken(
        { sub: user.id, email: user.email },
        {
          secret: app.config.jwtSecret!,
          issuer: app.config.jwtIssuer,
          audience: app.config.jwtAudience,
          expiresIn: app.config.jwtExpiresIn ?? '15m',
        },
      );

      return {
        token,
        tokenType: 'Bearer',
        expiresIn: app.config.jwtExpiresIn ?? '15m',
        user: toPublicUser(user),
      };
    },
  );

  /**
   * Returns the authenticated user.
   *
   * The token is verified locally, with the same secret the other services
   * use.
   */
  app.get(
    '/api/auth/me',
    {
      schema: {
        tags: ['auth'],
        summary: 'The authenticated user',
        description: 'Returns the user the bearer token identifies.',
        security: [{ bearerAuth: [] }],
        response: {
          200: { ...publicUserSchema, description: 'The authenticated user' },
          401: { ...errorResponseSchema, description: 'Authentication is required' },
        },
      },
    },
    async (request) => {
      const token = extractToken(request.headers.authorization);
      if (!token) {
        throw unauthorized('A bearer token is required for this action.');
      }

      const user = await verifyWithServiceSecret(app, token);
      if (!user) {
        throw unauthorized('The access token is not valid.');
      }

      return user;
    },
  );

  /**
   * Verifies a token and returns the user it identifies.
   */
  app.get(
    '/api/auth/verify',
    {
      schema: {
        tags: ['auth'],
        summary: 'Verify a token',
        description:
          'Verifies a bearer token and returns what it identifies. Expiry, signature and algorithm are all checked.',
        security: [{ bearerAuth: [] }],
        response: {
          200: { ...tokenVerificationSchema, description: 'What the token identifies' },
          401: { ...errorResponseSchema, description: 'The token is not valid' },
        },
      },
    },
    async (request) => {
      const token = extractToken(request.headers.authorization);
      if (!token) {
        throw unauthorized('A bearer token is required for this action.');
      }

      const user = await verifyWithServiceSecret(app, token);
      if (!user) {
        throw unauthorized('The access token is not valid.');
      }

      return { valid: true, user };
    },
  );
}

/** Extracts the token from an Authorization header. */
function extractToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!scheme || !value || scheme.toLowerCase() !== 'bearer') return null;
  const token = value.trim();
  return token === '' ? null : token;
}

/** Verifies a token locally and returns the user it identifies. */
async function verifyWithServiceSecret(
  app: FastifyInstance,
  token: string,
): Promise<PublicUser | null> {
  const { jwtVerify } = await import('jose');

  try {
    const verified = await jwtVerify(token, new TextEncoder().encode(app.config.jwtSecret!), {
      // Pinned. A token must never choose its own algorithm.
      algorithms: ['HS256'],
      ...(app.config.jwtIssuer ? { issuer: app.config.jwtIssuer } : {}),
      ...(app.config.jwtAudience ? { audience: app.config.jwtAudience } : {}),
    });

    if (typeof verified.payload.sub !== 'string') return null;

    const [user] = await app.db
      .select()
      .from(users)
      .where(eq(users.id, verified.payload.sub))
      .limit(1);

    if (!user) return null;
    return toPublicUser(user);
  } catch {
    return null;
  }
}

/**
 * A hash used to spend the same time on a login for an account that does not
 * exist as for one that does.
 *
 * Without it, a missing account would return noticeably faster than a wrong
 * password — a timing oracle that says which addresses are registered. The
 * hash is of a random password nobody has, so verification always fails, but
 * it fails SLOWLY, which is the point.
 */
let dummyHashPromise: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(randomBytes(32).toString('base64url'));
  }
  return dummyHashPromise;
}
