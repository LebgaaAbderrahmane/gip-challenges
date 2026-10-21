# Architecture

How the system is put together, and why. This document covers the shape of the whole thing; each
challenge has its own document under [`docs/tasks/`](./tasks/) for the detail of that particular
problem.

---

## 1. The shape of it

Seven challenges, one brief, one repository. Three of them are backends that are actually
deployed, two are frontends that the brief forbids a framework for, and two are algorithms. The
interesting engineering is in how they share one repository, one database instance and one
signing secret without being able to interfere with each other.

```
                         ┌──────────────────────────────────────────┐
                         │  Netlify — static build                  │
                         │  abderrahmane-gip-challenge.netlify.app  │
                         │                                          │
                         │  React 19 · Vite · React Router          │
                         │  ┌────────────┬───────────┬───────────┐  │
                         │  │ 7 challenge│ API       │ Flash Sale│  │
                         │  │  pages     │ tester    │ lab       │  │
                         │  └────────────┴───────────┴───────────┘  │
                         │  ┌────────────────────────────────────┐  │
                         │  │  <iframe> × 2 — vanilla demos      │  │
                         │  │  copied verbatim at build time    │  │
                         │  └────────────────────────────────────┘  │
                         └───────────────┬──────────────────────────┘
                                         │  HTTPS, from the browser
             ┌───────────────────────────┼───────────────────────────┐
             │                           │                           │
   ┌─────────▼─────────┐     ┌───────────▼─────────┐     ┌───────────▼─────────┐
   │ Render            │     │ Render              │     │ Render              │
   │ Lost & Found API  │     │ Auth API            │     │ Flash Sale API      │
   │ Fastify 5         │     │ Fastify 5           │     │ Fastify 5           │
   │ port 10000        │     │ port 10000          │     │ port 10000          │
   └─────────┬─────────┘     └───────────┬─────────┘     └───────────┬─────────┘
             │                           │                           │
             └───────────────────────────┼───────────────────────────┘
                                         │  one Neon instance
                    ┌────────────────────┴────────────────────┐
                    │  PostgreSQL 17 — three schemas,        │
                    │  three roles, no cross-access          │
                    │                                         │
                    │  ┌────────────┐ ┌────────┐ ┌───────────┐ │
                    │  │ lost_found │ │ auth   │ │flash_sale │ │
                    │  └────────────┘ └────────┘ └───────────┘ │
                    └──────────────────────────────────────────┘
```

**The portfolio never touches the database.** It makes ordinary HTTP requests to the deployed
APIs, exactly as a browser would. There is no server-side component to the portfolio at all: it
is a static build, so there is nothing to keep running and nothing to attack.

---

## 2. The boundaries

### 2.1 Repository

One pnpm workspace, six deployable packages and one shared package.

```
apps/
  portfolio/       React 19 · Vite 8 · TypeScript · React Router 7 · Tailwind 4
  calculator/      vanilla HTML/CSS/JS — no framework, no build step
  autocomplete/    vanilla HTML/CSS/JS, the supplied data.js used unmodified
services/
  lost-found-api/  Fastify 5 · Zod · Drizzle
  auth-api/        Fastify 5 · Zod · Drizzle · Argon2
  flash-sale-api/  Fastify 5 · Zod · Drizzle
packages/
  service-core/    the error envelope, pagination, config, the database pool, the migration runner
docs/              the brief, the plan, this document, the jury guide, one document per challenge
scripts/           the database setup and the demo sync
```

`packages/service-core` is the only shared code, and it is shared for three reasons that came up
in more than one service: the **error envelope** (so a client handles errors the same way
whichever API it called), **pagination** (so list endpoints behave the same way), and the
**migration runner** (so migrations are safe to run concurrently on deploy).

The plan also proposed `packages/api-contracts` and `packages/test-utils`. They were removed:
there was no real shared code for them to hold, and an empty package is a promise the repository
does not keep.

### 2.2 Deployment

