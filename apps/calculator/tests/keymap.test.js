/**
 * Tests for the shared key resolver.
 *
 * The resolver has to work on every keyboard, not just the one its author
 * uses. The cases below come from the research into how browsers actually
 * report keys:
 *
 *   - `event.key` is the CHARACTER a layout produces, so the key labelled "1"
 *     reports "&" on French AZERTY and "1" on QWERTY.
 *   - `event.code` is the PHYSICAL key and is layout-independent, but can be
 *     "" or "Unidentified" when the browser cannot map it (chromium issue
 *     41384052).
 *   - `event.keyCode` is deprecated and unreliable for printable characters:
 *     MDN's rules 3 to 5 have Firefox derive it from the ASCII character the
 *     key produces rather than from its position, so on AZERTY the digit row
 *     reports 38 for "&" rather than 49.
 *
 * Every source is therefore exercised, alone and in combination.
 */
import { describe, it, expect } from 'vitest';

import { resolveKey, isCalculatorKey, usableCode } from '../keymap.js';

const ev = (key, code, keyCode, shiftKey = false) => ({
  key,
  code,
  keyCode,
  which: keyCode,
  shiftKey,
});

/**
 * The French AZERTY unshifted digit row.
 *
 * The row is & é " ' ( - è _ ç à, and the shifted layer above it is
 * 1 2 3 4 5 6 7 8 9 0. So "&" is 1 and "à" is 0.
 */
const AZERTY_ROW = ['&', 'é', '"', "'", '(', '-', 'è', '_', 'ç', 'à'];
/** The digit each character of the AZERTY row produces. */
const AZERTY_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

describe('resolveKey', () => {
  describe('the physical key is the primary source', () => {
    it('reads a QWERTY digit row', () => {
      for (const [i, digit] of [...'0123456789'].entries()) {
        expect(resolveKey(ev(digit, `Digit${i}`, 0))).toBe(digit);
      }
    });

    it('reads an AZERTY digit row from the physical key, with no shift', () => {
      // The character is punctuation; the physical code still says Digit1.
      AZERTY_ROW.forEach((character, i) => {
        const code = `Digit${i + 1}`;
        expect(resolveKey(ev(character, code, 0))).toBe(AZERTY_DIGITS[i]);
      });
    });

    it('reads the keypad, whatever NumLock is doing', () => {
      // NumLock engaged: the character is the digit.
      for (let i = 0; i < 10; i++) {
        expect(resolveKey(ev(String(i), `Numpad${i}`, 96 + i))).toBe(String(i));
      }
      // NumLock disengaged: the character is a navigation function, but the
      // physical code is still NumpadN.
      const unlocked = ['Insert', 'End', 'ArrowDown', 'PageDown', 'ArrowLeft', 'Clear', 'ArrowRight', 'Home', 'ArrowUp', 'PageUp'];
      unlocked.forEach((character, i) => {
        expect(resolveKey(ev(character, `Numpad${i}`, 0))).toBe(String(i));
      });
    });

    it('reads keypad operators', () => {
      expect(resolveKey(ev('+', 'NumpadAdd', 107))).toBe('+');
      expect(resolveKey(ev('-', 'NumpadSubtract', 109))).toBe('-');
      expect(resolveKey(ev('*', 'NumpadMultiply', 106))).toBe('*');
      expect(resolveKey(ev('/', 'NumpadDivide', 111))).toBe('/');
      expect(resolveKey(ev('.', 'NumpadDecimal', 110))).toBe('.');
    });
  });

  describe('named actions', () => {
    it('reads Enter, Backspace, Escape and Delete from the character', () => {
      expect(resolveKey(ev('Enter', 'Enter', 13))).toBe('equals');
      expect(resolveKey(ev('=', 'Equal', 187))).toBe('equals');
      expect(resolveKey(ev('Backspace', 'Backspace', 8))).toBe('backspace');
      expect(resolveKey(ev('Escape', 'Escape', 27))).toBe('clear');
      expect(resolveKey(ev('Delete', 'Delete', 46))).toBe('clear');
    });

    it('reads the keypad Enter', () => {
      expect(resolveKey(ev('Enter', 'NumpadEnter', 13))).toBe('equals');
    });
  });

  describe('a deliberately shifted character', () => {
    it('gives Shift+9 the parenthesis on QWERTY', () => {
      expect(resolveKey(ev('(', 'Digit9', 57, true))).toBe('(');
    });

    it('gives Shift+8 the multiply sign on QWERTY', () => {
      expect(resolveKey(ev('*', 'Digit8', 56, true))).toBe('*');
    });

    it('gives Shift+= the plus sign', () => {
      expect(resolveKey(ev('+', 'Equal', 187, true))).toBe('+');
    });

    it('ignores a shifted character the calculator does not use', () => {
      // Shift+1 is "!" on QWERTY. The user meant the digit.
      expect(resolveKey(ev('!', 'Digit1', 49, true))).toBe('1');
    });
  });

  describe('when the browser reports no usable code', () => {
    it('recovers digits from the keycode table', () => {
      for (const [i, digit] of [...'0123456789'].entries()) {
        expect(resolveKey(ev(digit, '', 48 + i))).toBe(digit);
      }
    });

    it('recovers keypad digits with NumLock engaged', () => {
      for (let i = 0; i < 10; i++) {
        expect(resolveKey(ev(String(i), '', 96 + i))).toBe(String(i));
      }
    });

    it('does not mistake a navigation key for a keypad digit', () => {
      // 37 is both "the keypad's 4" and "ArrowLeft". Without a usable code
      // the two are indistinguishable, so the arrow key must stay an arrow
      // key rather than type a 4.
      expect(resolveKey(ev('ArrowLeft', '', 37))).toBeNull();
      expect(resolveKey(ev('ArrowUp', '', 38))).toBeNull();
      expect(resolveKey(ev('Home', '', 36))).toBeNull();
    });

    it('recovers an AZERTY digit row from the known layout', () => {
      // Neither code nor keyCode identify these: Firefox derives the keycode
      // from the character, so "&" gives 38, which is in no keycode table.
      // The parenthesis is the exception — it is a calculator key in its own
      // right, and the digit 5 stays reachable through shift and the keypad.
      AZERTY_ROW.forEach((character, i) => {
        const expected = character === '(' ? '(' : AZERTY_DIGITS[i];
        expect(resolveKey(ev(character, '', 38))).toBe(expected);
      });
    });

    it('still prefers the keycode over the layout table when both fit', () => {
      // A QWERTY digit has a keycode in the table and is not in any layout
      // row, so it resolves directly.
      expect(resolveKey(ev('7', '', 55))).toBe('7');
    });

    it('reads named actions from the keycode table', () => {
      expect(resolveKey(ev('Enter', '', 13))).toBe('equals');
      expect(resolveKey(ev('Backspace', '', 8))).toBe('backspace');
      expect(resolveKey(ev('Escape', '', 27))).toBe('clear');
    });
  });

  describe('when the browser reports Unidentified as the code', () => {
    it('behaves exactly like an empty code', () => {
      expect(resolveKey(ev('5', 'Unidentified', 0))).toBe('5');
      expect(resolveKey(ev('&', 'Unidentified', 38))).toBe('1');
    });  });

  describe('unrecognised input', () => {
    it('returns null for keys that are not calculator input', () => {
      expect(resolveKey(ev('a', 'KeyA', 65))).toBeNull();
      expect(resolveKey(ev('Tab', 'Tab', 9))).toBeNull();
      expect(resolveKey(ev('ArrowLeft', 'ArrowLeft', 37))).toBeNull();
    });

    it('returns null rather than guessing when nothing identifies the key', () => {
      // No code, no keycode, and the character is not part of any known
      // layout's digit row. Guessing would be worse than doing nothing.
      expect(resolveKey(ev('§', '', 0))).toBeNull();
    });
  });
});

