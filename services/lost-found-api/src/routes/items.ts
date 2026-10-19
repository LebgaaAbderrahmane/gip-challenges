/**
 * The item report routes.
 *
 * Ownership is established from the verified token. A report is owned by
 * whoever created it, and only that user may update it or mark it recovered.
 */
import type { FastifyInstance } from 'fastify';
import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';

import {
  badRequest,
  forbidden,
  notFound,
  paginate,
  parsePagination,
  invalidState,
} from '@gip/service-core';

import '../types.ts';

import { itemReports } from '../db/schema.ts';
import {
  errorResponseSchema,
  itemListResponseSchema,
  itemReportSchema,
} from '../schemas.ts';
import { requireUser } from '../plugins/auth.ts';

/** The categories a report may be filed under. */
export const CATEGORIES = [
  'electronics',
  'documents',
  'clothing',
  'keys',
  'bags',
  'jewellery',
  'pets',
  'other',
] as const;

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_LOCATION_LENGTH = 160;
const MAX_CATEGORY_LENGTH = 60;

const createReportSchema = z.object({
  type: z.enum(['lost', 'found'], {
    error: 'The type must be either "lost" or "found".',
  }),
  title: z
    .string()
    .trim()
    .min(1, 'The title is required.')
    .max(MAX_TITLE_LENGTH, `The title must be at most ${MAX_TITLE_LENGTH} characters.`),
  description: z
    .string()
    .trim()
    .min(1, 'The description is required.')
    .max(
      MAX_DESCRIPTION_LENGTH,
      `The description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`,
    ),
  category: z
    .string()
    .trim()
    .min(1, 'The category is required.')
    .max(MAX_CATEGORY_LENGTH, `The category must be at most ${MAX_CATEGORY_LENGTH} characters.`),
  location: z
    .string()
    .trim()
    .min(1, 'The location is required.')
    .max(
      MAX_LOCATION_LENGTH,
      `The location must be at most ${MAX_LOCATION_LENGTH} characters.`,
    ),
  eventDate: z
    .string()
    .min(1, 'The event date is required.')
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: 'The event date must be a valid date.',
    })
    .transform((value) => new Date(value)),
});

const updateReportSchema = createReportSchema.partial();