| Package | Host | Kind |
|---|---|---|
| `portfolio` | Netlify | static build |
| `lost-found-api` | Render (free) | Fastify, `PORT=10000` |
| `auth-api` | Render (free) | Fastify, `PORT=10000` |
| `flash-sale-api` | Render (free) | Fastify, `PORT=10000` |

Each service is deployed from its own directory and owns its own migrations. A service can be
redeployed without touching the others — which is what makes the three independent rather than
merely separate.

**Why Netlify for the site and Render for the APIs.** The site is a static bundle, so it wants a
host that serves files and nothing else. The APIs are long-lived processes on a free tier, and
the site's own bundler is no place to run them. Details in
[`docs/deployment.md`](./deployment.md).

---

## 3. The request flow

The portfolio's API tester is the interesting case, because it is a **browser** calling a
**third-party origin**.

```
  Browser tab
    │
    │  fetch(POST https://gip-auth-api.onrender.com/api/auth/login)
    │  Authorization: Bearer <token>
    │
    ▼
  ┌──────────────────────────────────────────────────────────┐
  │ Render: Fastify                                         │
  │  1. @fastify/cors — the origin is checked against        │
  │     CORS_ORIGINS. A request without a matching Origin    │
  │     gets no CORS headers, so the browser blocks it.      │
  │  2. @fastify/rate-limit — 10 per minute on login/signup  │
  │  3. Zod validates the body.                               │
  │  4. The route handler.                                    │
  │  5. Drizzle issues the query.                             │
  │  6. The error handler turns anything thrown into the      │
  │     shared error envelope.                                │
  └──────────────────────────────────────────────────────────┘
    │
    ▼
  Neon (pooled) → PostgreSQL → the service's own schema
```

Two details in that flow are worth calling out, because both were found the hard way.

**CORS is enforced by the browser, not by the server.** A cross-origin `fetch` that the server
refuses to bless does not fail with a useful error — it fails in the console, with an error that
reads like a network problem. The portfolio's tester therefore does not hide that: when a
request fails, it offers two ordinary links, `/health` and `/docs`. They open as normal
navigations, which bypass CORS entirely. If those work, the address is right and the problem is
CORS. If they 404, the address is wrong. That turns an opaque failure into a diagnosis.

**The error envelope is one shape for every service.**

```json
{ "error": { "code": "CONFLICT", "message": "…", "details": [] } }
```

The `code` is the machine-readable part, and it is what distinguishes two failures that share a
status. The Flash Sale API returns `409` both for a sold-out product and for a reused
idempotency key; the code is what tells them apart. Anything thrown that is *not* an
`AppError` is treated as a bug and reported as a generic `500` — never with its message, which
might contain a query, a path or a secret.

---

## 4. The database

### 4.1 One instance, three schemas, three roles

All three services share a single Neon PostgreSQL instance. What they do **not** share is
access.

| Schema | Owner role | Holds |
|---|---|---|
| `lost_found` | `lost_found_role` | `item_reports` |
| `auth` | `auth_role` | `users` |
| `flash_sale` | `flash_sale_role` | `products`, `orders` |

Each service connects with **its own role**, and that role's `search_path` points at its own
schema. The separation is therefore enforced by PostgreSQL, not by convention: a service cannot
read or write another service's tables even if its code tried to.

This was verified directly against the live database — each role can write its own schema,
cannot write `public`, and cannot read the other services' tables.

**Why the role's `search_path` and not a connection option.** Neon's pooler rejects
`search_path` in the startup package (`unsupported startup parameter in options: search_path`),
so passing it as a connection option would break every hosted deployment while working perfectly
locally. Setting it on the role works everywhere — the pooler applies role settings at login —
and it moves the guarantee from "the code passes the right thing" to "the database refuses
anything else".

Each service also has a `*_test` schema with its own role, truncated between suites. The tests
run against a real PostgreSQL with the same isolation, so a test cannot accidentally pass by
reading production-shaped data.

### 4.2 The data models

