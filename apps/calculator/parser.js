/**
 * Expression tokenizer, parser and evaluator for the calculator.
 *
 * The challenge brief requires "only HTML/CSS and javascript with no
 * framework", so this file uses no dependencies and no expression-evaluation
 * library. In particular it never calls eval() or new Function(): both are
 * equivalent to arbitrary code execution, and a calculator that evaluates
 * strings that a user typed is exactly the wrong place to allow that.
 *
 * Grammar (recursive descent, standard precedence):
 *
 *   expression := term (("+" | "-") term)*
 *   term       := factor (("*" | "/") factor)*
 *   factor     := unary | "(" expression ")" | number
 *   unary      := ("+" | "-")* primary
 *   primary    := NUMBER
 *
 * Precedence, loosest first:
 *   1. parentheses
 *   2. unary sign
 *   3. * and /
 *   4. + and -
 */

export class ParseError extends Error {
  constructor(message, position = -1) {
    super(message);
    this.name = 'ParseError';
    this.position = position;
  }
}

const NUMBER_PATTERN = /^(?:\d+\.?\d*|\.\d+)/;

/**
 * Split an expression string into tokens.
 * @param {string} input
 * @returns {Array<{type: 'number'|'operator'|'paren', value: string, position: number}>}
 */
export function tokenize(input) {
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === ' ' || ch === '\t') {
      i += 1;
      continue;
    }

    if ((ch >= '0' && ch <= '9') || ch === '.') {
      const rest = input.slice(i);
      const match = NUMBER_PATTERN.exec(rest);
      if (!match) {
        throw new ParseError(`Unexpected character "${ch}" at position ${i}.`, i);
      }
      tokens.push({ type: 'number', value: match[0], position: i });
      i += match[0].length;
      continue;
    }

    if ('+-*/'.includes(ch)) {
      tokens.push({ type: 'operator', value: ch, position: i });
      i += 1;
      continue;
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch, position: i });
      i += 1;
      continue;
    }

    throw new ParseError(`Unexpected character "${ch}" at position ${i}.`, i);
  }

  return tokens;
}

/**
 * Parse tokens and evaluate to a number.
 *
 * @param {string} input expression text
 * @returns {number}
 * @throws {ParseError} on malformed input, division by zero, or a non-finite result
 */
export function evaluate(input) {
  const tokens = tokenize(input);

  if (tokens.length === 0) {
    throw new ParseError('Enter an expression.');
  }

  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseExpression() {
    let left = parseTerm();
    while (peek() && peek().type === 'operator' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm() {
    let left = parseFactor();
    while (peek() && peek().type === 'operator' && (peek().value === '*' || peek().value === '/')) {
      const op = consume().value;
      const right = parseFactor();
      if (op === '*') {
        left = left * right;
      } else {
        if (right === 0) {
          throw new ParseError('Cannot divide by zero.');
        }
        left = left / right;
      }
    }
    return left;
  }

  function parseFactor() {
    const token = peek();

    if (!token) {
      throw new ParseError('Expression is incomplete.');
    }

    // Unary sign: one or more of + or - before a value.
    if (token.type === 'operator' && (token.value === '+' || token.value === '-')) {
      consume();
      const operand = parseFactor();
      return token.value === '-' ? -operand : operand;
    }

    if (token.type === 'paren' && token.value === '(') {
      consume();
      const inner = parseExpression();
      const closing = peek();
      if (!closing || closing.type !== 'paren' || closing.value !== ')') {
        throw new ParseError('Missing closing parenthesis.', closing?.position ?? -1);
      }
      consume();
      return inner;
    }

    if (token.type === 'number') {
      consume();
      return Number(token.value);
    }

    throw new ParseError(`Unexpected "${token.value}" at position ${token.position}.`, token.position);
  }

  const result = parseExpression();

  if (pos < tokens.length) {
    throw new ParseError(`Unexpected "${tokens[pos].value}" at position ${tokens[pos].position}.`, tokens[pos].position);
  }

  if (!Number.isFinite(result)) {
    throw new ParseError('Result is not a finite number.');
  }

  return result;
}

/**
 * Format a result for display.
 *
 * Floating point means 0.1 + 0.2 is 0.30000000000000004. The value is rounded
 * for DISPLAY only, to 12 significant digits, which is far beyond any precision
 * a person can meaningfully read on a calculator keypad. Callers must keep
 * using the unrounded value for any further arithmetic.
 *
 * @param {number} value
 * @returns {string}
 */
export function formatResult(value) {
  if (!Number.isFinite(value)) {
    return 'Error';
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  // toPrecision(12) then strip trailing zeros avoids 0.30000000000000004 while
  // keeping genuinely precise values intact.
  const rounded = Number(value.toPrecision(12));
  return String(rounded);
}