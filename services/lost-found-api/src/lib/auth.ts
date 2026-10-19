/**
 * Token verification.
 *
 * The brief requires that users can update THEIR OWN reports, so ownership
 * has to be trustworthy. A client-supplied owner id is not identity.
 *
 * The Auth service signs the tokens; this service verifies them LOCALLY, with
 * the same secret, rather than calling the Auth service on every request.
 * That avoids a network hop in the hot path and a cascading failure when the
 * Auth service is slow. The cost is a shared secret, which is a real
 * boundary — it is documented in docs/architecture.md.
 *
 * The signing algorithm is PINNED. A token that names its own algorithm is
 * never trusted, because that is how the `alg: none` and HMAC/RSA confusion
 * attacks work.
 */
import { jwtVerify, type JWTPayload } from 'jose';

import { unauthorized } from '@gip/service-core/errors';

export interface AuthenticatedUser {
  /** The token's subject — the user's identifier. */
  id: string;
  email?: string;
}

export interface TokenVerifierOptions {
  secret: string;
  issuer?: string;
  audience?: string;
}

/**
 * Verifies a bearer token and returns the user it identifies.
 *
 * @throws {AppError} 401 when the token is missing, malformed, expired,
 *   signed with the wrong key, or names a different algorithm
 */
export async function verifyToken(
  token: string,
  options: TokenVerifierOptions,
): Promise<AuthenticatedUser> {
  let payload: JWTPayload;

  try {
    const secret = new TextEncoder().encode(options.secret);

    const verified = await jwtVerify(token, secret, {
      // PINNED. Without this, a token could choose its own algorithm.
      algorithms: ['HS256'],
      ...(options.issuer ? { issuer: options.issuer } : {}),
      ...(options.audience ? { audience: options.audience } : {}),
    });

    payload = verified.payload;
  } catch (error) {
    const reason = error instanceof Error ? error.name : 'unknown';
    // The reason is deliberately coarse. Saying "the token expired" versus
    // "the signature was wrong" tells an attacker about the token.
    throw unauthorized(
      reason === 'TokenExpiredError'
        ? 'The access token has expired.'
        : 'The access token is not valid.',
    );
  }

  if (typeof payload.sub !== 'string' || payload.sub === '') {
    throw unauthorized('The access token does not identify a user.');
  }

  return {
    id: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
  };
}

/**
 * Extracts the token from an `Authorization: Bearer …` header.
 *
 * @returns the token, or null when the header is absent or not a bearer
 */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;

  const [scheme, value] = header.split(' ');
  if (!scheme || !value) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;

  const token = value.trim();
  return token === '' ? null : token;
}
