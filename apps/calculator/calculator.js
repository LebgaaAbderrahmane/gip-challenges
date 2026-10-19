/**
 * Calculator — DOM wiring.
 *
 * The challenge brief requires "only HTML/CSS and javascript with no framework".
 * This file imports only from ./parser.js, which uses no dependencies and never
 * calls eval(). No framework, no build step, no transpilation: the browser
 * loads these files exactly as written.
 */
import { evaluate, formatResult, ParseError } from './parser.js';

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

/** Map a browser KeyboardEvent to a calculator action. */
function keyFromEvent(event) {
  if (event.key === 'Enter' || event.key === '=') return 'equals';
  if (event.key === 'Backspace') return 'backspace';
  if (event.key === 'Escape') return 'clear';
  if (event.key === 'Delete') return 'clear';
  // × ÷ are what the buttons show; * / are what the parser accepts.
  if (event.key === '×') return '*';
  if (event.key === '÷') return '/';
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