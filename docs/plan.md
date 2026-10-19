# GIP Challenge Portfolio — Full Project Plan

> **Purpose:** Build one polished, publicly accessible portfolio that demonstrates all seven GIP challenges through dedicated live demos, real backend APIs, automated tests, and clear technical documentation.
>
> **Planning assumptions:** 1–2 weeks available; free hosting only; one monorepo; mixed technologies selected to suit each task; dark developer-tool visual direction; all seven challenges must be functional; backend tasks should have both an embedded API tester and Swagger/OpenAPI documentation; the provided autocomplete `data.js` dataset will be available.

---

## 1. Executive summary

Build a unified engineering portfolio rather than seven disconnected submissions. The portfolio is the public entry point, while each challenge retains its own implementation, tests, documentation, and route. The three backend services must be real deployed APIs, not mocked responses.

### Project goals

1. Provide one memorable landing page from which jurors can discover every challenge.
2. Give each task a stable route and clear, immediately testable demo.
3. Preserve all challenge constraints, especially the vanilla-JavaScript-only calculator and autocomplete.
4. Demonstrate engineering judgment through correct algorithms, API contracts, validation, security, persistence, and concurrency handling.
5. Keep the source code in one maintainable monorepo while allowing independent deployment of the frontend and backend services.
6. Provide documentation and repeatable tests so a reviewer can verify the work quickly.
7. Deploy early and test the deployed URLs rather than leaving deployment until the end.

### Definition of done

- One deployed landing page.
- Seven dedicated challenge pages.
- Three independently deployed backend APIs.
- Persistent storage for backend data.
- Swagger/OpenAPI documentation and a lightweight embedded API tester for each API.
- Correct algorithmic and frontend behavior, including documented edge cases.
- Automated tests for critical logic and API behavior.
- A root README, architecture/deployment documentation, and one task document per challenge.
- A final public-URL smoke test and a concise jury guide.

### Priorities

**P0 — Required correctness:** original task requirements, working routes, valid public links, API functionality, algorithm correctness, secure authentication, and Flash Sale stock/idempotency guarantees.

**P1 — Strong presentation:** coherent design system, responsive screens, embedded API playgrounds, examples, meaningful error/loading/empty states, technical explanations, Swagger, and source links.

**P2 — Optional polish:** elaborate animation, visual algorithm stepping, advanced analytics, custom charts, and nonessential filters. Only implement these after P0 and P1 work.

---

## 2. Challenge inventory and routes

The challenge numbering supplied in the brief restarts, so this plan uses stable names rather than relying only on the original numbering.

| ID | Challenge | Type | Portfolio route | Core proof |
|---|---|---|---|---|
| 01 | Lost & Found API | Backend | `/tasks/lost-found` | Create, search, inspect, update, and recover reports through a real API |
| 02 | Interactive Calculator | Frontend | `/tasks/calculator` | Keyboard support and proper operator precedence using vanilla JavaScript |
| 03 | Missing Binary String | Algorithm | `/tasks/binary-string` | Return an absent binary string of length `n`, with proof and tests |
| 04 | Autocomplete Search | Frontend + algorithm | `/tasks/autocomplete` | Mid-word matching, accent/apostrophe normalization, and provided dataset usage |
| 05 | Authentication API | Backend + security | `/tasks/auth` | Secure signup/login, password hashing, JWT issuance and verification |
| 06 | Smallest Missing Positive | Algorithm | `/tasks/missing-positive` | Correct `O(n)` solution with constant auxiliary space |
| 07 | Flash Sale API | Backend + concurrency | `/tasks/flash-sale` | No overselling, atomic stock updates, safe retries, and order history |

The labels “Live”, “Completed”, “Tests passing”, and similar must only be displayed when backed by actual status or verified test results. Do not hardcode claims that may become false.

---

## 3. Architecture

### 3.1 Architectural principle

Use a **single monorepo with independently deployable applications and services**. The portfolio must not be responsible for hosting or simulating backend logic. It sends HTTP requests to the actual APIs.

### 3.2 High-level architecture

```text
Jury / visitor browser
        |
        v
Portfolio (React + Vite + TypeScript)
        |-- Static / client-side demos
        |     |-- Calculator (vanilla HTML/CSS/JS app)
        |     |-- Autocomplete (vanilla HTML/CSS/JS app + supplied data.js)
        |     |-- Missing binary string demo
        |     `-- Smallest missing positive demo
        |
        `-- API tester (real HTTP requests)
              |-- Lost & Found API (Fastify + TypeScript)
              |-- Authentication API (Fastify + TypeScript)
              `-- Flash Sale API (Fastify + TypeScript)
                          |
                          v
                    PostgreSQL database
                    (isolated schemas / table ownership)
