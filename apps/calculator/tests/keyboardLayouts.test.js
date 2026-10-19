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
const click = (key) => document.querySelector(`button[data-key="${CSS.escape(key)}"]`).click();

/**
 * Press a key with BOTH properties, the way a browser supplies them.
 *
 * `code` names the physical key and is layout-independent; `key` is the
 * character the layout produces for it.
 */
const press = (key, code, shiftKey = false) =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key, code, shiftKey, bubbles: true, cancelable: true }),
  );

/**
 * The characters AZERTY produces for the physical digit row, in order from
 * Digit1 to Digit0. These are what `event.key` reports on a French keyboard.
 */
const AZERTY_DIGIT_KEYS = ['&', 'é', '"', "'", '(', '-', 'è', '_', 'ç', 'à'];

describe('keyboard layouts', () => {
  beforeEach(async () => {
    await mountCalculator();
  });

  it('accepts digits on a QWERTY layout', () => {
    for (const [i, d] of [...'1234567890'].entries()) press(d, `Digit${(i + 1) % 10}`);
    press('Enter', 'Enter');
    expect(result()).toBe('1234567890');
  });

  it('accepts digits on an AZERTY layout, where key is not a digit', () => {
    // Digit1 reports "&", Digit2 reports "é", and so on. Keying only off
    // event.key meant no number ever worked on such a keyboard.
    //
    // The characters "(" and "-" are also calculator keys, so they stay
    // themselves. Their digits are on the shifted layer, where they read as
    // literal digits.
    const row = AZERTY_DIGIT_KEYS.filter((c) => c !== '(' && c !== '-');
    row.forEach((character, i) => {
      const code = i === 9 ? 'Digit0' : `Digit${i + 1}`;
      press(character, code);
    });
    press('Enter', 'Enter');
    expect(result()).toBe('1234789' + '0');
  });

  it('computes correctly from AZERTY digits', () => {
    // 7 * 6, where 7 and 6 arrive as "è" and "-" on AZERTY. The 6 is typed
    // with shift, where the character is the literal digit.
    press('è', 'Digit7');
    press('*', 'NumpadMultiply');
    press('6', 'Digit6', true);
    press('Enter', 'Enter');
    expect(result()).toBe('42');
  });

  it('still honours a shift-modified "+" on a QWERTY layout', () => {
    press('9', 'Digit9');
    press('+', 'Equal');
    press('1', 'Digit1');
    press('Enter', 'Enter');
    expect(result()).toBe('10');
  });

  it('honours shift-modified parentheses on a QWERTY layout', () => {
    // Shift+9 is "(" on QWERTY. The character must win here even though the
    // code says Digit9 — this is the case shift disambiguates.
    press('8', 'Digit8');
    press('*', 'NumpadMultiply');
    press('(', 'Digit9', true);
    press('2', 'Digit2');
    press(')', 'Digit0', true);
    press('Enter', 'Enter');
    expect(result()).toBe('16'); // 8 * (2)
  });

  it('handles named keys when code is absent', () => {
    // Synthetic and older environments may not supply `code`.
    press('1', undefined);
    press('2', undefined);
    press('Backspace', undefined);
    press('Enter', undefined);
    expect(result()).toBe('1');
  });

  it('clears with Escape regardless of layout', () => {
    ['5', '5'].forEach(click);
    press('Escape', 'Escape');
    expect(result()).toBe('0');
  });

  it('ignores keys that are not calculator input', () => {
    press('q', 'KeyQ');
    press('Tab', 'Tab');
    expect(result()).toBe('0');
    expect(document.getElementById('expression').textContent.trim()).toBe('');
  });
});