/**
 * Key event diagnostics (?debug=1)
 *
 * Keyboard problems are almost impossible to reason about from the source
 * alone: `event.key` and `event.code` differ between layouts, and the symptom
 * ("numbers don't work") looks identical whether the cause is a layout, a
 * stale bundle, a lost keydown, or focus sitting in another frame.
 *
 * This panel shows what the browser actually delivered and what the calculator
 * made of it, so the cause is visible rather than inferred. It is inert unless
 * the page is opened with ?debug=1, and it is plain DOM like the rest of the
 * demo — no framework, no build step.
 */

const MAX_ROWS = 10;

/**
 * Bumped whenever the key-handling logic changes, so a stale bundle is
 * obvious at a glance instead of being mistaken for a broken fix.
 */
const BUILD = 'kbd-2026-10-19-b';

/** @type {Array<{key: string, code: string, shift: boolean, action: string}>} */
const log = [];

let panel = null;

function ensurePanel() {
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'key-debug';
  panel.setAttribute('aria-live', 'polite');

  const title = document.createElement('strong');
  title.textContent = 'key diagnostics';
  title.style.cssText =
    'display:block;font:600 11px/1.4 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;color:#a78bfa';

  const rows = document.createElement('div');
  rows.id = 'key-debug-rows';

  const hint = document.createElement('p');
  hint.id = 'key-debug-reason';
  hint.textContent =
    'Press keys to see what this browser reports. "action" is what the calculator did with it.';
  hint.style.cssText =
    'margin:8px 0 0;font:400 11px/1.5 system-ui,sans-serif;color:#a1a1aa';

  const style = document.createElement('style');
  style.textContent = `
    #key-debug {
      position: fixed; inset: auto 12px 12px auto; z-index: 2147483647;
      width: min(30rem, calc(100vw - 24px)); max-height: 60vh; overflow: auto;
      background: #0d0f14; border: 1px solid #3d4256; border-radius: 10px;
      padding: 10px 12px; box-shadow: 0 12px 40px -12px rgba(0,0,0,.9);
      font: 400 11px/1.5 ui-monospace, monospace; color: #f4f4f5;
    }
    #key-debug table { width: 100%; border-collapse: collapse; }
    #key-debug th {
      text-align: left; font-weight: 600; color: #71717a; padding: 2px 6px 4px 0;
      font-size: 10px; text-transform: uppercase; letter-spacing: .06em;
    }
    #key-debug td {
      padding: 2px 6px 2px 0; vertical-align: top;
      border-top: 1px solid #222633; word-break: break-all;
    }
    #key-debug .ok { color: #34d399; }
    #key-debug .no { color: #f87171; }
    #key-debug .dim { color: #71717a; }
  `;

  document.head.appendChild(style);
  panel.append(title, rows, hint, buildTag());
  document.body.appendChild(panel);
  return panel;
}

function escapeCell(value) {
  return String(value === '' ? '∅' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Build marker, so a stale bundle is visible rather than guessed at. */
function buildTag() {
  const tag = document.createElement('p');
  tag.id = 'key-debug-build';
  tag.dataset['build'] = BUILD;
  tag.textContent = `build ${BUILD}`;
  tag.style.cssText = 'margin:8px 0 0;font:400 10px/1.4 ui-monospace,monospace;color:#71717a';
  return tag;
}

function render() {
  const rows = document.getElementById('key-debug-rows');
  if (!rows) return;

  if (log.length === 0) {
    rows.innerHTML = '<div class="dim">no keys seen yet — start typing</div>';
    return;
  }

  const body = log
    .slice(-MAX_ROWS)
    .reverse()
    .map(
      (e) => `<tr>
        <td>${escapeCell(e.key)}</td>
        <td class="dim">${escapeCell(e.code)}</td>
        <td class="dim">${e.shift ? 'yes' : 'no'}</td>
        <td class="${e.accepted ? 'ok' : 'no'}">${escapeCell(e.action)}</td>
      </tr>`,
    )
    .join('');

  rows.innerHTML = `<table>
    <thead><tr><th>key</th><th>code</th><th>shift</th><th>action</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

/** Records one keydown. Exported so the handler and the panel share it. */
export function recordKeyEvent(event, action, accepted) {
  if (!panel) return;
  log.push({
    key: event.key,
    code: event.code,
    shift: Boolean(event.shiftKey),
    action: accepted ? action : `(ignored: ${escapeCell(action)})`,
    accepted,
  });
  if (log.length > 60) log.shift();
  render();
}

/**
 * True when diagnostics are requested via the URL.
 */
export const debugEnabled = () =>
  new URLSearchParams(window.location.search).has('debug');

/**
 * Opens the panel on demand.
 *
 * Called automatically when a physical digit key arrives but cannot be
 * resolved, which is precisely the failure being chased. Without this, the
 * panel only appears on ?debug=1 and getting that information required
 * asking the person reporting the bug to go and fetch it.
 */
export function openDebug(reason) {
  ensurePanel();
  const note = document.getElementById('key-debug-reason');
  if (note && reason) {
    note.textContent = `Opened automatically: ${reason}`;
    note.style.color = '#f87171';
  }
  render();
}

/** Shown once diagnostics are enabled. */
export function startDebug() {
  ensurePanel();
  render();
}