```

### 3.3 Recommended stack

| Layer | Recommendation | Notes |
|---|---|---|
| Portfolio | React + Vite + TypeScript | Shared layout, routing, task cards, API tester UI |
| Styling | Tailwind CSS or a small consistent CSS system | Choose one styling approach; avoid duplicate styling systems |
| Routing | React Router or Vite-compatible router | All required direct URLs and refreshes must work |
| Calculator | Vanilla HTML/CSS/JavaScript | Do not implement its core using React or a framework |
| Autocomplete | Vanilla HTML/CSS/JavaScript | The search algorithm must be written by you and use supplied `data.js` |
| Algorithm functions | TypeScript modules | Keep core algorithms independent from the display UI |
| Backend | Node.js + TypeScript + Fastify | One runtime and shared conventions reduce delivery overhead |
| Validation | Zod or Fastify JSON schemas | Validate request inputs at API boundaries |
| Database | Hosted PostgreSQL | Transactions, unique constraints, and atomic stock updates |
| Database access | Drizzle, Prisma, or parameterized SQL | Choose one; for the Flash Sale transaction, ensure the library exposes the required transaction semantics |
| API docs | OpenAPI + Swagger UI | Generated or validated against real routes and schemas |
| Unit tests | Vitest | Tests for algorithms, normalization, validation, and service logic |
| API tests | Fastify inject and/or HTTP integration tests | Include persistence and concurrent request tests |
| Browser tests | Manual smoke tests plus a small automated suite where practical | Do not spend excessive deadline time setting up a large E2E framework |
| Hosting | Static frontend host + backend host + hosted PostgreSQL | Confirm current free-tier limits and sleeping/pause behavior before committing to providers |

**Stack constraint — note the difference in status between the two demos:**

- The **calculator** has a hard, brief-mandated constraint: *"You must use only HTML/CSS and javascript with no framework."* Its implementation must not depend on React, Vue, Angular, or any other framework or expression-evaluation library.
- The **autocomplete** has **no framework prohibition in the brief**. The brief requires only that the algorithm be hand-written and that the supplied `data.js` dataset be used. Building it as vanilla JavaScript is **our own choice**, not a challenge requirement.

Both are implemented as standalone vanilla apps and embedded from the portfolio, so the stronger approach is kept in both cases. Do not describe the autocomplete's framework-free implementation as a challenge requirement in the UI or documentation; state it as a deliberate choice.

### 3.4 Backend boundaries

- Each API must start and deploy independently.
- Each backend owns its migrations, environment variables, routes, and tests.
- Each backend provides `/health` and `/docs`.
- Each backend has its own OpenAPI specification and base URL.
- The portfolio may share display components for API testing, but must not share secrets or bypass the APIs by accessing database tables directly.
- If the Lost & Found API protects report ownership, the API must establish the caller's identity using a verified authentication mechanism. A client-submitted `ownerId` is not trusted identity.
- For the public Flash Sale demo, a documented demo identity may be used for convenience. It must be clearly described as demo-only unless proper authentication is implemented.

### 3.5 Repository layout

```text
gip-challenge-portfolio/
├── apps/
│   ├── portfolio/
│   │   ├── src/
│   │   │   ├── app/                 # app entry, router, providers
│   │   │   ├── components/          # shared buttons, cards, badges, dialogs
│   │   │   ├── layouts/             # site shell and task layout
│   │   │   ├── pages/               # landing, task pages, about
│   │   │   ├── features/            # API tester, task navigation, status display
│   │   │   ├── data/                # task metadata and API base URLs
│   │   │   └── styles/              # global tokens and base styles
│   │   ├── public/
│   │   └── package.json
│   ├── calculator/                  # vanilla JS only
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── calculator.js
│   │   ├── parser.js                # optional pure parser module
│   │   └── tests/
│   ├── autocomplete/                # vanilla JS only
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── search.js
│   │   ├── normalize.js
│   │   ├── data.js                  # exact provided dataset
│   │   └── tests/
│   ├── binary-string/
│   │   ├── index.html or portfolio page integration
│   │   ├── solution.ts
│   │   └── tests/
│   └── missing-positive/
│       ├── index.html or portfolio page integration
│       ├── solution.ts
│       └── tests/
├── services/
│   ├── lost-found-api/
│   │   ├── src/                     # routes, schemas, services, repositories
│   │   ├── migrations/
│   │   ├── tests/
│   │   ├── openapi/                 # if spec is maintained separately
│   │   └── package.json
│   ├── auth-api/
│   │   ├── src/
│   │   ├── migrations/
│   │   ├── tests/
│   │   └── package.json
│   └── flash-sale-api/
│       ├── src/
│       ├── migrations/
│       ├── tests/
│       └── package.json
├── packages/
│   ├── api-contracts/               # shared non-secret request/response types if useful
│   ├── test-utils/
│   └── config/                      # shared lint/test settings where valuable
├── docs/
│   ├── architecture.md
│   ├── deployment.md
│   ├── jury-guide.md
│   └── tasks/
│       ├── lost-found.md
│       ├── calculator.md
│       ├── binary-string.md
│       ├── autocomplete.md
│       ├── auth.md
│       ├── missing-positive.md
│       └── flash-sale.md
├── package.json                     # npm workspaces and root scripts
├── package-lock.json
├── .gitignore
├── .env.example
└── README.md
```

Do not create unnecessary abstractions simply to fill this structure. Start with the minimum folders required and add shared packages only when there is real reuse.

### 3.6 Root scripts

Use npm workspaces and expose predictable root commands. Exact package names may differ, but the intended usage should resemble:

```bash
npm install
npm run dev:portfolio
npm run dev:lost-found
npm run dev:auth
npm run dev:flash-sale
npm run test
npm run lint
npm run build
```

If workspace orchestration becomes cumbersome, add a root script that invokes each workspace in sequence. Document all actual scripts in the README; do not leave examples that do not work.

### 3.7 Environment and secret rules

- Use `.env` locally and host-provided environment configuration in production.
- Commit `.env.example` with placeholders, never real values.
- Add `.env`, `.env.*`, local databases, build outputs, logs, and test artifacts to `.gitignore` as appropriate.
- Never put a database URL, JWT signing secret, or other backend secret in the Vite `VITE_*` variables; Vite exposes those values to the browser bundle.
- Configure API base URLs as public frontend configuration, for example `VITE_LOST_FOUND_API_URL`, `VITE_AUTH_API_URL`, and `VITE_FLASH_SALE_API_URL`. These are URLs, not credentials.
- Use separate service configuration. `JWT_SECRET` should exist only where needed for token signing or verification.
- Validate required environment variables at service startup and fail with a clear configuration error, without printing their values.

---

## 4. URL and navigation design

### 4.1 Required public routes

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/tasks` | All challenge cards / overview |
| `/tasks/lost-found` | Lost & Found API tester and documentation |
| `/tasks/calculator` | Calculator demo |
| `/tasks/binary-string` | Missing binary-string solution demo |
| `/tasks/autocomplete` | Autocomplete demo |
| `/tasks/auth` | Authentication API tester |
| `/tasks/missing-positive` | Smallest-missing-positive demo |
| `/tasks/flash-sale` | Flash Sale API tester and concurrency simulator |
| `/about` | Engineering notes / project context, optional |

Each challenge page should link to its source directory or source repository, task documentation, and—where applicable—the live API and Swagger page.

### 4.2 Backend URL conventions

For each API, publish its actual deployed base URL, such as:

- Lost & Found: `https://<actual-host>/api`
- Authentication: `https://<actual-host>/api`
- Flash Sale: `https://<actual-host>/api`

These are placeholders until deployment. Do not publish example hostnames as though they are live.

Each API should expose:

- `/health` — safe readiness/health response.
- `/docs` — Swagger UI.
- A discoverable OpenAPI JSON route, such as `/openapi.json`, if supported by the chosen setup.

### 4.3 SPA routing requirements

- Configure the static host to serve the portfolio entry point for valid client-side routes.
- Test opening `/tasks/flash-sale` directly in a fresh browser session.
- Test refreshing every route.
- Ensure a bad route displays a useful not-found page rather than a host-level 404.
- Decide how the standalone vanilla apps are hosted or embedded. Keep the required no-framework implementation isolated; the portfolio may link to the deployed demo or embed the static app using an iframe if that produces the most reliable result.

---

## 5. UI / UX specification

### 5.1 Design direction

**Visual theme:** dark, modern developer-tool aesthetic with a distinctive identity separate from the GIP source platform.

Suggested starter tokens (adjust after checking contrast on real screens):

| Token | Suggested value | Use |
|---|---|---|
| Background | `#101116` | Page background |
| Surface | `#191C25` | Cards and panels |
| Elevated surface | `#222633` | Menus, hover, nested panels |
| Accent | `#A78BFA` | Primary action / highlight |
| Primary text | `#F4F4F5` | Headings and main content |
| Muted text | `#A1A1AA` | Explanatory content |
| Border | `#303442` | Card and input borders |
| Success | accessible green token | Success states |
| Warning | accessible amber token | Warnings |
| Error | accessible red token | Validation failures |

Use semantic theme variables rather than repeating hex values throughout components. Verify text and control contrast before release; the palette is a starting point, not an accessibility certification.

### 5.2 Typography and visual details

- Use a strong but readable sans-serif for headings and UI body text.
- Use a monospace font for code, JSON, endpoints, and algorithm snippets.
- Keep body text readable at mobile size.
- Prefer subtle borders and restrained shadows over many glowing effects.
- Use small motion only where it improves affordance; honor `prefers-reduced-motion`.
- Make focus indicators visible and do not rely on color alone for success/error status.
- Avoid overly dense dashboard styling on the landing page. The initial call to action and challenge links should be immediately discoverable.

### 5.3 Landing page layout

1. **Top navigation**
   - Project mark / name.
   - Challenges link.
   - Engineering / architecture link.
   - Source repository link, when public and ready.
   - Mobile menu with keyboard support.

