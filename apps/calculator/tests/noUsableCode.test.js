/**
 * UI-level tests for environments where the browser reports no usable
 * `event.code`.
 *
 * Firefox reports `code: ''` or `code: 'Unidentified'` for keys it cannot map
 * to the standard layout, which happens on several non-Latin layouts. Every
 * lookup keyed on `code` then finds nothing, and the only surviving path is
 * the one reading `event.key` — reached solely by holding shift. The symptom
 * is Shift+number giving a digit while a bare number does nothing.
 *
 * The resolver's own rules are covered in keymap.test.js. These tests check
 * that the calculator behaves, not just that the function returns.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

async function mountCalculator() {
  const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
  document.documentElement.innerHTML = html
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?head[^>]*>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<title[^>]*>.*?<\/title>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  vi.resetModules();
  await import('../calculator.js');
}

const result = () => document.getElementById('result').textContent;
const expression = () => document.getElementById('expression').textContent;

/** A keydown exactly as a browser with no usable `code` reports it. */
const pressNoCode = (key, keyCode, shiftKey = false) =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      code: '',
      keyCode,
      which: keyCode,
      shiftKey,
      bubbles: true,
      cancelable: true,
    }),
  );

const pressUnidentified = (key, keyCode, shiftKey = false) =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      code: 'Unidentified',
      keyCode,
      which: keyCode,
      shiftKey,
      bubbles: true,
      cancelable: true,
    }),
  );

const enter = () => pressNoCode('Enter', 13);

/** The French AZERTY unshifted digit row, over 1 2 3 4 5 6 7 8 9 0. */
const AZERTY_ROW = ['&', 'é', '"', "'", '(', '-', 'è', '_', 'ç', 'à'];

describe('the calculator still works with no usable event.code', () => {
  beforeEach(async () => {
    await mountCalculator();
  });

  it('accepts the main digit row from the keycode table', () => {
    for (const [i, d] of [...'1234567890'].entries()) {
      pressNoCode(d, 49 + (i % 10));
    }
    enter();
    expect(result()).toBe('1234567890');
  });

  it('accepts an AZERTY digit row from the known layout', () => {
    // "&" is 1 on a French AZERTY, and the browser's keycode for it is the
    // ASCII code of "&", which appears in no keycode table at all.
    //
    // The parenthesis is the one character of the row that is a calculator key
    // in its own right, so it is taken as a parenthesis rather than as the
    // digit 5. The digit 5 remains reachable with shift, whose character is
    // the literal "5", and through the keypad.
    const row = AZERTY_ROW.filter((character) => character !== '(');
    row.forEach((character) => pressNoCode(character, 38));

    expect(expression()).toContain('1');
    expect(expression()).toContain('2');
    expect(expression()).toContain('3');
    expect(expression()).toContain('4');
    expect(expression()).toContain('6');
    expect(expression()).toContain('7');
    expect(expression()).toContain('8');
    expect(expression()).toContain('9');
    expect(expression()).toContain('0');
  });

  it('accepts keypad digits with NumLock engaged', () => {
    for (let i = 0; i < 10; i++) pressNoCode(String(i), 96 + i);
    enter();
    expect(result()).toBe('123456789');
  });

  it('treats code "Unidentified" the same as an empty code', () => {
    pressUnidentified('&', 38);
    pressUnidentified('+', 107);
    pressUnidentified('5', 53);
    enter();
    expect(result()).toBe('6'); // 1 + 5
  });

  it('resolves keypad operators from the keycode', () => {
    pressNoCode('8', 104);
    pressNoCode('*', 106);
    pressNoCode('2', 98);
    enter();
    expect(result()).toBe('16');
  });

  it('leaves a real arrow key alone rather than typing a digit', () => {
    // 37 is both "the keypad's 4" and "ArrowLeft". Typing a 4 here would be
    // worse than doing nothing.
    pressNoCode('ArrowLeft', 37);
    expect(expression().trim()).toBe('');
  });

  it('clears with Escape when code is unavailable', () => {
    pressNoCode('9', 57);
    pressNoCode('9', 57);
    pressNoCode('Escape', 27);
    expect(result()).toBe('0');
  });

  it('ignores genuine non-calculator keys', () => {
    pressNoCode('a', 65);
    expect(expression().trim()).toBe('');
  });

  it('exposes the diagnostic panel on demand', async () => {
    const { openDebug } = await import('../keydebug.js');
    openDebug('manual');
    expect(document.getElementById('key-debug')).not.toBeNull();
    expect(document.getElementById('key-debug-build')?.dataset.build).toMatch(/^kbd-/);
  });
});
