/**
 * The response schemas.
 *
 * These document the API and, because Fastify serialises a response through
 * its schema, they decide exactly what a client receives.
 *
 * The user schema has NO passwordHash property. A response schema that
 * declared one would put the hash on the wire, so it is deliberately absent
 * from the type as well as the schema.
 */

/** A user, as the API returns it. */
export const publicUserSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const;

/** A signed-in session. */
export const tokenResponseSchema = {
  type: 'object',
  properties: {
    token: { type: 'string' },
    tokenType: { type: 'string', enum: ['Bearer'] },
    expiresIn: { type: 'string' },
    user: publicUserSchema,
  },
} as const;

/** The result of verifying a token. */
export const tokenVerificationSchema = {
  type: 'object',
  properties: {
    valid: { type: 'boolean' },
    user: publicUserSchema,
  },
} as const;

/** The standard error envelope. */
export const errorResponseSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const;

/** The health response. */
export const healthResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok', 'degraded'] },
    service: { type: 'string' },
    version: { type: 'string' },
    database: { type: 'string', enum: ['ok', 'unavailable'] },
    uptimeSeconds: { type: 'integer' },
  },
} as const;
