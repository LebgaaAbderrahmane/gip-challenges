/**
 * Keyboard inspector.
 *
 * Keyboard differences between browsers and layouts are invisible from the
 * source: a key that works in one browser reports nothing usable in another,
 * and the symptom is always the same — "the numbers don't work". Guessing at
 * the cause wasted more time than building the thing that shows it.
 *
 * This panel displays exactly what the browser delivered for each key, and
 * what the calculator made of it. Open it with the ⌨ button on the calculator
 * or with ?debug=1 in the URL.
 *
 * Plain DOM, no framework, no build step — the rest of the demo has the same
 * constraints.
 */

const MAX_ROWS = 12;

const state = {
  /** @type {Array<{key: string, code: string, keyCode: number, location: number, shift: boolean, action: string|null, accepted: boolean}>} */
  rows: [],
  panel: null,
  open: false,
};

const escapeCell = (value) =>
  String(value === '' ? '∅' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function buildPanel() {
  if (state.panel) return state.panel;

  const panel = document.createElement('div');
  panel.id = 'key-inspector';
  panel.hidden = true;

  const style = document.createElement('style');
  style.textContent = `
    #key-inspector {
      position: fixed; inset: auto 8px 8px auto; z-index: 2147483647;
      width: min(38rem, calc(100vw - 16px)); max-height: 70vh; overflow: auto;
      background: #0b0d12; border: 1px solid #3d4256; border-radius: 10px;
      padding: 8px 10px; box-shadow: 0 14px 44px -14px rgba(0,0,0,.95);
      font: 400 11px/1.45 ui-monospace, monospace; color: #e4e4e7;
    }
    #key-inspector table { width: 100%; border-collapse: collapse; }
    #key-inspector th {
      text-align: left; font-weight: 600; color: #71717a; padding: 1px 5px 3px 0;
      font-size: 9.5px; text-transform: uppercase; letter-spacing: .05em;
    }
    #key-inspector td {
      padding: 1px 5px 1px 0; vertical-align: top;
      border-top: 1px solid #1e2230; white-space: nowrap;
    }
    #key-inspector td.wrap { white-space: normal; word-break: break-all; }
    #key-inspector .ok { color: #34d399; }
    #key-inspector .no { color: #f87171; }
    #key-inspector .dim { color: #71717a; }
    #key-inspector .head {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 5px; gap: 8px;
    }
    #key-inspector .head b { color: #a78bfa; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
    #key-inspector .head button {
      background: #222633; color: #e4e4e7; border: 1px solid #3d4256;
      border-radius: 5px; padding: 2px 7px; font: inherit; cursor: pointer;
    }
  `;

  const head = document.createElement('div');
  head.className = 'head';
  const title = document.createElement('b');
  title.textContent = 'keyboard inspector';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'close';
  close.addEventListener('click', () => toggleInspector(false));
  head.append(title, close);

  const rows = document.createElement('div');
  rows.id = 'key-inspector-rows';

  const hint = document.createElement('p');
  hint.id = 'key-inspector-hint';
  hint.style.cssText = 'margin:6px 0 0;color:#71717a;font:400 10.5px/1.5 system-ui,sans-serif';

  document.head.appendChild(style);
  panel.append(head, rows, hint);
  document.body.appendChild(panel);

  state.panel = panel;
  return panel;
}

function render() {
  const rows = document.getElementById('key-inspector-rows');
  if (!rows) return;

  if (state.rows.length === 0) {
    rows.innerHTML = '<div class="dim">no keys seen yet — press some</div>';
    return;
  }

  const body = state.rows
    .slice(-MAX_ROWS)
    .reverse()
    .map(
      (e) => `<tr>
        <td>${escapeCell(e.key)}</td>
        <td class="dim">${escapeCell(e.code)}</td>
        <td class="dim">${e.keyCode}</td>
        <td class="dim">${e.location}</td>
        <td class="dim">${e.shift ? 'Y' : '·'}</td>
        <td class="${e.accepted ? 'ok' : 'no'}">${escapeCell(e.action ?? '(none)')}</td>
      </tr>`,
    )
    .join('');

  rows.innerHTML = `<table>
    <thead><tr><th>key</th><th>code</th><th>keyCode</th><th>loc</th><th>⇧</th><th>resolved</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

/** Opens or closes the panel. */
export function toggleInspector(force) {
  const panel = buildPanel();
  state.open = force === undefined ? !state.open : force;
  panel.hidden = !state.open;
  render();
  return state.open;
}

/** Records a key event and what the calculator made of it. */
export function recordKeyEvent(event, action, accepted) {
  state.rows.push({
    key: event.key,
    code: event.code,
    keyCode: event.keyCode ?? event.which ?? 0,
    location: event.location ?? 0,
    shift: Boolean(event.shiftKey),
    action,
    accepted,
  });
  if (state.rows.length > 80) state.rows.shift();
  if (state.open) render();
}

/** True when the inspector was requested by URL. */
export const debugEnabled = () =>
  new URLSearchParams(window.location.search).has('debug');

/** Shows the inspector at startup when ?debug=1 is present. */
export function startDebug() {
  toggleInspector(true);
  const hint = document.getElementById('key-inspector-hint');
  if (hint) {
    const ua = navigator.userAgent;
    const browser = /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'unknown';
    hint.textContent = `browser: ${browser} — press any key, including digits and keypad keys.`;
  }
  render();
}

/** Opens the inspector automatically when a key could not be resolved. */
export function openDebug(reason) {
  const wasOpen = state.open;
  toggleInspector(true);
  if (!wasOpen && reason) {
    const hint = document.getElementById('key-inspector-hint');
    if (hint) {
      hint.textContent = `Opened automatically: ${reason}`;
      hint.style.color = '#f87171';
    }
  }
  render();
}
