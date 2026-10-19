import { useCallback, useEffect, useRef, useState } from 'react';

import { isCalculatorKey, isCharacterInput, resolveCharacter, LITERAL_KEYS } from '@gip/keymap';

const GITHUB_URL = 'https://github.com/LebgaaAbderrahmane/gip-challenges';

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
      // Shortcuts belong to the browser; typing belongs to the demo. AltGr
      // reaches characters such as "*" and "/" on many European layouts, so
      // the shared helper tells the two apart.
      if (!isCharacterInput(event)) return;

      const frame = frameRef.current;
      if (!frame || cameFromDemo(event, frame)) return;

      // Never steal keys from a real control on the parent page.
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      if (active instanceof HTMLSelectElement) return;
      if (active instanceof HTMLElement && active.dataset['demoFrameIgnore'] === 'true') return;

      /*
       * The SAME resolver the demo uses decides what a key means.
       *
       * The parent previously filtered on its own list of characters and
       * physical codes, which was a second, drifting copy of the demo's rules.
       * A key the demo would have accepted could be dropped here, before it
       * ever reached the demo — which is precisely how the embedded page
       * rejected numbers the standalone page accepted. One resolver, imported
       * from the demo's own file, removes that class of bug entirely.
       */
      if (!isCalculatorKey(event)) return;

      const view = frame.contentWindow as (Window & typeof globalThis) | null;
      if (!view) return;

      /*
       * Characters are forwarded as TEXT, not as synthetic key events.
       *
       * The demo captures keystrokes as ordinary text, because letting the
       * browser resolve the layout is the only thing that behaves identically
       * in every browser. A synthetic key event inserts no text, so
       * forwarding one would reach the demo without ever triggering its
       * input handler. The character is therefore inserted into the demo's
       * focused field, and an input event is dispatched in the frame's own
       * realm so the demo receives an event it recognises.
       */
      const literal = resolveCharacter(event.key);
      const frameDoc = frame.contentDocument;
      let target = frameDoc?.activeElement;

      // The demo focuses its capture field on load, but focus can land
      // elsewhere — the parent page itself, for instance. Handing focus to
      // the frame's text field keeps the character path deterministic
      // instead of depending on which path happened to catch the key.
      if (frameDoc && (!target || target === frameDoc.body)) {
        const field = frameDoc.querySelector<HTMLInputElement>('input[type="text"]');
        if (field) {
          field.focus();
          target = field;
        }
      }

      if (
        literal &&
        LITERAL_KEYS.has(literal) &&
        (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
      ) {
        target.value += literal;
        target.dispatchEvent(
          new view.InputEvent('input', {
            data: literal,
            inputType: 'insertText',
            bubbles: true,
            cancelable: false,
          }),
        );
        return;
      }

      // Keys that insert no text — Enter, Backspace, Escape, and the keypad
      // when NumLock is disengaged — are forwarded as key events, because
      // that is the only signal they produce.
      event.preventDefault();
      view.document.dispatchEvent(
        new view.KeyboardEvent('keydown', {
          key: event.key,
          code: event.code,
          keyCode: event.keyCode,
          which: event.which,
          shiftKey: event.shiftKey,
          // location distinguishes the numeric keypad (3) from the arrow
          // cluster (0), which share keycodes. It is needed to tell the
          // keypad's 4 from ArrowLeft when NumLock is disengaged.
          location: event.location,
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
          // Underlined, because a link inside a sentence has to be
          // distinguishable without relying on colour alone.
          className="text-accent underline underline-offset-2 hover:text-accent-strong"
        >
          apps/{name}
        </a>{' '}
        — plain HTML, CSS and JavaScript, served as-is with no build step.
      </p>
    </div>
  );
}