/**
 * UI tests for the calculator, including the keyboard support the brief
 * explicitly requires ("a working calculator UI with keyboard support").
 *
 * These run against the real index.html markup loaded into jsdom, so they
 * exercise the same event wiring the browser uses.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/** Loads the real HTML and the real calculator.js into the jsdom document. */
async function mountCalculator() {
  const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
  document.documentElement.innerHTML = html
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?head[^>]*>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<title[^>]*>.*?<\/title>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Import fresh so module-level state resets between tests.
  vi.resetModules();
  await import('../calculator.js');
}

const result = () => document.getElementById('result').textContent;
const expression = () => document.getElementById('expression').textContent;
const error = () => document.getElementById('error').textContent;

const click = (key) => {
  document.querySelector(`button[data-key="${CSS.escape(key)}"]`).click();
};

const press = (key) => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
};

describe('calculator UI', () => {
  beforeEach(async () => {
    await mountCalculator();
  });

  it('starts showing zero', () => {
    expect(result()).toBe('0');
  });

  it('computes 2 + 3 * 4 = 14 via keypad clicks', () => {
    ['2', '+', '3', '*', '4', 'equals'].forEach(click);
    expect(result()).toBe('14');
  });

  it('computes (2 + 3) * 4 = 20 via keypad clicks', () => {
    ['(', '2', '+', '3', ')', '*', '4', 'equals'].forEach(click);
    expect(result()).toBe('20');
  });

  it('computes 10 / 2 = 5', () => {
    ['1', '0', '/', '2', 'equals'].forEach(click);
    expect(result()).toBe('5');
  });

  it('displays 0.3 for 0.1 + 0.2', () => {
    ['0', '.', '1', '+', '0', '.', '2', 'equals'].forEach(click);
    expect(result()).toBe('0.3');
  });

  it('shows an error for 5 / 0 rather than a bogus answer', () => {
    ['5', '/', '0', 'equals'].forEach(click);
    expect(result()).toBe('Error');
    expect(error()).toMatch(/divide by zero/i);
  });

  it('keeps the expression intact after an error so it can be corrected', () => {
    ['5', '/', '0', 'equals'].forEach(click);
    expect(expression()).toContain('5/0');
  });

  it('handles an incomplete expression without crashing', () => {
    ['2', '+'].forEach(click);
    expect(result()).toBe('0'); // no error yet, nothing committed
    click('equals');
    expect(result()).toBe('Error');
  });

  it('clears everything with AC', () => {
    ['9', '+', '9', 'equals'].forEach(click);
    expect(result()).toBe('18');
    click('clear');
    expect(result()).toBe('0');
    expect(expression().trim()).toBe('');
  });

  it('deletes the last character with backspace', () => {
    ['1', '2', '3'].forEach(click);
    click('backspace');
    ['equals'].forEach(click);
    expect(result()).toBe('12');
  });

  describe('keyboard support (required by the brief)', () => {
    it('types digits and operators from the keyboard', () => {
      ['2', '+', '3', '*', '4'].forEach(press);
      press('Enter');
      expect(result()).toBe('14');
    });

    it('evaluates with the "=" key', () => {
      ['6', '*', '7'].forEach(press);
      press('=');
      expect(result()).toBe('42');
    });

    it('clears with Escape', () => {
      ['8', '+', '8'].forEach(press);
      press('Escape');
      expect(result()).toBe('0');
    });

    it('deletes with Backspace', () => {
      ['1', '2', '3'].forEach(press);
      press('Backspace');
      press('Enter');
      expect(result()).toBe('12');
    });

    it('supports parentheses from the keyboard', () => {
      ['(', '2', '+', '3', ')', '*', '4'].forEach(press);
      press('Enter');
      expect(result()).toBe('20');
    });

    it('does not let "/" trigger browser behaviour', () => {
      const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
      document.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });

    it('ignores modified keystrokes so browser shortcuts still work', () => {
      const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
      document.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('input guards', () => {
    it('replaces rather than stacks consecutive operators', () => {
      ['2', '+', '*'].forEach(click);
      ['4', 'equals'].forEach(click);
      expect(result()).toBe('8');
    });

    it('allows a unary minus after multiplication', () => {
      ['2', '*', '-', '3', 'equals'].forEach(click);
      expect(result()).toBe('-6');
    });

    it('allows only one decimal point per number', () => {
      // The second "." is rejected because the current literal already has one,
      // but the following "2" is still appended — so 1.5 + 2 forms "1.52".
      ['1', '.', '5', '.', '2'].forEach(click);
      press('Enter');
      expect(result()).toBe('1.52');
    });

    it('inserts an implicit multiply before an opening parenthesis', () => {
      ['2', '(', '3', '+', '1', ')', 'equals'].forEach(click);
      expect(result()).toBe('8');
    });
  });
});