2. **Hero section**
   - Short headline such as “Seven challenges. One engineering workspace.”
   - Brief explanation of the goal.
   - Primary action: “Explore challenges”.
   - Secondary action: “View source” when the repository is ready.
   - Avoid exaggerated or unsupported performance claims.

3. **Project overview**
   - Seven challenge cards.
   - Accurate status and category tags.
   - Concise descriptions focused on what can be tested.
   - Direct “Open demo” links.

4. **Engineering highlights**
   - API architecture and OpenAPI.
   - Security and authentication.
   - Algorithmic correctness and complexity.
   - Flash Sale concurrency strategy.

5. **Documentation / source section**
   - README, architecture diagram, deployment notes, task docs, source code.

6. **Footer**
   - Source link, relevant profile/contact link if desired, and concise project description.

### 5.4 Challenge card specification

Every card should include:

- Stable task ID and title.
- Category (Backend, Frontend, Algorithm, Security, Concurrency, as appropriate).
- One-sentence requirement summary.
- One technical highlight (e.g. “Atomic stock updates” or “Accent-insensitive substring matching”).
- Accurate state: Planned / In progress / Live / Verified, if statuses are genuinely maintained.
- Link to the actual challenge route.

Avoid adding ratings, fake metrics, fake test counts, or nonfunctional decorative controls.

### 5.5 Shared challenge-page layout

Each page should follow the same broad pattern:

1. Breadcrumbs: `GIP / Challenges / Task name`.
2. Title and short problem summary.
3. Metadata: technology, category, real deployment status.
4. Main interactive demo or API tester above the long explanation.
5. Result, response, and error panels.
6. “How it works” technical section.
7. Validation, edge cases, and complexity or API contract.
8. Test examples and verified results.
9. Links to source, task documentation, and Swagger where applicable.

The interaction should be usable before a jury member has to read a long explanation.

### 5.6 Shared interactions and states

- Inputs have explicit labels and useful placeholders.
- Errors identify the issue without exposing secrets or internal stack traces.
- API requests show a pending state, timeout/failure state, response status, and response body.
- Empty search results and empty order/report lists have helpful explanations.
- Copy buttons indicate whether copying succeeded where supported.
- Buttons must work with keyboard and touch.
- Focus order must be sensible; Escape should close dismissible dialogs or menus where appropriate.
- Respect reduced motion and avoid animation that interferes with keyboard input.
- On mobile, cards stack into one column and dense JSON/code panels scroll horizontally rather than breaking the page layout.

---

## 6. Task 01 — Lost & Found API

### 6.1 Objective

Build a REST API that allows users to report lost items and found items, search/filter reports, inspect report details, update their own reports, and mark items as recovered.

### 6.2 Suggested implementation

- Fastify + TypeScript.
- PostgreSQL.
- Request schemas via Zod or Fastify JSON Schema.
- OpenAPI/Swagger route.
- Unit and integration tests.

### 6.3 Data model

`ItemReport`:

| Field | Type / rule |
|---|---|
| `id` | UUID primary key |
| `type` | `lost` or `found` |
| `title` | Required non-empty string with a reasonable maximum length |
| `description` | Required text with length limit |
| `category` | Validated category or non-empty string |
| `location` | Human-readable location; coordinates are optional scope, not required |
| `eventDate` | Valid timestamp/date, if supplied or required by the chosen contract |
| `status` | `open` or `recovered` |
| `ownerId` | Server-established owner identity |
| `createdAt` | Creation timestamp |
| `updatedAt` | Last update timestamp |

Decide and document which fields are mandatory. Keep the contract consistent between validation, OpenAPI, and the database.

### 6.4 Proposed endpoint contract

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/items` | Create a lost/found report |
| `GET` | `/api/items` | List/search/filter reports |
| `GET` | `/api/items/:id` | Get report details |
| `PATCH` | `/api/items/:id` | Update an owned report |
| `PATCH` | `/api/items/:id/recover` | Mark report recovered |
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Swagger UI |

Suggested list query parameters:

- `type=lost|found`
- `status=open|recovered`
- `category=<value>`
- `q=<search phrase>`
- `location=<phrase>`
- `page=<positive integer>`
- `limit=<bounded positive integer>`
- `sort=createdAt|eventDate` and a documented direction if included

Example:

```http
GET /api/items?type=lost&status=open&q=wallet&page=1&limit=10
```

Example list response:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 0
  }
}
```

### 6.5 Ownership and authorization

The requirement says users must be able to update their own reports. Therefore, the implementation needs a trustworthy owner identity and an ownership check. Do not accept a client-supplied `ownerId` as proof of identity.

For a realistic approach, protect create/update/recover operations with a verified bearer token. Reuse a compatible JWT verification approach where practical, or implement a small auth guard in the Lost & Found service. Avoid coupling the service to a synchronous network request to the Auth API on every request unless the design specifically requires that. A shared signing secret can simplify verification but creates a secret-sharing boundary; if used, document and protect it carefully. For the jury demo, use a synthetic demo account and explain what is and is not secured.

### 6.6 Validation and status codes

- `201 Created`: report created.
- `200 OK`: successful read/update/recovery.
- `400 Bad Request` or `422 Unprocessable Content`: invalid input (choose a consistent policy).
- `401 Unauthorized`: no valid authentication for a protected action.
- `403 Forbidden`: authenticated user does not own the report.
- `404 Not Found`: report does not exist.
- `409 Conflict`: applicable invalid state transition or duplicate conflict.

Validate IDs, enum values, dates, body size, pagination limits, and sort keys. Use parameterized queries or a safe query builder.

### 6.7 UI / embedded tester

- Report form with lost/found type selector.
- Search input and filters for type, category, status, and location where implemented.
- Paginated report list.
- Detail panel showing all returned fields.
- Update and recover actions shown only when appropriate for the demo user.
- Request panel showing method, URL, payload, status code, latency if measured, and JSON response.
- Links to Swagger and source/docs.

The tester is an evaluation aid; the backend API remains the deliverable.

### 6.8 Tests

- Create valid lost and found reports.
- Reject missing or malformed required fields.
- Search/filter combinations return the correct records.
- Pagination is bounded and correctly reported.
- Get missing ID returns 404.
- Owner can update and recover their report.
- Another user cannot update/recover the report.
- State transitions behave according to the documented policy.
- API errors do not expose secrets or stack traces.

### 6.9 Acceptance criteria

A jury member can create, search, retrieve, update, and recover a report through the deployed API. Authorization checks prevent editing another user's report. OpenAPI documents the real route behavior.

**Time budget:** approximately 1 focused day for MVP plus test/deployment time.

---

## 7. Task 02 — Interactive Calculator

### 7.1 Objective and hard constraint

Build a working calculator UI with keyboard support and correct operator precedence using **only HTML, CSS, and vanilla JavaScript for the calculator**. Do not use a frontend framework or an external expression-evaluation package for the calculator logic.

### 7.2 Interface specification

- Main expression/result display.
- Optional smaller line for the current expression or previous operation.
- Numeric keys `0–9`.
- Decimal point.
- Operators: addition, subtraction, multiplication, division.
- Equals, clear, and backspace.
- Parentheses only if included in the parser and UI.
- Optional percentage/sign controls only if their semantics are clearly defined.
- Visible keyboard focus and responsive keypad.
- Clear result and error states.

### 7.3 Calculation approach

