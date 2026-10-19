/**
 * The operations each service exposes in the tester.
 *
 * These are preconfigured so a visitor can exercise the API without knowing
 * the contract, and so the panel demonstrates the behaviours that matter —
 * in particular the ownership checks, which are the whole point of the
 * Lost & Found API.
 */
import type { ApiOperation, ApiService } from './types.ts';

export const lostFoundOperations: ApiOperation[] = [
  {
    id: 'list',
    label: 'List reports',
    method: 'GET',
    path: '/api/items',
    requiresAuth: false,
    description:
      'Lists reports with a pagination envelope. Add ?q=, ?type=, ?status=, ?category= or ?location= to filter.',
  },
  {
    id: 'get',
    label: 'Get one report',
    method: 'GET',
    path: '/api/items/{id}',
    requiresAuth: false,
    parameters: [{ name: 'id', placeholder: 'the report id', label: 'Report id' }],
    description: 'Returns the details of a single report.',
  },
  {
    id: 'create',
    label: 'Create a report',
    method: 'POST',
    path: '/api/items',
    requiresAuth: true,
    body: {
      type: 'lost',
      title: 'Black leather wallet',
      description: 'A black wallet with a zip pocket and a scratch on the back.',
      category: 'bags',
      location: 'Central station, north entrance',
      eventDate: '2026-03-14T10:30:00.000Z',
    },
    description:
      'Creates a report. The owner is taken from the token — there is no owner field in the body.',
  },
  {
    id: 'update',
    label: 'Update a report',
    method: 'PATCH',
    path: '/api/items/{id}',
    requiresAuth: true,
    parameters: [{ name: 'id', placeholder: 'the report id', label: 'Report id' }],
    body: { title: 'Updated title' },
    description:
      'Updates a report. Only the user who created it may change it — another user gets 403.',
  },
  {
    id: 'recover',
    label: 'Mark as recovered',
    method: 'PATCH',
    path: '/api/items/{id}/recover',
    requiresAuth: true,
    parameters: [{ name: 'id', placeholder: 'the report id', label: 'Report id' }],
    description:
      'Marks a report as recovered. Recovering one twice is a 409, not a silent no-op.',
  },
];

export const authOperations: ApiOperation[] = [
  {
    id: 'signup',
    label: 'Create an account',
    method: 'POST',
    path: '/api/auth/signup',
    requiresAuth: false,
    body: {
      email: 'jury@example.com',
      password: 'a-strong-demo-password',
    },
    description:
      'Creates an account. The password is hashed with Argon2id and is never returned.',
  },
  {
    id: 'login',
    label: 'Sign in',
    method: 'POST',
    path: '/api/auth/login',
    requiresAuth: false,
    body: {
      email: 'jury@example.com',
      password: 'a-strong-demo-password',
    },
    description:
      'Exchanges credentials for a token. The failure message is the same whether the account exists or the password is wrong.',
  },
  {
    id: 'me',
    label: 'The signed-in user',
    method: 'GET',
    path: '/api/auth/me',
    requiresAuth: true,
    description: 'Returns the user the bearer token identifies.',
  },
  {
    id: 'verify',
    label: 'Verify a token',
    method: 'GET',
    path: '/api/auth/verify',
    requiresAuth: true,
    description:
      'Verifies a token. The expiry, the signature and the algorithm are all checked.',
  },
];

export const flashSaleOperations: ApiOperation[] = [
  {
    id: 'products',
    label: 'Browse products',
    method: 'GET',
    path: '/api/products',
    requiresAuth: false,
    description: 'Lists the products and their current stock.',
  },
  {
    id: 'product',
    label: 'One product',
    method: 'GET',
    path: '/api/products/{id}',
    requiresAuth: false,
    parameters: [{ name: 'id', placeholder: 'the product id', label: 'Product id' }],
    description: 'Returns a product and the stock available right now.',
  },
  {
    id: 'order',
    label: 'Place an order',
    method: 'POST',
    path: '/api/orders',
    requiresAuth: true,
    body: { productId: 'the product id', quantity: 1 },
    description:
      'Places an order. The idempotency key stops a retried request creating a second order.',
  },
  {
    id: 'orders',
    label: 'My orders',
    method: 'GET',
    path: '/api/orders',
    requiresAuth: true,
    description: 'Lists the orders for the signed-in customer.',
  },
];

/** Builds a service description for the tester. */
export const buildService = (
  name: string,
  baseUrl: string,
  operations: ApiOperation[],
): ApiService => ({ name, baseUrl, operations });