describe('isCalculatorKey', () => {
  it('accepts everything the resolver accepts', () => {
    const samples = [
      ev('1', 'Digit1', 49),
      ev('&', 'Digit1', 0),
      ev('&', '', 38),
      ev('5', 'Numpad5', 101),
      ev('Clear', 'Numpad5', 12),
      ev('Enter', 'Enter', 13),
      ev('*', 'NumpadMultiply', 106),
      ev('(', 'Digit9', 57, true),
    ];
    for (const sample of samples) {
      expect(isCalculatorKey(sample)).toBe(true);
    }
  });

  it('rejects keys the calculator does not use', () => {
    const samples = [ev('a', 'KeyA', 65), ev('Tab', 'Tab', 9), ev('ArrowLeft', 'ArrowLeft', 37)];
    for (const sample of samples) {
      expect(isCalculatorKey(sample)).toBe(false);
    }
  });

  it('accepts a physical digit key whose character is unhelpful', () => {
    // This is the case that must never be dropped by the parent page: the
    // demo would accept it, so the parent must forward it.
    expect(isCalculatorKey(ev('&', 'Digit1', 0))).toBe(true);
  });
});

describe('usableCode', () => {
  it('accepts a real code', () => {
    expect(usableCode('Digit1')).toBe('Digit1');
  });

  it('rejects an empty or unidentified code', () => {
    expect(usableCode('')).toBeNull();
    expect(usableCode('Unidentified')).toBeNull();
    expect(usableCode(undefined)).toBeNull();
  });
});

describe('the numeric keypad, told apart by event.location', () => {
  it('reads a keypad digit with NumLock disengaged when location says numpad', () => {
    // 38 is ArrowUp on the arrow cluster and the keypad's 8 with NumLock off.
    // Only `location` separates them.
    expect(resolveKey({ ...ev('ArrowUp', '', 38), location: 3 })).toBe('8');
    expect(resolveKey({ ...ev('ArrowLeft', '', 37), location: 3 })).toBe('4');
    expect(resolveKey({ ...ev('Insert', '', 45), location: 3 })).toBe('0');
  });

  it('leaves the arrow cluster alone', () => {
    // Same keycodes, but location 0 means the arrow cluster, not the keypad.
    expect(resolveKey({ ...ev('ArrowUp', '', 38), location: 0 })).toBeNull();
    expect(resolveKey({ ...ev('ArrowLeft', '', 37), location: 0 })).toBeNull();
  });
});
