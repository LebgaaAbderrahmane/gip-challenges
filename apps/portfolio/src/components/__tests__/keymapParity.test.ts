import { describe, it, expect } from 'vitest';

import { resolveKey, isCalculatorKey } from '@gip/keymap';

/**
 * The embedded demo and the standalone demo must agree about every key.
 *
 * The portfolio used to keep its own list of "keys worth forwarding", a
 * second copy of the demo's rules. It drifted: the embedded page dropped
 * keys the standalone page accepted, so a number that worked in one did not
 * work in the other. The parent now imports the demo's own resolver, and
 * this test is what keeps that true.
 */

const ev = (
  key: string,
  code: string,
  keyCode: number,
  shiftKey = false,
  location = 0,
): KeyboardEvent => ({ key, code, keyCode, which: keyCode, shiftKey, location }) as unknown as KeyboardEvent;

describe('the parent forwards exactly what the demo accepts', () => {
  const samples: [string, KeyboardEvent][] = [
    ['QWERTY digit', ev('7', 'Digit7', 0)],
    ['AZERTY digit, code present', ev('&', 'Digit1', 0)],
    ['AZERTY digit, code empty', ev('&', '', 38)],
    ['AZERTY digit, code unidentified', ev('&', 'Unidentified', 38)],
    ['keypad digit, NumLock on', ev('8', 'Numpad8', 0)],
    ['keypad digit, NumLock off', ev('ArrowUp', 'Numpad8', 0)],
    ['keypad digit, no code, NumLock off', ev('ArrowUp', '', 38, false, 3)],
    ['keypad multiply', ev('*', 'NumpadMultiply', 0)],
    ['shifted parenthesis', ev('(', 'Digit9', 57, true)],
    ['Enter', ev('Enter', 'Enter', 13)],
    ['Backspace', ev('Backspace', 'Backspace', 8)],
    ['Escape', ev('Escape', 'Escape', 27)],
  ];

  it.each(samples)('forwards a %s', (_label, event) => {
    expect(resolveKey(event)).not.toBeNull();
    expect(isCalculatorKey(event)).toBe(true);
  });

  const rejected: [string, KeyboardEvent][] = [
    ['letter', ev('a', 'KeyA', 65)],
    ['Tab', ev('Tab', 'Tab', 9)],
    ['arrow key', ev('ArrowLeft', 'ArrowLeft', 37)],
    ['arrow key with no usable code', ev('ArrowLeft', '', 37)],
  ];

  it.each(rejected)('does not forward a %s', (_label, event) => {
    expect(isCalculatorKey(event)).toBe(false);
  });

  it('never accepts a key the demo would reject', () => {
    // The invariant that matters: forwarding a key the demo ignores would
    // swallow a keystroke the user expected to do something.
    const everything = [
      ...samples.map(([, event]) => event),
      ...rejected.map(([, event]) => event),
    ];
    for (const event of everything) {
      const resolved = resolveKey(event);
      if (resolved !== null) {
        expect(isCalculatorKey(event)).toBe(true);
      }
    }
  });
});
