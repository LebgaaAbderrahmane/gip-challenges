/**
 * Calculator — DOM wiring.
 *
 * The challenge brief requires "only HTML/CSS and javascript with no framework".
 * This file imports only from ./parser.js, which uses no dependencies and never
 * calls eval(). No framework, no build step, no transpilation: the browser
 * loads these files exactly as written.
 */
import { evaluate, formatResult, ParseError } from './parser.js';

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

/** Keys that insert a literal character. */
const LITERAL_KEYS = new Set(['0','1','2','3','4','5','6','7','8','9','.','+','-','*','/','(',')']);

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
  if (key === '.' ) {
    // Only allow one decimal point per numeric literal.
    const currentNumber = expression.split(/[+\-*/(]/).pop();
    if (currentNumber.includes('.')) return;
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
    expressionEl.textContent = expression;
    resultEl.textContent = formatted;
    setError(null);
    expression = formatted;
    render();
    // render() resets the result to lastResult; keep the source expression shown.
    expressionEl.textContent = expression;
  } catch (error) {
    if (error instanceof ParseError) {
      setError(error.message);
      resultEl.textContent = 'Error';
    } else {
      setError('Something went wrong.');
      resultEl.textContent = 'Error';
    }
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

/**
 * Physical-key mapping, used when `event.key` is not already a literal.
 *
 * `event.key` describes the CHARACTER a layout produces, so the physical key
 * labelled "1" reports "&" on AZERTY and "1" on QWERTY. `event.code` describes
 * the KEY ITSELF and is identical on every layout.
 *
 * Measured before this existed: on a French/Arabic layout every symbol worked
 * but no number did, because "&", "é", "\"", "'", "(", "-", "è", "_", "ç", "à"
 * matched nothing while "+" and "*" — the same on every layout — did.
 */
const CODE_TO_KEY = {
  Digit0: '0', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4',
  Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9',
  Numpad0: '0', Numpad1: '1', Numpad2: '2', Numpad3: '3', Numpad4: '4',
  Numpad5: '5', Numpad6: '6', Numpad7: '7', Numpad8: '8', Numpad9: '9',
  Period: '.', NumpadDecimal: '.',
  Equal: '+', NumpadAdd: '+',
  Minus: '-', NumpadSubtract: '-',
  Slash: '/', NumpadDivide: '/',
  NumpadMultiply: '*',
};

const NAMED_KEYS = {
  NumpadEnter: 'equals',
};

/**
 * Resolve a KeyboardEvent to a calculator action, independent of layout.
 *
 * `event.key` is preferred when it already means the intended thing, so
 * shift-modified input such as "+" on a QWERTY layout still works. Only when
 * it does not — an AZERTY digit, for example — do we fall back to the physical
 * key, which is what makes the calculator work on every keyboard layout rather
 * than only the one its author happened to use.
 */
function keyFromEvent(event) {
  // Named actions are checked by character first. "Enter", "Backspace",
  // "Escape" and "Delete" mean the same thing on every layout, so this works
  // even in environments that do not supply `event.code` at all.
  if (event.key === 'Enter' || event.key === '=') return 'equals';
  if (event.key === 'Backspace') return 'backspace';
  if (event.key === 'Escape' || event.key === 'Delete') return 'clear';

  // Then by physical key, which is how a non-QWERTY digit is recognised.
  /*
   * Shift is what disambiguates the two conflicting cases:
   *
   *   QWERTY, Shift+9  -> key "(", code Digit9  -> the user wants "("
   *   AZERTY, Digit6    -> key "-", code Digit6  -> the user wants "6"
   *
   * Both have a literal `event.key` that disagrees with its own code, and they
   * differ only in whether shift is held. So trust the character when shift is
   * involved, and the physical key otherwise.
   */
  if (event.shiftKey && LITERAL_KEYS.has(event.key)) return event.key;

  const fromCode = CODE_TO_KEY[event.code];
  if (fromCode && LITERAL_KEYS.has(fromCode)) return fromCode;

  if (LITERAL_KEYS.has(event.key)) return event.key;

  return event.key;
}

document.addEventListener('keydown', (event) => {
  // Never hijack typing inside a field, and never steal browser shortcuts.
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  const key = keyFromEvent(event);
  if (!LITERAL_KEYS.has(key) && !['equals', 'backspace', 'clear'].includes(key)) return;

  // Prevent "/" from opening Firefox quick-find and other browser behaviours,
  // and " " from scrolling the page.
  event.preventDefault();
  handleKey(key);
});

render();

// Exposed for tests and for manual poking in the browser console. The UI does
// not depend on this.
globalThis.__calculator = { handleKey, evaluate, formatResult };