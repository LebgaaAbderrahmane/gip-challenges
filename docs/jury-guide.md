# Jury guide

Everything in this submission is live and can be tried without installing anything. This guide
is the shortest path through it.

> **Repository:** <https://github.com/LebgaaAbderrahmane/gip-challenges>
>
> **Portfolio:** <https://abderrahmane-gip-challenge.netlify.app>

---

## 1. Where to start

Open the portfolio and follow the **guided walkthrough** panel in the top-right corner. It is a
seven-step story that moves through all seven challenges in order, and every step is a link into
the part of the site it is talking about. Each challenge page also has an **API tester** that
sends real requests to the deployed backend, so nothing on the site is a mock.

There is one page that maps the submission to the brief: **`/evaluate`**. It lists each
requirement from the brief, states which are met and how to see them, and separates the brief's
requirements from the choices we made. That separation matters: it is a different thing to say
"the brief asked for this" and "we decided this".

---

## 2. Before you start: cold starts

The three APIs run on a **free tier**, so they are asleep when you arrive and the first request
wakes them. The first call to each service can take **up to about a minute**; every later call
is fast. The portfolio shows this rather than hiding it — the service status strip in the footer
reports each service as `checking`, `live`, `waking up` or `unreachable`, and a request that is
waiting shows a live timer and offers a cancel button.

Nothing needs to be set up, but **do the Auth sign-in first** and let the service warm up while
you read the rest of this page.

---

## 3. The seven challenges

