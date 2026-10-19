/**
 * Calculator — DOM wiring.
 *
 * The challenge brief requires "only HTML/CSS and javascript with no framework".
 * This file imports only from ./parser.js and ./keymap.js, which use no
 * dependencies and never call eval(). No framework, no build step, no
 * transpilation: the browser loads these files exactly as written.
 */
import { evaluate, formatResult, ParseError } from './parser.js';
import { resolveKey, isCharacterInput, LITERAL_KEYS } from './keymap.js';
import {
  debugEnabled,
  openDebug,
  recordKeyEvent,
  startDebug,
  toggleInspector,
} from './keydebug.js';

/*
 * Detect whether this demo is running inside a frame.
 *
 * Standalone, it should fill the viewport and centre itself. Embedded in the
 * portfolio it must hug its content instead: inside an iframe, 100dvh means
 * the FRAME's height, and the portfolio sizes the frame to its content — so a
 * viewport-height body would grow with the frame and grow it again, forever.
 *
 * One line, no framework, and it lets a single stylesheet serve both contexts.
 */
if (window.self !== window.top) {
  document.documentElement.classList.add('is-embedded');
}

const expressionEl = document.getElementById('expression');
const resultEl = document.getElementById('result');
const errorEl = document.getElementById('error');
const keypadEl = document.getElementById('keypad');
const screenEl = document.querySelector('.screen');

/** The expression being typed. */
let expression = '';
/** The last successful result, used when starting a fresh expression. */
let lastResult = null;

function render() {
  expressionEl.textContent = expression || '\u00a0';
  // Mirror the raw value while typing; show the last result otherwise.
  resultEl.textContent = lastResult === null ? '0' : lastResult;
}

function setError(message) {
  errorEl.textContent = message ?? '';
  // Error styling is additive to the "Error" text, never a replacement for it.
  screenEl?.classList.toggle('screen--error', Boolean(message));
}

/** Append a literal token, avoiding two operators in a row. */
function appendLiteral(key) {
  setError(null);
  const last = expression.at(-1);

  const isOperator = (c) => c !== undefined && '+-*/'.includes(c);

  // Reject a second operator in a row — except when the second is '-', which
  // is a legitimate unary sign after * or / (e.g. "2*-3").
  if (isOperator(key) && isOperator(last)) {
    if (key === '-' && (last === '*' || last === '/')) {
      expression += key;
      render();
      return;
    }
    // Replace the trailing operator instead of stacking them.
    expression = expression.slice(0, -1);
  }

  // Prevent "5(3)" and "3.5.5".
  if (key === '(' && last !== undefined && !'+-*/('.includes(last)) {
    expression += '*(';
    render();
    return;
  }
  if (key === ')' && last !== undefined && '+-*/('.includes(last)) {
    return; // nothing to close
  }
  if (key === '.') {
    // Only allow one decimal point per numeric literal.
    const currentNumber = expression.split(/[+\-*/(]/).pop();
    if (currentNumber.includes('.')) return;
    // A bare "." becomes 0. rather than a leading "." the tokenizer rejects.
    expression += (currentNumber === '' ? '0' : '') + '.';
    render();
    return;
  }

  expression += key;
  render();
}

function backspace() {
  setError(null);
  if (expression.length === 0) return;
  expression = expression.slice(0, -1);
  render();
}

function clearAll() {
  expression = '';
  lastResult = null;
  setError(null);
  render();
}

/**
 * Evaluate the current expression.
 *
 * On success the result is displayed and the expression is committed, so
 * pressing an operator afterwards continues from that value (standard
 * calculator chaining). On failure the expression is left intact so the user
 * can correct it rather than losing their work.
 */
function equals() {
  if (expression.trim() === '') return;

  try {
    const value = evaluate(expression);
    const formatted = formatResult(value);
    lastResult = formatted;
    expression = formatted;
    render();
    // Keep the source expression visible above the result.
    expressionEl.textContent = formatted;
  } catch (error) {
    if (error instanceof ParseError) {
      setError(error.message);
    } else {
      setError('Something went wrong.');
    }
    resultEl.textContent = 'Error';
  }
}

function handleKey(key) {
  if (key === 'clear') return clearAll();
  if (key === 'backspace') return backspace();
  if (key === 'equals') return equals();
  if (LITERAL_KEYS.has(key)) return appendLiteral(key);
}

keypadEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-key]');
  if (!button) return;
  handleKey(button.dataset.key);
});

document.addEventListener('keydown', (event) => {
  // Never hijack typing inside a field.
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

  /*
   * Shortcuts belong to the browser; typing belongs to the calculator.
   *
   * Ctrl+1 switches tabs and Cmd+S saves, so a plain modifier is ignored.
   * AltGr is the exception: several European layouts reach "*" and "/" with
   * it, and it is reported as ctrl and alt both being set. Treating it as a
   * shortcut blocked exactly those two operators, which is why they could not
   * be typed. `isCharacterInput` knows the difference.
   */
  if (!isCharacterInput(event)) return;

  const key = resolveKey(event);
  const recognised = key !== null;

  // Diagnostics (?debug=1) record every key, including rejected ones, so an
  // ignored keystroke is visible instead of silently doing nothing.
  recordKeyEvent(event, key, recognised);

  // If a physical digit key arrived and still could not be resolved, open the
  // panel immediately. That is the exact failure being chased, and it means the
  // person reporting it does not have to go looking for ?debug=1 to tell us
  // what their browser actually sent.
  if (!recognised && /^(Digit|Numpad)[0-9]$/.test(event.code)) {
    openDebug(
      `a physical "${event.code}" key could not be resolved (key="${event.key}", keyCode=${event.keyCode})`,
    );
    return;
  }

  if (!recognised) return;

  // Prevent "/" from opening Firefox quick-find and other browser behaviours.
  event.preventDefault();
  handleKey(key);
});

if (debugEnabled()) startDebug();

// The inspector toggle, for anyone whose keyboard behaves unexpectedly.
document.getElementById('toggle-inspector')?.addEventListener('click', () => {
  toggleInspector();
});

render();

// Exposed for tests and for manual poking in the browser console. The UI does
// not depend on this.
globalThis.__calculator = { handleKey, evaluate, formatResult, resolveKey };