**`lost_found.item_reports`** — a UUID primary key, a `report_type` enum (`lost`/`found`), a
`report_status` enum (`open`/`recovered`), the descriptive fields, and `owner_id`. The list
endpoint filters on status, type and owner, so each of those is indexed.

**`auth.users`** — a UUID, a normalised `email` with a unique index, and `password_hash`. The
plaintext password is never stored, and the unique index is the last line of defence against two
accounts for one address if two sign-ups race.

**`flash_sale.products`** — a UUID, a name, and `price_cents BIGINT` with
`CHECK (price_cents >= 0)`. **The price is an integer number of cents, never a float.** Float
arithmetic on money is not exact, and "€10.10 + €0.20" is not "€10.30" in binary floating point.

**`flash_sale.orders`** — a UUID, the product, the customer, the quantity, the unit and total
price **captured at the time of the order** (so a later price change cannot alter an order that
has already been placed), the `idempotency_key`, and a `request_fingerprint`.

### 4.3 Migrations

Each service owns its migrations and runs them at start-up, behind a **PostgreSQL advisory
lock**. `CREATE TABLE IF NOT EXISTS` is not safe under concurrency — two instances starting at
the same time can both decide the table does not exist and both try to create it. The advisory
lock serialises the runners, so the second one waits and then finds the table already there.

The migrations also contain two PostgreSQL-specific details worth recording, because both caused
a real failure:

- **`CREATE TYPE IF NOT EXISTS` does not exist.** Only tables and indexes have that clause, so
  enum types are created inside a `DO $$ … $$` conditional block.
- **The existence check must be scoped to `current_schema()`.** An unqualified check finds the
  type in *another* schema — the test schema, say — and skips creating it, which leaves the
  service with a table whose column type does not exist.

---

## 5. Authentication, and who owns what

Two separate decisions, made separately.

### 5.1 One signing secret across three services

All three services verify tokens with the **same `JWT_SECRET`**, and the tokens are **HS256** —
pinned, not negotiated. A token issued by the Auth API is valid on the other two.

This is deliberate. The brief asks for JWT issuing and verification; a portfolio that
demonstrates a token working across three independently deployed services shows the design
working rather than describing it. The portfolio's **session** feature does exactly that: it
keeps the token **in memory only** — never in `localStorage`, never in a cookie, never in the
URL — and offers to reuse it.

The trade-off is explicit: one shared secret means a compromise of any one service's
environment compromises the token issuer. A per-service key pair with asymmetric verification
would fix that, and would be the right call for a system with genuinely different trust domains.
Here the three services are one system, and the simplicity is worth more than the isolation.

The token is short-lived (**15 minutes**), and the algorithm is pinned so a token cannot
negotiate itself down to `none`.

### 5.2 Ownership comes from the token, never from the body

The Lost & Found API has an `owner_id` column, and a request body **cannot** set it. The owner
is read from the **verified token**, so there is no field to forge.

The same shape appears in the Flash Sale API: the `customer_id` is taken from the
`x-demo-customer` header, which is how the demo identifies a customer without a full sign-in
flow. In a production system that header would be replaced by a verified token — the point of
the design is that the *authoritative* identity comes from a place the client cannot write to.

### 5.3 The failure modes are the same on purpose

Signing in with a wrong password and signing in with an account that does not exist produce
**the same message** and take a **comparable amount of time**. Otherwise the endpoint is a
membership oracle: it tells an attacker which addresses have accounts, and it leaks that fact
through the response time alone.

The implementation hashes a dummy password when the account is not found, so the work done is
the same either way.

Passwords are hashed with **Argon2id** at 64 MiB, t=3, p=1 — the memory-hard variant, chosen
so that GPU cracking is expensive. Sign-in and sign-up are rate limited to **10 requests per
minute**.

---

## 6. The Flash Sale design

Two requirements in this brief are genuinely hard, and they need **different** mechanisms.

### 6.1 Not overselling

A read-then-write in the application is not safe. Two requests can both read the same stock and
both conclude there is enough. The reservation is therefore a **single conditional statement**:

