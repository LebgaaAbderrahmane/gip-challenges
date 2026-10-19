import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'styles.css'), 'utf8');

/**
 * The embedded demo must hug its content.
 *
 * A viewport-height body inside an iframe is the FRAME's height, and the
 * portfolio derives the frame height from the content — so the two feed each
 * other and the frame grows without limit. The demo therefore marks itself as
 * embedded and the stylesheet drops the viewport height in that case.
 */
describe('embedded layout', () => {
  beforeEach(async () => {
    const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
    document.documentElement.innerHTML = html
      .replace(/<\/?html[^>]*>/gi, '')
      .replace(/<\/?head[^>]*>/gi, '')
      .replace(/<link[^>]*>/gi, '')
      .replace(/<title[^>]*>.*?<\/title>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    document.documentElement.className = '';
    vi.resetModules();
  });

  it('does not set the embedded class when opened directly', async () => {
    Object.defineProperty(window, 'top', { value: window, configurable: true, writable: true });
    await import('../autocomplete.js');
    expect(document.documentElement.classList.contains('is-embedded')).toBe(false);
  });

  it('sets the embedded class when running inside a frame', async () => {
    Object.defineProperty(window, 'top', { value: {}, configurable: true, writable: true });
    await import('../autocomplete.js');
    expect(document.documentElement.classList.contains('is-embedded')).toBe(true);
  });
});

describe('the stylesheet', () => {
  it('fills the viewport only when not embedded', () => {
    expect(css).toMatch(/html:not\(\.is-embedded\)\s+body\s*\{[^}]*min-height:\s*100dvh/);
  });

  it('drops the viewport height when embedded, so the frame cannot feed back', () => {
    expect(css).toMatch(/html\.is-embedded\s+body\s*\{[^}]*min-height:\s*0/);
  });

  it('keeps a vh fallback for browsers without dvh', () => {
    expect(css).toMatch(/min-height:\s*100vh;\s*min-height:\s*100dvh;/);
  });
});