const listQuerySchema = z.object({
  type: z.enum(['lost', 'found']).optional(),
  status: z.enum(['open', 'recovered']).optional(),
  category: z.string().trim().min(1).max(MAX_CATEGORY_LENGTH).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  location: z.string().trim().min(1).max(MAX_LOCATION_LENGTH).optional(),
  owner: z.enum(['mine', 'all']).optional(),
  sort: z.enum(['createdAt', 'eventDate']).default('createdAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

export async function itemRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Creates a report.
   *
   * The owner comes from the verified token. The request body has no owner
   * field at all, so a client cannot claim a report it does not own.
   */
  app.post(
    '/api/items',
    {
      preHandler: requireUser,
      schema: {
        tags: ['items'],
        summary: 'Create a lost or found report',
        description:
          'Creates a report. The owner is taken from the bearer token; there is no owner field in the body.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['type', 'title', 'description', 'category', 'location', 'eventDate'],
          properties: {
            type: { type: 'string', enum: ['lost', 'found'] },
            title: { type: 'string', minLength: 1, maxLength: MAX_TITLE_LENGTH },
            description: { type: 'string', minLength: 1, maxLength: MAX_DESCRIPTION_LENGTH },
            category: { type: 'string', minLength: 1, maxLength: MAX_CATEGORY_LENGTH },
            location: { type: 'string', minLength: 1, maxLength: MAX_LOCATION_LENGTH },
            eventDate: { type: 'string', format: 'date-time' },
          },
        },
        response: {
          201: { ...itemReportSchema, description: 'The created report' },
          400: { ...errorResponseSchema, description: 'The request is not valid' },
          401: { ...errorResponseSchema, description: 'Authentication is required' },
        },
      },
    },
    async (request, reply) => {
      const parsed = createReportSchema.safeParse(request.body);
      if (!parsed.success) {
        throw badRequest(
          'The report is not valid.',
          parsed.error.issues.map((issue) => ({
            path: `body.${issue.path.join('.')}`,
            message: issue.message,
          })),
        );
      }

      const user = request.user!;
      const [created] = await app.db
        .insert(itemReports)
        .values({ ...parsed.data, ownerId: user.id })
        .returning();

      return reply.code(201).send(created);
    },
  );

  /**
   * Lists and filters reports.
   */
  app.get(
    '/api/items',
    {
      schema: {
        tags: ['items'],
        summary: 'List and filter reports',
        description:
          'Lists reports with optional filters. A search term matches the title, description or location.',
        querystring: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['lost', 'found'] },
            status: { type: 'string', enum: ['open', 'recovered'] },
            category: { type: 'string' },
            q: { type: 'string' },
            location: { type: 'string' },
            owner: { type: 'string', enum: ['mine', 'all'] },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sort: { type: 'string', enum: ['createdAt', 'eventDate'], default: 'createdAt' },
            direction: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
        },
        response: {
          200: { ...itemListResponseSchema, description: 'A page of reports' },
        },
      },
    },
    async (request) => {
      const query = listQuerySchema.parse(request.query);
      const pagination = parsePagination(request.query);

      const filters: SQL[] = [];

      if (query.type) filters.push(eq(itemReports.type, query.type));
      if (query.status) filters.push(eq(itemReports.status, query.status));
      if (query.category) filters.push(eq(itemReports.category, query.category));
      if (query.location) {
        filters.push(ilike(itemReports.location, `%${escapeLike(query.location)}%`));
      }
      if (query.q) {
        const term = `%${escapeLike(query.q)}%`;
        const search = or(
          ilike(itemReports.title, term),
          ilike(itemReports.description, term),
          ilike(itemReports.location, term),
        );
        if (search) filters.push(search);
      }

      const where = filters.length > 0 ? and(...filters) : undefined;

      const rows = await app.db
        .select()
        .from(itemReports)
        .where(where)
        .orderBy(
          query.direction === 'asc'
            ? asc(itemReports[query.sort])
            : desc(itemReports[query.sort]),
        )
        .limit(pagination.limit)
        .offset((pagination.page - 1) * pagination.limit);

      const [countRow] = await app.db
        .select({ count: sql<number>`count(*)::int` })
        .from(itemReports)
        .where(where);

      return paginate(rows, countRow?.count ?? 0, pagination);
    },
  );

  /**
   * Returns one report.
   */
  app.get(
    '/api/items/:id',
    {
      schema: {
        tags: ['items'],
        summary: 'Get a report',
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: { ...itemReportSchema, description: 'The report' },
          404: { ...errorResponseSchema, description: 'No such report' },
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const report = await findReport(app, id);
      if (!report) throw notFound('There is no report with that id.');
      return report;
    },
  );

  /**
   * Updates a report. Only its owner may do so.
   */
  app.patch(
    '/api/items/:id',
    {
      preHandler: requireUser,
      schema: {
        tags: ['items'],
        summary: 'Update a report you own',
        description: 'Updates a report. Only the user who created it may change it.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: { ...itemReportSchema, description: 'The updated report' },
          400: { ...errorResponseSchema, description: 'The request is not valid' },
          401: { ...errorResponseSchema, description: 'Authentication is required' },
          403: { ...errorResponseSchema, description: 'You do not own this report' },
          404: { ...errorResponseSchema, description: 'No such report' },
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const parsed = updateReportSchema.safeParse(request.body);
      if (!parsed.success) {
        throw badRequest(
          'The report is not valid.',
          parsed.error.issues.map((issue) => ({
            path: `body.${issue.path.join('.')}`,
            message: issue.message,
          })),
        );
      }

      if (Object.keys(parsed.data).length === 0) {
        throw badRequest('At least one field must be supplied.');
      }

      const user = request.user!;
      const report = await findReport(app, id);
      if (!report) throw notFound('There is no report with that id.');
      if (report.ownerId !== user.id) {
        throw forbidden('Only the user who created this report may change it.');
      }

      const [updated] = await app.db
        .update(itemReports)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(itemReports.id, id))
        .returning();

      return updated;
    },
  );

  /**
   * Marks a report as recovered. Only its owner may do so.
   */
  app.patch(
    '/api/items/:id/recover',
    {
      preHandler: requireUser,
      schema: {
        tags: ['items'],
        summary: 'Mark a report you own as recovered',
        description:
          'Marks a report as recovered. Only the user who created it may do so, and only once.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: { ...itemReportSchema, description: 'The recovered report' },
          401: { ...errorResponseSchema, description: 'Authentication is required' },
          403: { ...errorResponseSchema, description: 'You do not own this report' },
          404: { ...errorResponseSchema, description: 'No such report' },
          409: { ...errorResponseSchema, description: 'The report is already recovered' },
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      const report = await findReport(app, id);
      if (!report) throw notFound('There is no report with that id.');
      if (report.ownerId !== user.id) {
        throw forbidden('Only the user who created this report may change it.');
      }
      if (report.status === 'recovered') {
        throw invalidState('This report has already been marked as recovered.');
      }

      const [updated] = await app.db
        .update(itemReports)
        .set({ status: 'recovered', updatedAt: new Date() })
        .where(eq(itemReports.id, id))
        .returning();

      return updated;
    },
  );
}

/** Finds a report by id, or undefined. */
async function findReport(app: FastifyInstance, id: string) {
  const rows = await app.db.select().from(itemReports).where(eq(itemReports.id, id)).limit(1);
  return rows[0];
}

/**
 * Escapes the LIKE wildcards, so a search for "100%" does not match
 * everything.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