```sql
UPDATE products
   SET stock = stock - $1, updated_at = now()
 WHERE id = $2 AND stock >= $1
RETURNING id, price_cents, stock;
```

The database evaluates the condition and the update together, so the check cannot be
interleaved with another request. Two requests can never both take the last unit.

Three further layers back it up:

- A **`CHECK (stock >= 0)` constraint**, so the database refuses a negative stock whatever an
  application bug does.
- The stock is **never** held in an in-memory map. The database is the only authority.
- The reservation and the order insert happen in **one transaction**, so a failure to write the
  order rolls the stock back.

### 6.2 Not creating a duplicate order

The client may time out *after* the order succeeded, and retry. The guarantee is a **UNIQUE
index**:

```sql
CREATE UNIQUE INDEX orders_customer_id_idempotency_key_idx
  ON orders (customer_id, idempotency_key);
```

An application-level "does this key already exist?" check would still race — two requests can
both find that it does not. A unique index cannot: the second insert fails, whatever the
application believed.

When the insert violates the index, the transaction is **rolled back** and the order is read
again in a **fresh** transaction, with bounded retries. The read is what distinguishes two
cases that look identical from the outside:

- The same key with the **same** payload → the original order is replayed (`200`). A genuine
  retry.
- The same key with a **different** payload → `409 CONFLICT`. A key reused for a different
  order.

The two are told apart by a `request_fingerprint`: a hash of the request's semantic fields,
stored with the order. The same key with a different fingerprint is not a retry, and it must not
be silently replayed as one.

### 6.3 What was measured, and where

Against the **live deployment and the live database**, four runs, each with a fresh customer so
that no idempotency key was reused:

| Simultaneous requests | Stock | `201` created | `409` refused | Final stock |
|---|---|---|---|---|
| 50 | 10 | 10 | 40 | 0 |
| 50 | 10 | 10 | 40 | 0 |
| 20 | 10 | 10 | 10 | 0 |
| 50 | 10 | 10 | 40 | 0 |

The stock never went below zero and no order was created for a unit that did not exist.

**What that does and does not show.** It shows the invariant holds under simultaneous load
against a real database over HTTP. It does not show the service can sustain an unbounded burst
— it is a free-tier instance, a burst of 50 took 8–20 seconds, and during a cold start one
connection was observed being dropped by the host's proxy with a `522` before it reached the
application. That is a hosting limit, not an application limit, and the invariant held in that
run too.

---

## 7. The portfolio

### 7.1 The two vanilla demos stay vanilla

The brief requires the calculator and the autocomplete box to be plain HTML, CSS and JavaScript
with no framework. Rather than assert that in a comment, the demos are **copied verbatim** into
`apps/portfolio/public/demos/` at build time by `scripts/sync-demos.mjs` and embedded in an
`<iframe>`.

The portfolio **never imports** from those directories and never bundles them. The guarantee is
auditable in the file tree: the calculator has no `package.json` dependency on React, because it
has no dependencies at all.

The calculator's keyboard handling is the one place the "no framework" constraint needed real
work. `event.code` reports the **US position** of a character, so on a French AZERTY layout
pressing the key labelled `a` reports `KeyQ`. The calculator therefore captures the **text**
the keyboard produced and resolves it through a layout-aware key map
(`apps/calculator/keymap.js`), shared with the portfolio through a Vite alias. The alternative —
reconstructing the key from `event.code` — is wrong on exactly the layouts where it matters.
The autocomplete app uses the same resolution.

### 7.2 The tour is a strip, not an overlay

The guided walkthrough is a slim bar under the header. It says which step you are on, what to
do, and how to get to the next one, and then it gets out of the way.

It has been three things, and each of the first two was wrong in a way worth recording:

| | What it was | Why it failed |
|---|---|---|
| 1 | A card docked in the corner of every page | It took screen space from every page and became something to ignore. A permanent widget is a permanent cost. |
| 2 | A spotlight: the page dimmed and a hole was cut over the thing being explained | The thing being explained is usually a whole panel, so the "hole" was most of the page and the page behind it was too dark to read. Precise and useless. |
| 3 | **A strip under the header** | The page stays exactly as it was. |

