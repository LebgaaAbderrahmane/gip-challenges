/**
 * Calculator — DOM wiring.
 *
 * The challenge brief requires "only HTML/CSS and javascript with no framework".
 * This file imports only from ./parser.js and ./keymap.js, which use no
 * dependencies and never call eval(). No framework, no build step, no
 * transpilation: the browser loads these files exactly as written.
 */
import { evaluate, formatResult, ParseError } from './parser.js';
import {
  resolveKey,
  resolveCharacter,
  isCharacterInput,
  LITERAL_KEYS,
} from './keymap.js';
import {
  debugEnabled,
  openDebug,
  recordKeyEvent,
  startDebug,
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
const captureEl = document.getElementById('capture');

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
  // The click moved focus to the button; hand it back so typing continues.
  focusCapture();
});

/*
 * Keyboard capture
 * ----------------
 * Characters arrive as TEXT, not as reconstructed key events.
 *
 * The browser resolves the keyboard layout for us and reports the character
 * it actually inserted. That is the only signal that means the same thing in
 * every browser: Firefox on a non-US layout reports `event.code` as the US
 * position of the CHARACTER rather than the physical key, so "&" came back as
 * "Digit7" and the digit row typed the wrong numbers.
 *
 * Key events are still used for the keys that insert no text at all:
 * Enter, Backspace, Escape, and the numeric keypad when NumLock is
 * disengaged and the keypad performs navigation instead of typing.
 */
const focusCapture = () => {
  if (!captureEl) return;
  // A focus attempt can be refused, and that is not fatal.
  try {
    captureEl.focus({ preventScroll: true });
  } catch {
    /* focus refused — the keydown fallback still works */
  }
};

captureEl?.addEventListener('input', (event) => {
  // The field is only a capture buffer, so it is emptied as soon as it is
  // read. The expression is held in the calculator's own model.
  const text = event.data ?? captureEl.value ?? '';
  captureEl.value = '';

  if (event.inputType === 'deleteContentBackward') {
    handleKey('backspace');
    return;
  }

  // A paste arrives as one string; each character is applied in turn.
  for (const character of text) {
    const action = resolveCharacter(character);
    if (action) handleKey(action);
  }
});

captureEl?.addEventListener('keydown', (event) => {
  /*
   * Keys that insert no text still arrive here as key events.
   *
   * Enter, Backspace and Escape are named keys. The numeric keypad with
   * NumLock disengaged is the other case: it performs navigation, so nothing
   * is inserted, and the key event is the only signal that it came from the
   * keypad. `event.location` is 3 for the keypad, which is what tells it
   * apart from the arrow cluster.
   */
  const named = ['Enter', '=', 'Backspace', 'Escape', 'Delete'];
  const fromKeypad =
    event.location === 3 && /^Numpad/.test(event.code ?? '');

  if (!named.includes(event.key) && !fromKeypad) {
    // Printable characters are handled by the input event that follows.
    return;
  }

  if (!isCharacterInput(event)) return;

  event.preventDefault();
  const action = resolveKey(event);
  if (action) handleKey(action);
});

document.addEventListener('keydown', (event) => {
  // Never hijack typing inside a field.
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    // The capture field has its own handler above.
    if (target === captureEl) return;
    return;
  }

  /*
   * Shortcuts belong to the browser; typing belongs to the calculator.
   *
   * Ctrl+1 switches tabs and Cmd+S saves, so a plain modifier is ignored.
   * AltGr is the exception: several European layouts reach "*" and "/" with
   * it, and it is reported as ctrl and alt both being set. Treating it as a
   * shortcut blocked exactly those two operators.
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

  event.preventDefault();
  handleKey(key);
});

if (debugEnabled()) startDebug();

focusCapture();

/*
 * The keyboard inspector is no longer behind a button.
 *
 * It was a small keyboard glyph in the corner, and it was clutter on a
 * page whose whole point is that you just start typing. It is still here
 * for the people who need it, in the two ways that actually matter:
 *
 *   - append ?debug=1 to the URL, and it opens at startup
 *   - it opens by itself when a key cannot be resolved, because at that
 *     moment seeing what the browser reported is exactly what is wanted
 */

render();

// Exposed for tests and for manual poking in the browser console. The UI does
// not depend on this.
globalThis.__calculator = { handleKey, evaluate, formatResult, resolveKey };
