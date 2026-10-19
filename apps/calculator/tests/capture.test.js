/**
 * Tests for the text capture layer.
 *
 * Keystrokes reach the calculator as text, not as reconstructed key events.
 * The browser resolves the layout and reports the character it inserted, which
 * is the only signal that means the same thing in every browser: Firefox on a
 * non-US layout reports `event.code` as the US position of the CHARACTER
 * rather than the physical key.
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
const capture = () => document.getElementById('capture');

/** Simulates the browser inserting text, exactly as it would. */
const typeText = (text, inputType = 'insertText') => {
  const field = capture();
  field.value = text;
  field.dispatchEvent(
    new InputEvent('input', { data: text, inputType, bubbles: true, cancelable: false }),
  );
};

describe('text capture', () => {
  beforeEach(async () => {
    await mountCalculator();
  });

  it('takes focus on load, so typing works without clicking first', () => {
    expect(document.activeElement).toBe(capture());
  });

  it('types digits from inserted text', () => {
    typeText('1');
    typeText('2');
    typeText('3');
    expect(expression()).toContain('123');
  });

  it('resolves an AZERTY character to its digit', () => {
    // "&" is the unshifted character of the digit 1 on a French AZERTY.
    typeText('&');
    expect(expression()).toContain('1');
  });

  it('resolves the whole AZERTY row', () => {
    for (const character of ['&', 'é', '"', "'", 'è', '_', 'ç', 'à']) {
      typeText(character);
    }
    expect(expression()).toContain('1');
    expect(expression()).toContain('2');
    expect(expression()).toContain('3');
    expect(expression()).toContain('4');
    expect(expression()).toContain('7');
    expect(expression()).toContain('8');
    expect(expression()).toContain('9');
    expect(expression()).toContain('0');
  });

  it('evaluates a whole expression pasted at once', () => {
    typeText('2+3*4');
    // Enter inserts no text, so it arrives as a key event.
    capture().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }),
    );
    expect(result()).toBe('14');
  });

  it('empties the capture field as it reads it', () => {
    typeText('5');
    expect(capture().value).toBe('');
  });

  it('handles a backspace as a deletion', () => {
    typeText('1');
    typeText('2');
    typeText('', 'deleteContentBackward');
    expect(expression()).toContain('1');
    expect(expression()).not.toContain('2');
  });

  it('ignores text that is not calculator input', () => {
    typeText('abc');
    expect(expression().trim()).toBe('');
  });

  it('still handles Enter, Backspace and Escape as key events', () => {
    // These insert no text, so they never produce an input event.
    const field = capture();
    const press = (key, code) =>
      field.dispatchEvent(
        new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true }),
      );

    typeText('9');
    typeText('9');
    press('Backspace', 'Backspace');
    expect(expression()).toContain('9');
    expect(expression()).not.toContain('99');

    press('Escape', 'Escape');
    expect(expression().trim()).toBe('');
  });

  it('keeps working when the capture field is not focused', () => {
    // A visitor who tabs to a button must still be able to type.
    capture().blur();
    document.body.focus();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '7', code: 'Digit7', bubbles: true, cancelable: true }),
    );
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '*', code: 'NumpadMultiply', bubbles: true, cancelable: true }),
    );
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '6', code: 'Digit6', bubbles: true, cancelable: true }),
    );
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }),
    );

    expect(result()).toBe('42');
  });
});
