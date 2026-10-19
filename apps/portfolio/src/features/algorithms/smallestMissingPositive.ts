/**
 * gip-06 — Smallest Missing Positive Integer
 *
 * Brief: "Given an unsorted integer array nums. Return the smallest positive
 * integer (n > 0) that is not present in nums."
 * Example: [0, -2, 1, 2] -> 3.
 *
 * ## Approach — in-place index placement
 *
 * For an array of length `n`, every value `x` in [1, n] belongs at index
 * `x - 1`. Repeatedly swap each in-range value into its home index, then scan
 * for the first index where the value is not `i + 1`.
 *
 * Values outside [1, n] are ignored — they can never be the answer, because
 * with n slots the answer is always in [1, n+1].
 *
 * ## Why it terminates
 *
 * Each swap places a value into its final, correct index, and no value is
 * displaced from a correct index (the loop condition stops when
 * `nums[target] === nums[i]`). So a correct placement can never be undone, and
 * the number of swaps is bounded by the number of positions: O(n).
 *
 * ## Complexity
 *
 * - Time: O(n) overall — O(n) passes with O(n) total swaps.
 * - Auxiliary space: O(1). The input array is reordered in place.
 *
 * ## Mutation
 *
 * This function MUTATES its argument. That is what makes it O(1) in space.
 * Callers that need the original preserved must pass a copy — which is O(n) —
 * and that copy is a UI-boundary concern, not part of the algorithm.
 */

/**
 * Returns the smallest positive integer not present in `nums`.
 *
 * @param nums unsorted array of integers (MUTATED)
 * @returns smallest positive integer absent from the input
 * @throws {TypeError} if the input is not an array of integers
 */
export function firstMissingPositive(nums: number[]): number {
  if (!Array.isArray(nums)) {
    throw new TypeError('Input must be an array of numbers.');
  }
  for (let i = 0; i < nums.length; i++) {
    if (!Number.isInteger(nums[i])) {
      throw new TypeError(`nums[${i}] must be an integer, received ${nums[i]}.`);
    }
  }

  const n = nums.length;

  for (let i = 0; i < n; i++) {
    // Place nums[i] at index nums[i]-1 while it is in range and not already home.
    // The second condition is what prevents an infinite swap loop on duplicates.
    while (nums[i] >= 1 && nums[i] <= n && nums[nums[i] - 1] !== nums[i]) {
      const target = nums[i] - 1;
      const tmp = nums[target];
      nums[target] = nums[i];
      nums[i] = tmp;
    }
  }

  for (let i = 0; i < n; i++) {
    if (nums[i] !== i + 1) {
      return i + 1;
    }
  }

  // Every value in [1, n] is present, so the answer is n + 1.
  return n + 1;
}