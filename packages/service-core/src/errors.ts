/**
 * The error envelope shared by every service.
 *
 * One shape for every failure, so a client can handle errors the same way
 * whichever API it called:
 *
 *   { "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [] } }
 *
 * The `code` is the machine-readable part and is what distinguishes two
 * failures that share a status — the Flash Sale API returns 409 for both a
 * sold-out product and a reused idempotency key, and the code is what tells
 * them apart.
 */

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_STATE: 'INVALID_STATE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ErrorDetail {
  /** Where the problem is, e.g. "body.type" or "query.page". */
  path: string;
  message: string;
}

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details: ErrorDetail[];
  };
}

/**
 * An error that carries an HTTP status and a machine-readable code.
 *
 * Anything thrown that is NOT an AppError is treated as a bug and reported
 * as a generic 500 — never with its message, which might contain a query,
 * a path or a secret.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details: ErrorDetail[];

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details: ErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  toEnvelope(): ErrorEnvelope {
    return {
      error: { code: this.code, message: this.message, details: this.details },
    };
  }
}

export const badRequest = (message: string, details: ErrorDetail[] = []) =>
  new AppError(400, ERROR_CODES.VALIDATION_ERROR, message, details);

export const unauthorized = (message = 'Authentication is required.') =>
  new AppError(401, ERROR_CODES.UNAUTHORIZED, message);

export const forbidden = (message = 'You do not have access to this resource.') =>
  new AppError(403, ERROR_CODES.FORBIDDEN, message);

export const notFound = (message = 'The requested resource does not exist.') =>
  new AppError(404, ERROR_CODES.NOT_FOUND, message);

export const conflict = (code: ErrorCode, message: string, details: ErrorDetail[] = []) =>
  new AppError(409, code, message, details);

export const invalidState = (message: string) =>
  new AppError(409, ERROR_CODES.INVALID_STATE, message);

export const serviceUnavailable = (message: string) =>
  new AppError(503, ERROR_CODES.SERVICE_UNAVAILABLE, message);
