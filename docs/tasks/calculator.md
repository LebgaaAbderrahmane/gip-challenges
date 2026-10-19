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

### Keyboard layouts

The calculator has to work on the keyboard its user actually has, not only on
the author's. Three properties of a key event carry that information, and each
has a failure mode:

| Property | What it means | Failure mode |
|---|---|---|
| `event.code` | The **physical key** — `Digit1`, `Numpad5` | Can be `''` or `'Unidentified'` when the browser cannot map the key (chromium issue 41384052) |
| `event.key` | The **character** the layout produces | Layout-dependent: the key labelled "1" reports `&` on French AZERTY |
| `event.keyCode` | Legacy numeric code | Unreliable for printable characters — MDN's rules 3–5 have Firefox derive it from the ASCII character rather than the key's position |

The resolver in [`keymap.js`](../../apps/calculator/keymap.js) consults them in
that order, and adds two further signals:

- **`event.location`** — `3` means the numeric keypad. It is the only way to
  tell "the keypad's 4" from "ArrowLeft" when NumLock is disengaged, because
  both report keyCode `37`. Without it, interpreting the keypad would make
  the left arrow type a `4`.
- **Known layout digit rows** — a data table of layouts whose digit row is not
  digits (`& é " ' ( - è _ ç à` over `1 2 3 4 5 6 7 8 9 0` for French AZERTY).
  It is the last resort, for when the browser reports neither a usable `code`
  nor a usable `keyCode`.

One conflict is inherent, and is resolved in favour of digits. On a French
AZERTY the unshifted character of the digit `5` is `(`. A parenthesis is a
calculator key in its own right, so the character wins and the digit `5` stays
reachable through shift — whose character is the literal `5` — and through the
keypad. Whenever the browser *does* supply a usable `code`, the physical key
wins instead and the digit comes through directly.

### The embedded demo uses the same resolver

The portfolio page previously kept its own list of "keys worth forwarding"
into the iframe: a second copy of these rules. It drifted, and the embedded
page dropped keys the standalone page accepted — the same number working in
one and not the other. The parent now imports the demo's own `keymap.js`
(aliased as `@gip/keymap`), so the two cannot disagree. A parity test asserts
it, and the key resolution is verified in a real browser across seven
layout combinations on both the standalone and the embedded page.

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

**94 tests, all passing** (run via `pnpm --filter @gip/calculator test`).

### Key resolution (keymap.test.js, 33 tests)

Covers each source alone and in combination: a QWERTY digit row, an AZERTY
digit row with a usable `code`, the same with an empty `code`, the same with
`code: 'Unidentified'`, the keypad with NumLock engaged and disengaged, the
keypad with no usable `code` but `location: 3`, shifted characters, named
actions, and the cases that must be *rejected* — a letter, Tab, an arrow key,
and an arrow key whose keycode is also a keypad digit.

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
- Layouts: a dedicated suite drives the real key handling with QWERTY, French
  AZERTY, keypad and NumLock-off events, including events whose `code` is
  empty or `Unidentified`
- Parity: the portfolio has its own suite asserting it forwards exactly the
  keys the demo accepts, so the two copies of the rules can never drift apart
  again
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