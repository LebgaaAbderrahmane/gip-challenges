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

describe('error state presentation', () => {
  beforeEach(async () => {
    await mountCalculator();
  });

  it('marks the screen as errored when the result is invalid', () => {
    ['5', '/', '0', 'equals'].forEach(click);
    expect(document.querySelector('.screen').classList.contains('screen--error')).toBe(true);
  });

  it('clears the error styling once the expression is corrected', () => {
    ['5', '/', '0', 'equals'].forEach(click);
    expect(document.querySelector('.screen').classList.contains('screen--error')).toBe(true);

    // Start over and enter something valid.
    click('clear');
    ['8', '/', '2', 'equals'].forEach(click);
    expect(result()).toBe('4');
    expect(document.querySelector('.screen').classList.contains('screen--error')).toBe(false);
  });

  it('never signals an error by colour alone', () => {
    ['5', '/', '0', 'equals'].forEach(click);
    // The word "Error" must be present, not just the red styling.
    expect(result()).toBe('Error');
  });
});