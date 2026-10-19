/**
 * The Lost & Found API application factory.
 *
 * The factory takes its dependencies as arguments so the tests can build a
 * real application against a real database, and so the same code serves the
 * development server and the deployed one.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { eq, sql } from 'drizzle-orm';

import { itemReports } from './db/schema.ts';

import {
  AppError,
  ERROR_CODES,
  createDatabase,
  loadConfig,
  parsePagination,
  registerHealth,
  type Database,
  type ServiceConfig,
} from '@gip/service-core';

import { itemRoutes } from './routes/items.ts';
import { authPlugin } from './plugins/auth.ts';

export interface BuildAppOptions {
  config?: ServiceConfig;
  /** An existing database, so tests can supply their own. */
  database?: ReturnType<typeof createDatabase>;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config =
    options.config ??
    loadConfig(process.env, { schema: 'lost_found', requireJwt: 'verify' });

  const database =
    options.database ??
    createDatabase({
      connectionString: config.databaseUrl,
      schema: config.schema,
      // Drizzle needs the table objects to map rows into typed objects.
      tables: { itemReports },
    });

  const app = Fastify({
    logger: {
      level: config.nodeEnv === 'test' ? 'silent' : 'info',
    },
    // A request id is included in every response and every log line, so a
    // report can be traced end to end.
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
  });

  app.decorate('config', config);
  // The one unavoidable cast: the Fastify augmentation cannot know this
  // service's table types, so the concrete client is widened to the declared
  // shape here and nowhere else.
  app.decorate('db', database.db as unknown as Database);
  app.decorate('pool', database.pool);

  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: false,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Lost & Found API',
        description:
          'Report lost and found items, search and filter reports, update your own reports and mark items as recovered.',
        version: '1.0.0',
      },
      tags: [
        { name: 'items', description: 'Lost and found reports' },
        { name: 'health', description: 'Service health' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description:
              'A JWT issued by the auth service. The owner of a report is taken from the token, never from the request body.',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  await app.register(authPlugin, {
    secret: config.jwtSecret!,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(error.toEnvelope());
    }

    // A Zod failure that reached here was not caught by the route handler.
    if (error instanceof Error && error.name === 'ZodError') {
      return reply.code(400).send({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'The request is not valid.',
          details: [],
        },
      });
    }

    /*
     * Fastify's own schema validation, which runs BEFORE the route handler
     * for the body, the query and the parameters.
     *
     * Without this branch its error would be treated as an unknown fault and
     * reported as a 500, which is wrong: a client sending a malformed body
     * has made a mistake, not broken the server.
     */
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

    // Anything else is a bug. The message is logged but NOT returned, because
    // it may contain a query, a path or a secret.
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
    service: 'lost-found-api',
  });

  // The specification is also served from a stable path, so a client does not
  // have to know where the Swagger UI happens to keep it.
  app.get('/openapi.json', async () => app.swagger());

  /*
   * The root route.
   *
   * The base URL is the first thing anyone pastes into a browser, and a 404
   * there reads as a broken service rather than as an API that simply has no
   * root resource. So the root says what this is and where to go next.
   */
  app.get('/', async () => ({
    service: 'lost-found-api',
    title: 'Lost & Found API',
    summary: 'Report, search, update and recover lost and found items.',
    links: {
      documentation: '/docs',
      specification: '/openapi.json',
      health: '/health',
    },
  }));

  await app.register(itemRoutes);

  app.addHook('onClose', async () => {
    await database.pool.end();
  });

  return app;
}

export { eq, sql, parsePagination };
