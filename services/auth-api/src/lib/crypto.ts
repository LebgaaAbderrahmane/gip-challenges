/**
 * Password hashing and token issuing.
 */
import argon2 from 'argon2';
import { SignJWT } from 'jose';

/**
 * The hashing parameters.
 *
 * Argon2id is the current recommendation: it is memory-hard, which makes a
 * brute-force attack on a stolen hash far more expensive than a fast hash
 * such as SHA-256, and it resists both side-channel and GPU attacks.
 *
 * The memory cost is the main dial and is deliberately generous. 64 MB per
 * hash makes a large-scale attack expensive; 19 MiB of memory parallelism
 * matches the widely used guidance for interactive logins.
 */
const HASH_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65_536, // 64 MiB
  timeCost: 3,
  parallelism: 1,
};

/** Hashes a password for storage. */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, HASH_OPTIONS);
}

/**
 * Checks a password against a stored hash.
 *
 * Returns false rather than throwing when the hash is malformed, so a
 * corrupted record cannot turn a login into a 500.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password, HASH_OPTIONS);
  } catch {
    return false;
  }
}

/**
 * Normalises an email for storage and lookup.
 *
 * Lowercased and trimmed. The domain part is case-insensitive by RFC, and in
 * practice mail providers treat the local part that way too, so folding the
 * whole address is the behaviour that avoids two accounts for one person.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface TokenClaims {
  sub: string;
  email: string;
}

/**
 * Issues an access token.
 *
 * The claims are minimal: the subject, the email, the issue time and the
 * expiry. Nothing sensitive goes in — a token is readable by whoever holds
 * it, so it must never carry a password, a hash, or anything else private.
 */
export async function issueToken(
  claims: TokenClaims,
  options: { secret: string; issuer?: string; audience?: string; expiresIn: string },
): Promise<string> {
  const builder = new SignJWT({ email: claims.email })
    // The algorithm is pinned. A token that names its own algorithm is never
    // trusted, because that is how the `alg: none` attack works.
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt();

  if (options.issuer) builder.setIssuer(options.issuer);
  if (options.audience) builder.setAudience(options.audience);
  builder.setExpirationTime(options.expiresIn);

  return builder.sign(new TextEncoder().encode(options.secret));
}