Do not simply evaluate the input using JavaScript `eval()`. Use a controlled expression grammar, e.g. a tokenizer plus a recursive-descent parser or a shunting-yard algorithm. A small recursive-descent parser is suitable for a compact expression language.

Suggested precedence:

1. Parentheses, if supported.
2. Unary signs.
3. Multiplication and division.
4. Addition and subtraction.

Example:

```text
2 + 3 * 4 = 14
```

The parser must detect malformed expressions, divide-by-zero results, and non-finite numeric results. Decide how to display floating-point results (e.g. trim trailing zeros and round only for display within a clearly defined precision policy; do not silently alter internal values in a way that produces incorrect subsequent operations).

### 7.4 Keyboard mapping

- `0–9`: enter digits.
- `.`: decimal separator.
- `+`, `-`, `*`, `/`: operators.
- `Enter` or `=`: evaluate.
- `Backspace`: remove the last entered character/token according to UI behavior.
- `Escape`: clear the current expression.
- Optional parentheses keys if parenthesized expressions are supported.

Prevent browser shortcuts or key handling from causing unexpected page navigation, but do not block normal accessibility interactions unnecessarily.

### 7.5 Tests

| Input | Expected behavior |
|---|---|
| `2 + 3 * 4` | `14` |
| `(2 + 3) * 4` | `20`, if parentheses are supported |
| `10 / 2` | `5` |
| `0.1 + 0.2` | Display `0.3` under the chosen formatting policy |
| `5 / 0` | A clear error / non-finite result is not displayed as a valid answer |
| Incomplete expression | Helpful error or incomplete state; no crash |
| Keyboard `2 + 3 Enter` | `5` |
| Backspace / Escape | Behave as documented |

### 7.6 Acceptance criteria

Calculator source is vanilla HTML/CSS/JavaScript, precedence is correct, the keyboard mapping works, invalid expressions do not crash the app, and the UI behaves on desktop and mobile.

**Time budget:** 0.5–1 day.

---

## 8. Task 03 — Missing Binary String

### 8.1 Objective

Given an array `nums` containing `n` unique binary strings, each of length `n`, return any binary string of length `n` not present in `nums`.

### 8.2 Recommended algorithm: diagonal construction

At each index `i`, inspect `nums[i][i]` and flip the bit. The generated result differs from `nums[i]` at position `i`, so it cannot equal any array element.

```ts
export function findDifferentBinaryString(nums: string[]): string {
  return nums
    .map((value, index) => (value[index] === "0" ? "1" : "0"))
    .join("");
}
```

Preconditions should be validated in the demo: there must be `n` strings, each of length `n`, containing only `0` and `1`. The original problem states uniqueness; the algorithm still constructs a string different from every row as long as the indexed inputs are well formed.

### 8.3 Complexity

- Time: `O(n)`.
- Output storage: `O(n)` for the returned string. The shown `map().join()` version may allocate intermediate storage; this is not a material concern for typical challenge constraints.

### 8.4 UI specification

- Textarea or structured input for the array.
- “Load example” action.
- Input validation messages.
- Output string and copy action.
- Optional diagram showing each diagonal input bit and the flipped result bit.
- Proof-of-correctness section.
- Complexity section and tests.

Example:

```text
Input: ["01", "10"]
Possible output: "11"
```

There may be multiple valid answers; tests should verify validity, not one fixed output.

### 8.5 Tests and acceptance criteria

- Result has length `n`.
- Result contains only binary digits.
- Result does not appear in `nums`.
- Invalid input is reported clearly.
- Edge cases such as `n = 1` work under the problem's input conditions.

**Time budget:** 0.25–0.5 day.

---

## 9. Task 04 — Autocomplete Search

### 9.1 Objective and hard constraints

Build a performant **client-side** autocomplete search box using the provided `data.js` dataset. Write the matching algorithm yourself. It must support:

- Mid-word substring matches (`land` matches `Iceland` and `Ireland`).
- Accent-insensitive matching. Verified against the supplied dataset: the query `cote d'ivoire` (straight apostrophe, as written in the brief) matches the label `Côte d'Ivoire`, which also uses a **straight** apostrophe (U+0027). The dataset contains no curly apostrophes, so a query containing U+2019 does **not** match — this is expected, and normalization exists to canonicalise user input, not to make every input match.
- Apostrophe variants and case-insensitive search.
- A useful suggestion interaction, including keyboard behavior.

Do not replace the provided dataset with a smaller hand-written dataset. Preserve original values for display.

### 9.2 Inspect the dataset first

Before designing optimizations:

1. Inspect the format and exports in `data.js`.
2. Count entries and inspect representative fields.
3. Identify duplicates, missing values, and non-string values.
4. Confirm language/locale assumptions and any data-specific quirks.
5. Keep a copy or preserve the original file and document any required adaptation.

Do not assume the dataset is small or large without checking.

**Verified facts (measured against the supplied `data.js`, not assumed):**

| Property | Measured value |
|---|---|
| Entries | **110** |
| Identifiers | `id` 1–110, sequential, no gaps |
| Fields | `id`, `name` only — no locale, code, or alternate spellings |
| Unique names | 110 / 110 — **no duplicates** |
| Non-string or empty names | 0 |
| Longest name | 22 characters (`Bosnia and Herzegovina`) |
| Names containing non-ASCII | **2 only** — `Côte d'Ivoire`, `São Tomé and Príncipe` |
| Apostrophe characters present | **U+0027 (straight) only.** No curly U+2019 anywhere in the file |
| List ordering | Not locale-sorted — `São Tomé and Príncipe` sits between `Switzerland` and `Tunisia` |
| Export | `countries` |

**Consequence for §9.4:** at 110 records (~3.5 KB) a linear `includes()` scan per keystroke is effectively instantaneous. **The n-gram candidate index considered later in §9.4 is not required and should not be built.** Measure and record the actual timing rather than assuming it.

### 9.3 Normalization

Maintain both original display labels and normalized searchable strings. Normalize once at initialization rather than recomputing every string on every keystroke.

Possible starting function:

