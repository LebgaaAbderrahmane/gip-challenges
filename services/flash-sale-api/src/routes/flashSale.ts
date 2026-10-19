/**
 * The Flash Sale API routes.
 */
import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { AppError, ERROR_CODES, badRequest, notFound } from '@gip/service-core';

import { orders, products } from '../db/schema.ts';
import {
  placeOrder,
  SoldOutError,
  UnknownProductError,
  type PlacementResult,
} from '../lib/orders.ts';
import { resolveCustomer } from '../lib/customer.ts';
import {
  errorResponseSchema,
  orderListResponseSchema,
  orderSchema,
  productListResponseSchema,
  productSchema,
} from '../schemas.ts';

const MAX_QUANTITY = 100;

const orderBodySchema = z.object({
  productId: z.string().uuid('The product id must be a UUID.'),
  quantity: z
    .number()
    .int('The quantity must be a whole number.')
    .min(1, 'The quantity must be at least 1.')
    .max(MAX_QUANTITY, `The quantity must be at most ${MAX_QUANTITY}.`),
});

export async function flashSaleRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Lists the products and their current stock.
   */
  app.get(
    '/api/products',
    {
      schema: {
        tags: ['products'],
        summary: 'Browse the products',
        description: 'Lists the products with the stock available right now.',
        response: {
          200: { ...productListResponseSchema, description: 'The products' },
        },
      },
    },
    async () => {
      const rows = await app.db.select().from(products).orderBy(products.createdAt);
      return { data: rows };
    },
  );

  /**
   * Returns one product and its current stock.
   */
  app.get(
    '/api/products/:id',
    {
      schema: {
        tags: ['products'],
        summary: 'One product',
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: { ...productSchema, description: 'The product' },
          404: { ...errorResponseSchema, description: 'No such product' },
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const [product] = await app.db.select().from(products).where(eq(products.id, id)).limit(1);
      if (!product) throw notFound('There is no product with that id.');
      return product;
    },
  );

  /**
   * Places an order.
   *
   * The idempotency key is REQUIRED. Without it a retried request could
   * create a second order, which is the one thing this endpoint must never
   * do.
   */
  app.post(
    '/api/orders',
    {
      schema: {
        tags: ['orders'],
        summary: 'Place an order',
        description:
          'Places an order. The Idempotency-Key header is required: a retried request with the same key returns the original order instead of creating a second one.',
        headers: {
          type: 'object',
          properties: {
            'idempotency-key': {
              type: 'string',
              maxLength: 200,
              description: 'A key the client generates for one logical order.',
              // NOT declared as required here on purpose. Fastify would
              // reject a missing header with its own generic message before
              // the handler ran, and the handler explains WHY the key is
              // needed, which is the more useful answer.
            },
          },
        },
        body: {
          type: 'object',
          required: ['productId', 'quantity'],
          properties: {
            productId: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer', minimum: 1, maximum: MAX_QUANTITY },
          },
        },
        response: {
          201: { ...orderSchema, description: 'The order that was created' },
          200: { ...orderSchema, description: 'The original order, replayed' },
          400: { ...errorResponseSchema, description: 'The request is not valid' },
          404: { ...errorResponseSchema, description: 'No such product' },
          409: { ...errorResponseSchema, description: 'Sold out, or the key was reused' },
        },
      },
    },
    async (request, reply) => {
      const parsed = orderBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw badRequest(
          'The order is not valid.',
          parsed.error.issues.map((issue) => ({
            path: `body.${issue.path.join('.')}`,
            message: issue.message,
          })),
        );
      }

      const idempotencyKey = request.headers['idempotency-key'];
      const key = Array.isArray(idempotencyKey) ? idempotencyKey[0] : idempotencyKey;
      if (!key || key.trim() === '') {
        throw badRequest(
          'The Idempotency-Key header is required, so a retried request cannot create a second order.',
        );
      }

      const customerId = await resolveCustomer(app, request);

      let result: PlacementResult;
      try {
        result = await placeOrder(app.db, {
          productId: parsed.data.productId,
          quantity: parsed.data.quantity,
          customerId,
          idempotencyKey: key.trim(),
        });
      } catch (error) {
        if (error instanceof UnknownProductError) {
          throw notFound('There is no product with that id.');
        }
        if (error instanceof SoldOutError) {
          throw new AppError(
            409,
            ERROR_CODES.CONFLICT,
            'There is not enough stock for that quantity.',
            [{ path: 'body.quantity', message: 'Not enough stock is available.' }],
          );
        }
        throw error;
      }

      switch (result.kind) {
        case 'created':
          return reply.code(201).send(result.order);

        case 'replayed':
          // The same key and the same payload: this is a retry, and the
          // original order is returned.
          return reply.code(200).send(result.order);

        case 'conflict':
          // The same key but a different payload. The key is being reused
          // for another logical order, which is a client error.
          throw new AppError(
            409,
            ERROR_CODES.CONFLICT,
            'That idempotency key was already used for a different order.',
            [{ path: 'header.idempotency-key', message: 'The key is already in use.' }],
          );

        case 'in-progress':
          // The other attempt has not committed yet. The client may retry:
          // the key will resolve to the original order.
          return reply
            .code(409)
            .header('Retry-After', '1')
            .send({
              error: {
                code: ERROR_CODES.CONFLICT,
                message:
                  'An order with that idempotency key is being placed right now. Try again in a moment.',
                details: [],
              },
            });

        default:
          throw new Error('unreachable');
      }
    },
  );

  /**
   * Lists the orders for the current customer.
   */
  app.get(
    '/api/orders',
    {
      schema: {
        tags: ['orders'],
        summary: "The current customer's orders",
        description: 'Lists the orders belonging to the current customer.',
        response: {
          200: { ...orderListResponseSchema, description: 'The orders' },
        },
      },
    },
    async (request) => {
      const customerId = await resolveCustomer(app, request);
      const rows = await app.db
        .select()
        .from(orders)
        .where(eq(orders.customerId, customerId))
        .orderBy(desc(orders.createdAt));
      return { data: rows };
    },
  );

  /**
   * Returns one order.
   */
  app.get(
    '/api/orders/:id',
    {
      schema: {
        tags: ['orders'],
        summary: 'One order',
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: { ...orderSchema, description: 'The order' },
          404: { ...errorResponseSchema, description: 'No such order' },
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const customerId = await resolveCustomer(app, request);
      const [order] = await app.db
        .select()
        .from(orders)
        .where(and(eq(orders.id, id), eq(orders.customerId, customerId)))
        .limit(1);
      if (!order) throw notFound('There is no order with that id.');
      return order;
    },
  );
}
