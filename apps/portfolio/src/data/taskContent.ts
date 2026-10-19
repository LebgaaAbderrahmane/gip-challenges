/**
 * Long-form content for the shared challenge-page layout (plan §5.5,
 * sections 5–8: how it works, complexity, edge cases, test evidence).
 *
 * This is the page-level companion to docs/tasks/<slug>.md. Where the task
 * document is the full write-up, this is what a visitor reads on the site.
 *
 * HONESTY RULE: `tests.total` must reflect an actual test run. If a number here
 * stops matching what `pnpm test` reports, that is a bug in this file, not a
 * number to quietly round.
 */

export interface ContentBlock {
  heading?: string;
  body: string;
  code?: string;
}

export interface EdgeCase {
  input: string;
  result: string;
  note?: string;
}

export interface TaskContent {
  howItWorks: ContentBlock[];
  complexity: { measure: string; value: string }[];
  edgeCases: EdgeCase[];
  tests: {
    total: number;
    command: string;
    highlights: string[];
  };
  notes?: string[];
}

export const TASK_CONTENT: Record<string, TaskContent> = {
  'lost-found': {
    howItWorks: [
      {
        heading: 'The owner comes from the token, never from the body',
        body: 'The brief asks for users to update their own reports, so ownership has to be trustworthy. The create request has no owner field at all — the owner is taken from the verified bearer token. A test sends an ownerId in the body and asserts it is ignored.',
      },
      {
        heading: 'Tokens are verified locally, not over the network',
        body: 'The auth service signs the tokens; this service verifies the signature with the same secret rather than calling the auth service on every request. That avoids a network hop in the hot path and a cascading failure when the auth service is slow. The cost is a shared secret, which is a real boundary and is documented in the architecture notes.',
      },
      {
        heading: 'The signing algorithm is pinned',
        body: 'A token that names its own algorithm is never trusted, because that is how the alg: none attack works, and how the HMAC/RSA confusion works. The algorithm is fixed in code, and a token claiming anything else is rejected — there is a test for exactly that.',
      },
      {
        heading: 'Search is a real query, not a scan in JavaScript',
        body: 'The list endpoint filters in PostgreSQL: an exact match on type, status and category, a case-insensitive match on the location, and a search across the title, description and location. The search term has its LIKE wildcards escaped, so searching for a percent sign does not match everything.',
      },
      {
        heading: 'One schema, one role, one service',
        body: 'The service owns the lost_found schema and connects as the role that owns it, with the search_path set so it cannot reach another service tables even by accident. That isolation is enforced by PostgreSQL, not by convention, and it is verified against the hosted database.',
      },
    ],
    complexity: [
      { measure: 'Endpoints', value: '5 — create, list, get, update, recover' },
      { measure: 'Tests', value: '38, against a real PostgreSQL instance' },
      { measure: 'Database', value: 'One schema, one restricted role' },
      { measure: 'Documents', value: 'OpenAPI generated from the live route schemas' },
    ],
    edgeCases: [
      { input: 'POST /api/items', result: '201', note: 'The owner is taken from the token' },
      { input: 'POST without a token', result: '401', note: 'Required for every write' },
      { input: 'POST with a token signed by another key', result: '401', note: 'The signature is checked' },
      { input: 'POST with an alg:none token', result: '401', note: 'The algorithm is pinned' },
      { input: 'POST with a missing title', result: '400', note: 'With the field named in the details' },
      { input: 'GET /api/items?limit=1000', result: '400', note: 'The limit is bounded' },
      { input: 'GET /api/items?q=%25', result: '0 results', note: 'LIKE wildcards are escaped' },
      { input: 'PATCH by another user', result: '403', note: 'Only the owner may change a report' },
      { input: 'PATCH with an empty body', result: '400', note: 'At least one field is required' },
      { input: 'PATCH /recover twice', result: '409', note: 'Not a silent no-op' },
      { input: 'GET /api/items/unknown-id', result: '404', note: 'With the standard error envelope' },
    ],
    tests: {
      total: 38,
      command: 'pnpm --filter @gip/lost-found-api test',
      highlights: [
        'Ownership: the owner is taken from the token, an ownerId in the body is ignored, and another user gets 403 on update and on recover',
        'Authentication: a missing, malformed, expired, wrongly-signed or alg:none token is all rejected with 401',
        'Validation: missing title, description, location, an invalid type, an invalid date and an over-long title are all 400',
        'Search and filtering by type, category and a term across the title, description and location, with the LIKE wildcards escaped',
        'Pagination: the envelope, the page and the limit, and a limit above the maximum rejected',
        'State: recovering a report twice is a 409 rather than a silent no-op',
        'Health: reports the real state and discloses no credentials, host or connection string',
        'OpenAPI: every route is described, and the document never mentions a password hash',
      ],
    },
    notes: [
      'A deployed instance sleeps after fifteen minutes on the free tier, so the first request can take a minute. The tester shows a waiting state and offers a retry.',
      'The API is the deliverable. The tester on this page is an evaluation aid that makes real requests from your browser to the deployed service.',
    ],
  },

  auth: {
    howItWorks: [
      {
        heading: 'Argon2id, with a deliberately generous cost',
        body: 'Argon2id is memory-hard, which makes a stolen hash expensive to attack in bulk, and it resists both side-channel and GPU attacks. The memory cost is 64 MiB with three passes. The plaintext password is never stored, never logged and never returned — the response schema has no passwordHash property at all, so it cannot reach the wire even by accident.',
      },
      {
        heading: 'The email is normalised before it is stored',
        body: 'Trimmed and lowercased, so Ada@EXAMPLE.test and ada@example.test are one account, with a unique index as the last line of defence if two signups race.',
      },
      {
        heading: 'Minimal claims, and a pinned algorithm',
        body: 'A token is just base64, so anything sensitive in it would be readable by whoever holds it. The claims are the subject, the email, the issue time and the expiry. The algorithm is fixed in code rather than chosen by the token, which is what makes the alg: none attack impossible.',
      },
      {
        heading: 'The failure does not reveal whether an account exists',
        body: 'The message and the status are identical whether the account does not exist or the password is wrong, so the endpoint cannot be used to discover which addresses are registered. The timing is identical too: when the account does not exist, a hash of a random password is verified anyway, because otherwise a missing account would return noticeably faster — a timing oracle.',
      },
      {
        heading: 'Login and signup are rate limited',
        body: 'Ten attempts a minute per address, reported with the standard error envelope. Signup is limited because it costs an email verification; login because it is a password-guessing target.',
      },
    ],
    complexity: [
      { measure: 'Hashing', value: 'Argon2id — 64 MiB memory, 3 passes, 1 lane' },
      { measure: 'Token lifetime', value: '15 minutes' },
      { measure: 'Tests', value: '30, against a real PostgreSQL instance' },
      { measure: 'Rate limit', value: '10 attempts per minute per address' },
    ],
    edgeCases: [
      { input: 'POST /api/auth/signup', result: '201', note: 'The user is returned without a hash' },
      { input: 'signup with a duplicate email', result: '409', note: 'A differently-cased one too' },
      { input: 'signup with a short password', result: '400', note: 'Twelve characters minimum' },
      { input: 'POST /api/auth/login', result: '200', note: 'A token, its type and its lifetime' },
      { input: 'login with a wrong password', result: '401', note: 'The same message as an unknown account' },
      { input: 'login with an unknown account', result: '401', note: 'The same message as a wrong password' },
      { input: 'GET /api/auth/me without a token', result: '401' },
      { input: 'GET /api/auth/me with an expired token', result: '401' },
      { input: 'GET /api/auth/me with an alg:none token', result: '401', note: 'The algorithm is pinned' },
      { input: 'too many attempts', result: '429', note: 'With the standard error envelope' },
    ],
    tests: {
      total: 30,
      command: 'pnpm --filter @gip/auth-api test',
      highlights: [
        'The stored value is an $argon2id$ hash and never the password, and the response never contains either',
        'A duplicate email is rejected, and a differently-cased one is the same account',
        'The failure message and code are identical for a wrong password and for an unknown account, so the endpoint cannot be used to discover registered addresses',
        'Tokens are rejected when missing, malformed, expired, signed with the wrong key, issued by the wrong issuer, or claiming an algorithm other than the pinned one',
        'The rate limit is enforced, with its own error code',
        'The OpenAPI document never mentions a password hash',
      ],
    },
    notes: [
      'There is no email verification, no password reset and no refresh token. The brief asks for signup, login, hashing and JWT issuing and verification, and a reset flow needs an email transport the free tier does not provide.',
      'The rate limit is per address rather than per account, so several users behind one address share a budget.',
    ],
  },

  calculator: {
    howItWorks: [
      {
        heading: 'A parser, not an eval',
        body: 'The expression is never passed to eval() or new Function(). Both are equivalent to arbitrary code execution, and a calculator evaluates text the user typed — that combination would let a visitor execute code in the page origin. A tokenizer and a recursive-descent parser are a few dozen lines, so there is no real trade-off.',
      },
      {
        heading: 'Grammar and precedence',
        body: 'Loosest to tightest binding: parentheses, then unary sign, then multiplication and division, then addition and subtraction. Left associativity gives 100 / 5 / 2 = 10.',
        code: `expression := term (("+" | "-") term)*
term       := factor (("*" | "/") factor)*
factor     := unary | "(" expression ")" | number
unary      := ("+" | "-")* factor`,
      },
      {
        heading: 'The parser is separated from the DOM',
        body: 'parser.js is a pure module with no DOM access at all, so the algorithm is tested headlessly. calculator.js handles only event wiring and input guards.',
      },
      {
        heading: 'Errors keep your work',
        body: 'On a parse failure the expression stays on screen so it can be corrected, rather than being cleared. Division by zero raises rather than producing Infinity — a non-finite value is never displayed as a valid answer.',
      },
      {
        heading: 'Display rounding',
        body: '0.1 + 0.2 is 0.30000000000000004 in floating point. The result is rounded to 12 significant digits for display only; the unrounded value is never fed back into further arithmetic, so rounding cannot corrupt a later operation.',
      },
    ],
    complexity: [
      { measure: 'Parsing', value: 'O(n) in expression length — single left-to-right pass' },
      { measure: 'Space', value: 'O(n) for tokens and the recursion stack' },
      { measure: 'Dependencies', value: 'None — no framework, no bundler, no build step' },
    ],
    edgeCases: [
      { input: '2 + 3 * 4', result: '14', note: 'Precedence, not left-to-right' },
      { input: '(2 + 3) * 4', result: '20', note: 'Parentheses override precedence' },
      { input: '10 / 2', result: '5' },
      { input: '0.1 + 0.2', result: '0.3', note: 'Rounded for display only' },
      { input: '5 / 0', result: 'Error', note: 'Never displays Infinity' },
      { input: '5 / (3 - 3)', result: 'Error', note: 'Computed division by zero also caught' },
      { input: '2 +', result: 'Error', note: 'On evaluate; no crash beforehand' },
      { input: '()', result: 'Error' },
      { input: '2++*3', result: 'Error' },
      { input: '-3 / 2', result: '-1.5', note: 'Unary sign binds tighter' },
      { input: '100 / 5 / 2', result: '10', note: 'Left-associative' },
    ],
    tests: {
      total: 42,
      command: 'pnpm --filter @gip/calculator test',
      highlights: [
        '21 parser tests: tokenizing, precedence, parentheses, unary signs, malformed input',
        '21 UI tests that load the real index.html into jsdom and drive the actual handlers, so keyboard support is verified rather than assumed',
        'A test asserting that input which would execute code under eval — alert(1), constructor, 1;2 — throws a parse error. It exists to fail loudly if anyone switches the implementation to eval().',
        'Keyboard: Enter, =, Escape, Backspace, parentheses. "/" prevents the browser default; modified keystrokes are left alone so shortcuts still work.',
      ],
    },
    notes: [
      'The brief requires "only HTML/CSS and javascript with no framework". That restriction is enforced by scripts/demo-build.mjs, which fails the build if the calculator source contains eval(, new Function(, or a framework import — so the constraint cannot quietly erode.',
      'No percent or sign-flip key: the brief does not ask for one and its semantics in a chained expression are ambiguous.',
      'Very long expressions scroll horizontally instead of wrapping, which keeps the layout stable but hides earlier input on narrow screens.',
    ],
  },

  'binary-string': {
    howItWorks: [
      {
        heading: 'Diagonal construction',
        body: 'Build the answer one position at a time: at index i, take the bit at nums[i][i] and flip it.',
        code: `for (let i = 0; i < n; i++) {
  answer[i] = nums[i][i] === '0' ? '1' : '0';
}`,
      },
      {
        heading: 'Why it is correct',
        body: 'The answer differs from nums[i] at position i, by construction. Suppose the answer were equal to some nums[j] — equal strings agree at every position, so they would agree at position j. But answer[j] is the complement of nums[j][j], so it does not. Contradiction. This holds for every j, so the answer cannot equal any row.',
      },
      {
        heading: 'Uniqueness is not needed',
        body: 'The proof never uses the uniqueness precondition. The construction differs from every row whether or not the rows are distinct — uniqueness only matters for the problem statement counting argument, not for correctness here. A dedicated test confirms it by feeding in duplicate rows.',
      },
      {
        heading: 'Tests assert validity, not one answer',
        body: 'The brief says "if there are multiple answers, you may return any of them". Asserting a particular output string would have tested the wrong thing, so every test checks that the result has length n, is binary, and is absent from the input.',
      },
    ],
    complexity: [
      { measure: 'Time', value: 'O(n) — one pass over the diagonal' },
      { measure: 'Space', value: 'O(n) for the returned string (the unavoidable output)' },
    ],
    edgeCases: [
      { input: '["01", "10"]', result: '"11"', note: 'Worked example' },
      { input: '["0"]', result: '"1"' },
      { input: '["1"]', result: '"0"' },
      { input: '["01", "01"]', result: '"10"', note: 'Duplicate rows — still absent from input' },
      { input: '[]', result: 'Rejected', note: 'No length n to satisfy; the problem is undefined' },
      { input: '["0", "12"]', result: 'Rejected', note: 'Rows must be length n' },
      { input: '["12", "01"]', result: 'Rejected', note: 'Only 0 and 1 allowed' },
    ],
    tests: {
      total: 13,
      command: 'pnpm --filter @gip/portfolio test',
      highlights: [
        '600 randomised valid inputs (n from 1 to 12), each checked for length, binary-ness, and absence from the input',
        'Complete enumeration of valid n = 2 inputs',
        'A duplicate-row test proving correctness does not depend on uniqueness',
        'A direct check that the answer differs from every row at that row\'s own index',
        '7 validation cases, each producing its own specific error message',
      ],
    },
    notes: [
      'The empty array is rejected rather than answered: with zero inputs there is no length n to satisfy, so returning "0" would be a guess.',
      'The UI accepts loose input formats as a convenience, but the algorithm itself only accepts a well-formed array.',
    ],
  },

  autocomplete: {
    howItWorks: [
      {
        heading: 'Matching is by substring, not by prefix',
        body: 'The brief asks for mid-word matches — "land" finds Iceland and Ireland. A prefix search would find neither, so the search is a substring scan over the whole label. Every keystroke checks the complete dataset.',
      },
      {
        heading: 'Normalisation happens once, at load',
        body: 'The 110 labels are normalised when the page loads, never per keystroke. Normalisation decomposes each label into its base characters, drops the combining accents, folds the apostrophe variants to a plain one, lowercases, and collapses whitespace. The original label is always kept for display, so what the user sees is exactly what the dataset says.',
      },
      {
        heading: 'Accents and apostrophes',
        body: 'A French AZERTY keyboard types "&" for the key labelled "1", and a smart keyboard produces U+2019 where the dataset has U+0027. Folding both means "cote d\'ivoire" and "côte d’ivoire" both find "Côte d\'Ivoire".',
      },
      {
        heading: 'Ranking never hides a match',
        body: 'Results are ordered exact, then prefix, then any other substring, and only then truncated to the display limit. Within a tier the shorter label wins, because it is the more specific answer. The limit is applied after ranking, so a valid match is never crowded out by a less relevant one.',
      },
      {
        heading: 'Highlighting without innerHTML',
        body: 'The matched range is mapped back onto the original label, because the normalised string is not character-for-character the same — "Côte d\'Ivoire" normalises to "cote d\'ivoire". The label is then built from text nodes and a <mark> element, never by interpolating into HTML, so a dataset entry could never inject markup.',
      },
      {
        heading: 'No index, because none is needed',
        body: 'The supplied dataset is 110 records. A linear scan over the prepared entries measures 0.0079 ms per search, so building an index would cost more to construct than the scan ever costs to run. The figure is measured by the test suite rather than assumed.',
      },
    ],
    complexity: [
      { measure: 'Search', value: 'O(n) over the dataset — 110 records' },
      { measure: 'Measured', value: '0.0079 ms per search, averaged over 3000 searches' },
      { measure: 'Normalisation', value: 'O(n) once at load, not per keystroke' },
      { measure: 'Index', value: 'None — the scan is already faster than building one' },
    ],
    edgeCases: [
      { input: 'land', result: '7 matches', note: 'Finland, Iceland, Ireland, Netherlands, New Zealand, Poland, Switzerland' },
      { input: "cote d'ivoire", result: "Côte d'Ivoire", note: "The brief's example" },
      { input: 'cote d’ivoire', result: "Côte d'Ivoire", note: 'Curly apostrophe against the straight one' },
      { input: 'sao', result: 'São Tomé and Príncipe', note: 'Accents folded on both sides' },
      { input: 'ICELAND', result: 'Iceland', note: 'Case-insensitive' },
      { input: 'zzzz', result: 'No match', note: 'Explained in the status line' },
      { input: '(empty)', result: 'No suggestions', note: 'A hint is shown instead' },
    ],
    tests: {
      total: 33,
      command: 'pnpm --filter @gip/autocomplete test',
      highlights: [
        'The brief\'s own examples: "land" finds Iceland and Ireland, and "cote d\'ivoire" finds "Côte d\'Ivoire"',
        'The full result set for "land" — seven entries, not the two the brief names — asserted against the supplied data',
        'Accent folding in both directions, curly and straight apostrophes, and case-insensitivity',
        'Ranking order asserted explicitly, including that a valid match is never dropped to make room for a better-ranked one',
        'Highlighting asserted against the original label, including a match that spans a folded character',
        'The dataset itself checked: 110 records, no duplicate or empty names, and a landmark from the far end of the list to prove the whole dataset is searched',
        'Performance measured rather than assumed',
      ],
    },
    notes: [
      'The apostrophe is part of the word, not optional: a query with a space or no apostrophe does not match. The brief asks for apostrophes to be handled — the variants of the character — not for the character to be optional.',
      'This task is framework-free by choice, not by requirement. The brief constrains the algorithm and the dataset, not the stack.',
    ],
  },

  'missing-positive': {
    howItWorks: [
      {
        heading: 'In-place index placement',
        body: 'For an array of length n, every value x in [1, n] belongs at index x - 1. Repeatedly swap each in-range value into its home index, then scan for the first index whose value is not i + 1. Values outside [1, n] are ignored — they can never be the answer, because with n slots the answer always lies in [1, n + 1].',
        code: `while (nums[i] >= 1 && nums[i] <= n && nums[nums[i] - 1] !== nums[i]) {
  const target = nums[i] - 1;
  const tmp = nums[target];
  nums[target] = nums[i];
  nums[i] = tmp;
}`,
      },
      {
        heading: 'Why the loop terminates',
        body: 'Each swap places a value into its final correct index, and no swap ever displaces a value that is already correctly placed. The condition nums[nums[i] - 1] !== nums[i] stops the loop precisely when the target already holds the value — which is also what prevents an infinite loop on duplicates, the classic failure mode of this algorithm.',
      },
      {
        heading: 'It mutates its input — deliberately',
        body: 'That is the trade that makes the algorithm O(1) in auxiliary space. The page passes a copy so your input stays readable and shows you the before and after arrays. The copy is a UI-boundary concern; the algorithm itself is still O(1).',
      },
    ],
    complexity: [
      { measure: 'Time', value: 'O(n) — O(n) outer passes, O(n) total swaps' },
      { measure: 'Auxiliary space', value: 'O(1) — in place' },
      { measure: 'Measured', value: '200,000 consecutive values in ~13 ms' },
    ],
    edgeCases: [
      { input: '[0, -2, 1, 2]', result: '3', note: "The brief's worked example" },
      { input: '[1, 2, 3]', result: '4', note: 'Every value in [1, n] present' },
      { input: '[3, 4, -1, 1]', result: '2' },
      { input: '[7, 8, 9, 11, 12]', result: '1', note: 'No positive in range' },
      { input: '[]', result: '1' },
      { input: '[1, 1]', result: '2', note: 'Duplicates must not loop forever' },
      { input: '[-1, -2]', result: '1' },
      { input: '[100, 200, 300]', result: '1', note: 'Values beyond n are ignored' },
      { input: '[1.5, 2]', result: 'Rejected', note: 'Non-integers are not coerced' },
    ],
    tests: {
      total: 16,
      command: 'pnpm --filter @gip/portfolio test',
      highlights: [
        'The brief\'s example plus every case from the task plan\'s test table',
        'An exhaustive check: every permutation of [-1, 0, 1, 2, 3] (120 cases) compared against a naive Set-based reference implementation',
        'A 200,000-element array confirming linear time',
        'Mutation behaviour verified rather than asserted in a comment: the input is reordered, and is a permutation of the original',
        'Duplicate-heavy arrays confirming the swap-loop guard',
      ],
    },
    notes: [
      'The function reorders the array as a side effect, which would be unacceptable if the caller needed the original ordering preserved — hence the copy at the UI boundary.',
      'Non-integer input is rejected rather than coerced, since the problem specifies integers.',
    ],
  },
};