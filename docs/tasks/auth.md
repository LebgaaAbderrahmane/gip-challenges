# gip-05 — Authentication API

> Source: [`services/auth-api/`](../../services/auth-api/)
> Demo: `/tasks/auth`

## 1. Problem statement

> Build signup/login endpoints with password hashing and JWT issuing/verification.
>
> — challenge brief, `docs/brief.md`

## 2. Constraints from the brief

| Constraint | Status |
|---|---|
| "you will be asked to build **secured** signup/login endpoints" | Argon2id, rate limiting, generic failures, pinned algorithms |
| "JWT issuing and verification" | Issued on login, verified locally by every service |
| "in any language/framework of your choice" | Fastify 5 · TypeScript · Zod · Drizzle · PostgreSQL |

## 3. Implementation approach

| File | Responsibility |
|---|---|
| `src/app.ts` | The Fastify application factory |
| `src/routes/auth.ts` | The four endpoints |
| `src/lib/crypto.ts` | Password hashing, email normalisation, token issuing |
| `src/db/schema.ts` | The user model |
| `src/db/migrate.ts` | The migration runner |
| `src/schemas.ts` | The response schemas |
| `migrations/*.sql` | The schema, owned by this service |

## 4. The API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/signup` | Create an account |
| `POST` | `/api/auth/login` | Exchange credentials for a token |
| `GET` | `/api/auth/me` | The authenticated user |
| `GET` | `/api/auth/verify` | Verify a token |
| `GET` | `/health` | Service and database health |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/openapi.json` | The OpenAPI specification |

A login returns the token, its type, its lifetime, and the user:

```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9…",
  "tokenType": "Bearer",
  "expiresIn": "15m",
  "user": { "id": "…", "email": "ada@example.test", "createdAt": "…" }
}
```

## 5. Password hashing

**Argon2id**, with a deliberately generous cost:

| Parameter | Value | Why |
|---|---|---|
| `type` | `argon2id` | The hybrid of Argon2i and Argon2d — resists both side-channel and GPU attacks |
| `memoryCost` | 65 536 (64 MiB) | Memory-hard, so a stolen hash is expensive to attack in bulk |
| `timeCost` | 3 | Passes |
| `parallelism` | 1 | Matches the widely used guidance for interactive logins |

The plaintext password is never stored, never logged, and never returned. The
response schema has no `passwordHash` property at all, so it cannot reach the
wire even by accident — and the OpenAPI document does not mention it either.

**The email is normalised** — trimmed and lowercased — before it is stored, so
`Ada@EXAMPLE.test` and `ada@example.test` are one account. A unique index on
the column is the last line of defence against two accounts for one address if
two signups race.

## 6. Tokens

| Property | Value |
|---|---|
| Algorithm | **HS256, pinned** |
| Claims | `sub`, `email`, `iat`, `exp` — nothing else |
| Lifetime | 15 minutes |
| Issuer | `gip-auth` |
| Audience | `gip` |

**The algorithm is pinned.** A token that names its own algorithm is never
trusted, because that is how the `alg: none` attack works, and how the
HMAC/RSA confusion works. `jose` is given `algorithms: ['HS256']`, so a token
claiming anything else is rejected.

**The claims are minimal.** A token is readable by whoever holds it — it is
just base64 — so nothing sensitive goes in. No password, no hash, no
permissions.

**The other services verify locally**, with the same shared secret, rather
than calling this service on every request. That avoids a network hop in the
hot path and a cascading failure when this service is slow.

## 7. Failure behaviour

| Case | Result |
|---|---|
| Duplicate email | `409 CONFLICT` |
| Wrong password | `401 UNAUTHORIZED` |
| Unknown email | `401 UNAUTHORIZED` |
| Malformed request | `400 VALIDATION_ERROR` |
| Too many attempts | `429 RATE_LIMITED` |
| Missing, malformed, expired, wrongly-signed or wrong-algorithm token | `401 UNAUTHORIZED` |

**The failure message is identical** whether the account exists or the password
is wrong, so the endpoint cannot be used to discover which addresses are
registered. A test asserts the two messages are byte-for-byte the same.

**The timing is identical too.** When the account does not exist, a hash of a
random password is verified anyway, so the response takes the same time as a
real check. Without it, a missing account would return noticeably faster, which
is a timing oracle.

**Login and signup are rate limited** — 10 attempts a minute per address, and
429 with the standard envelope once that is reached. A test builds the app
with a limit of 3 and asserts the limit is enforced.

## 8. The database

One schema, one role, as with the other services:

| Schema | Role |
|---|---|
| `auth` | `auth_role` |
| `auth_test` | `auth_test_role` |

The integration tests run as the **restricted test role**, so they have the
same isolation as production rather than running as a superuser.

## 9. Test cases and actual results

**32 tests, all passing**, against a real PostgreSQL instance.

| Area | What is asserted |
|---|---|
| Signup | Creates the account; the response contains no hash and no password |
| Storage | The stored value is an `$argon2id$` hash, not the password |
| Duplicate | A duplicate email → 409; a differently-cased one → 409; the stored email is normalised |
| Validation | Missing email, malformed email, missing password, short password → 400 |
| Login | Correct credentials issue a token; the token works at `/me`; a wrong password → 401 |
| Indistinguishable failures | The message and code are identical for a wrong password and an unknown account |
| Token | Rejects a malformed token, a token signed with the wrong key, an expired token, a token with `alg: none`, and a token from the wrong issuer |
| `/me` | Requires a token; returns the user; never includes a hash |
| `/verify` | Reports a valid token; rejects a token with no user behind it |
| Rate limiting | The limit is enforced and reported as `RATE_LIMITED` |
| Health | Reports the real state; discloses no credentials |
| OpenAPI | Every route is described; the document never mentions a password hash |
| Errors | A consistent envelope; no stack trace in the response |

### Verified over real HTTP, against Neon

```
signup        201  {"id":"3ed9c40e…","email":"ada@example.test","createdAt":"…"}
login         200  {"token":"eyJhbGciOiJIUzI1NiJ9…","tokenType":"Bearer","expiresIn":"15m",…}
/me           200  {"id":"3ed9c40e…","email":"ada@example.test",…}
/verify       200  {"valid":true,"user":{…}}
duplicate     409
wrong pass    401
stored value  {"email":"ada@example.test","hash":"$argon2id$v=19$m=65536,t=3,p=1"}
```

## 10. Links and limitations

- Source: [`services/auth-api/`](../../services/auth-api/)
- Tests: [`auth.test.ts`](../../services/auth-api/tests/auth.test.ts),
  [`rateLimit.test.ts`](../../services/auth-api/tests/rateLimit.test.ts)
- API: `/api` on the deployed host · Swagger at `/docs`

**Limitations.** There is no email verification, no password reset and no
refresh token — the brief asks for signup, login, hashing and JWT issuing and
verification, and a reset flow needs an email transport that the free tier
does not provide. Accounts cannot be deleted through the API. The rate limit is
per address rather than per account, so several users behind one address share
a budget.
