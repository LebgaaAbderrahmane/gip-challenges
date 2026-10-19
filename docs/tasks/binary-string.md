# gip-03 — Missing Binary String

> Source: [`apps/portfolio/src/features/algorithms/binaryString.ts`](../../apps/portfolio/src/features/algorithms/binaryString.ts)
> Demo: `/tasks/binary-string`

## 1. Problem statement

> Given an array of string `nums` containing `n` unique binary strings each of length `n`,
> return a binary string of length `n` that does not appear in `nums`. If there are multiple
> answers, you may return any of them.
>
> — challenge brief, `docs/brief.md`

## 2. Constraints from the brief

| Constraint | Status |
|---|---|
| "You can write your solution in any language you want." | TypeScript |

There is **no framework or language restriction** for this task.

## 3. Implementation approach

Diagonal construction. Build the answer one position at a time: at index `i`, take the bit at
`nums[i][i]` and flip it.

## 4. Algorithm

```ts
for (let i = 0; i < n; i++) {
  answer[i] = nums[i][i] === '0' ? '1' : '0';
}
```

### Proof of correctness

The returned string `answer` differs from `nums[i]` at position `i`, because `answer[i]` is
defined as the complement of `nums[i][i]`.

Suppose `answer` were equal to some `nums[j]`. Equal strings agree at every position, so they
would agree at position `j`. But `answer[j]` is the complement of `nums[j][j]` by construction,
so `answer[j] != nums[j][j]`. This is a contradiction.

Since the argument holds for every `j`, `answer` cannot equal any row of the input.

**Note on uniqueness.** The proof never uses the uniqueness precondition. The construction
differs from every row regardless of whether the rows are distinct. Uniqueness matters only for
the problem statement's counting argument (there are `2^n` binary strings and `n` inputs, so an
answer exists), not for correctness of this method. A test asserts this explicitly.

## 5. Interaction design

The page accepts either a JSON array or a plain comma-separated list, validates the preconditions,
and shows a table of the diagonal construction: for each `i`, the input row, the diagonal bit
`nums[i][i]`, and the resulting `answer[i]`. Errors are reported inline with `role="status"` and
an `aria-live` region so the result is announced to assistive technology.

## 6. Validation and edge cases

`validateBinaryInput` enforces the preconditions and throws `InvalidBinaryInputError`:

| Condition | Message |
|---|---|
| Not an array | `Input must be an array of strings.` |
| Empty array | `Input must contain at least one string.` |
| Non-string entry | `nums[i] must be a string, received …` |
| Wrong row length | `nums[i] must have length n, received …` |
| Non-binary characters | `nums[i] must contain only "0" and "1"…` |

Handled edge cases:

- **`n = 1`** — `["0"]` → `"1"`, `["1"]` → `"0"`.
- **Duplicate rows** — still returns a string absent from the input; see the proof.
- **Out-of-order input** — output order follows the array, not the strings.

## 7. Complexity

| Measure | Value |
|---|---|
| Time | **O(n)** — one pass over the diagonal |
| Auxiliary space | **O(n)** for the returned string |

The implementation writes into a preallocated array rather than using `map().join()`, which
avoids allocating the intermediate array that the naive one-liner creates. The O(n) result string
is unavoidable; it is the output.

## 8. Test cases and actual results

**13 tests, all passing** (run via `pnpm --filter @gip/portfolio test`).

| Test | What it establishes |
|---|---|
| Worked example `["01","10"]` | Returns a valid answer |
| `n = 1`, both inputs | Base case |
| 600 randomised valid inputs, `n` from 1–12 | Property check: output is length `n`, binary, and absent from the input |
| Complete enumeration of valid `n = 2` inputs | Exhaustive for the smallest non-trivial case |
| `["01","01"]` (duplicates) | Correctness does not depend on uniqueness |
| Diagonal differs at every index | The construction invariant holds directly |
| 7 validation cases | Each precondition produces its own message |

Because the brief permits any correct answer, **every test asserts validity rather than a fixed
output string**. Asserting one particular result would have tested the wrong thing.

## 9. Links and limitations

- Source: [`binaryString.ts`](../../apps/portfolio/src/features/algorithms/binaryString.ts)
- Tests: [`binaryString.test.ts`](../../apps/portfolio/src/features/algorithms/__tests__/binaryString.test.ts)
- Demo: `/tasks/binary-string`

**Limitations.** The empty array is rejected rather than answered. With zero inputs there is no
length `n` to satisfy, so the problem is undefined rather than merely hard; returning `"0"` would
be a guess. The UI accepts loose input formats as a convenience, but the algorithm itself only
accepts a well-formed array.