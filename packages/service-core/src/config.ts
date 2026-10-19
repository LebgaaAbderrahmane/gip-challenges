/**
 * Configuration loading and validation.
 *
 * Every variable a service needs is checked at startup, and a service that
 * is misconfigured refuses to start rather than failing later on a request.
 * The failure message names the VARIABLE but never its value, so a missing
 * secret cannot leak through the logs.
 */

export interface ServiceConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  host: string;
  databaseUrl: string;
  /** The PostgreSQL schema this service owns, e.g. "lost_found". */
  schema: string;
  /** Origins allowed to call this API from a browser. */
  corsOrigins: string[];
  /** Secret used to verify tokens issued by the auth service. */
  jwtSecret?: string;
  jwtIssuer?: string;
  jwtAudience?: string;
  /** How long an issued token is valid for, e.g. "15m". */
  jwtExpiresIn?: string;
  /**
   * The maximum number of attempts per minute on the rate-limited routes.
   *
   * Generous in test, so a test suite is not throttled by its own cases.
   */
  rateLimitMax?: number;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const read = (env: NodeJS.ProcessEnv, name: string): string | undefined => {
  const value = env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/**
 * Loads and validates the configuration.
 *
 * @param env usually `process.env`
 * @param options.schema the schema this service owns
 * @param options.requireJwt whether a JWT secret is needed (the auth service
 *   needs one to sign; the others need one to verify)
 */
export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: { schema: string; requireJwt: 'sign' | 'verify' | 'none' } = {
    schema: 'public',
    requireJwt: 'none',
  },
): ServiceConfig {
  const nodeEnv = (read(env, 'NODE_ENV') ?? 'development') as ServiceConfig['nodeEnv'];

  const portRaw = read(env, 'PORT');
  const port = portRaw ? Number(portRaw) : 3000;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError('PORT must be an integer between 1 and 65535.');
  }

  const databaseUrl = read(env, 'DATABASE_URL');
  if (!databaseUrl) {
    throw new ConfigError('DATABASE_URL is required.');
  }

  let jwtSecret: string | undefined;
  if (options.requireJwt !== 'none') {
    jwtSecret = read(env, 'JWT_SECRET');
    if (!jwtSecret) {
      throw new ConfigError('JWT_SECRET is required.');
    }
    if (jwtSecret.length < 32) {
      // The value is never printed, only its length.
      throw new ConfigError('JWT_SECRET must be at least 32 characters long.');
    }
  }

  const corsOrigins = (read(env, 'CORS_ORIGINS') ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    nodeEnv,
    port,
    host: read(env, 'HOST') ?? '0.0.0.0',
    databaseUrl,
    schema: options.schema,
    corsOrigins,
    jwtSecret,
    jwtIssuer: read(env, 'JWT_ISSUER'),
    jwtAudience: read(env, 'JWT_AUDIENCE'),
    jwtExpiresIn: read(env, 'JWT_EXPIRES_IN') ?? '15m',
    rateLimitMax: nodeEnv === 'test' ? 10_000 : Number(read(env, 'RATE_LIMIT_MAX') ?? 10),
  };
}