The rule behind all three: **guidance should not cost the visitor the thing it is guiding them
through.** A strip satisfies that; an overlay does not.

The position is remembered in `localStorage`, so a return visit picks up where they left off,
and the same button brings the tour back after it is closed. Being easy to dismiss **and** easy
to recall is the whole trick — dismissal alone just means nobody ever sees it again.

### 7.3 The site is not a wall of text

The first version of this site had **one graphic** on the landing page, a CI badge, and 695
words. It was accurate and it was dull. Three things changed that:

- **A live terminal in the hero.** It types a command and runs it — a real `fetch` to a
  deployed service, from the browser, at that moment. The stock in that terminal is the stock in
  the database. Only read requests are made: a hero animation that placed orders on the public
  database every time somebody loaded the page would be a bad neighbour.
- **A small animated visual on every challenge card.** Each one is an honest picture of the
  mechanism: the calculator really evaluates `2 + 3 * 4`, the autocomplete really searches the
  supplied records, the stock bar really counts down. They animate a *colour*, never an
  *opacity* — fading text out reduces its contrast against the background, and an animation that
  makes the words harder to read is not a decoration.
- **The real code, on the challenge page.** Each challenge shows the one part of its
  implementation that contains the difficulty, copied from the repository, with a copy button.
  The highlighting is a small tokenizer in `CodeSnippet.tsx` rather than a dependency: it is a
  few dozen lines instead of a few hundred kilobytes, and it is enough for a handful of
  snippets.

The cards have a **fixed height**, so the grid is even and an animation inside one card cannot
change its height and shove the rest of the grid around.

### 7.4 The API tester

The tester is a small client for the deployed APIs: pick an operation, fill the parameters and
the body, press send. The request goes from the browser **straight to the API** — there is no
proxy in the portfolio.

The parts worth mentioning:

- **The pending state is live.** It shows a moving indicator, a running elapsed counter, and a
  **cancel** button that really aborts the request. A wait that says nothing is
  indistinguishable from a broken one, and on a free tier the wait can be a minute.
- **The response is summarised, not dumped.** The tester offers the parts of the response that
  are worth copying — the token, the order id — rather than making the visitor find them in a
  wall of JSON. Those are the buttons that matter: *copy token*, *copy id*.
- **The curl command is generated**, so a visitor can leave the browser entirely and reproduce
  the request exactly.

### 7.5 The Flash Sale lab

The lab is the concurrency proof, made visible. It fires genuinely simultaneous requests at
the deployed API and shows each one as it lands, with a live counter. Every number it displays
comes from the API — the stock from the products endpoint, the outcomes from the responses, the
order list read back from the service. There are no mock numbers anywhere in it.

### 7.6 The shared session

Signing in on the Auth page stores the token **in memory only** — a React context, never
`localStorage`, never a cookie, never the URL. The other two challenge pages read it and offer
it to the tester automatically. Reload the tab and the session is gone, which is the intended
behaviour: a token that lives in memory cannot be read by another script on the page.

---

## 8. Testing

**378 tests** across six workspaces, all run in CI on every push.

| Workspace | Tests | What they cover |
|---|---|---|
| `apps/calculator` | 110 | the parser, the keyboard layouts, the text capture, the error state |
| `apps/portfolio` | 128 | the components, the router, the API tester, the accessibility contract |
| `apps/autocomplete` | 38 | the search, the ranking, the accent and apostrophe handling |
| `services/lost-found-api` | 39 | the routes, the validation, the ownership rules |
| `services/auth-api` | 33 | sign-up, sign-in, the hashing, the token, the rate limit |
| `services/flash-sale-api` | 30 | the concurrency, the idempotency, the sold-out path |

Three decisions shape this:

**The API tests run against a real PostgreSQL.** A mocked database cannot test the one
invariant that matters most in this submission — that simultaneous transactions cannot take the
same unit twice. So the tests create real schemas, run real migrations, and fire real concurrent
transactions.

