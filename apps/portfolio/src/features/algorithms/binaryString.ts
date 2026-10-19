/**
 * gip-03 — Missing Binary String
 *
 * Brief: "Given an array of string nums containing n unique binary strings each
 * of length n, return a binary string of length n that does not appear in nums.
 * If there are multiple answers, you may return any of them."
 *
 * ## Approach — diagonal construction
 *
 * Build the answer one position at a time. At index `i`, take the bit at
 * `nums[i][i]` — the diagonal — and flip it.
 *
 * ## Why it is correct
 *
 * The returned string `ans` differs from `nums[i]` at position `i`, because
 * `ans[i]` is defined as the complement of `nums[i][i]`.
 *
 * Suppose `ans` were equal to some `nums[j]`. Then at position `j` they would
 * agree, since equal strings agree everywhere. But `ans[j]` is the complement
 * of `nums[j][j]` by construction, so `ans[j] != nums[j][j]`, which means
 * `ans` cannot equal `nums[j]`. This holds for every `j`, so `ans` is absent
 * from the array.
 *
 * Note the proof never depends on uniqueness. The answer differs from every
 * row regardless, so uniqueness only matters for the problem statement's
 * counting argument, not for correctness of this construction.
 *
 * ## Complexity
 *
 * - Time: O(n)
 * - Extra space: O(n) for the returned string. The loop below writes into a
 *   preallocated array instead of `map().join()` to avoid the intermediate
 *   array that the naive version allocates.
 */

export class InvalidBinaryInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBinaryInputError';
  }
}

/**
 * Validates the input against the problem's preconditions and returns `n`.
 * @throws {InvalidBinaryInputError}
 */
export function validateBinaryInput(nums: readonly string[]): number {
  if (!Array.isArray(nums)) {
    throw new InvalidBinaryInputError('Input must be an array of strings.');
  }

  const n = nums.length;
  if (n === 0) {
    throw new InvalidBinaryInputError('Input must contain at least one string.');
  }

  for (let i = 0; i < n; i++) {
    const value = nums[i];
    if (typeof value !== 'string') {
      throw new InvalidBinaryInputError(`nums[${i}] must be a string, received ${typeof value}.`);
    }
    if (value.length !== n) {
      throw new InvalidBinaryInputError(`nums[${i}] must have length ${n}, received ${value.length}.`);
    }
    if (!/^[01]*$/.test(value)) {
      throw new InvalidBinaryInputError(`nums[${i}] must contain only "0" and "1", received "${value}".`);
    }
  }

  return n;
}

/**
 * Returns a binary string of length n that does not appear in `nums`.
 *
 * @param nums n unique binary strings, each of length n
 * @returns any valid binary string of length n absent from the input
 * @throws {InvalidBinaryInputError} if the input violates the preconditions
 */
export function findDifferentBinaryString(nums: readonly string[]): string {
  const n = validateBinaryInput(nums);

  const answer = new Array<string>(n);
  for (let i = 0; i < n; i++) {
    // Flip the bit on the diagonal.
    answer[i] = nums[i][i] === '0' ? '1' : '0';
  }

  return answer.join('');
}