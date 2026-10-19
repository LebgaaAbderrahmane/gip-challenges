/**
 * The response schemas.
 *
 * These document the API and, because Fastify serialises a response through
 * its schema, they decide exactly what a client receives.
 */

/** A product. The price is in minor units — cents — and is never a float. */
export const productSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    priceCents: { type: 'integer', description: 'The price in cents.' },
    stock: { type: 'integer' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

/** An order. */
export const orderSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    productId: { type: 'string', format: 'uuid' },
    customerId: { type: 'string' },
    quantity: { type: 'integer' },
    unitPriceCents: { type: 'integer' },
    totalPriceCents: { type: 'integer' },
    idempotencyKey: { type: 'string' },
    status: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const;

export const productListResponseSchema = {
  type: 'object',
  properties: { data: { type: 'array', items: productSchema } },
} as const;

export const orderListResponseSchema = {
  type: 'object',
  properties: { data: { type: 'array', items: orderSchema } },
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