```js
function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’‘`]/g, "'")
    .toLocaleLowerCase("en")
    .trim();
}
```

This is a starting point, not a universal linguistic solution. Choose and document locale behavior based on the dataset. Unicode normalization plus removal of combining marks handles common accent differences; apostrophe normalization maps common typographic forms to a canonical form. Preserve the original label for display.

### 9.4 Matching and ranking

Initial implementation:

1. Normalize the user's query.
2. Return no suggestions or a documented default state for an empty query.
3. Search normalized labels using substring matching (`includes`) so matching is not prefix-only.
4. Rank matches only if doing so adds value and does not exclude valid matches. A reasonable ranking might prioritize exact normalized matches, then prefix matches, then other substring matches.
5. Limit the visible suggestions (for example, 8–10) to keep the UI compact, while not accidentally limiting the candidate set before ranking.
6. Display original labels and highlight matched text without injecting unsafe HTML.

If profiling against the complete dataset shows that scanning is too slow, consider a more suitable index such as n-gram candidate indexing. Do not add index complexity prematurely. Measure performance on the actual dataset and document the result if reporting a benchmark.

### 9.5 Interface specification

- Search input with accessible label.
- Dropdown suggestions immediately beneath the input.
- Highlight matched text.
- Up/down arrow navigation.
- Enter selects the highlighted item.
- Escape closes the suggestion list.
- Click/tap selects a suggestion.
- Clear/no-results states.
- Optional selected-value area if consistent with the dataset use case.
- Responsive width and visible focus indicators.

Use safe DOM APIs (text nodes/elements) for labels and highlighting. Do not interpolate dataset labels into raw HTML without escaping.

### 9.6 Tests

- `land` returns both `Iceland` and `Ireland` when present in the provided data.
- `cote d'ivoire` matches the original `Côte d'Ivoire` label.
- `land` returns **7** matches from the supplied dataset: Finland, Iceland, Ireland, Netherlands, New Zealand, Poland, Switzerland. (The brief cites only Iceland and Ireland as examples; the full result set is larger and must be verified in tests.)
- Curly and straight apostrophes normalize consistently.
- Case differences do not prevent a match.
- A query in the middle of a string matches.
- Empty query behavior matches the documented rule.
- No-result state appears appropriately.
- Arrow keys, Enter, Escape, and click/touch behavior work.
- Matching is done against the full provided dataset.
- Performance is acceptable for the actual data volume.

### 9.7 Acceptance criteria

The provided `data.js` dataset is used, all required matching behaviors work, the original labels display unchanged, the code is framework-free, and the interface is usable using both keyboard and pointer input.

**Time budget:** 0.75–1 day, including dataset inspection.

---

## 10. Task 05 — Authentication API

### 10.1 Objective

Build secure signup/login endpoints, password hashing, JWT issuance, and JWT verification in a backend service.

### 10.2 Data model

`User`:

| Field | Rule |
|---|---|
| `id` | UUID primary key |
| `email` | Normalized email, unique constraint |
| `passwordHash` | Secure hash; never plaintext |
| `createdAt` | Timestamp |

Never return the password hash in user-facing responses, and never log plaintext passwords.

### 10.3 Proposed API contract

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/signup` | Create an account |
| `POST` | `/api/auth/login` | Verify credentials and issue a JWT |
| `GET` | `/api/auth/me` | Return the authenticated user's safe profile |
| `GET` | `/api/auth/verify` | Verify the bearer token |
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Swagger UI |

Example request:

```json
{
  "email": "demo@example.com",
  "password": "A-strong-demo-password"
}
```

Do not commit or publish real demo passwords used in production data. Provide instructions for creating a temporary demo account or generate seeded non-sensitive demo users during deployment.

### 10.4 Security requirements

- Hash passwords with Argon2id or bcrypt using an appropriate current work factor.
- Normalize email consistently before checking uniqueness and looking up users.
- Use a cryptographically secure random JWT signing secret from environment configuration.
- Pin an explicit accepted JWT signing algorithm; never trust an arbitrary algorithm supplied by an untrusted token.
- Verify signature, issuer/audience where configured, and expiry.
- Use a short reasonable access-token lifespan, such as 15 minutes, unless challenge needs dictate otherwise.
- Keep claims minimal: subject (`sub`), issue time (`iat`), expiry (`exp`), and optional issuer/audience.
- Never put passwords, signing secrets, or sensitive account information in token payloads.
- Apply validation, request size limits, and login rate limiting.
- Avoid inconsistent login error messages that reveal whether an account exists.
- Configure CORS to the actual portfolio origin.
- Do not put production bearer tokens into public screenshots, logs, committed files, or long-lived browser-visible examples.

Refresh tokens are not necessary unless the specification expands beyond issuing and verifying JWTs. Avoid scope creep.

### 10.5 Status codes and errors

- `201 Created`: signup succeeded.
- `200 OK`: login or protected profile request succeeded.
- `400`/`422`: invalid request payload (choose a consistent policy).
- `401 Unauthorized`: invalid credentials, missing token, malformed token, bad signature, or expired token.
- `409 Conflict`: duplicate email on signup.
- `429 Too Many Requests`: rate limit exceeded.

A production API may choose a less revealing response for duplicate accounts. Document the behavior.

### 10.6 Jury demo UI

- Signup form and login form.
- Safe display of the returned user profile.
- Button to call `/api/auth/me` with a token obtained during the session.
- Token verification panel.
- Invalid, malformed, and expired-token examples that do not reveal secrets.
- Request/response viewer and status code.
- Swagger link and security explanation.

Tokens must be handled as sensitive data. Do not persist a real production token in a public shared state or expose it to analytics. For the demo, in-memory state is preferable where feasible; explain any browser storage behavior.

### 10.7 Tests

- Valid signup creates a user.
- Duplicate normalized email is rejected.
- Stored password is a hash, not the original password.
- Correct credentials issue a signed token.
- Incorrect credentials fail with `401`.
- Valid token reaches `/me`.
- Expired, tampered, malformed, or incorrectly signed tokens fail.
- Missing token fails protected routes.
- Rate limiting works when configured.
- Sensitive fields are never returned.

### 10.8 Acceptance criteria

Signup/login function through HTTP; passwords are hashed; JWTs are properly signed, verified, and expired; protected routes enforce authentication; errors and documentation match actual behavior.

**Time budget:** 0.75–1 focused day plus tests/deployment.

---

## 11. Task 06 — Smallest Missing Positive Integer

### 11.1 Objective

Given an unsorted array of integers, return the smallest positive integer not present in the array.

### 11.2 Recommended algorithm: in-place index placement

For an array of length `n`, each value `x` in `[1, n]` belongs at index `x - 1`. Repeatedly swap valid values into their target indices, avoiding infinite loops by stopping when the target already contains the same value. Then scan for the first position where `nums[i] !== i + 1`.

```ts
export function firstMissingPositive(nums: number[]): number {
  const n = nums.length;

  for (let i = 0; i < n; i++) {
    while (
      nums[i] >= 1 &&
      nums[i] <= n &&
      nums[nums[i] - 1] !== nums[i]
    ) {
      const target = nums[i] - 1;
      [nums[i], nums[target]] = [nums[target], nums[i]];
    }
  }

  for (let i = 0; i < n; i++) {
    if (nums[i] !== i + 1) {
      return i + 1;
    }
  }

  return n + 1;
}
```

This implementation mutates the input array. Document that behavior. If the demo should preserve the user's visible input, pass a copy to the function and be clear that the copy consumes `O(n)` additional space at the UI boundary; the algorithm itself uses `O(1)` auxiliary space excluding that copy.

### 11.3 Complexity

- Time: `O(n)` because each valid value can be placed into its correct position at most a bounded number of times.
- Auxiliary space: `O(1)` for in-place execution, excluding optional copy of input.

### 11.4 Demo UI

- Array input, e.g. `[0, -2, 1, 2]`.
- Example buttons.
- Input parsing/validation and helpful feedback.
- Result display.
- Optional step-by-step index-placement visualization after core correctness is complete.
- Complexity and correctness explanation.

### 11.5 Tests

| Input | Expected result |
|---|---:|
| `[0, -2, 1, 2]` | `3` |
| `[1, 2, 3]` | `4` |
| `[3, 4, -1, 1]` | `2` |
| `[7, 8, 9, 11, 12]` | `1` |
| `[]` | `1` |
| `[1, 1]` | `2` |
| `[-1, -2]` | `1` |

### 11.6 Acceptance criteria

Correctly handles negatives, zeros, duplicates, empty arrays, missing values, and fully consecutive positive arrays. The UI does not crash on invalid input and the explanation matches the implementation.

**Time budget:** 0.25–0.5 day.

---

## 12. Task 07 — Flash Sale API

