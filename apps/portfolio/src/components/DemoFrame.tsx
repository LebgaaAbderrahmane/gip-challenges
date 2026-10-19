import { useCallback, useEffect, useRef, useState } from 'react';

const GITHUB_URL = 'https://github.com/LebgaaAbderrahmane/gip-challenges';

/**
 * Physical-key codes we forward on keyboards where `event.key` is not the
 * character the key produces.
 *
 * `event.key` is layout-dependent: the key labelled "1" reports "&" on AZERTY
 * and "1" on QWERTY. Filtering only on `event.key` dropped every number on a
 * French/Arabic layout while symbols — identical across layouts — kept
 * working. `event.code` names the physical key and is stable everywhere.
 */
const FORWARDABLE_CODES = new Set([
  ...'0123456789'.split('').map((d) => `Digit${d}`),
  ...'0123456789'.split('').map((d) => `Numpad${d}`),
  'Period',
  'NumpadDecimal',
  'Equal',
  'NumpadAdd',
  'Minus',
  'NumpadSubtract',
  'Slash',
  'NumpadDivide',
  'NumpadMultiply',
  'Enter',
  'NumpadEnter',
  'Backspace',
  'Escape',
  'Delete',
]);

/** Keys forwarded when they already mean the right thing on any layout. */
const FORWARDED_KEYS = new Set([
  ...'0123456789.+-*/()'.split(''),
  'Enter',
  '=',
  'Backspace',
  'Escape',
  'Delete',
]);

/**
 * True when the event originated inside the demo frame rather than the parent.
 *
 * Keyboard events do NOT bubble across a frame boundary: when the demo has
 * focus its own listener handles the key, and this parent listener never sees
 * it. So the parent listener firing at all already implies the demo was not
 * focused, and forwarding unconditionally cannot double-fire.
 *
 * An earlier version checked the frame's activeElement and skipped forwarding
 * when it looked focused. That heuristic could disagree with the real focus
 * and swallow keys silently — a dead zone where nothing happened. Removing it
 * makes the failure mode impossible.
 */
const cameFromDemo = (event: KeyboardEvent, frame: HTMLIFrameElement): boolean =>
  event.target instanceof Node && (frame.contentDocument?.contains(event.target) ?? false);

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

  /**
   * Focus the frame once it is ready.
   *
   * Focus is a nicety, not a requirement: browsers may refuse a programmatic
   * focus that happens without user activation, and the forwarding below means
   * typing still reaches the demo even when this is refused. That is why the
   * demo is not *dependent* on being focused.
   */
  const handleLoad = useCallback(() => {
    setLoaded(true);
    try {
      frameRef.current?.focus();
    } catch {
      /* focus refused — forwarding still covers this */
    }
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

  // Forward keys into the demo whenever the demo did not receive them itself.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // Accept the key if EITHER the character or the physical key is one we
      // handle, so non-QWERTY layouts are not silently dropped.
      if (!FORWARDED_KEYS.has(event.key) && !FORWARDABLE_CODES.has(event.code)) return;

      const frame = frameRef.current;
      if (!frame || cameFromDemo(event, frame)) return;

      // Never steal keys from a real control on the parent page.
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      if (active instanceof HTMLSelectElement) return;
      // A link or button on the parent page should behave normally.
      if (active instanceof HTMLElement && active.dataset['demoFrameIgnore'] === 'true') return;

      event.preventDefault();
      const view = frame.contentWindow as (Window & typeof globalThis) | null;
      if (!view) return;

      // Both properties are passed through untouched. `code` is the physical
      // key and is what makes non-QWERTY layouts work; `key` preserves
      // shift-modified characters such as "+". The demo resolves the pair.
      // Deriving `code` from `key` here would reintroduce the exact bug this
      // fix exists to remove (an AZERTY "&" would become "Digit&").
      view.document.dispatchEvent(
        new view.KeyboardEvent('keydown', {
          key: event.key,
          code: event.code,
          bubbles: true,
          cancelable: true,
        }),
      );
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /**
   * Propagate `?debug` from the parent URL into the frame, so the demo's own
   * diagnostics can be switched on from the page that embeds it. Other query
   * parameters are deliberately dropped.
   */
  const frameSrc =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('debug')
      ? `${src}${src.includes('?') ? '&' : '?'}debug=1`
      : src;

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
          src={frameSrc}
          title={`${name} demo`}
          height={contentHeight}
          loading="eager"
          tabIndex={0}
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