#!/usr/bin/env node
/**
 * Sets up the LOCAL development environment, in one command.
 *
 * It does three things:
 *
 *   1. Creates the schemas and the restricted roles in the local PostgreSQL,
 *      by running the same init script the CI and the hosted instance use.
 *   2. Writes each service's `.env` — its own port, its own role's
 *      DATABASE_URL, and one shared JWT_SECRET.
 *   3. Writes the portfolio's `.env.local`, pointing it at those services.
 *
 * After that, `pnpm dev` starts the whole system.
 *
 * Usage:
 *   pnpm db:up          # start the local PostgreSQL in Docker
 *   pnpm db:setup:local # create the schemas and write the .env files
 *   pnpm dev            # start everything
 *
 * Every file it writes is gitignored. Nothing secret is committed.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const here = dirname(fileURLToPath(import.meta.url));

/** The local database, as docker-compose.yml defines it. */
const LOCAL_DB = {
  user: 'gip',
  password: 'gip_local_dev_only',
  database: 'gip',
  port: 5433,
  host: '127.0.0.1',
};

/**
 * The three services, and where each one lives.
 *
 * The ports are the ones the portfolio's fallback URLs already assume, and
 * the ones each service's .env.example documents.
 */
const SERVICES = [
  {
    package: 'lost-found-api',
    role: 'lost_found_role',
    port: 3001,
    // The variable the portfolio reads. Spelled out, because deriving it
    // from the package name leaves a hyphen in it, and a hyphen is not
    // valid in an environment variable name.
    variable: 'VITE_LOST_FOUND_API_URL',
  },
  {
    package: 'auth-api',
    role: 'auth_role',
    port: 3002,
    variable: 'VITE_AUTH_API_URL',
  },
  {
    package: 'flash-sale-api',
    role: 'flash_sale_role',
    port: 3003,
    variable: 'VITE_FLASH_SALE_API_URL',
  },
];

const connectionString = `postgres://${LOCAL_DB.user}:${LOCAL_DB.password}@${LOCAL_DB.host}:${LOCAL_DB.port}/${LOCAL_DB.database}`;

// ---------------------------------------------------------------------------
// 1. The schemas and the roles
// ---------------------------------------------------------------------------

async function createSchemas() {
  const initSql = readFileSync(join(here, 'init', '01-schemas.sql'), 'utf8');

  const client = await connectWhenReady();

  try {
    await client.query(initSql);
    console.log('[setup] schemas and roles ready');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[setup] could not create the schemas:', message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

/**
 * Connects, waiting for the container to be ready.
 *
 * `docker compose up -d` returns as soon as the container is created, not
 * as soon as PostgreSQL is accepting connections, so the first attempt often
 * fails on a cold start.
 */
async function connectWhenReady(attempts = 60) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    // A FRESH client each time: a client that failed to connect cannot be
    // connected again, so retrying with the same one fails differently.
    const client = new pg.Client({ connectionString });
    try {
      await client.connect();
      return client;
    } catch (error) {
      await client.end().catch(() => {});
      if (attempt === attempts) {
        console.error(
          '[setup] could not reach the local PostgreSQL. Is it running?\n' +
            '        pnpm db:up',
        );
        process.exit(1);
      }
      if (attempt === 1) console.log('[setup] waiting for the local PostgreSQL…');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. The service .env files
// ---------------------------------------------------------------------------

/**
 * One shared secret, so a token from the auth service is valid on the other
 * two — which is the behaviour the portfolio demonstrates.
 */
function sharedSecret() {
  const existing = readExistingSecret();
  if (existing) {
    console.log('[setup] reusing the JWT secret already in the .env files');
    return existing;
  }
  return randomBytes(48).toString('base64url');
}

/** The secret already written into a service's .env, if there is one. */
function readExistingSecret() {
  for (const service of SERVICES) {
    const path = join(root, 'services', service.package, '.env');
    if (!existsSync(path)) continue;
    const match = readFileSync(path, 'utf8').match(/^JWT_SECRET=(.+)$/m);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function writeServiceEnv(service, secret) {
  const path = join(root, 'services', service.package, '.env');
  const example = join(root, 'services', service.package, '.env.example');

  const body = `# The local development environment.
#
# Written by \`pnpm db:setup:local\`. Gitignored.
#
# This service connects as ITS OWN role, exactly as it does in production.
# The role's search_path points at this service's schema, so the service
# cannot reach the other services' tables even locally. Connecting as the
# superuser "gip" instead would leave the service looking in "public",
# where none of its tables are, and every query would fail.
#
# The three services share one JWT_SECRET. If they differ, every
# authenticated request fails with 401.

NODE_ENV=development
HOST=0.0.0.0
PORT=${service.port}
DATABASE_URL=postgres://${service.role}:${LOCAL_DB.password}@${LOCAL_DB.host}:${LOCAL_DB.port}/${LOCAL_DB.database}
JWT_SECRET=${secret}
JWT_ISSUER=gip-auth
JWT_AUDIENCE=gip
JWT_EXPIRES_IN=15m
CORS_ORIGINS=http://localhost:5173
RUN_MIGRATIONS=true
`;

  writeFileSync(path, body);
  console.log(`[setup] services/${service.package}/.env  (port ${service.port}, role ${service.role})`);
  return example;
}

// ---------------------------------------------------------------------------
// 3. The portfolio's .env.local
// ---------------------------------------------------------------------------

function writePortfolioEnv() {
  const path = join(root, 'apps', 'portfolio', '.env.local');
  const body = `# The portfolio, pointed at the LOCAL services.
#
# Written by \`pnpm db:setup:local\`. Gitignored.
#
# The deployed site gets these three URLs from the Netlify dashboard's
# environment variables, which are inlined into the bundle at build time.
# This file is the local equivalent.
#
# The origin must be exactly "localhost", not "127.0.0.1" — the services
# allow-list the origin, and the two are different strings to a browser.

${SERVICES.map((service) => `${service.variable}=http://localhost:${service.port}`).join('\n')}
`;
  writeFileSync(path, body);
  console.log('[setup] apps/portfolio/.env.local');
}

// ---------------------------------------------------------------------------
// The seed data
// ---------------------------------------------------------------------------

function seedFlashSale() {
  try {
    execFileSync('pnpm', ['seed:flash-sale'], { cwd: root, stdio: 'inherit' });
  } catch {
    // The seed is a convenience, not a requirement. The service works without
    // it; it just has no products to show.
    console.log('[setup] the seed did not run — run `pnpm seed:flash-sale` by hand if you want the products');
  }
}

// ---------------------------------------------------------------------------

await createSchemas();

const secret = sharedSecret();
for (const service of SERVICES) {
  writeServiceEnv(service, secret);
}
writePortfolioEnv();

seedFlashSale();

console.log('\n[setup] done. Now run:\n        pnpm dev\n');
console.log('[setup] the portfolio will be at http://localhost:5173');
