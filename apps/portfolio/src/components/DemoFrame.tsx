import { useCallback, useEffect, useRef, useState } from 'react';

const GITHUB_URL = 'https://github.com/LebgaaAbderrahmane/gip-challenges';

/** Keys forwarded from the parent page into the demo when the demo is not focused. */
const FORWARDED_KEYS = new Set([
  ...'0123456789.+-*/()'.split(''),
  'Enter',
  '=',
  'Backspace',
  'Escape',
  'Delete',
]);

const KEY_CODES: Record<string, { code: string }> = {
  Enter: { code: 'Enter' },
  '=': { code: 'Equal' },
  Backspace: { code: 'Backspace' },
  Escape: { code: 'Escape' },
  Delete: { code: 'Delete' },
};

/**
 * Embeds a vanilla demo in an <iframe>.
 *
 * The demo's source is copied verbatim into the portfolio's public/demos
 * directory at build time and is never bundled or imported by React. That is
 * what keeps the challenge constraint auditable: no build step, no transform,
 * no framework in the demo's own code path.
 *
 * KEYBOARD HANDLING
 * -----------------
 * An iframe only receives keyboard events once it has focus. A visitor who
 * scrolls to the demo and starts typing without clicking first gets nothing —
 * keys go to the parent page. Two things prevent that:
 *
 *   1. the frame is focused automatically once it loads, and
 *   2. while the frame does NOT hold focus, the parent forwards the keys it
 *      would have ignored anyway, so typing "works" from the moment the page
 *      appears.
 *
 * Forwarding stops as soon as the user clicks into the frame (the frame has
 * focus) or tabs away to something else (that element has focus). Modified
 * keystrokes are never forwarded, so browser shortcuts keep working.
 */
export default function DemoFrame({
  name,
  src,
  height = 560,
}: {
  name: string;
  src: string;
  height?: number;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  /** Grows/shrinks to the demo's content so the visitor never scrolls inside. */
  const [contentHeight, setContentHeight] = useState<number>(height);

  /** True when the iframe itself currently holds focus. */
  const frameHasFocus = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return false;
    const active = frame.contentDocument?.activeElement;
    // No focused element inside the frame means focus is elsewhere.
    return Boolean(active && active !== frame.contentDocument?.body);
  }, []);

  /**
   * Size the frame to its content.
   *
   * The demo is same-origin, so we can measure it. A fixed height would leave
   * the visitor scrolling inside a frame they did not ask to scroll, which is
   * especially annoying on mobile. The observer keeps the frame correct if the
   * demo's own layout changes — for example when an error message appears and
   * makes it taller.
   */
  const syncHeight = useCallback(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc?.body) return;

    // A few pixels of slack: scrollHeight and clientHeight disagree by a
    // pixel or two because of sub-pixel layout, and a rounded border can clip
    // the last row without it.
    const next = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight) + 4;

    setContentHeight((current) => (Math.abs(current - next) > 1 ? next : current));
  }, []);

  // Focus the frame as soon as it is ready, so the keyboard works immediately.
  const handleLoad = useCallback(() => {
    setLoaded(true);
    frameRef.current?.focus();
    syncHeight();

    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc?.body || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(syncHeight);
    observer.observe(doc.body);
    observer.observe(doc.documentElement);
    observerRef.current?.disconnect();
    observerRef.current = observer;
  }, [syncHeight]);

  // Tear the observer down when the frame is unmounted or reloaded.
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [reloadNonce]);

  // Forward keys into the demo while the demo does not have focus.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const active = document.activeElement;
      // Never steal keys from a real control on the parent page.
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      if (active instanceof HTMLSelectElement) return;

      const frame = frameRef.current;
      if (!frame || frameHasFocus()) return;
      if (!FORWARDED_KEYS.has(event.key)) return;

      event.preventDefault();
      const view = frame.contentWindow as (Window & typeof globalThis) | null;
      if (!view) return;

      const { code } = KEY_CODES[event.key] ?? { code: `Digit${event.key}` };

      // Re-dispatch inside the frame so the demo's own listener sees it. The
      // event is built with the FRAME's constructor, because an instance from
      // the parent realm would not be accepted by the frame's listener.
      view.document.dispatchEvent(
        new view.KeyboardEvent('keydown', {
          key: event.key,
          code,
          bubbles: true,
          cancelable: true,
        }),
      );
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [frameHasFocus]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <p className="text-xs text-text-subtle">
          {loaded ? 'Interactive demo — click it, or just start typing' : 'Loading demo…'}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="text-xs font-medium text-text-muted hover:text-text hover:underline"
          >
            Reload
          </button>
          <a
            href={src}
            target="_blank"
            rel="noreferrer noopener"
            className="text-xs font-medium text-accent hover:underline"
          >
            Open standalone ↗
          </a>
        </div>
      </div>

      {failed ? (
        <div className="rounded-xl border border-danger/40 bg-danger-muted p-6 text-sm text-danger">
          <p className="font-medium">The demo could not be loaded.</p>
          <p className="mt-2 text-danger-muted">
            Open it standalone instead — this usually means the demo files have not been
            copied into the build yet.
          </p>
        </div>
      ) : (
        <iframe
          key={reloadNonce}
          ref={frameRef}
          src={src}
          title={`${name} demo`}
          height={contentHeight}
          loading="lazy"
          onLoad={handleLoad}
          onError={() => setFailed(true)}
          className="w-full rounded-xl border border-border bg-surface focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        />
      )}

      <p className="mt-3 text-xs text-text-subtle">
        Source:{' '}
        <a
          href={`${GITHUB_URL}/tree/main/apps/${name}`}
          target="_blank"
          rel="noreferrer noopener"
          className="text-accent hover:underline"
        >
          apps/{name}
        </a>{' '}
        — plain HTML, CSS and JavaScript, served as-is with no build step.
      </p>
    </div>
  );
}