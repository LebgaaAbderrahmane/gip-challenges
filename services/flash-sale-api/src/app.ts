/**
 * The Flash Sale API application factory.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import {
  AppError,
  ERROR_CODES,
  createDatabase,
  loadConfig,
  registerHealth,
  type ServiceConfig,
} from '@gip/service-core';

import { products } from './db/schema.ts';
import { flashSaleRoutes } from './routes/flashSale.ts';
import { demoRoutes } from './routes/demo.ts';
import { errorResponseSchema } from './schemas.ts';
import './types.ts';

export interface BuildAppOptions {
  config?: ServiceConfig;
  database?: ReturnType<typeof createDatabase>;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config =
    options.config ??
    loadConfig(process.env, { schema: 'flash_sale', requireJwt: 'verify' });

  const database =
    options.database ??
    createDatabase({
      connectionString: config.databaseUrl,
      schema: config.schema,
      tables: { products },
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

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Flash Sale API',
        description:
          'Browse products, place orders, and never oversell. Stock is reserved with a single conditional UPDATE, and a retried request returns the original order instead of creating a second one.',
        version: '1.0.0',
      },
      tags: [
        { name: 'products', description: 'The products on sale' },
        { name: 'orders', description: 'Placing and listing orders' },
        { name: 'health', description: 'Service health' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description:
              'A JWT issued by the auth service. Without one, a demo customer id is used, which is clearly a demo and is not a verified identity.',
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
    service: 'flash-sale-api',
  });

  app.get('/openapi.json', async () => app.swagger());

  /*
   * The root route.
   *
   * The base URL is the first thing anyone pastes into a browser, and a 404
   * there reads as a broken service rather than as an API that simply has no
   * root resource. So the root says what this is and where to go next.
   */
  app.get('/', async () => ({
    service: 'flash-sale-api',
    title: 'Flash Sale API',
    summary: 'Browse products, place orders, and see the stock under concurrency.',
    links: {
      documentation: '/docs',
      specification: '/openapi.json',
      health: '/health',
    },
  }));

  await app.register(flashSaleRoutes);
  await app.register(demoRoutes);

  app.addHook('onClose', async () => {
    await database.pool.end();
  });

  return app;
}

export { errorResponseSchema };
