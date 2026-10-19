# gip-04 — Autocomplete Search

> Source: [`apps/autocomplete/`](../../apps/autocomplete/)
> Demo: `/tasks/autocomplete`

## 1. Problem statement

> Build a performant client side search box that supports auto completion,
> from the given dataset.
>
> — challenge brief, `docs/brief.md`

## 2. Constraints from the brief

| Constraint | Status |
|---|---|
| "You should write the auto completion algorithm." | Hand-written, no library |
| "The dataset should be the one given (data.js)." | Used unmodified, all 110 records |
| "It should support mid-word matches (typing land returns you iceland, ireland...)" | Substring matching |
| "Accents and apostrophes should be handled too (cote d'ivoire returns côte d'ivoire)" | Normalisation |

> **Attribution.** The brief imposes **no framework prohibition** on this task. It constrains the
> algorithm and the dataset, not the stack. The implementation is framework-free by choice, and is
> described that way throughout — see [`docs/plan.md` §3.3](../plan.md).

## 3. Implementation approach

| File | Responsibility |
|---|---|
| `data.js` | The supplied dataset, unmodified |
| `normalize.js` | Normalisation, and the position map for highlighting |
| `search.js` | The matching and ranking algorithm |
| `autocomplete.js` | DOM wiring only |

The algorithm is separated from the interface, so it is tested without a browser.

### The dataset, measured

| Property | Value |
|---|---|
| Records | **110** |
| Identifiers | `id` 1–110, sequential |
| Fields | `id`, `name` only |
| Unique names | 110 / 110 — no duplicates |
| Longest name | 22 characters |
| Names containing non-ASCII | **2** — `Côte d'Ivoire`, `São Tomé and Príncipe` |
| Apostrophe characters present | **U+0027 (straight) only** — no curly U+2019 |

## 4. The algorithm

### Matching is by substring

The brief asks for mid-word matches. A prefix search would find neither "Iceland" nor "Ireland"
for "land", so the search is `indexOf` over the whole normalised label.

### Normalisation happens once

Every label is normalised when the page loads, never per keystroke:

1. **NFD decomposition** — splits "é" into "e" and a combining accent, so the accent can be
   removed. NFC would recompose them and nothing would match.
2. **Combining marks removed** — "Côte" becomes "Cote".
3. **Apostrophe variants folded** — U+2019, U+02BC and the grave accent all become U+0027. The
   dataset uses U+0027, but keyboards and copy-paste produce the others.
4. **Lowercased**, so matching is case-insensitive.
5. **Whitespace collapsed and trimmed**, so a stray double space changes nothing.

The original label is always kept for display, so what the user sees is exactly what the dataset
says.

### Ranking never hides a match

Results are ordered **exact → prefix → any other substring**, and only then truncated to the
display limit of 10. Within a tier the shorter label wins, because it is the more specific answer,
and the name breaks any remaining tie so the order is deterministic.

The limit is applied *after* ranking, so a valid match is never crowded out by a less relevant one
that happens to rank above it. A test asserts this.

### Highlighting without `innerHTML`

The normalised string is not character-for-character the same as the original, so the match has to
be mapped back. `normalizeWithMap` records, for every character of the normalised string, the
index it came from in the original. The highlighted range is then correct even when the match
spans a folded character — searching "sao" marks **"São"**, with the accent intact.

The label is assembled from text nodes and a `<mark>` element. It is never interpolated into HTML,
so a dataset entry could not inject markup.

## 5. Interaction design

| Control | Behaviour |
|---|---|
| Typing | Filters the full dataset on every keystroke |
| ↑ / ↓ | Move the highlight, wrapping at both ends |
| Enter | Selects the highlighted option |
| Escape | Dismisses the list, leaving the text |
| Click / tap | Selects an option |
| Clear button | Empties the field and refocuses it |

The field is a `combobox` with `aria-expanded`, `aria-controls` and `aria-activedescendant`, and
the list is a `listbox` of `option`s. The result count is announced through a `role="status"`
region.

An empty query shows no list and no status; a query with no results explains that in the status
line rather than showing an empty dropdown.

## 6. Validation and edge cases

| Input | Result | Note |
|---|---|---|
| `land` | **7** matches | Finland, Iceland, Ireland, Netherlands, New Zealand, Poland, Switzerland |
| `cote d'ivoire` | `Côte d'Ivoire` | The brief's example |
| `cote d’ivoire` | `Côte d'Ivoire` | Curly apostrophe against the straight one |
| `sao` | `São Tomé and Príncipe` | Accents folded on both sides |
| `ICELAND` | `Iceland` | Case-insensitive |
| `man` | `Romania` | Matches in the middle of a word |
| `zzzz` | No match | Explained in the status line |
| *(empty)* | No suggestions | A hint is shown instead |

**The apostrophe is part of the word, not optional.** A query with a space (`cote d ivoire`) or
with no apostrophe (`cote divoire`) does not match. The brief asks for apostrophes to be *handled* —
the variants of the character — not for the character to be optional. This is asserted by a test so
the behaviour is deliberate rather than accidental.

## 7. Complexity and measured performance

| Measure | Value |
|---|---|
| Search | **O(n)** over the dataset — 110 records |
| Normalisation | **O(n) once**, at load, not per keystroke |
| Auxiliary space | O(n) for the prepared entries |
| **Measured** | **0.0079 ms per search**, averaged over 3000 searches |

**No index is built.** The plan considered an n-gram index and deferred it; the measurement
settles it. At 110 records a linear scan is already faster than the index would be to construct,
so building one would be pure cost.

## 8. Test cases and actual results

**33 tests, all passing** (run via `pnpm --filter @gip/autocomplete test`).

| Area | What is asserted |
|---|---|
| The dataset | 110 records; the first entry; no duplicate or empty names |
| Full coverage | A landmark from the far end of the list ("Zimbabwe") is found, proving the whole dataset is searched and not a prefix of it |
| Mid-word | The brief's "land" finds Iceland and Ireland, and the **full set of seven** is asserted against the supplied data |
| Accents | "cote", "côte", "côte d'ivoire" and "sao" all find the accented entries |
| Apostrophes | Straight, curly and modifier forms all match |
| Case | "ICELAND" and "iCeLaNd" both match |
| Ranking | The exact order for "guinea" is asserted, tier by tier, including that a valid match is never dropped to make room for a better-ranked one |
| Highlighting | The marked range is checked against the original label, including a match spanning a folded character |
| Normalisation | Each step tested individually, plus a non-string input that must not throw |
| Empty query | Returns nothing, so the interface can show a hint |
| Performance | Measured over 400 searches and asserted to be under 5 ms |

## 9. Links and limitations

- Source: [`apps/autocomplete/`](../../apps/autocomplete/)
- Tests: [`search.test.js`](../../apps/autocomplete/tests/search.test.js)
- Demo: `/tasks/autocomplete` (embedded via `<iframe>` from `/demos/autocomplete/`)

**Limitations.** The apostrophe is required, as described above. Matching is exact-substring, not
fuzzy: a typo is not corrected and a missing space is not inferred. The list shows at most ten
suggestions, with the total count reported in the status line. The dataset is the one supplied
with the brief, and no other country data is added.
