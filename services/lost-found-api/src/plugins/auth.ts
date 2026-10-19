/**
 * The authentication plugin.
 *
 * It verifies the bearer token and attaches the user to the request. The
 * verification itself is local — see lib/auth.ts for why.
 */
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { unauthorized } from '@gip/service-core/errors';

import { extractBearerToken, verifyToken, type AuthenticatedUser } from '../lib/auth.ts';

declare module 'fastify' {
  interface FastifyRequest {
    /** The authenticated user, set by the `requireUser` preHandler. */
    user?: AuthenticatedUser;
  }
  interface FastifyInstance {
    /** Verifies the token and returns the user. */
    authenticate(request: FastifyRequest): Promise<AuthenticatedUser>;
  }
}

export interface AuthPluginOptions {
  secret: string;
  issuer?: string;
  audience?: string;
}

async function authPluginImpl(
  app: FastifyInstance,
  options: AuthPluginOptions,
): Promise<void> {
  app.decorate('authenticate', async (request: FastifyRequest) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw unauthorized('A bearer token is required for this action.');
    }

    return verifyToken(token, {
      secret: options.secret,
      issuer: options.issuer,
      audience: options.audience,
    });
  });
}

/**
 * Wrapped with fastify-plugin so the decoration reaches the root scope,
 * where the route handlers can use it.
 */
export const authPlugin = fp(authPluginImpl, { name: 'auth' });
export default authPlugin;

/**
 * A preHandler that requires a valid token and stores the user on the
 * request.
 */
export async function requireUser(request: FastifyRequest): Promise<void> {
  const user = await request.server.authenticate(request);
  request.user = user;
}
