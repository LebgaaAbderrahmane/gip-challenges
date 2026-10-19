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
 * The physical key (`event.code`) is normally the answer, but it is not
 * reliable when the layout is not a US one. Measured in Firefox on a French
 * AZERTY layout:
 *
 *   "&"  ->  code "Digit7"    (the US position of "&", not the AZERTY key)
 *   "é"  ->  code ""          (no US position at all)
 *   "à"  ->  code ""          (and so the only digit that worked)
 *
 * So `event.code` reports where the CHARACTER lives on a US keyboard, which
 * is not where the key lives on an AZERTY one. A character that identifies
 * the layout's digit row is therefore more trustworthy than the code, and
 * must be consulted first.
 *
 * Two rules keep this safe on every other layout:
 *
 *   1. The table only applies to an UNSHIFTED press. On QWERTY the
 *      characters in these rows are all shifted — "&" is Shift+7, the double
 *      quote is Shift+' — so on a US keyboard the table never fires. On
 *      French AZERTY they are unshifted, which is the case it exists for.
 *
 *   2. Characters that are calculator keys in their own right are kept
 *      separate, because a user pressing "(" means a parenthesis, not a
 *      digit. Those two are only consulted after the code has had its say.
 *
 * Adding a layout is a data change, not a code change.
 */
const LAYOUT_DIGIT_ROWS = [
  {
    name: 'French AZERTY',
    /** Unshifted characters that are not calculator keys: unambiguously digits. */
    row: {
      '&': '1', 'é': '2', '"': '3', "'": '4',
      'è': '7', '_': '8', 'ç': '9', 'à': '0',
    },
    /** Unshifted characters that are also calculator keys: consulted later. */
    ambiguous: {
      '(': '5', '-': '6',
    },
  },
];

/**
 * Finds the digit a character represents on a known layout.
 *
 * @param {string} character
 * @param {'row'|'ambiguous'} which table to consult
 * @returns {string|null} the digit, or null when the character is not a
 *   digit-row character of any known layout
 */
function digitFromLayoutCharacter(character, which = 'row') {
  if (typeof character !== 'string' || character.length === 0) return null;

  for (const layout of LAYOUT_DIGIT_ROWS) {
    const table = which === 'row' ? layout.row : layout.ambiguous;
    const digit = table?.[character];
    if (digit) return digit;
  }

  return null;
}

/**
 * Resolves a single character to a calculator action.
 *
 * This is the character-only half of `resolveKey`, used when the character
 * arrives through the browser's own text insertion rather than through a key
 * event. A text field lets the browser do the layout work — dead keys, AltGr
 * and input methods included — and hands over the character it actually
 * inserted.
 *
 * @param {string} character
 * @returns {string|null} a literal key, a named action, or null
 */
export function resolveCharacter(character) {
  if (typeof character !== 'string' || character.length === 0) return null;

  if (character === 'Enter' || character === '=') return 'equals';
  if (character === 'Backspace') return 'backspace';
  if (character === 'Escape' || character === 'Delete') return 'clear';

  if (/^[0-9]$/.test(character)) return character;
  if (LITERAL_KEYS.has(character)) return character;

  // A known layout's digit row, for a character that is not a calculator key
  // in its own right. Only unshifted characters reach this point, because a
  // shifted one is already a literal.
  const fromLayout = digitFromLayoutCharacter(character, 'row');
  if (fromLayout) return fromLayout;

  return null;
}

/**
 * True when the character is one the calculator acts on.
 */
export const isCalculatorCharacter = (character) => resolveCharacter(character) !== null;

/**
 * True when a keypress with modifiers is still the user typing a character.
 *
 * A modifier on its own means a shortcut, and shortcuts must reach the
 * browser: Ctrl+1 switches tabs, Cmd+S saves. But two combinations are
 * typing, not shortcutting:
 *
 *   - AltGr, which several European layouts use to reach characters such as
 *     "*" and "/". It is reported as ctrl and alt both being set, with
 *     getModifierState('AltGraph') true.
 *   - The Option key on macOS, reported as alt alone, which produces
 *     characters of its own.
 *
 * @param {KeyboardEvent} event
 */
export function isCharacterInput(event) {
  const altGraph =
    typeof event.getModifierState === 'function' && event.getModifierState('AltGraph');
  if (altGraph) return true;

  const optionOnly = event.altKey && !event.ctrlKey && !event.metaKey;
  if (optionOnly) return isCalculatorCharacter(event.key);

  return !(event.metaKey || event.ctrlKey || event.altKey);
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

  /*
   * 2. The character itself, when it already means something.
   *
   * This comes before the physical key, and the reason is the measurement
   * that settled the whole problem. In Firefox on a French AZERTY layout:
   *
   *   "&"  ->  code "Digit7"    (the US position of "&", not the AZERTY key)
   *   "_"  ->  code "Minus"
   *   "é"  ->  code ""
   *
   * `event.code` names where the CHARACTER lives on a US keyboard, not where
   * the key lives on an AZERTY one. On a non-US layout it is therefore not a
   * physical position at all, and trusting it types the wrong digit.
   *
   * The character, by contrast, is exactly what the user's operating system
   * decided they typed — which is the only thing a calculator can act on.
   */
  if (typeof event.key === 'string') {
    if (/^[0-9]$/.test(event.key)) return event.key;
    if (LITERAL_KEYS.has(event.key)) return event.key;
  }

  // 3. A known layout's digit row, for a character that is not a calculator
  //    key in its own right.
  //
  //    Only for an unshifted press: on a US layout every character in these
  //    rows is shifted ("&" is Shift+7), so on a US keyboard this never
  //    fires. On French AZERTY they are unshifted, which is the case it
  //    exists for.
  if (!shifted) {
    const fromLayout = digitFromLayoutCharacter(event.key, 'row');
    if (fromLayout) return fromLayout;
  }

  // 4. The physical key. It is the only source for the numeric keypad when
  //    NumLock is disengaged and the character is a navigation name.
  const code = usableCode(event.code);
  if (code) {
    const fromCode = CODE_TO_KEY[code];
    if (fromCode && LITERAL_KEYS.has(fromCode)) return fromCode;

    const action = CODE_TO_ACTION[code];
    if (action) return action;
  }

  // 5. The legacy keycode, for browsers reporting no usable `code`.
  //
  //    Only the main digit row and the keypad with NumLock engaged are
  //    included. The keypad's NumLock-disengaged keycodes (45, 35, 40, 34, 37,
  //    12, 39, 36, 38, 33) are deliberately absent: those are the very
  //    keycodes of the navigation keys, so without a usable `code` a keypad 4
  //    and an ArrowLeft are indistinguishable. Interpreting them would make
  //    the left arrow type a 4.
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

  // 6. The last of the AZERTY digit-row characters: the two that are also
  //    calculator keys. Reached only when nothing else spoke, so a real "-"
  //    on a US keyboard stays a minus sign.
  if (!shifted) {
    const fromAmbiguous = digitFromLayoutCharacter(event.key, 'ambiguous');
    if (fromAmbiguous) return fromAmbiguous;
  }

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
