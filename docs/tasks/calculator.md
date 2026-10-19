# gip-02 — Interactive Calculator

> Source: [`apps/calculator/`](../../apps/calculator/)
> Demo: `/tasks/calculator`

## 1. Problem statement

> Build a working calculator UI with keyboard support and proper operator
> precedence handling in vanilla JS.
>
> — challenge brief, `docs/brief.md`

## 2. Constraints from the brief

| Constraint | Enforced by |
|---|---|
| **"You must use only HTML/CSS and javascript with no framework"** | Build-time check — see §9 |
| Vanilla JS | No build step, no transpilation, no bundler |

This is the only challenge where the brief imposes a framework prohibition. The autocomplete is
framework-free **by our choice**, not by requirement. See
[`docs/plan.md` §3.3](../plan.md).

## 3. Implementation approach

A hand-written tokenizer and recursive-descent parser, split from the DOM wiring:

| File | Responsibility |
|---|---|
| `parser.js` | Tokenize, parse, evaluate, format. **Pure — no DOM at all** |
| `calculator.js` | DOM wiring, keyboard mapping, input guards |
| `styles.css` | Plain CSS |
| `index.html` | Markup |

Separating the parser means the algorithm is testable without a browser, which is where all the
interesting tests live.

### Why not `eval()`

`eval()` and `new Function()` are equivalent to arbitrary code execution. A calculator evaluates
text the user typed; routing that through `eval()` would mean a user could execute code in the
page's origin. The expression grammar is small enough that a correct parser is a few dozen lines,
so there is no real trade-off here — only a bad one.

## 4. Grammar

```text
expression := term (("+" | "-") term)*
term       := factor (("*" | "/") factor)*
factor     := unary | "(" expression ")" | number
unary      := ("+" | "-")* factor
```

Precedence, loosest first: parentheses → unary sign → `*` `/` → `+` `-`.

The parser reads tokens left to right and reports the **position** of any failure, so the UI can
point at what went wrong rather than saying only "error".

## 5. Interaction design

| Key | Action |
|---|---|
| `0`–`9`, `.` | Digits and decimal point |
| `+` `-` `*` `/` | Operators |
| `(` `)` | Parentheses |
| `Enter` or `=` | Evaluate |
| `Backspace` | Delete the last character |
| `Escape` or `Delete` | Clear everything |

Screen shows the expression being typed above the current result, mirroring a physical calculator.

**Input guards** (each has a test):

- Two operators in a row are **replaced**, not stacked — except `-` after `*` or `/`, which is a
  legitimate unary sign (`2*-3`).
- Only one decimal point per numeric literal.
- `(` after a digit inserts an implicit `*`, so `2(3)` evaluates as `2*(3)` rather than failing.
- `)` immediately after an operator is ignored.

**Keyboard details.** `/` calls `preventDefault()` to stop Firefox quick-find, and modified
keystrokes (`Ctrl`/`Meta`/`Alt`) are ignored entirely so browser shortcuts keep working.

## 6. Validation and edge cases

Division by zero throws rather than returning `Infinity` — a non-finite value is never displayed as
a valid answer. Malformed input throws `ParseError` with a position.

| Input | Result |
|---|---|
| `2 + 3 * 4` | `14` |
| `(2 + 3) * 4` | `20` |
| `10 / 2` | `5` |
| `0.1 + 0.2` | `0.3` |
| `5 / 0` | Error: "Cannot divide by zero." |
| `5 / (3 - 3)` | Error — indirect division by zero also caught |
| `2 +` | Error on evaluate; no crash beforehand |
| `()` , `2)` , `2++*3` | Parse error |

**On an error the expression is left on screen** so it can be corrected, rather than being cleared.

### Float display policy

Floating point makes `0.1 + 0.2` equal `0.30000000000000004`. `formatResult` rounds to 12
significant digits **for display only**. The unrounded value is never fed back into further
arithmetic, so rounding cannot corrupt a subsequent operation. Twelve digits is far beyond what a
person can meaningfully read off a keypad.

## 7. Complexity

Parsing is a single left-to-right pass: **O(n)** in expression length, **O(n)** space for tokens
and the recursion stack.

## 8. Test cases and actual results

**42 tests, all passing** (run via `pnpm --filter @gip/calculator test`).

### Parser (21 tests)

- Tokenizer: number/operator/paren splitting, decimals with and without a leading zero, whitespace,
  rejection of unknown characters
- Precedence: `2+3*4`, `(2+3)*4`, `10/2`, mixed `2+3*4-6/2`, left-associative `100/5/2`, nested
  parentheses
- Unary signs: `-3`, `2*-3`, `--5`, `-(2+3)`
- Errors: division by zero (direct and computed), incomplete expressions, empty input, empty
  parentheses, stray parentheses, garbage input
- Display: `0.1+0.2 → 0.3`, `1/3 → 0.333333333333`, integers without a decimal point
- **A dedicated test asserting that input which would be code execution under `eval` — `alert(1)`,
  `constructor`, `1;2` — throws a `ParseError`.** This exists specifically to fail loudly if
  someone "simplifies" the implementation by switching to `eval`.

### UI (21 tests)

Loads the real `index.html` into jsdom and drives the real event handlers, so keyboard support is
tested rather than assumed:

- Every case from the challenge's test table, via clicks
- Keyboard: digits and operators, `Enter`, `=`, `Escape`, `Backspace`, parentheses
- `/` prevents the browser default; modified keystrokes do **not**
- Input guards: operator replacement, unary minus after `*`, single decimal point, implicit multiply
- Error behaviour: `5 / 0` shows "Error" and keeps the expression

## 9. How the constraint is enforced, not just claimed

The brief's framework restriction is the kind of thing that erodes — a convenience import, a
"temporary" `eval()` during debugging. So `scripts/demo-build.mjs` **fails the build** if the
calculator's source contains `eval(`, `new Function(`, or an import of React/Vue/Angular/Svelte/
Preact/Solid.

The check strips comments before scanning, because documentation describing the ban must not trip
the check enforcing it. It was verified with a negative control: appending a real `eval()` call
fails the build, removing it passes.

## 10. Links and limitations

- Source: [`apps/calculator/`](../../apps/calculator/)
- Tests: [`parser.test.js`](../../apps/calculator/tests/parser.test.js),
  [`calculator.test.js`](../../apps/calculator/tests/calculator.test.js)
- Demo: `/tasks/calculator` (embedded via `<iframe>` from `/demos/calculator/`)

**Limitations.** There is no percent or sign-flip key; the brief does not ask for one and their
semantics in a chained expression are ambiguous. There is no history of previous calculations
beyond the current one. Very long expressions scroll horizontally rather than wrapping, which
keeps the layout stable but hides older input on narrow screens.