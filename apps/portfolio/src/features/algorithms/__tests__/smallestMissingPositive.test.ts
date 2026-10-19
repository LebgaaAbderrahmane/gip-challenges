import { describe, it, expect } from 'vitest';

import { firstMissingPositive } from '../smallestMissingPositive';

describe('firstMissingPositive', () => {
  // Cases taken directly from the brief and the task plan's test table.
  it.each([
    [[0, -2, 1, 2], 3], // the brief's worked example
    [[1, 2, 3], 4],
    [[3, 4, -1, 1], 2],
    [[7, 8, 9, 11, 12], 1],
    [[], 1],
    [[1, 1], 2],
    [[-1, -2], 1],
  ])('firstMissingPositive(%j) === %i', (input, expected) => {
    expect(firstMissingPositive([...input])).toBe(expected);
  });

  it('returns 1 when no positive integer is present', () => {
    expect(firstMissingPositive([0, 0, 0])).toBe(1);
    expect(firstMissingPositive([-5, -1])).toBe(1);
  });

  it('handles a fully consecutive array starting at 1', () => {
    expect(firstMissingPositive([1, 2, 3, 4, 5])).toBe(6);
  });

  it('handles large gaps and out-of-range values', () => {
    expect(firstMissingPositive([100, 200, 300])).toBe(1);
    expect(firstMissingPositive([1, 2, 1000])).toBe(3);
  });

  it('does not loop forever on duplicates', () => {
    expect(firstMissingPositive([2, 2, 2, 2])).toBe(1);
    expect(firstMissingPositive([1, 1, 1, 1, 1])).toBe(2);
    expect(firstMissingPositive([2, 2, 1, 1])).toBe(3);
  });

  it('is correct for every permutation of small arrays', () => {
    // Exhaustive check: for small n, enumerate arrays and compare against a
    // straightforward reference implementation.
    const reference = (nums: number[]): number => {
      const present = new Set(nums);
      let candidate = 1;
      while (present.has(candidate)) candidate += 1;
      return candidate;
    };

    const values = [-1, 0, 1, 2, 3];
    const buildPermutations = (arr: number[], k: number): number[][] => {
      if (k === arr.length) return [[]];
      const out: number[][] = [];
      for (let i = 0; i < arr.length; i++) {
        const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
        for (const tail of buildPermutations(rest, k + 1)) {
          out.push([arr[i], ...tail]);
        }
      }
      return out;
    };

    for (const perm of buildPermutations(values, 0)) {
      expect(firstMissingPositive([...perm])).toBe(reference(perm));
    }
  });

  it('scales linearly', () => {
    const n = 200_000;
    const big = Array.from({ length: n }, (_, i) => i + 1);
    // Every value 1..n present, so the answer is n + 1.
    expect(firstMissingPositive(big)).toBe(n + 1);
  });

  it('mutates its input, as documented', () => {
    const input = [3, 4, -1, 1];
    firstMissingPositive(input);
    // The array is reordered in place — this is the O(1)-space trade-off.
    expect(input).not.toEqual([3, 4, -1, 1]);
    // It is a permutation of the original values.
    expect([...input].sort()).toEqual([-1, 1, 3, 4]);
  });

  it('does not mutate the caller\'s array when given a copy', () => {
    const original = [3, 4, -1, 1];
    const copy = [...original];
    firstMissingPositive(copy);
    expect(original).toEqual([3, 4, -1, 1]);
  });

  it('rejects non-integer input', () => {
    expect(() => firstMissingPositive([1.5, 2] as number[])).toThrow(TypeError);
    expect(() => firstMissingPositive([1, NaN] as number[])).toThrow(/must be an integer/);
    expect(() => firstMissingPositive('abc' as unknown as number[])).toThrow(TypeError);
  });
});