**`fastify inject` rather than a listening socket.** The tests exercise the whole application —
routes, hooks, serialisation, the error handler — without binding a port, which makes them fast
and free of flakiness.

**The concurrency tests run serially.** Vitest 4 removed `poolOptions`, so the suites that
share a database set `fileParallelism: false` instead.

**A regression test that was checked against the broken code.** The blank-page bug (a hook below
an early return, which React reports as "Rendered fewer hooks than expected") is covered by a
test that reproduces the exact transition. The test was verified by reintroducing the bug and
confirming it failed: a regression test that passes against the code it is meant to catch is
worse than no test at all.

---

## 9. Continuous integration

One GitHub Actions workflow, on every push and pull request:

1. **PostgreSQL 17** as a service container.
2. **The schemas and roles** created from `scripts/db/init/01-schemas.sql`.
3. **`pnpm lint`** → **`pnpm typecheck`** → **`pnpm test`** → **`pnpm build`**.

The README's test badge is read from this workflow's status, so a "tests passing" claim cannot
drift from reality.

Two details in the workflow exist because of failures on this machine:

- **The install is pinned.** `pnpm-workspace.yaml` lists the only packages allowed to run
  install scripts (`esbuild`, `argon2`) and sets `dangerouslyAllowAllBuilds: false`. The
  development machine has a global pnpm config that approves every build script; CI does not,
  so a setting that works locally can fail there. Pinning it in the repository makes the two
  environments identical.
- **The build gets placeholder API URLs.** `VITE_*` values are inlined at build time, so the CI
  build passes `https://example.invalid` rather than letting a missing variable silently
  produce a build with the wrong endpoints.

---

## 10. Tradeoffs, and what was deliberately left out

| Decision | Why | What it costs |
|---|---|---|
| One shared `JWT_SECRET` across three services | A token working across three independent deployments is the clearest demonstration of the design | A compromise of any one environment compromises the issuer; asymmetric keys would be the fix |
| `search_path` on the role, not the connection | Neon's pooler rejects it as a startup parameter | The schema is chosen by the role, so one role means one schema — which is exactly the intent |
| Money as integer cents | Float arithmetic on money is not exact | Prices are not decimals; converting is the caller's job |
| Portfolio is static, with no server | Nothing to run, nothing to attack, no cold start | The CORS pre-flight is the browser's, so a misconfigured origin fails opaquely — the tester works around it by offering `/health` and `/docs` links |
| Two vanilla demos copied at build time | Makes the "no framework" constraint auditable rather than asserted | The demos cannot share the portfolio's components, and the copy step must be kept in sync |
| The `x-demo-customer` header for the Flash Sale | Lets the lab identify a customer without a sign-in flow | It is not authentication; in production it would be a verified token |
| Free-tier hosting | Zero cost, and the limits are real and documented | Cold starts, queueing under load, and an occasional dropped connection |
| Shared `service-core` only | The plan proposed two more shared packages; there was no real shared code for them | Some duplication of test helpers between the API suites |

**Deliberately not built.** No admin panel, no email verification, no password reset, no
refresh-token rotation, no rate limiting on the Lost & Found API beyond what Fastify provides,
no CI matrix across Node versions, and no load-testing framework beyond the concurrency scripts
used to measure the figures above. Each of those is a reasonable thing to want and none of them
is in the brief.

---

## 11. Where to look next

| Document | What is in it |
|---|---|
| [`jury-guide.md`](./jury-guide.md) | the shortest path through the submission, for a jury |
| [`deployment.md`](./deployment.md) | what is deployed where, the environment variables, the free-tier caveats |
| [`plan.md`](./plan.md) | the plan this implementation follows, and the decisions taken along the way |
| [`brief.md`](./brief.md) | the supplied brief, verbatim, with its numbering defect recorded |
| [`tasks/`](./tasks/) | one document per challenge: the approach, the edge cases, the complexity, the tests, the limitations |