### 12.1 Objective and criticality

Build a store API to browse products and current stock, place orders, and retrieve orders. Multiple customers may request the same scarce stock simultaneously. The backend must prevent negative stock, prevent overselling, respond correctly when sold out, and avoid duplicate orders caused by retrying the same request.

This is the highest technical priority because correctness depends on database concurrency semantics, not just endpoint behavior.

### 12.2 Data models

`Product`:

- `id`: UUID.
- `name`: required product name.
- `description`: optional text.
- `price`: decimal/money-safe representation; do not rely on imprecise floating-point arithmetic for stored monetary values.
- `stock`: non-negative integer; enforce this in the database as well as application validation.
- `createdAt`, `updatedAt`: timestamps.

`Order`:

- `id`: UUID.
- `productId`: product reference.
- `quantity`: positive integer.
- `unitPrice`: captured price at order time.
- `totalPrice`: captured total using safe decimal/integer minor-unit handling.
- `customerId`: authenticated user ID or documented demo identity.
- `idempotencyKey`: client-generated request key.
- `requestFingerprint`: or enough persisted request data to check that key reuse has the same semantic payload.
- `createdAt`: timestamp.

Use appropriate foreign keys and database constraints. Decide whether a demo order can contain one product only; a one-product order is a sensible scope reduction for the challenge unless the brief or task platform demands a cart.

### 12.3 Proposed API contract

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/products` | Browse products and stock |
| `GET` | `/api/products/:id` | Product details and current stock |
| `POST` | `/api/orders` | Place an order |
| `GET` | `/api/orders` | View orders for current/demo customer |
| `GET` | `/api/orders/:id` | View an order |
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Swagger UI |

Example request:

```http
POST /api/orders
Idempotency-Key: demo-order-001
Content-Type: application/json
```

```json
{
  "productId": "PRODUCT_UUID",
  "quantity": 1
}
```

Derive `customerId` from verified auth when implementing real authentication. If the task demo uses a hardcoded/public demo identity for simplicity, document this explicitly. Do not present user-provided `customerId` as secure identity.

### 12.4 Atomic stock reservation

**Unsafe pattern:** read stock, check in application code, then update stock in a separate operation. Two concurrent requests could both observe the same stock.

**Safer pattern:** let the database perform a conditional atomic update within the transaction:

```sql
UPDATE products
SET stock = stock - $1,
    updated_at = NOW()
WHERE id = $2
  AND stock >= $1
RETURNING id, stock;
```

If no row returns, determine whether the product is missing or stock is insufficient/sold out. The stock update and order creation must occur in one database transaction; if the order insert fails, roll back the stock decrement.

Also:

- Require `quantity` to be a positive integer with a reasonable upper bound.
- Add a database check constraint preventing `stock < 0`.
- Never mutate stock in an in-memory map as the authority.
- Do not claim that a check-then-update sequence is safe without a proper lock/atomic statement.

### 12.5 Idempotency design

The client may time out even though an order has succeeded and may retry the request. The API must ensure retries with the same key do not create duplicate orders.

Required behavior:

1. Require an idempotency key for order creation.
2. Scope the key by customer or demo identity, e.g. unique constraint `(customer_id, idempotency_key)`.
3. Persist the idempotency result and order consistently with the stock transaction.
4. On a retry with the same key and equivalent request, return the original order/result.
5. On reuse of the same key for a different product or quantity, return a documented conflict (e.g. `409 Conflict`).
6. Handle two simultaneous requests with the same key. A preliminary in-memory or application-level existence check is not enough; database uniqueness and transaction handling must resolve the race safely.
7. Be careful with transaction behavior after a uniqueness conflict. The implementation should read and return the existing result when appropriate rather than decrementing stock twice.

A request fingerprint may be calculated from canonicalized semantic fields such as product ID and quantity. Do not include unpredictable headers in the semantic fingerprint.

### 12.6 Failure behavior

| Scenario | Expected result |
|---|---|
| Stock is available | One order created; stock decremented atomically |
| Stock is sold out | Documented conflict response, typically `409` |
| Quantity exceeds remaining stock | Reject request; stock unchanged |
| Duplicate retry with same key and same payload | Return the original order; no second decrement |
| Same key with different payload | Reject with conflict |
| Invalid quantity | `400` or `422`, consistent with API policy |
| Unknown product | `404` |
| Order insert fails | Transaction rollback; stock restored automatically |
| Database unavailable | Safe server error; no false success response |

### 12.7 Demo seed data

- Seed a small number of products with realistic but invented product names.
- Include at least one deliberately scarce product for concurrency testing.
- Provide a documented reset/seed procedure that is safe for the demo environment.
- Do not rely on volatile service filesystem data for durable stock and order state.
- Ensure the public simulator cannot trigger uncontrolled request storms.

### 12.8 Jury-facing Flash Sale Lab

Build the following features after the endpoint implementation works:

- Product list with actual stock returned by the API.
- Product detail / quantity selector.
- Place-order action that generates an idempotency key for a new logical order.
- Retry-last-request action that deliberately reuses the same key and identical payload.
- Configurable concurrent request count, kept modest (e.g. tens rather than thousands) for the public demo.
- Results panel showing each request status and whether it created a new order or replayed an existing one.
- Final stock refreshed from the API.
- Order list showing persisted order records.
- Link to Swagger and concurrency test documentation.

The displayed stock and outcomes must be API-backed data, not mock values. Provide sensible timeouts and a cancel/stop option if a test is still running.

### 12.9 Critical test scenarios

**Scenario A — Oversell prevention**

1. Seed a product with stock `10`.
2. Send 50 simultaneous order requests, each purchasing one unit, each with a distinct idempotency key and customer scope as appropriate.
3. Expected: exactly 10 successful unit orders, 40 insufficient-stock/sold-out failures, final stock `0`, total quantity ordered `10`, and no negative stock.

**Scenario B — Idempotency under concurrent retries**

1. Seed a product with sufficient stock.
2. Send multiple simultaneous copies of the same order payload with the same customer and idempotency key.
3. Expected: exactly one logical order and one stock decrement; all successful replays refer to the same order or a documented in-progress response is returned and can be retried safely.

**Scenario C — Key reused with different payload**

1. Send a successful order with a key.
2. Reuse the key for another quantity or product.
3. Expected: conflict, no extra decrement, and no second order.

**Scenario D — Rollback**

Force/induce an order-write failure in a controlled test. Confirm the transaction rolls back and stock remains unchanged.

### 12.10 Acceptance criteria

- Stock cannot become negative.
- Successful order quantity never exceeds available stock.
- Stock decrement and order persistence are atomic.
- Reusing an idempotency key does not create duplicate orders.
- The same key with a different request is rejected.
- Orders and stock persist across service restarts.
- Concurrent behavior is proven by automated tests, not just by the happy-path UI.

**Time budget:** 1–1.5 days for a focused implementation plus tests/deployment.

---

## 13. Shared API standards

### 13.1 Response conventions

A collection response can use:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 0
  }
}
```