| # | Challenge | Page | What it is |
|---|---|---|---|
| gip-01 | Lost & Found API | [`/tasks/lost-found`](https://abderrahmane-gip-challenge.netlify.app/tasks/lost-found) | Fastify + PostgreSQL, deployed |
| gip-02 | Interactive Calculator | [`/tasks/calculator`](https://abderrahmane-gip-challenge.netlify.app/tasks/calculator) | Vanilla HTML/CSS/JS, no framework |
| gip-03 | Missing Binary String | [`/tasks/binary-string`](https://abderrahmane-gip-challenge.netlify.app/tasks/binary-string) | Algorithm, with an interactive tester |
| gip-04 | Autocomplete Search | [`/tasks/autocomplete`](https://abderrahmane-gip-challenge.netlify.app/tasks/autocomplete) | Vanilla HTML/CSS/JS, the supplied dataset |
| gip-05 | Authentication API | [`/tasks/auth`](https://abderrahmane-gip-challenge.netlify.app/tasks/auth) | Argon2id + JWT, deployed |
| gip-06 | Smallest Missing Positive | [`/tasks/missing-positive`](https://abderrahmane-gip-challenge.netlify.app/tasks/missing-positive) | Algorithm, with an interactive tester |
| gip-07 | Flash Sale API | [`/tasks/flash-sale`](https://abderrahmane-gip-challenge.netlify.app/tasks/flash-sale) | Concurrency and idempotency, deployed |

### gip-01 — Lost & Found API

**Try this:** report a lost item with the token from §4, then filter the list by status and type,
open one report, update it, and mark it recovered. Then try to update a report that belongs to
somebody else — it must be refused with `403`, and the reason is shown.

**What good looks like:** the API derives ownership from the **verified token**, not from
anything the request body claims. There is no `ownerId` field to forge.

### gip-02 — Interactive Calculator

**Try this:** type `2+3*4` and press Enter. It gives `14`, not `20`. Then use the arrow keys,
backspace, and the keyboard only. Then try a French or German keyboard layout if you have one —
`event.code` lies about which key was pressed on those layouts, and the implementation handles
that.

**What good looks like:** no framework, no `eval()`. The expression is tokenised and parsed, so
the precedence is real rather than a side effect of string manipulation.

### gip-03 — Missing Binary String

**Try this:** paste an array of unique binary strings of length *n* into the tester. It returns a
binary string of length *n* that is not in the array.

**What good looks like:** the brief allows any language, so this one is solved in TypeScript and
exposed as an interactive tester rather than a page of text.

### gip-04 — Autocomplete Search

**Try this:** type `land`. It returns **Iceland** and **Ireland**. Then type `cote d'ivoire` and
it returns **Côte d'Ivoire**. The accents and the apostrophe are handled, not stripped.

**What good looks like:** the dataset is the one supplied with the brief, used **unmodified**,
and the search is substring-based so it matches mid-word. The algorithm is ours — there is no
library doing the work.

### gip-05 — Authentication API

**Try this:** create an account from the page. The password must be at least 12 characters. The
response carries a token; the portfolio keeps it **in memory only** and offers to reuse it on the
other two services.

**What good looks like:** the password is hashed with Argon2id and never returned or stored in
plain text. Signing in with the wrong password and signing in with an account that does not
exist give the **same message** and take a comparable amount of time, so the endpoint cannot be
used to discover which addresses have accounts.

### gip-06 — Smallest Missing Positive

**Try this:** enter `[0, -2, 1, 2]`. The answer is `3`. The tester also shows the complexity and
the edge cases, and there is a note on why the input array is copied before it is modified.

### gip-07 — Flash Sale API

**Try this:** this is the one to spend the most time on. See §5.

---

## 4. The three deployed APIs

| Service | Base URL | Swagger | Health |
|---|---|---|---|
| Lost & Found | `https://gip-challenges.onrender.com` | [`/docs`](https://gip-challenges.onrender.com/docs) | [`/health`](https://gip-challenges.onrender.com/health) |
| Authentication | `https://gip-auth-api.onrender.com` | [`/docs`](https://gip-auth-api.onrender.com/docs) | [`/health`](https://gip-auth-api.onrender.com/health) |
| Flash Sale | `https://flash-sale-oopm.onrender.com` | [`/docs`](https://flash-sale-oopm.onrender.com/docs) | [`/health`](https://flash-sale-oopm.onrender.com/health) |

Every route is listed in each service's OpenAPI document at **`/openapi.json`**.

### Creating an account

There is **no fixed demo account and no shared password** — an account is created on the spot, so
there is nothing private to leak and nothing to share between jurors.

```
POST https://gip-auth-api.onrender.com/api/auth/signup
Content-Type: application/json

{ "email": "you@example.com", "password": "at-least-12-characters" }
```

The response contains a token that is valid for **15 minutes**. It is also accepted by the other
two services, because all three share one signing secret — the portfolio's **session** feature
does exactly that, which is the clearest demonstration of the design.

> Sign-in and sign-up are rate limited to **10 requests per minute** per client. A failure is a
> `429`, and the response says so.

---

## 5. The concurrency proof — what to observe

This is the part of the brief that is genuinely hard, so it is worth doing by hand.

**In the browser:** open `/tasks/flash-sale`, and press **"Fire simultaneous orders"**. The panel
fires the requests at the same time and shows each one arriving, with a live counter
(`n of 50 requests answered`). What you should see:

- Exactly as many **"Order created"** rows as there were units in stock.
- Every other row says **"Sold out"**.
- The stock line goes from its starting number down to **0**, and never below it.

**Over HTTP**, so you can see the raw status codes:

```bash
# 50 simultaneous orders for a product with 10 in stock
for i in $(seq 1 50); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST \
    "https://flash-sale-oopm.onrender.com/api/orders" \
    -H "content-type: application/json" \
    -H "x-demo-customer: jury-$i" \
    -H "idempotency-key: jury-$i" \
    -d '{"productId":"<the product id>","quantity":1}' &
done | sort | uniq -c
```

**Measured against the live deployment and the live database**, four runs, each with a fresh
customer so no idempotency key is reused:

| Simultaneous requests | Stock | `201` created | `409` refused | Final stock |
|---|---|---|---|---|
| 50 | 10 | 10 | 40 | 0 |
| 50 | 10 | 10 | 40 | 0 |
| 20 | 10 | 10 | 10 | 0 |
| 50 | 10 | 10 | 40 | 0 |

**Never once did the stock go below zero, and no order was created for a unit that did not
exist.**

The retry case is just as quick to check. Send the **same** `idempotency-key` twice with the
**same** body: the second call returns `200` with the original order, and the stock falls by one
unit, not two. Send the same key with a **different** body: the second call returns `409
CONFLICT` and the stock does not move at all.

**One honest caveat.** The free tier is a shared, low-CPU instance. A burst of 50 requests can
take 8–20 seconds, and during a cold start one connection was observed being dropped by the
host's proxy with a `522` before it reached the application. That is a **hosting** limit, not an
application limit: the stock invariant held in every run, including that one. The invariant is
enforced by the database, not by the host.

---

## 6. Where the code is

```
apps/portfolio/      React site: seven routes, API tester, Flash Sale lab, walkthrough
apps/calculator/     vanilla HTML/CSS/JS — the brief forbids a framework here
apps/autocomplete/   vanilla HTML/CSS/JS, the supplied dataset untouched
services/            the three Fastify + PostgreSQL APIs
packages/service-core/  shared error envelope, pagination, config, migrations
docs/                the brief, the plan, the architecture, and one document per challenge
```

Everything runs from one command:

```bash
pnpm install
pnpm verify     # lint + typecheck + 360 tests + build
```

**360 tests** across six workspaces, in GitHub Actions on every push:

| Workspace | Tests |
|---|---|
| `apps/calculator` | 110 |
| `apps/portfolio` | 110 |
| `apps/autocomplete` | 38 |
| `services/lost-found-api` | 39 |
| `services/auth-api` | 33 |
| `services/flash-sale-api` | 30 |

The API tests run against a **real PostgreSQL**, not a mock — the Flash Sale tests fire
genuinely simultaneous transactions at a real database, because that is the only way to test the
invariant that matters.

---

## 7. What this submission is honest about

- **No claim is made that a free tier is production infrastructure.** The cold start, the queueing
  under a burst, and the occasional dropped connection are documented above rather than hidden.
- **No performance figure is quoted without the environment.** Where a number appears, the request
  count and the tier it was measured on are stated with it.
- **The status of every challenge is `implemented`,** and each of those seven was reached by
  meeting a stated exit criterion — there is no "live" badge that can appear without a verified
  public URL.
- **The two frameworks we were forbidden to use were not used.** The calculator and the
  autocomplete box are plain HTML, CSS and JavaScript, copied into the portfolio at build time and
  embedded in an `<iframe>`, so the constraint is auditable in the file tree rather than merely
  asserted in a comment.
- **The brief's own numbering is defective** — three of its tasks are labelled "Task 01" — so
  tasks are identified by stable names. The brief is preserved verbatim in `docs/brief.md` so
  every requirement stays traceable to its source.

---

## 8. One document per challenge

If you want the reasoning rather than the result, each challenge has its own document under
`docs/tasks/`, written to a consistent template: the problem, the constraints from the brief, the
approach, the data model or algorithm, the API contract, the edge cases, the complexity or the
security and concurrency design, the test cases, and the known limitations.

- [`docs/architecture.md`](./architecture.md) — how the whole thing is put together
- [`docs/deployment.md`](./deployment.md) — what is deployed where, and how
- [`docs/plan.md`](./plan.md) — the plan this implementation follows
- [`docs/brief.md`](./brief.md) — the supplied brief, verbatim
