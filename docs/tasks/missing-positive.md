# gip-06 — Smallest Missing Positive Integer

> Source: [`apps/portfolio/src/features/algorithms/smallestMissingPositive.ts`](../../apps/portfolio/src/features/algorithms/smallestMissingPositive.ts)
> Demo: `/tasks/missing-positive`

## 1. Problem statement

> Given an unsorted integer array `nums`. Return the smallest positive integer (`n > 0`) that is
> not present in `nums`.
>
> Example: as an input we have `arr = [0, -2, 1, 2]`. The output here is going to be 3, since
> 1 & 2 are already available.
>
> — challenge brief, `docs/brief.md`

## 2. Constraints from the brief

The brief states no language or framework restriction for this task, and gives no constraint on
time or space complexity.

## 3. Implementation approach

In-place index placement. For an array of length `n`, every value `x` in `[1, n]` belongs at
index `x - 1`. Repeatedly swap each in-range value into its home index, then scan for the first
index whose value is not `i + 1`.

Values outside `[1, n]` are ignored — they can never be the answer, because with `n` slots the
answer always lies in `[1, n + 1]`.

## 4. Algorithm

```ts
for (let i = 0; i < n; i++) {
  while (nums[i] >= 1 && nums[i] <= n && nums[nums[i] - 1] !== nums[i]) {
    const target = nums[i] - 1;
    const tmp = nums[target];
    nums[target] = nums[i];
    nums[i] = tmp;
  }
}

for (let i = 0; i < n; i++) {
  if (nums[i] !== i + 1) return i + 1;
}

return n + 1;
```

### Why the loop terminates

Each swap places a value into its final, correct index, and no swap ever displaces a value that is
already correctly placed — the condition `nums[nums[i] - 1] !== nums[i]` stops the loop precisely
when the target already holds the value. That condition is also what prevents an infinite loop on
duplicates, which is the classic failure mode of this algorithm.

### Why this is correct

After the placement pass, every value `x` in `[1, n]` sits at index `x - 1`: each is either
already home, or was swapped there, and can never be displaced afterwards. Therefore index `i`
holds `i + 1` if and only if `i + 1` is present in the input. Scanning from index 0 upward, the
first index failing this check yields exactly the smallest absent positive integer. If every index
passes, all of `[1, n]` are present and the answer is `n + 1`.

## 5. Mutation, and why it is documented rather than hidden

This function **mutates its argument**. That is the trade that makes the algorithm O(1) in
auxiliary space.

The demo page passes a copy so the visitor's input stays readable, and displays both the before and
after arrays. A test asserts both that the input really is mutated and that it is a permutation of
the original — so the documented behaviour is verified rather than merely asserted in a comment.

Copying costs O(n), but that copy is a **UI-boundary concern**, not part of the algorithm. The
algorithm's own space complexity remains O(1).

## 6. Validation and edge cases

Non-integer input throws `TypeError`. Handled cases:

| Input | Result | Why |
|---|---|---|
| `[0, -2, 1, 2]` | `3` | The brief's worked example |
| `[1, 2, 3]` | `4` | Every value in `[1, n]` present |
| `[3, 4, -1, 1]` | `2` | 1 present, 2 absent |
| `[7, 8, 9, 11, 12]` | `1` | No positive in range |
| `[]` | `1` | Empty array |
| `[1, 1]` | `2` | Duplicates must not loop forever |
| `[-1, -2]` | `1` | Negatives are ignored |
| `[100, 200, 300]` | `1` | Values beyond `n` are ignored |
| `[2, 2, 2, 2]` | `1` | Duplicate swap-loop guard |

## 7. Complexity

| Measure | Value |
|---|---|
| Time | **O(n)** — O(n) outer passes, O(n) total swaps |
| Auxiliary space | **O(1)** — in place |

Measured: an array of 200,000 consecutive values completes in roughly 13 ms.

## 8. Test cases and actual results

**16 tests, all passing** (run via `pnpm --filter @gip/portfolio test`).

| Test | What it establishes |
|---|---|
| 7 table-driven cases | The brief's example plus every case from the task plan's test table |
| `1` when no positive present | Zeroes and negatives ignored |
| Fully consecutive array | Answers `n + 1` |
| Large gaps and out-of-range values | Values beyond `n` ignored |
| Three duplicate-heavy arrays | Swap-loop guard works |
| **Exhaustive permutation check** | For every permutation of `[-1,0,1,2,3]` (120 cases), the result matches a naive `Set`-based reference implementation |
| 200,000-element array | Runs in linear time, no stack or memory issues |
| Mutation behaviour | Input is reordered, and is a permutation of the original |
| Copy behaviour | Passing a copy leaves the caller's array untouched |
| Invalid input | Non-integers, `NaN` and non-arrays are rejected |

The exhaustive permutation test is the strongest of these: it compares against an independent
reference implementation rather than against hand-written expected values.

## 9. Links and limitations

- Source: [`smallestMissingPositive.ts`](../../apps/portfolio/src/features/algorithms/smallestMissingPositive.ts)
- Tests: [`smallestMissingPositive.test.ts`](../../apps/portfolio/src/features/algorithms/__tests__/smallestMissingPositive.test.ts)
- Demo: `/tasks/missing-positive`

**Limitations.** The function sorts the array as a side effect, which would be unacceptable if the
caller needed the original ordering preserved. That is why the demo copies. Non-integer input is
rejected rather than coerced, since the problem specifies integers. Very large arrays are handled
in linear time but mutate proportionally more memory in place; this is inherent to the approach.