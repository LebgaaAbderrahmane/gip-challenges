/**
 * Pagination shared by every list endpoint.
 *
 * The limits are enforced in one place, so no endpoint can accidentally
 * accept `limit=100000` and try to return the whole table.
 */
import { z } from 'zod';

import { badRequest } from './errors.ts';

/** The largest page a client may ask for. */
export const MAX_LIMIT = 100;
/** The default page size. */
export const DEFAULT_LIMIT = 20;

/** Query parameters for a paginated list. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** The envelope a list endpoint returns. */
export interface Paginated<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Builds the pagination envelope.
 *
 * `totalPages` is at least 1 even when there are no results, so a client
 * does not have to guard against a division by zero.
 */
export function paginate<T>(data: T[], total: number, query: PaginationQuery): Paginated<T> {
  return {
    data,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

/**
 * Parses a pagination query, turning a Zod failure into the standard
 * validation error.
 */
export function parsePagination(input: unknown): PaginationQuery {
  const result = paginationQuerySchema.safeParse(input);
  if (!result.success) {
    throw badRequest(
      'The pagination parameters are not valid.',
      result.error.issues.map((issue) => ({
        path: `query.${issue.path.join('.')}`,
        message: issue.message,
      })),
    );
  }

  return result.data;
}
