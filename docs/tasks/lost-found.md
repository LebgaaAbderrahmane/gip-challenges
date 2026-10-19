# gip-01 — Lost & Found API

> Source: [`services/lost-found-api/`](../../services/lost-found-api/)
> Demo: `/tasks/lost-found`

## 1. Problem statement

> Build an API that allows users to report lost items, report found items, search and filter
> reported items, view the details of the item, update their own reports & mark an item as
> recovered.
>
> — challenge brief, `docs/brief.md`

## 2. Constraints from the brief

| Constraint | Status |
|---|---|
| "You are free to use any technology you want." | Fastify 5 · TypeScript · Zod · Drizzle · PostgreSQL |
| "No frontend is required" | An embedded API tester is provided as an evaluation aid; the API is the deliverable |

Every capability the brief names is implemented: report lost items, report found items, search
and filter, view details, update your own reports, and mark an item recovered.

## 3. Implementation approach

| File | Responsibility |
|---|---|
| `src/app.ts` | The Fastify application factory |
| `src/server.ts` | The entrypoint |
| `src/routes/items.ts` | The report endpoints |
| `src/lib/auth.ts` | Token verification |
| `src/plugins/auth.ts` | The authentication plugin |
| `src/db/schema.ts` | The Drizzle table definition |
| `src/db/migrate.ts` | The migration runner |
| `src/schemas.ts` | The response schemas |
| `migrations/*.sql` | The schema, owned by this service |

The application is built by a **factory** that takes its dependencies as arguments, so the tests
build the real application against a real database, and the same code serves development and
production.

## 4. The API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/items` | Create a lost or found report |
| `GET` | `/api/items` | List and filter reports |
| `GET` | `/api/items/:id` | Get one report |
| `PATCH` | `/api/items/:id` | Update a report **you own** |
| `PATCH` | `/api/items/:id/recover` | Mark a report **you own** as recovered |
| `GET` | `/health` | Service and database health |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/openapi.json` | The OpenAPI specification |

**List filters:** `type`, `status`, `category`, `q` (searches title, description and location),
`location`, `page`, `limit`, `sort` (`createdAt` or `eventDate`) and `direction`.

The list response uses the shared envelope:

```json
{
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 1 }
}
```

## 5. Ownership, and why the owner is not a request field

The brief says users update **their own** reports, so ownership has to be trustworthy. The
create request body has **no owner field at all** — the owner is taken from the verified token, so
a client cannot claim a report it does not own. A test sends an `ownerId` in the body and asserts
it is ignored.

**Tokens are verified locally.** The Auth service signs them; this service verifies the signature
with the same secret rather than calling the Auth service on every request. That avoids a network
hop in the hot path and a cascading failure when the Auth service is slow. The cost is a shared
secret, which is a real boundary and is documented in `docs/architecture.md`.

**The signing algorithm is pinned** to HS256. A token that names its own algorithm is never
trusted — that is how the `alg: none` and HMAC/RSA confusion attacks work. A test sends a token
claiming `alg: none` and asserts it is rejected.

## 6. Status codes

| Code | When |
|---|---|
| `201` | A report was created |
| `200` | A read, update or recovery succeeded |
| `400` | The request is not valid |
| `401` | No token, or the token is missing, malformed, expired or wrongly signed |
| `403` | Authenticated, but not the owner |
| `404` | No such report |
| `409` | The report has already been recovered |

Every failure uses the same envelope:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [] } }
```

The `code` is the machine-readable part. An unknown error is reported as a generic 500 with **no
message** — the real one is logged, because it may contain a query, a path or a secret.

## 7. The database

One PostgreSQL instance, one schema per service:

| Schema | Owner |
|---|---|
| `lost_found` | `lost_found_role` |
| `lost_found_test` | `lost_found_role` |

The service connects as its own role with `search_path` set to its own schema, so it cannot read
or write another service's tables even by accident. This is verified, not assumed — the
development bootstrap denies a cross-schema write.

Migrations are plain SQL, applied in order and recorded in a `migrations` table, so running them
twice is safe. Each migration and its record are applied in one transaction.

## 8. Test cases and actual results

**38 tests, all passing**, against a real PostgreSQL instance. The application is the real one;
only the server is replaced, and requests go through Fastify's `inject`, which exercises routing,
validation, authentication, the database and the error handler.

| Area | What is asserted |
|---|---|
| Create | Returns 201 with the report; owner comes from the token; an `ownerId` in the body is ignored |
| Authentication | Missing token → 401; wrong signing key → 401; expired token → 401; `alg: none` → 401 |
| Validation | Missing title, description, location, invalid type, invalid date, over-long title → 400 |
| List | Pagination envelope; page and limit; a limit above the maximum → 400 |
| Filters | By type, by category, and a search across title, description and location |
| Wildcards | A `%` in the search does not match everything — LIKE wildcards are escaped |
| Sorting | By `eventDate`, ascending and descending |
| Read | Returns the report; unknown id → 404; a malformed id → 400 |
| Update | The owner may update; **another user gets 403**; a token is required; an empty update → 400; invalid fields → 400 |
| Recover | The owner may recover; another user gets 403; recovering twice → 409 |
| Health | Reports `ok` and the database state; discloses no credentials, host or connection string |
| OpenAPI | Every route is described; the bearer scheme is documented |
| Errors | A consistent envelope for an unknown route; no stack trace in the response |

### Verified over real HTTP

The running server was exercised with `curl`:

```
health              {"status":"ok","service":"lost-found-api","database":"ok"}
create              201, full report body
list                {"data":[…],"pagination":{…}}
search 'wallet'     1 match
update as owner     status: open, title: Updated title
update as another   403
recover as owner    status: recovered
recover twice       409
no token            401
invalid body        400
bad token           401
/openapi.json       200      /docs   200
```

## 9. Links and limitations

- Source: [`services/lost-found-api/`](../../services/lost-found-api/)
- Shared scaffolding: [`packages/service-core/`](../../packages/service-core/)
- API: `/api` on the deployed host · Swagger at `/docs`

**Limitations.** The owner is identified by the token's subject, which is a user id issued by the
Auth service; this service does not manage users. Reports are never deleted — a report moves
between `open` and `recovered`, and recovering an already-recovered report is a conflict rather
than a silent no-op. The `owner` list filter is not implemented, because "mine" is a
per-user filter and the list endpoint is public; the ownership check applies to writes, which is
where the brief requires it.
