import { describe, it, expect } from 'vitest';

import { evaluate, formatResult, tokenize, ParseError } from '../parser';

describe('tokenize', () => {
  it('separates numbers, operators and parentheses', () => {
    expect(tokenize('2+3*4').map((t) => t.value)).toEqual(['2', '+', '3', '*', '4']);
    expect(tokenize('(1+2)').map((t) => t.type)).toEqual(['paren', 'number', 'operator', 'number', 'paren']);
  });

  it('handles decimals with or without a leading zero', () => {
    expect(tokenize('.5').map((t) => t.value)).toEqual(['.5']);
    expect(tokenize('0.25').map((t) => t.value)).toEqual(['0.25']);
  });

  it('ignores whitespace', () => {
    expect(tokenize('  2 +  3 ').map((t) => t.value)).toEqual(['2', '+', '3']);
  });

  it('rejects unknown characters', () => {
    expect(() => tokenize('2 $ 3')).toThrow(ParseError);
    expect(() => tokenize('2 & 3')).toThrow(/Unexpected character/);
  });
});

describe('evaluate — precedence', () => {
  // These are the cases from the challenge's test table.
  it('2 + 3 * 4 = 14', () => {
    expect(evaluate('2+3*4')).toBe(14);
  });

  it('(2 + 3) * 4 = 20', () => {
    expect(evaluate('(2+3)*4')).toBe(20);
  });

  it('10 / 2 = 5', () => {
    expect(evaluate('10/2')).toBe(5);
  });

  it('respects operator precedence for * and /', () => {
    expect(evaluate('2+3*4-6/2')).toBe(11); // 2 + 12 - 3
    expect(evaluate('100/5/2')).toBe(10); // left-associative
    expect(evaluate('2*3+4*5')).toBe(26);
  });

  it('groups mixed parentheses', () => {
    expect(evaluate('2*(3+4)')).toBe(14);
    expect(evaluate('((1+2)*(3+4))')).toBe(21);
    expect(evaluate('2*(3+(4-1))')).toBe(12);
  });

  it('handles unary signs', () => {
    expect(evaluate('-3')).toBe(-3);
    expect(evaluate('-3+5')).toBe(2);
    expect(evaluate('2*-3')).toBe(-6);
    expect(evaluate('--5')).toBe(5);
    expect(evaluate('-(2+3)')).toBe(-5);
  });
});

describe('evaluate — errors', () => {
  it('rejects division by zero rather than returning Infinity', () => {
    expect(() => evaluate('5/0')).toThrow(/divide by zero/i);
    expect(() => evaluate('5/(3-3)')).toThrow(/divide by zero/i);
  });

  it('rejects an incomplete expression without crashing', () => {
    expect(() => evaluate('2+')).toThrow(ParseError);
    expect(() => evaluate('2*')).toThrow(ParseError);
    expect(() => evaluate('(2+3')).toThrow(/closing parenthesis/i);
    expect(() => evaluate('')).toThrow(/enter an expression/i);
    expect(() => evaluate('   ')).toThrow(/enter an expression/i);
  });

  it('rejects an empty pair of parentheses', () => {
    expect(() => evaluate('()')).toThrow(ParseError);
  });

  it('rejects mismatched or stray parentheses', () => {
    expect(() => evaluate('2)')).toThrow(ParseError);
    expect(() => evaluate('(2)+)')).toThrow(ParseError);
  });

  it('rejects garbage input', () => {
    expect(() => evaluate('hello')).toThrow(ParseError);
    expect(() => evaluate('2++*3')).toThrow(ParseError);
  });
});

describe('formatResult', () => {
  it('displays integers without a decimal point', () => {
    expect(formatResult(14)).toBe('14');
    expect(formatResult(-7)).toBe('-7');
    expect(formatResult(0)).toBe('0');
  });

  it('displays 0.1 + 0.2 as 0.3', () => {
    expect(formatResult(evaluate('0.1+0.2'))).toBe('0.3');
  });

  it('keeps genuinely precise decimals', () => {
    expect(formatResult(evaluate('1/3'))).toBe('0.333333333333');
    expect(formatResult(evaluate('0.1+0.7'))).toBe('0.8');
  });

  it('handles negative and large results', () => {
    expect(formatResult(evaluate('2-5'))).toBe('-3');
    expect(formatResult(evaluate('999999*999999'))).toBe('999998000001');
  });

  it('returns an error string for non-finite input', () => {
    expect(formatResult(Infinity)).toBe('Error');
    expect(formatResult(NaN)).toBe('Error');
  });
});

describe('the parser never evaluates strings as code', () => {
  it('rejects input that would be dangerous if passed to eval', () => {
    // These would be code execution under eval(); here they must be plain
    // parse errors. This test exists to fail loudly if someone "simplifies"
    // the implementation by switching to eval().
    expect(() => evaluate('alert(1)')).toThrow(ParseError);
    expect(() => evaluate('globalThis.process')).toThrow(ParseError);
    expect(() => evaluate('1;2')).toThrow(ParseError);
    expect(() => evaluate('constructor')).toThrow(ParseError);
  });
});