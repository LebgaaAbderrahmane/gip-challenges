/**
 * Key resolution for the calculator.
 *
 * One source of truth, plain ES module, no dependencies — the demo has no
 * build step, so this must run in the browser exactly as written.
 *
 * WHY THIS IS NOT JUST `event.key`
 * -------------------------------
 * `event.key` is the CHARACTER a layout produces, so the physical key labelled
 * "1" reports "&" on a French AZERTY layout and "1" on QWERTY. `event.code` is
 * the physical KEY and is identical on every layout.
 *
 * WHY THIS IS NOT JUST `event.code`
 * --------------------------------
 * `event.code` is normally perfect, but it can be an empty string or
 * "Unidentified" when the browser cannot map the key (chromium issue 41384052
 * records this happening). So `event.code` is the primary source, with
 * `event.keyCode` as a documented fallback and `event.key` as the last resort.
 *
 * WHY `keyCode` IS ONLY A FALLBACK
 * --------------------------------
 * MDN is explicit: "Web developers shouldn't use the `keyCode` attribute for
 * printable characters when handling keydown and keyup events … the keyCode
 * attribute is not useful for printable characters." Firefox derives it from
 * the ASCII character the key can input, not from its position, so on AZERTY
 * the key that types "1" reports keyCode 38 ('&') rather than 49. Chrome
 * differs again. The values below are therefore used only when `code` is
 * unavailable, and the main digit row additionally accepts a literal digit
 * from `event.key`.
 *
 * WHY SHIFT IS NOT USED TO DISAMBIGUATE
 * -------------------------------------
 * Two cases conflict, and shift is not the way out:
 *
 *   QWERTY  Shift+9  ->  key "("   code Digit9  ->  the user wants "("
 *   AZERTY  Digit5    ->  key "'"   code Digit5  ->  the user wants "5"
 *
 * On a French AZERTY the digits live on the SHIFTED layer, so "5" is Shift+Digit5
 * and the unshifted character is "'". Reading the physical code gives the right
 * digit for both layouts, and reading `event.key` gives the right parenthesis
 * for both layouts — because "(" is Shift+9 on QWERTY and unshifted-Digit6 on
 * AZERTY, and in both cases `event.key` is the only place that information
 * exists. So: parentheses come from `event.key`, digits from `event.code`, and
 * shift is never consulted.
 */

/** The calculator's literal keys, as opposed to named actions. */
export const LITERAL_KEYS = new Set([
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '.', '+', '-', '*', '/', '(', ')',
]);

/** Named actions, distinct from literal keys. */
export const NAMED_ACTIONS = new Set(['equals', 'backspace', 'clear']);

/** Physical codes for the digit row, in both the main block and the keypad. */
const CODE_TO_KEY = {
  Digit0: '0', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4',
  Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9',
  Numpad0: '0', Numpad1: '1', Numpad2: '2', Numpad3: '3', Numpad4: '4',
  Numpad5: '5', Numpad6: '6', Numpad7: '7', Numpad8: '8', Numpad9: '9',

  NumpadAdd: '+', NumpadSubtract: '-', NumpadMultiply: '*', NumpadDivide: '/',
  NumpadDecimal: '.',

  // Main block operators. "Equal" is ambiguous: unshifted it is "=", which
  // evaluates, and shifted it is "+" on most layouts.
  Equal: '+', Minus: '-', Slash: '/', Period: '.', Comma: ',',
  NumpadComma: '.',
};

const CODE_TO_ACTION = {
  Enter: 'equals',
  NumpadEnter: 'equals',
  Backspace: 'backspace',
  Escape: 'clear',
  Delete: 'clear',
};

/**
 * Legacy keycodes, from the tables in MDN's KeyboardEvent.keyCode reference.
 *
 * The numpad entries appear twice: once with NumLock engaged (96-105) and once
 * with it disengaged, where the same physical keys report the keycodes of the
 * navigation functions they perform instead (45, 35, 40, 34, 37, 12, 39, 36,
 * 38, 33). Supporting both means the keypad works however NumLock is set.
 */
