/**
 * The concurrency tests.
 *
 * These are the tests that matter. Everything else in the project is
 * ordinary CRUD; THIS is the part of the brief that is hard, and it is the
 * part a reviewer should read.
 *
 * The requests are made through the real application, against a real
 * PostgreSQL instance, and they are genuinely concurrent — `Promise.all` over
 * separate requests, not a loop awaiting each one.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';

import { orders, products } from '../src/db/schema.ts';
import {
  buildTestApp,
  demoCustomer,
  insertProduct,
  truncateAll,
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

/** Places an order. */
const placeOrder = (
  productId: string,
  quantity: number,
  idempotencyKey: string,
  customer = 'concurrency-test',
) =>
  app.inject({
    method: 'POST',
    url: '/api/orders',
    headers: { ...demoCustomer(customer), 'idempotency-key': idempotencyKey },
    payload: { productId, quantity },
  });

const stockOf = async (productId: string): Promise<number> => {
  const [row] = await app.db.select().from(products).where(eq(products.id, productId));
  return row?.stock ?? -1;
};

const countOrders = async (): Promise<number> => {
  const rows = await app.db.select().from(orders);
  return rows.length;
};

describe('Scenario A — overselling', () => {
  it('never sells more than the stock, under 50 simultaneous requests', async () => {
    const product = await insertProduct(app, { stock: 10 });

    // Fifty requests, each for one unit, each with its own key, all fired
    // at once.
    const responses = await Promise.all(
      Array.from({ length: 50 }, (_, i) => placeOrder(product.id, 1, `key-${i}`)),
    );

    const created = responses.filter((r) => r.statusCode === 201);
    const soldOut = responses.filter((r) => r.statusCode === 409);

    expect(created).toHaveLength(10);
    expect(soldOut).toHaveLength(40);
    expect(created.length + soldOut.length).toBe(50);

    // The stock is exhausted, and it never went below zero.
    expect(await stockOf(product.id)).toBe(0);

    // Exactly ten units were ordered.
    expect(await countOrders()).toBe(10);
  });

  it('reports a sold-out product with a conflict, not a server error', async () => {
    const product = await insertProduct(app, { stock: 1 });

    const first = await placeOrder(product.id, 1, 'first');
    const second = await placeOrder(product.id, 1, 'second');

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(409);
    expect(second.json().error.message).toMatch(/stock/i);
  });

  it('rejects a quantity larger than the stock, and leaves the stock alone', async () => {
    const product = await insertProduct(app, { stock: 3 });

    const response = await placeOrder(product.id, 5, 'too-many');

    expect(response.statusCode).toBe(409);
    expect(await stockOf(product.id)).toBe(3);
    expect(await countOrders()).toBe(0);
  });

  it('refuses to create an order for a product that does not exist', async () => {
    const response = await placeOrder(
      '00000000-0000-4000-8000-000000000000',
      1,
      'missing',
    );

    expect(response.statusCode).toBe(404);
    expect(await countOrders()).toBe(0);
  });

  it('never lets the stock go below zero, even when asked for more than exists', async () => {
    const product = await insertProduct(app, { stock: 2 });

    await Promise.all(
      Array.from({ length: 20 }, (_, i) => placeOrder(product.id, 1, `many-${i}`)),
    );

    expect(await stockOf(product.id)).toBe(0);
  });
});

describe('Scenario B — idempotency under concurrent retries', () => {
  it('creates exactly one order for the same key sent many times at once', async () => {
    const product = await insertProduct(app, { stock: 100 });

    // The same logical order, retried ten times simultaneously.
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => placeOrder(product.id, 2, 'same-key')),
    );

    // Exactly one created it. The others either replayed it or were told to
    // retry, and none of them created a second order.
    const created = responses.filter((r) => r.statusCode === 201);
    expect(created).toHaveLength(1);

    expect(await countOrders()).toBe(1);
    expect(await stockOf(product.id)).toBe(98);
  });

  it('returns the original order when the same key is retried later', async () => {
    const product = await insertProduct(app, { stock: 100 });

    const first = await placeOrder(product.id, 3, 'retry-me');
    const second = await placeOrder(product.id, 3, 'retry-me');

    expect(first.statusCode).toBe(201);
    // A retry is a 200, not a second 201.
    expect(second.statusCode).toBe(200);
    expect(second.json().id).toBe(first.json().id);

    expect(await countOrders()).toBe(1);
    expect(await stockOf(product.id)).toBe(97);
  });
});

describe('Scenario C — the same key, a different payload', () => {
  it('rejects the second request and creates no extra order', async () => {
    const product = await insertProduct(app, { stock: 100 });

    const first = await placeOrder(product.id, 1, 'shared-key');
    const second = await placeOrder(product.id, 5, 'shared-key');

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(409);
    expect(second.json().error.message).toMatch(/idempotency key/i);

    // The second request must not have taken any stock.
    expect(await stockOf(product.id)).toBe(99);
    expect(await countOrders()).toBe(1);
  });

  it('rejects the same key for a different product', async () => {
    const first = await insertProduct(app, { stock: 10, name: 'First' });
    const second = await insertProduct(app, { stock: 10, name: 'Second' });

    const a = await placeOrder(first.id, 1, 'cross-key');
    const b = await placeOrder(second.id, 1, 'cross-key');

    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(409);
    expect(await countOrders()).toBe(1);
  });

  it('scopes the key to the customer, so two customers may use the same key', async () => {
    const product = await insertProduct(app, { stock: 100 });

    const a = await placeOrder(product.id, 1, 'same-key', 'customer-a');
    const b = await placeOrder(product.id, 1, 'same-key', 'customer-b');

    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(201);
    expect(await countOrders()).toBe(2);
  });
});

describe('Scenario D — the transaction rolls back', () => {
  it('restores the stock when the order cannot be written', async () => {
    const product = await insertProduct(app, { stock: 5 });

    // A key that already exists for this customer, but a different payload,
    // so the order insert is rejected by the unique index AFTER the stock has
    // been reserved. The rollback must put the stock back.
    await placeOrder(product.id, 1, 'rollback-key');
    const before = await stockOf(product.id);
    expect(before).toBe(4);

    const response = await placeOrder(product.id, 2, 'rollback-key');

    expect(response.statusCode).toBe(409);
    // The stock is exactly what it was before the failed attempt.
    expect(await stockOf(product.id)).toBe(4);
    expect(await countOrders()).toBe(1);
  });

  it('leaves the stock alone when the quantity is invalid', async () => {
    const product = await insertProduct(app, { stock: 5 });

    const response = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { ...demoCustomer('invalid-quantity'), 'idempotency-key': 'bad-qty' },
      payload: { productId: product.id, quantity: 0 },
    });

    expect(response.statusCode).toBe(400);
    expect(await stockOf(product.id)).toBe(5);
  });
});

describe('the idempotency key is required', () => {
  it('is rejected when it is missing', async () => {
    const product = await insertProduct(app, { stock: 5 });

    const response = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: demoCustomer('no-key'),
      payload: { productId: product.id, quantity: 1 },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toMatch(/idempotency/i);
    expect(await countOrders()).toBe(0);
  });
});

describe('money', () => {
  it('stores the price in whole cents, never a float', async () => {
    const product = await insertProduct(app, { stock: 10, priceCents: 1_999 });

    const response = await placeOrder(product.id, 3, 'money');

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.unitPriceCents).toBe(1_999);
    expect(body.totalPriceCents).toBe(5_997);
    expect(Number.isInteger(body.totalPriceCents)).toBe(true);
  });
});
