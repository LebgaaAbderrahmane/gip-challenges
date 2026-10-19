/**
 * The non-concurrency behaviour of the Flash Sale API.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';

import {
  buildTestApp,
  demoCustomer,
  insertProduct,
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

const placeOrder = (
  productId: string,
  quantity: number,
  idempotencyKey: string,
  headers: Record<string, string> = {},
) =>
  app.inject({
    method: 'POST',
    url: '/api/orders',
    headers: { ...demoCustomer('tester'), 'idempotency-key': idempotencyKey, ...headers },
    payload: { productId, quantity },
  });

describe('GET /api/products', () => {
  it('lists the products with their stock', async () => {
    await insertProduct(app, { stock: 7, name: 'Lamp' });
    await insertProduct(app, { stock: 3, name: 'Mug' });

    const response = await app.inject({ method: 'GET', url: '/api/products' });

    expect(response.statusCode).toBe(200);
    const { data } = response.json();
    expect(data).toHaveLength(2);
    expect(data.map((p: { stock: number }) => p.stock).sort()).toEqual([3, 7]);
  });

  it('returns one product, and 404 for an unknown one', async () => {
    const product = await insertProduct(app, { stock: 4, name: 'Lamp' });

    const found = await app.inject({ method: 'GET', url: `/api/products/${product.id}` });
    expect(found.statusCode).toBe(200);
    expect(found.json().name).toBe('Lamp');

    const missing = await app.inject({
      method: 'GET',
      url: '/api/products/00000000-0000-4000-8000-000000000000',
    });
    expect(missing.statusCode).toBe(404);
  });
});

describe('the customer', () => {
  it('uses the token subject when the request is authenticated', async () => {
    const product = await insertProduct(app, { stock: 10 });

    const token = await new SignJWT({ email: 'ada@example.test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1234')
      .setIssuedAt()
      .setIssuer('gip-auth')
      .setAudience('gip')
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode(TEST_SECRET));

    const response = await placeOrder(product.id, 1, 'authed', {
      authorization: `Bearer ${token}`,
      'x-demo-customer': 'should-be-ignored',
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().customerId).toBe('user-1234');
  });

  it('falls back to the demo customer, clearly namespaced', async () => {
    const product = await insertProduct(app, { stock: 10 });

    const response = await placeOrder(product.id, 1, 'demo-customer', {
      'x-demo-customer': 'jury-1',
    });

    expect(response.statusCode).toBe(201);
    // The demo id is namespaced so it can never collide with a real user id.
    expect(response.json().customerId).toBe('demo_jury-1');
  });

  it('refuses a request with neither a token nor a demo customer', async () => {
    const product = await insertProduct(app, { stock: 10 });

    const response = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { 'idempotency-key': 'no-customer' },
      payload: { productId: product.id, quantity: 1 },
    });

    expect(response.statusCode).toBe(500);
  });
});

describe('GET /api/orders', () => {
  it("lists only the current customer's orders", async () => {
    const product = await insertProduct(app, { stock: 100 });

    await placeOrder(product.id, 1, 'mine-1', { 'x-demo-customer': 'customer-a' });
    await placeOrder(product.id, 1, 'theirs-1', { 'x-demo-customer': 'customer-b' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/orders',
      headers: demoCustomer('customer-a'),
    });

    expect(response.statusCode).toBe(200);
    const { data } = response.json();
    expect(data).toHaveLength(1);
    expect(data[0].idempotencyKey).toBe('mine-1');
  });

  it("returns one order, and 404 for another customer's", async () => {
    const product = await insertProduct(app, { stock: 100 });

    const created = await placeOrder(product.id, 1, 'one', {
      'x-demo-customer': 'customer-a',
    });
    const { id } = created.json();

    const mine = await app.inject({
      method: 'GET',
      url: `/api/orders/${id}`,
      headers: demoCustomer('customer-a'),
    });
    expect(mine.statusCode).toBe(200);

    const theirs = await app.inject({
      method: 'GET',
      url: `/api/orders/${id}`,
      headers: demoCustomer('customer-b'),
    });
    expect(theirs.statusCode).toBe(404);
  });
});

describe('validation', () => {
  it('rejects a quantity that is not a positive whole number', async () => {
    const product = await insertProduct(app, { stock: 10 });

    for (const quantity of [0, -1, 2.5, 1_000]) {
      const response = await placeOrder(product.id, quantity, `qty-${quantity}`);
      expect(response.statusCode).toBe(400);
    }
  });

  it('rejects a product id that is not a UUID', async () => {
    const response = await placeOrder('not-a-uuid', 1, 'bad-id');
    expect(response.statusCode).toBe(400);
  });

  it('rejects a body with no quantity', async () => {
    const product = await insertProduct(app, { stock: 10 });

    const response = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { ...demoCustomer('tester'), 'idempotency-key': 'no-qty' },
      payload: { productId: product.id },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('the health endpoint and the OpenAPI document', () => {
  it('reports the real state', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      service: 'flash-sale-api',
      database: 'ok',
    });
  });

  it('describes every route', async () => {
    const response = await app.inject({ method: 'GET', url: '/openapi.json' });
    const paths = Object.keys(response.json().paths);

    expect(paths).toContain('/api/products');
    expect(paths).toContain('/api/products/{id}');
    expect(paths).toContain('/api/orders');
    expect(paths).toContain('/api/orders/{id}');
  });

  it('documents the idempotency key header', async () => {
    const response = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(response.body).toContain('idempotency-key');
  });
});
