/**
 * The API tester's types.
 */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** A path parameter, e.g. {id}. */
export interface PathParameter {
  name: string;
  placeholder: string;
  label: string;
}

export interface ApiOperation {
  id: string;
  label: string;
  method: HttpMethod;
  /** The path, with {placeholders} for the parameters. */
  path: string;
  /** Whether a bearer token is needed. */
  requiresAuth: boolean;
  /** The path parameters this operation takes. */
  parameters?: PathParameter[];
  /** The example request body, for the write operations. */
  body?: unknown;
  /** What the operation demonstrates, shown under the picker. */
  description: string;
}

export interface ApiService {
  /** The service's name, e.g. "Lost & Found API". */
  name: string;
  /** The base URL every path is relative to. */
  baseUrl: string;
  /** The operations this service exposes. */
  operations: ApiOperation[];
}

/** The outcome of a request. */
export type RequestOutcome =
  /** Nothing has been sent yet. */
  | { kind: 'idle' }
  | { kind: 'pending' }
  | {
      kind: 'success';
      status: number;
      statusText: string;
      durationMs: number;
      /** The parsed body, when the response was JSON. */
      body: unknown;
      /** The raw body, when it was not JSON. */
      rawBody: string;
      headers: Record<string, string>;
    }
  | {
      kind: 'failure';
      /** The HTTP status, when the server answered. */
      status?: number;
      durationMs: number;
      /** Why it failed, in a form a person can act on. */
      message: string;
      /** Whether a retry is worth trying. */
      retryable: boolean;
    };
