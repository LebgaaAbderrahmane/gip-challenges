import { describe, it, expect } from 'vitest';

import {
  findDifferentBinaryString,
  validateBinaryInput,
  InvalidBinaryInputError,
} from '../binaryString';

/**
 * The brief says "If there are multiple answers, you may return any of them."
 * Tests therefore assert that the output is VALID, never that it equals one
 * particular string.
 */
const assertValidAnswer = (nums: string[], result: string) => {
  const n = nums.length;
  expect(result).toHaveLength(n);
  expect(result).toMatch(/^[01]+$/);
  expect(nums).not.toContain(result);
};

describe('findDifferentBinaryString', () => {
  it('handles the worked example from the task plan', () => {
    const nums = ['01', '10'];
    assertValidAnswer(nums, findDifferentBinaryString(nums));
  });

  it('works for n = 1', () => {
    const nums = ['0'];
    const result = findDifferentBinaryString(nums);
    expect(result).toBe('1');

    const other = ['1'];
    expect(findDifferentBinaryString(other)).toBe('0');
  });

  it('returns a string absent from the input for many random valid inputs', () => {
    // Property-style check: validity holds for every well-formed input,
    // including the ones the uniqueness precondition rules out.
    const buildRandomSquare = (n: number): string[] => {
      const rows: string[] = [];
      for (let i = 0; i < n; i++) {
        let row = '';
        for (let j = 0; j < n; j++) {
          row += Math.random() < 0.5 ? '0' : '1';
        }
        rows.push(row);
      }
      return rows;
    };

    for (let n = 1; n <= 12; n++) {
      for (let trial = 0; trial < 50; trial++) {
        const nums = buildRandomSquare(n);
        assertValidAnswer(nums, findDifferentBinaryString(nums));
      }
    }
  });

  it('works on the complete enumeration for n = 2 (all four possible strings)', () => {
    const all: string[][] = [
      ['00', '01'],
      ['00', '10'],
      ['01', '10'],
      ['00', '11'],
      ['11', '10'],
    ];
    for (const nums of all) {
      assertValidAnswer(nums, findDifferentBinaryString(nums));
    }
  });

  it('is correct even when the input contains duplicates', () => {
    // The proof never relies on uniqueness, so a non-unique square must still
    // produce an answer absent from the array.
    const nums = ['01', '01'];
    assertValidAnswer(nums, findDifferentBinaryString(nums));
  });

  it('differs from every row at that row\'s own index', () => {
    const nums = ['010', '101', '111'];
    const result = findDifferentBinaryString(nums);
    nums.forEach((row, i) => {
      expect(result[i]).not.toBe(row[i]);
    });
  });
});

describe('validateBinaryInput', () => {
  it('returns n for valid input', () => {
    expect(validateBinaryInput(['0'])).toBe(1);
    expect(validateBinaryInput(['01', '10'])).toBe(2);
    expect(validateBinaryInput(['000', '111', '010'])).toBe(3);
  });

  it('rejects a non-array', () => {
    expect(() => validateBinaryInput('01' as unknown as string[])).toThrow(InvalidBinaryInputError);
  });

  it('rejects an empty array', () => {
    expect(() => validateBinaryInput([])).toThrow(/at least one string/);
  });

  it('rejects the wrong number of strings', () => {
    expect(() => validateBinaryInput(['0', '1', '0'])).toThrow(/length 3/);
  });

  it('rejects a row of the wrong length', () => {
    // Row 0 is length-correct so the failure is attributed to row 1.
    expect(() => validateBinaryInput(['01', '1'])).toThrow(/nums\[1\] must have length 2/);
  });

  it('rejects non-binary characters', () => {
    // Rows are length-correct so the character check is what fails, not the
    // length check that would otherwise fire first.
    expect(() => validateBinaryInput(['12', '01'])).toThrow(/only "0" and "1"/);
    expect(() => validateBinaryInput(['aa', 'bb'])).toThrow(/only "0" and "1"/);
    expect(() => validateBinaryInput(['0x', '10'])).toThrow(/only "0" and "1"/);
  });

  it('rejects non-string entries', () => {
    expect(() => validateBinaryInput([1 as unknown as string])).toThrow(/must be a string/);
    expect(() => validateBinaryInput([null as unknown as string])).toThrow(/must be a string/);
  });
});