const KEYCODE_TO_KEY = {
  // Main digit row, US positions.
  48: '0', 49: '1', 50: '2', 51: '3', 52: '4',
  53: '5', 54: '6', 55: '7', 56: '8', 57: '9',

  // Keypad, NumLock engaged.
  96: '0', 97: '1', 98: '2', 99: '3', 100: '4',
  101: '5', 102: '6', 103: '7', 104: '8', 105: '9',

  // Operators.
  106: '*', 107: '+', 109: '-', 110: '.', 111: '/',
  190: '.', 191: '/', 189: '-', 187: '+',
  170: '*', 171: '+', 173: '-',
};

/**
 * Keypad digits when NumLock is disengaged.
 *
 * With NumLock off the keypad performs navigation instead of typing digits,
 * and reports the navigation keycodes: 45, 35, 40, 34, 37, 12, 39, 36, 38, 33.
 *
 * Those values are exactly the keycodes of the navigation keys themselves —
 * 37 is ArrowLeft, 38 is ArrowUp, 39 is ArrowRight, and so on — so a keycode
 * alone cannot tell "the keypad's 4" from "the left arrow". `event.location`
 * can: it is 3 for the numeric keypad and 0 for the arrow cluster, which
 * separates the two without guessing.
 */
const UNLOCKED_NUMPAD = {
  45: '0', 35: '1', 40: '2', 34: '3', 37: '4',
  12: '5', 39: '6', 36: '7', 38: '8', 33: '9',
};

/** KeyboardEvent.location: 3 means the numeric keypad. */
const LOCATION_NUMPAD = 3;

const KEYCODE_TO_ACTION = {
  8: 'backspace',
  13: 'equals',
  27: 'clear',
  46: 'clear',
};

/** `event.code` is unusable when the browser could not map the key. */
export const usableCode = (code) =>
  typeof code === 'string' && code !== '' && code !== 'Unidentified' ? code : null;

/**
 * Resolve a KeyboardEvent to a calculator action.
 *
 * @param {KeyboardEvent} event
 * @returns {string|null} a literal key, a named action, or null if unrecognised
 */
/**
 * Digit rows of layouts where the unshifted characters are not digits.
 *
 * The physical key (`event.code`) is the general answer and it works on every
 * layout. But `event.code` can be missing — it is documented to be empty or
 * "Unidentified" when the browser cannot map the key — and then `event.keyCode`
 * cannot help either, because Firefox derives it from the ASCII character the
 * key produces rather than from its position (MDN's rules 3 to 5). On French
 * AZERTY the unshifted digit row therefore reports keyCode 38 for "&", and
 * 38 appears nowhere in any keycode table.
 *
 * What survives is the character itself, and the character identifies the
 * digit only if the layout's row is known. That is what these tables are.
 *
 * The rows are data, not code, so another layout is one object away. Each
 * maps the unshifted character of a digit-row key to the digit it produces.
 *
 * Note the French row: "&" is 1, not 0. The row is & é " ' ( - è _ ç à over
 * 1 2 3 4 5 6 7 8 9 0, because the digits sit on the shifted layer.
 */
const LAYOUT_DIGIT_ROWS = [
  {
    name: 'French AZERTY',
    row: {
      '&': '1', 'é': '2', '"': '3', "'": '4', '(': '5',
      '-': '6', 'è': '7', '_': '8', 'ç': '9', 'à': '0',
    },
  },
];

/**
 * Finds the digit a character represents on a known layout.
 *
 * @param {string} character
 * @returns {string|null} the digit, or null when the character is not a
 *   digit-row character of any known layout
 */
function digitFromLayoutCharacter(character) {
  if (typeof character !== 'string' || character.length === 0) return null;

  for (const layout of LAYOUT_DIGIT_ROWS) {
    const digit = layout.row[character];
    if (digit) return digit;
  }

  return null;
}

/**
 * Resolve a KeyboardEvent to a calculator action.
 *
 * @param {KeyboardEvent} event
 * @returns {string|null} a literal key, a named action, or null if unrecognised
 */
