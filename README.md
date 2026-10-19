# GIP Challenges — Engineering Portfolio

[![CI](https://github.com/LebgaaAbderrahmane/gip-challenges/actions/workflows/ci.yml/badge.svg)](https://github.com/LebgaaAbderrahmane/gip-challenges/actions/workflows/ci.yml)

Seven challenges from a single brief, built as one working engineering portfolio: three real
deployed backend APIs, two vanilla-JavaScript frontends, and two algorithm implementations.

> **Status: all seven challenges implemented and deployed.** Badges are advanced by hand only after
> the corresponding exit criterion is actually met — see [Status honesty](#status-honesty) below.

| | |
|---|---|
| **Portfolio** | <https://abderrahmane-gip-challenge.netlify.app> |
| **Jury guide** | [`docs/jury-guide.md`](docs/jury-guide.md) — the shortest path through the submission |
| **Architecture** | [`docs/architecture.md`](docs/architecture.md) — how it is put together, and why |
| **Tests** | 360 across six workspaces, on every push |

---

## The challenges

| ID | Challenge | Type | Route | Source |
|---|---|---|---|---|
| gip-01 | Lost & Found API | Backend | `/tasks/lost-found` | `services/lost-found-api` |
| gip-02 | Interactive Calculator | Frontend | `/tasks/calculator` | `apps/calculator` |
| gip-03 | Missing Binary String | Algorithm | `/tasks/binary-string` | `apps/portfolio` |
| gip-04 | Autocomplete Search | Frontend | `/tasks/autocomplete` | `apps/autocomplete` |
| gip-05 | Authentication API | Security | `/tasks/auth` | `services/auth-api` |
| gip-06 | Smallest Missing Positive | Algorithm | `/tasks/missing-positive` | `apps/portfolio` |
| gip-07 | Flash Sale API | Concurrency | `/tasks/flash-sale` | `services/flash-sale-api` |

The brief's own numbering restarts partway through — three of its tasks are labelled "Task 01" —
so tasks are identified here by stable names rather than numbers. The original brief is preserved
verbatim in [`docs/brief.md`](docs/brief.md) so every requirement stays traceable.

---

## Stack

| Layer | Choice |
|---|---|
| Portfolio | React 19 · Vite 8 · TypeScript · React Router 7 · Tailwind CSS 4 |
| Vanilla demos | Plain ES modules — zero dependencies |
| Backend | Fastify 5 · TypeScript · Zod · Drizzle ORM |
| Database | PostgreSQL 17 · three isolated schemas |
| Tests | Vitest · `fastify inject` · real PostgreSQL |
| CI | GitHub Actions |

> **Why pnpm and not npm?** `npm` is broken on the development machine (its global installation is
> missing transitive dependencies). `pnpm` is used throughout instead; the workspace layout is
> otherwise conventional.

---

## Getting started

```bash
pnpm install
pnpm db:up          # optional: local PostgreSQL in Docker
pnpm dev:portfolio # http://localhost:5173
```

If `DATABASE_URL` is unset, services start an embedded PostgreSQL automatically, so Docker is
optional.

### All commands

```bash
pnpm dev              # every app and service in parallel
pnpm dev:portfolio    # React portfolio
pnpm dev:calculator   # vanilla calculator, standalone
pnpm dev:autocomplete # vanilla autocomplete, standalone
pnpm dev:lost-found   # Fastify — Lost & Found
pnpm dev:auth         # Fastify — Auth
pnpm dev:flash-sale   # Fastify — Flash Sale

pnpm test             # all tests
pnpm lint             # lint / typecheck
pnpm build            # production build
pnpm verify           # lint + typecheck + test + build

pnpm db:up / db:down / db:reset
```

---

## The deployed services

| Service | URL | Swagger |
|---|---|---|
| Portfolio | <https://abderrahmane-gip-challenge.netlify.app> | — |
| Lost & Found API | <https://gip-challenges.onrender.com> | [`/docs`](https://gip-challenges.onrender.com/docs) |
| Authentication API | <https://gip-auth-api.onrender.com> | [`/docs`](https://gip-auth-api.onrender.com/docs) |
| Flash Sale API | <https://flash-sale-oopm.onrender.com> | [`/docs`](https://flash-sale-oopm.onrender.com/docs) |

---

## Architecture

```
apps/
  portfolio/      React — site shell, 7 routes, API tester, Flash Sale lab
  calculator/     vanilla HTML/CSS/JS  (brief-mandated: no framework)
  autocomplete/   vanilla HTML/CSS/JS + supplied data.js
services/
  lost-found-api/ auth-api/ flash-sale-api/
packages/
  service-core/   the shared error envelope, pagination, config, migration runner
docs/
  brief.md        the supplied brief, verbatim
  plan.md         the project plan this implementation follows
  architecture.md how the whole thing is put together
  deployment.md   what is deployed where, and how
  jury-guide.md   the shortest path through the submission
  tasks/          one document per challenge
```

Each service starts, deploys and tests independently, and owns its own migrations. The portfolio
never reads a database directly — it makes real HTTP requests to the deployed APIs.

The two vanilla demos are copied verbatim into `apps/portfolio/public/demos/` at build time and
embedded in an `<iframe>`. They are never bundled or imported by React, which keeps the
"no framework" constraint auditable rather than merely asserted.

### Database isolation

One PostgreSQL instance, three schemas, each owned by a separate restricted role so no service can
read or write another service's tables:

| Schema | Owner |
|---|---|
| `lost_found` | `lost_found_role` |
| `auth` | `auth_role` |
| `flash_sale` | `flash_sale_role` |

Each service also has a `*_test` schema, truncated between test suites.

---

## Status honesty

- Challenge badges are advanced **by hand**, and only after an exit criterion is genuinely met.
  There is no "Live" state that can appear without a verified public URL.
- Test results are shown from the CI workflow badge, never typed into a page.
- Performance and concurrency figures are **measured**, not estimated. Where they appear, the
  environment and request count are stated alongside them.
- Where a free-tier host introduces a limitation (cold starts, database pausing), it is documented
  rather than hidden.

---

## License

MIT — see [`LICENSE`](LICENSE).

The country dataset at `apps/autocomplete/data.js` is used exactly as supplied with the challenge
brief.