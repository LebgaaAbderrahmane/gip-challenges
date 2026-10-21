# Evaluation map

For each of the seven challenges: the requirement **in the brief's own words**, where to see it
working, and the one behaviour worth checking.

This was a page on the site (`/evaluate`). It is a document here instead, because the site is
for *doing* the challenges and this is for *reading* about them — a jury who wants the reasoning
has the repository, and a jury who wants the working thing has the site.

> The brief is reproduced verbatim in [`brief.md`](./brief.md), so every requirement quoted below
> can be traced to its source.

**Start with one thing.** If you only do one, do the last one: open the Flash Sale Lab and fire
thirty simultaneous orders at a product with ten units. It is the hardest requirement in the
brief, and it is the clearest thing to watch.

---

## gip-01 — Lost & Found API

> "search and filter reported items, view the details of the item, update their own reports &
> mark an item as recovered"

**Where:** `/tasks/lost-found` — the API tester.

**Look for:** Sign in on the Authentication API, then use that token here. Update a report as its
owner, then as a different user — the second attempt is refused with **403**.

---

## gip-02 — Interactive Calculator

> "a working calculator UI with keyboard support and proper operator precedence handling in
> vanilla JS" — "You must use only HTML/CSS and javascript with no framework"

**Where:** `/tasks/calculator` — the live demo.

**Look for:** Type `2 + 3 * 4` and press Enter: the answer is **14**, not 20. The source is three
plain files with no framework and no `eval()`.

---

## gip-03 — Missing Binary String

> "return a binary string of length n that does not appear in nums. If there are multiple answers,
> you may return any of them."

**Where:** `/tasks/binary-string` — the interactive tester.

**Look for:** The answer is always absent from the input, and it differs from every input row at
that row's own index.

---

## gip-04 — Autocomplete Search

> "It should support mid-word matches (typing land returns you iceland, ireland...)" and "Accents
> and apostrophes should be handled too (cote d'ivoire returns côte d'ivoire)"

**Where:** `/tasks/autocomplete` — the live demo.

**Look for:** Type `land` — it is a mid-word match. Type `cote d'ivoire` — it finds
**Côte d'Ivoire**. The search runs over all 110 supplied records.

---

## gip-05 — Authentication API

> "Build signup/login endpoints with password hashing and JWT issuing/verification" — "secured
> signup/login endpoints"

**Where:** `/tasks/auth` — the API tester.

**Look for:** Sign up, then sign in: the response carries a token and the user, without a
password hash. Try the same token on a different page — it is accepted, because all three
services share one secret.

---

## gip-06 — Smallest Missing Positive

> "Return the smallest positive integer (n > 0) that is not present in nums." The brief's example:
> `[0, -2, 1, 2]` gives `3`.

**Where:** `/tasks/missing-positive` — the interactive tester.

**Look for:** The brief's example gives **3**. An empty array gives 1, and a fully consecutive
array gives `n + 1`.

---

## gip-07 — Flash Sale API

> "prevent stock from going negative, ensure a product isn't oversold, correctly handle
> simultaneous requests... prevent a client from accidentally creating multiple orders by retrying
> the same request."

**Where:** `/tasks/flash-sale` — the Flash Sale Lab.

**Look for:** Fire 30 simultaneous orders at a product with 10 in stock: exactly **10** succeed,
**20** are refused, and the stock ends at 0 — never below it. Then retry the same order: one
order, one decrement.

---

## Two things worth knowing

**The task identifiers are not the brief's.** The brief restarts its own numbering partway
through — three of its tasks are labelled "Task 01" — so each challenge here carries a stable
name instead. The brief is reproduced verbatim in the repository, so every requirement can be
traced.

**The three APIs are one system, not three demos.** They share one signing secret, so a token
issued by the Authentication API is accepted by the other two. Sign in once and it follows you
around the site.
