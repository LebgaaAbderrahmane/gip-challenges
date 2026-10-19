/**
 * The Authentication API application factory.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import rateLimit from '@fastify/rate-limit';

import {
  AppError,
  ERROR_CODES,
  createDatabase,
  loadConfig,
  registerHealth,
  type ServiceConfig,
} from '@gip/service-core';

import { users } from './db/schema.ts';
import { authRoutes } from './routes/auth.ts';
import { errorResponseSchema, healthResponseSchema } from './schemas.ts';
import './types.ts';

export interface BuildAppOptions {
  config?: ServiceConfig;
  database?: ReturnType<typeof createDatabase>;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config =
    options.config ?? loadConfig(process.env, { schema: 'auth', requireJwt: 'sign' });

  const database =
    options.database ??
    createDatabase({
      connectionString: config.databaseUrl,
      schema: config.schema,
      tables: { users },
    });

  const app = Fastify({
    logger: { level: config.nodeEnv === 'test' ? 'silent' : 'info' },
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
  });

  app.decorate('config', config);
  app.decorate('db', database.db as never);
  app.decorate('pool', database.pool);

  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: false,
  });

  /*
   * Rate limiting.
   *
   * Signup and login are the two endpoints worth limiting: signup is an
   * email-verification cost, and login is a password-guessing target. The
   * per-route limits are set in the route options; this is the global
   * fallback.
   */
  await app.register(rateLimit, {
    global: false,
    max: 300,
    timeWindow: '1 minute',
    // The rate limiter keys on the client address, which is the real address
    // because trustProxy is on and Render sets X-Forwarded-For.
    keyGenerator: (request) => request.ip,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Authentication API',
        description:
          'Signup and login with Argon2id password hashing, and JWT issuing and verification.',
        version: '1.0.0',
      },
      tags: [
        { name: 'auth', description: 'Accounts and tokens' },
        { name: 'health', description: 'Service health' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'A JWT issued by this service.',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(error.toEnvelope());
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return reply.code(400).send({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'The request is not valid.',
          details: [],
        },
      });
    }

    // Fastify's own schema validation, which runs before the route handler.
    const validation = (error as { validation?: unknown }).validation;
    if (validation) {
      const context = (error as { validationContext?: string }).validationContext ?? '';
      const issues = Array.isArray(validation) ? validation : [];

      return reply.code(400).send({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'The request is not valid.',
          details: issues.map((issue) => {
            const params = (issue as { params?: { missingProperty?: string } }).params;
            const path = (issue as { instancePath?: string }).instancePath ?? '';
            return {
              path: `${context}${path}${params?.missingProperty ? `.${params.missingProperty}` : ''}`,
              message: (issue as { message?: string }).message ?? 'is not valid',
            };
          }),
        },
      });
    }

    // The rate limiter's own error.
    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply.code(429).send({
        error: {
          code: ERROR_CODES.RATE_LIMITED,
          message: 'Too many attempts. Please wait a moment and try again.',
          details: [],
        },
      });
    }

    request.log.error({ err: error }, 'unhandled error');
    return reply.code(500).send({
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Something went wrong while handling the request.',
        details: [],
      },
    });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({
      error: {
        code: ERROR_CODES.NOT_FOUND,
        message: 'The requested route does not exist.',
        details: [],
      },
    }),
  );

  registerHealth(app, {
    pool: database.pool,
    schema: config.schema,
    service: 'auth-api',
  });

  app.get('/openapi.json', async () => app.swagger());

  await app.register(authRoutes);

  app.addHook('onClose', async () => {
    await database.pool.end();
  });

  return app;
}

export { healthResponseSchema, errorResponseSchema };
