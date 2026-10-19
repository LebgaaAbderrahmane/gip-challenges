/**
 * The response schemas.
 *
 * These serve two purposes. They document the API in the OpenAPI document,
 * and — because Fastify serialises a response through its schema — they
 * decide exactly what a client receives. A response schema that declares only
 * "type: object" strips every field, so the shapes are declared properly.
 */

/** A report, as returned by the API. */
export const itemReportSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    type: { type: 'string', enum: ['lost', 'found'] },
    title: { type: 'string' },
    description: { type: 'string' },
    category: { type: 'string' },
    location: { type: 'string' },
    eventDate: { type: 'string', format: 'date-time' },
    status: { type: 'string', enum: ['open', 'recovered'] },
    ownerId: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
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

/** A page of reports. */
export const itemListResponseSchema = {
  type: 'object',
  properties: {
    data: { type: 'array', items: itemReportSchema },
    pagination: {
      type: 'object',
      properties: {
        page: { type: 'integer' },
        limit: { type: 'integer' },
        total: { type: 'integer' },
        totalPages: { type: 'integer' },
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