export function resolveKey(event) {
  if (!event) return null;

  // 1. Named actions that mean the same thing on every layout.
  if (event.key === 'Enter' || event.key === '=') return 'equals';
  if (event.key === 'Backspace') return 'backspace';
  if (event.key === 'Escape' || event.key === 'Delete') return 'clear';

  const shifted = Boolean(event.shiftKey);

  // 2. A deliberately shifted character. On QWERTY, Shift+9 is "(" and
  //    Shift+8 is "*"; the user held shift on purpose, so the character is
  //    what they meant. Only applied to characters the calculator understands,
  //    so Shift+1 ("!") still falls through to the physical key and types 1.
  if (shifted && typeof event.key === 'string' && LITERAL_KEYS.has(event.key)) {
    return event.key;
  }

  // 3. The physical key. This is the primary source for digits, and it is why
  //    they work on every layout without needing shift: on French AZERTY the
  //    key labelled "1" reports "&", but its physical code still says Digit1.
  const code = usableCode(event.code);
  if (code) {
    const fromCode = CODE_TO_KEY[code];
    if (fromCode && LITERAL_KEYS.has(fromCode)) return fromCode;

    const action = CODE_TO_ACTION[code];
    if (action) return action;
  }

  // 4. Parentheses. These are calculator keys in their own right, so they are
  //    taken at face value.
  //
  //    On a French AZERTY the unshifted character of the digit 5 is "(",
  //    so this step and step 5 disagree about that one key. The parenthesis
  //    wins here, and the digit 5 remains reachable through shift (whose
  //    character is the literal "5") and through the keypad. Above, step 3
  //    has already given the physical code the chance to say "Digit5", so
  //    whenever the browser supplies a code the digit wins instead.
  if (event.key === '(' || event.key === ')') return event.key;

  // 5. A digit recovered from a known layout's digit row. This is the path
  //    that makes an AZERTY digit row work when the browser reports neither a
  //    usable `code` nor a usable `keyCode`.
  const fromLayout = digitFromLayoutCharacter(event.key);
  if (fromLayout) return fromLayout;

  // 6. The legacy keycode, for browsers reporting no usable `code`.
  const keyCode = event.keyCode ?? event.which;
  if (typeof keyCode === 'number' && keyCode !== 0) {
    const fromKeyCode = KEYCODE_TO_KEY[keyCode];
    if (fromKeyCode && LITERAL_KEYS.has(fromKeyCode)) return fromKeyCode;

    // A keypad digit with NumLock disengaged. The keycode is ambiguous with
    // the navigation key of the same number, so `event.location` has to
    // confirm the key really is on the keypad.
    if (event.location === LOCATION_NUMPAD) {
      const unlocked = UNLOCKED_NUMPAD[keyCode];
      if (unlocked) return unlocked;
    }

    const action = KEYCODE_TO_ACTION[keyCode];
    if (action) return action;
  }

  // 7. A literal digit straight from the character. Reliable, because a
  //    literal digit is a literal digit on every layout.
  if (typeof event.key === 'string' && /^[0-9]$/.test(event.key)) return event.key;

  // 8. A literal operator.
  if (typeof event.key === 'string' && LITERAL_KEYS.has(event.key)) return event.key;

  return null;
}

/**
 * True when the key might mean something to the calculator.
 *
 * Deliberately permissive: the parent page uses this to decide whether to
 * forward a key into an embedded demo, and a key that the demo would accept
 * must never be dropped on the way. Resolution happens once, in the demo.
 */
export function isCalculatorKey(event) {
  if (!event) return false;
  if (resolveKey(event) !== null) return true;

  // Also forward when the physical key is one the calculator cares about, even
  // if the character is unhelpful — for example an AZERTY "&" on a key that
  // types "1".
  const code = usableCode(event.code);
  if (code && (code in CODE_TO_KEY || code in CODE_TO_ACTION)) return true;

  const keyCode = event.keyCode ?? event.which;
  if (typeof keyCode === 'number' && keyCode !== 0) {
    if (keyCode in KEYCODE_TO_KEY || keyCode in KEYCODE_TO_ACTION) return true;
  }

  return false;
}
