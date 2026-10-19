/**
 * Resolving the customer.
 *
 * When the request carries a valid bearer token, the customer is the user
 * the token identifies — a real identity, verified by the auth service.
 *
 * Without one, a DEMO customer id is used, taken from the X-Demo-Customer
 * header. That is a convenience for the public demo, and it is clearly a
 * demo: the header is a name the client chose for itself, and nothing is
 * verified. The docs say so plainly.
 *
 * The demo id is namespaced so it can never collide with a real user id.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { verifyToken } from './token.ts';

/** The prefix that marks a demo customer id. */
const DEMO_PREFIX = 'demo_';

export const DEMO_CUSTOMER_HEADER = 'x-demo-customer';

/**
 * The customer id for a request.
 */
export async function resolveCustomer(
  app: FastifyInstance,
  request: FastifyRequest,
): Promise<string> {
  const header = request.headers.authorization;
  if (header) {
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && value) {
      const user = await verifyToken(app, value.trim());
      // A token that does not verify is not an identity. The demo identity
      // below is used instead, and a real token is never silently accepted.
      if (user) return user.id;
    }
  }

  const demo = request.headers[DEMO_CUSTOMER_HEADER];
  const demoId = Array.isArray(demo) ? demo[0] : demo;
  if (demoId && demoId.trim() !== '') {
    const trimmed = demoId.trim();
    return trimmed.startsWith(DEMO_PREFIX) ? trimmed : `${DEMO_PREFIX}${trimmed}`;
  }

  throw new Error(
    'A customer is required. Send a bearer token, or the X-Demo-Customer header for the public demo.',
  );
}
