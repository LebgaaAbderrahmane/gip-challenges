import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

async function mountCalculator({ embedded = false } = {}) {
  const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
  document.documentElement.innerHTML = html
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?head[^>]*>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<title[^>]*>.*?<\/title>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  document.documentElement.className = '';

  // The demo decides its own layout mode by checking whether it is framed.
  // jsdom always reports self === top, so fake a framed context when needed.
  if (embedded) {
    Object.defineProperty(window, 'top', { value: {}, configurable: true, writable: true });
  } else {
    Object.defineProperty(window, 'top', { value: window, configurable: true, writable: true });
  }

  vi.resetModules();
  await import('../calculator.js');
}

describe('layout mode detection', () => {
  beforeEach(() => {
    document.documentElement.className = '';
  });

  it('does NOT mark itself as embedded when opened directly', async () => {
    await mountCalculator({ embedded: false });
    expect(document.documentElement.classList.contains('is-embedded')).toBe(false);
  });

  it('marks itself as embedded when running inside a frame', async () => {
    await mountCalculator({ embedded: true });
    expect(document.documentElement.classList.contains('is-embedded')).toBe(true);
  });

  it('keeps the class across a reload of the module', async () => {
    await mountCalculator({ embedded: true });
    await import('../calculator.js');
    expect(document.documentElement.classList.contains('is-embedded')).toBe(true);
  });
});

describe('the stylesheet provides both layouts', () => {
  const css = readFileSync(join(here, '..', 'styles.css'), 'utf8');

  it('fills the viewport only when not embedded', () => {
    expect(css).toMatch(/html:not\(\.is-embedded\)\s+body\s*\{[^}]*min-height:\s*100dvh/);
  });

  it('drops the viewport height when embedded, so the frame cannot feed back', () => {
    // This is the rule that stops the growth loop: 100dvh inside an iframe is
    // the frame height, which the portfolio derives from the content height.
    expect(css).toMatch(/html\.is-embedded\s+body\s*\{[^}]*min-height:\s*0/);
  });

  it('centres the calculator in both modes', () => {
    expect(css).toMatch(/place-items:\s*center/);
  });
});