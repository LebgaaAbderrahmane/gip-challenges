/**
 * Token verification.
 *
 * The same secret and the same pinned algorithm as the other services. The
 * algorithm is fixed in code, never chosen by the token.
 */
import { jwtVerify } from 'jose';
import type { FastifyInstance } from 'fastify';

export interface TokenUser {
  id: string;
  email?: string;
}

/**
 * Verifies a bearer token and returns the user it identifies.
 *
 * Returns null rather than throwing, because a token that does not verify
 * simply means "not authenticated" — it is not an error in itself.
 */
export async function verifyToken(
  app: FastifyInstance,
  token: string,
): Promise<TokenUser | null> {
  try {
    const verified = await jwtVerify(
      token,
      new TextEncoder().encode(app.config.jwtSecret!),
      {
        // PINNED. A token must never choose its own algorithm.
        algorithms: ['HS256'],
        ...(app.config.jwtIssuer ? { issuer: app.config.jwtIssuer } : {}),
        ...(app.config.jwtAudience ? { audience: app.config.jwtAudience } : {}),
      },
    );

    if (typeof verified.payload.sub !== 'string' || verified.payload.sub === '') {
      return null;
    }

    return {
      id: verified.payload.sub,
      email:
        typeof verified.payload.email === 'string' ? verified.payload.email : undefined,
    };
  } catch {
    return null;
  }
}