A common error format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "details": []
  }
}
```

Only use pagination metadata on paginated responses. Keep error names, messages, and status codes consistent across services where appropriate.

### 13.2 Engineering conventions

- Validate all inbound data.
- Use explicit HTTP status codes.
- Use parameterized database queries or a safe query builder.
- Provide centralized error handling.
- Log useful operational details without passwords, tokens, secrets, or unnecessary personal data.
- Include request IDs where practical.
- Health endpoints must not disclose database credentials, signing secrets, detailed internal stack traces, or sensitive configuration.
- Use bounded pagination and request sizes.
- Configure CORS to the real portfolio origin.
- Keep OpenAPI schemas and examples synchronized with actual endpoints.
- Apply database migrations rather than relying on ad hoc manual production changes.
- Provide test seed data and a documented reset strategy.
- Use HTTPS public endpoints.

### 13.3 Embedded API tester pattern

Use a shared **presentation component** in the portfolio where possible, not a shared business-logic service. It can provide:

- Method and endpoint selection / preconfigured operations.
- Request body editor for write operations.
- Required headers and safe token field when needed.
- Send button with loading and timeout states.
- HTTP status, response headers that are safe to display, duration if measured, and formatted JSON response.
- Error messages for network/CORS failures.
- “Open Swagger” and “Copy example request” links.

The actual requests must be sent to the live service from the browser, or through a documented proxy only if deployment constraints require it. Do not fake response payloads when APIs are offline.

---

## 14. Testing and quality gates

### 14.1 Testing matrix

| Challenge | Unit tests | Integration / end-to-end checks |
|---|---|---|
| Lost & Found | Input schemas, filters, state transitions | CRUD/search/recovery over HTTP; ownership enforcement |
| Calculator | Lexer/parser, precedence, malformed expressions | Keyboard/touch interaction and responsive layout |
| Missing binary string | Length, bit validity, output not present | Invalid input and edge cases in UI |
| Autocomplete | Normalization, substring match, ranking | Supplied full dataset, keyboard control, mobile interaction |
| Authentication | Password hashing, JWT claims/signature/expiry | Signup/login/protected route and error status codes |
| Missing positive | Negatives, zeros, duplicates, missing gaps | Empty and large arrays, UI validation |
| Flash Sale | Stock/order transaction logic, idempotency | Concurrent distinct purchases, simultaneous retries, rollback |

### 14.2 Minimum release quality gates

- [ ] All packages install from a clean clone.
- [ ] All required applications build or pass syntax/type checks.
- [ ] Unit tests pass.
- [ ] API integration tests pass against a test database.
- [ ] No secrets are tracked by Git.
- [ ] OpenAPI documents the deployed routes correctly.
- [ ] Direct URL navigation and refresh work.
- [ ] Desktop and mobile layouts are usable.
- [ ] Keyboard controls and focus behavior work.
- [ ] API timeout/network/CORS states are handled.
- [ ] Public APIs use persistent database storage.
- [ ] Flash Sale concurrency and idempotency tests pass.
- [ ] Final smoke test is run against deployed production URLs.

Do not claim full coverage or production-scale load handling unless it has been measured. Report measured tests and their scope honestly.

---

## 15. Deployment strategy (free-tier first)

### 15.1 Deployment topology

- Portfolio: static hosting (e.g. Netlify or Cloudflare Pages).
- Backend services: independent Node-capable web services, subject to current free-tier support.
- Database: hosted PostgreSQL free tier where available.
- Swagger: served by each backend, or another hosted location that loads the matching OpenAPI spec.

The provider names are candidates, not guarantees. Before finalizing, verify current free-tier limits, sleeping behavior, database pausing/retention rules, build limits, environment variable support, request limits, and custom-domain behavior. Free-tier policies change.

### 15.2 Database layout

To reduce operational overhead, one hosted PostgreSQL project may contain separate schemas for:

- `lost_found`
- `auth`
- `flash_sale`

Each service should own its tables and migrations. If the hosting setup supports restricted database roles, use separate roles and only grant each service access to its own schema. Never let one service casually update another service's tables.

The Flash Sale service must use PostgreSQL transaction/constraint behavior as the source of truth. Do not use JSON files or in-memory variables as the authoritative stock/order store.

### 15.3 Example configuration

A service-specific `.env.example` may resemble:

```dotenv
NODE_ENV=development
PORT=3000
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=15m
CORS_ORIGINS=http://localhost:5173
```

Remove variables unused by a service. For deployment, set production values in the host's environment settings. Do not include real credentials in this repository.

### 15.4 Deployment sequence

1. Create the monorepo, push it to Git hosting, and confirm a clean checkout builds locally.
2. Deploy the portfolio skeleton with placeholder demo states and real future API URL configuration.
3. Provision PostgreSQL and create schemas/migrations for each backend.
4. Deploy Lost & Found, then Authentication, then Flash Sale, testing each independently.
5. Configure the required production environment variables and restricted CORS origins.
6. Run migrations and seed safe demo records.
7. Verify health routes, Swagger pages, and critical API operations.
8. Add actual deployed API URLs to public frontend configuration.
9. Redeploy and test every task page and backend link from a fresh browser session.
10. Test database persistence, auth behavior, cold starts, concurrency, and failure states before submission.

### 15.5 Free-tier risks

- **Cold starts/sleep:** show a loading state and timeout/retry path; confirm how long the first request may take on the chosen host.
- **Database pauses/retention:** check the provider's current free-project inactivity and retention policy, and verify the project is active before evaluation.
- **Ephemeral filesystem:** do not rely on local service files for persistent reports, users, products, or orders.
- **CORS:** test the actual deployed site origin, not just localhost.
- **Rate/resource limits:** cap public concurrency simulations and request volume.
- **Quota exhaustion:** check current free-tier limits close to deployment.
- **Unavailability:** if a provider has unreliable free-tier service, select another option before investing heavily in provider-specific configuration.

Do not rely on artificial keep-alive requests as the primary reliability strategy. Keep a short pre-jury smoke-test procedure.

---

## 16. Ten-working-day implementation plan

This schedule assumes focused/full-time work and a functioning local environment. If actual daily hours are lower, preserve the priorities and cut polish rather than correctness. Aim for all core features by Day 8, release validation on Day 9, and presentation on Day 10.

| Day | Focus | Work | Deliverable / exit criteria |
|---|---|---|---|
| 1 | Foundation | Monorepo, workspaces, formatting/lint/test scripts, portfolio shell, design tokens, routing, first deployment | Public landing skeleton works; nested route strategy verified |
| 2 | Algorithms | Binary-string and smallest-positive functions, tests, demo forms/explanations | Both algorithms pass edge-case tests |
| 3 | Calculator | Vanilla page, tokenizer/parser, keypad, keyboard support, error states | Correct precedence, keyboard tests, responsive UI |
| 4 | Autocomplete | Inspect supplied `data.js`, normalize once, implement substring search/ranking, dropdown and keyboard behavior | Accent/apostrophe/mid-word tests pass on full data |
| 5 | Lost & Found | Schema, migrations, CRUD/search/filter/recovery, ownership mechanism, Swagger | API passes local integration tests |
| 6 | Authentication | Signup/login, password hashing, JWT validation, rate limits, docs/tests; deploy first backend services | Auth and Lost & Found work through deployed URLs |
| 7 | Flash Sale | Atomic stock update, transaction, idempotency constraints, order endpoints, concurrent tests | Overselling and duplicate retry tests pass locally |
| 8 | Integration | Deploy Flash Sale; connect all URLs; shared API tester; seed data; all task pages linked | All seven routes and three APIs are usable |
| 9 | Release validation | Production smoke tests, CORS, persistence, cold start, route refresh, mobile and failure states | No known P0 defects; deployment verified |
| 10 | Jury presentation | README, architecture diagram, task docs, verified screenshots/results, jury guide, final fixes | Submission-ready portfolio and documentation |

### 16.1 Daily rule

At the end of every day:

1. Commit working code.
2. Update task statuses truthfully.
3. Run relevant tests.
4. Keep a list of blockers and cut optional scope if the schedule slips.
5. Ensure any deployed link shown as “Live” actually works.

### 16.2 Scope cuts if behind schedule

Cut in this order:

1. Animated backgrounds and elaborate transition effects.
2. Optional step-by-step visualizations for algorithms.
3. Advanced API tester conveniences that duplicate Swagger.
4. Optional filters and analytics not required by the brief.
5. Deep styling refinements that do not improve usability.

Do **not** cut:

- The vanilla-only calculator requirement.
- The supplied autocomplete data and required matching behavior.
- The diagonal proof/output validity for the binary-string task.
- Correct smallest-positive logic and edge cases.
- Secure password hashing and token verification.
- Persistent backend data.
- Flash Sale database atomicity, idempotency, and concurrency tests.
- A working preview route for every task.

---

## 17. Documentation plan

### 17.1 Root README

Include:

- Project summary and actual deployed URL.
- Table of all seven tasks with demo, source, and documentation links.
- Technology stack.
- Architecture overview/diagram.
- Prerequisites and local setup.
- Install and run commands.
- Environment configuration instructions.
- How to run tests and checks.
- Database migration/seed commands.
- Deployment overview and limitations.
- Known caveats relevant to the jury.

### 17.2 Architecture document

`docs/architecture.md` should cover:

- High-level diagram.
- Repository and deployment boundaries.
- Request flow from portfolio API tester to services.
- Database schema ownership.
- Authentication/ownership decision.
- Flash Sale stock/idempotency design.
- Key tradeoffs and scope decisions.

### 17.3 Deployment document

`docs/deployment.md` should cover:

- Static frontend host and build settings.
- Separate service deployment settings.
- Current actual public URLs.
- Environment variables by service (names only; no values).
- Database migrations and safe seed process.
- CORS configuration.
- Free-tier limits/sleep and pre-jury warm-up/smoke procedure.
- Recovery/redeployment instructions.

### 17.4 Per-task document template

Use a consistent template for all seven files under `docs/tasks/`:

1. Problem statement and requirements.
2. Constraints from the challenge brief.
3. Implementation approach.
4. Architecture/data model or algorithm.
5. API contract or interaction design.
6. Validation and edge cases.
7. Complexity (algorithms) or security/concurrency (APIs).
8. Test cases and actual results.
9. Demo URL, Swagger/source links, and known limitations.

### 17.5 Jury guide

`docs/jury-guide.md` should contain:

- Portfolio URL.
- One-click link for each task.
- API base URLs and Swagger links.
- Short suggested test sequence for every task.
- Demo credentials/account-creation instructions if needed (never leak private credentials).
- Concurrency test explanation and what the juror should observe.
- A note about cold-start delays if applicable.

### 17.6 Documentation honesty

- Only report tests that were actually run.
- Only claim a feature is deployed when its public URL has been verified.
- If a hosting provider's free tier introduces a limitation, state it clearly.
- Separate observed benchmark figures from estimates.
- Do not claim the Flash Sale API can handle unlimited concurrency; report the tested request count and environment instead.

---

## 18. Final release checklist

### Portfolio

- [ ] Landing page is responsive and visually coherent.
- [ ] All seven cards and page routes are correct.
- [ ] Route refresh and direct-link behavior work on the deployed host.
- [ ] Not-found page works.
- [ ] All source, docs, and Swagger links point to actual resources.
- [ ] Status badges and test results are truthful.

### Frontend and algorithm tasks

- [ ] Calculator is implemented with vanilla HTML/CSS/JS and no `eval()`.
- [ ] Calculator precedence, keyboard support, and error behavior pass tests.
- [ ] Binary-string function returns length-`n` output not present in the input.
- [ ] Autocomplete uses the supplied `data.js` dataset.
- [ ] Autocomplete supports mid-word matches, accents, apostrophes, and keyboard selection.
- [ ] Smallest-missing-positive function passes negatives, zeros, duplicates, and empty-array tests.
- [ ] Invalid user input is handled without crashes.

### Backend APIs

- [ ] Lost & Found create/search/read/update/recover flows work.
- [ ] Lost & Found ownership checks are enforced for updates/recovery.
- [ ] Auth stores password hashes only and issues/verifies signed, expiring JWTs.
- [ ] Invalid, expired, or tampered JWTs are rejected.
- [ ] Flash Sale stock is non-negative at all times.
- [ ] Flash Sale order creation and stock decrement are in one transaction.
- [ ] Same-key/same-payload retry returns the original result without another order.
- [ ] Same-key/different-payload retry is rejected.
- [ ] Concurrent distinct orders cannot oversell stock.
- [ ] Backend data persists across service restarts.
- [ ] Swagger matches the actual API implementation.

### Security and deployment

- [ ] No secrets are committed or shipped in the browser bundle.
- [ ] Production environment variables are set correctly.
- [ ] CORS allows only expected origins.
- [ ] Public demos use synthetic data and bounded request volume.
- [ ] Health, docs, and API URLs are verified in a fresh session.
- [ ] Error responses do not expose internal details.
- [ ] Current free-tier limits and pause/sleep behavior have been checked.

### Documentation and jury readiness

- [ ] Root README is complete.
- [ ] Architecture and deployment docs are up to date.
- [ ] Seven task-specific docs exist.
- [ ] Test results reflect real test runs.
- [ ] Jury guide links to all demos and documents how to test them.
- [ ] Final smoke test is complete.

---

## 19. Recommended immediate next actions

1. **Create the monorepo and deploy the portfolio skeleton first.** Even an unfinished placeholder page provides an early live deployment and forces you to resolve routing/hosting constraints.
2. **Inspect the provided autocomplete `data.js`.** Confirm its shape, size, and entries before selecting the final search strategy.
3. **Implement and test the two algorithm functions.** They are fast, self-contained wins and can be completed before the backend infrastructure is ready.
4. **Build the vanilla calculator and autocomplete as independent apps.** Preserve each task's framework constraints.
5. **Create shared backend conventions before writing each API.** Decide validation, error format, health routes, logging, database migration flow, and OpenAPI approach once.
6. **Build Lost & Found and Auth, then Flash Sale.** Reuse suitable validation/documentation patterns, but keep ownership and concurrency requirements explicit.
7. **Make Flash Sale correctness a release blocker.** Do not submit based only on a successful single-user purchase test.
8. **Connect and test every deployed preview URL.** Validate the real remote services from a clean browser session.
9. **Finish with documentation and a jury walkthrough.** Make the first minute of evaluation obvious and frictionless.

## 20. Final recommendation

The most effective version of this project is not the one with the most features. It is the one where the visual presentation is coherent, every task is easy to find, every demo genuinely works, and technical decisions can be verified.

Prioritize in this order:

1. **Correctness and constraints.**
2. **Reliable deployment and persistent backend behavior.**
3. **A consistent, polished and accessible user experience.**
4. **Documentation and demonstrable test evidence.**
5. **Optional visual sophistication.**

Build the project as a focused engineering portfolio: one front door, seven clear demonstrations, three real APIs, meaningful tests, and no unsupported claims.
