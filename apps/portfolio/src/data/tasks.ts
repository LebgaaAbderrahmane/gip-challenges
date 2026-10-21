/**
 * Task metadata — the single source of truth for routes, categories and status.
 *
 * STATUS HONESTY RULE (plan §2, §17.6)
 * --------------------------------------
 * A task's `status` is only ever advanced by hand, and only after the
 * corresponding exit criterion in docs/plan.md §16 has actually been met.
 * Never hardcode a status to make the portfolio look better; a false "Live"
 * badge is worse than an honest "In progress".
 *
 * Continuous signals such as "tests passing" are NOT stored here — they are
 * rendered from the CI workflow badge so they cannot drift from reality.
 */

export type TaskCategory =
  | 'Backend'
  | 'Frontend'
  | 'Algorithm'
  | 'Security'
  | 'Concurrency';

export type TaskStatus = 'planned' | 'in-progress' | 'implemented' | 'verified';

export interface Task {
  /** Stable identifier. Deliberately NOT the brief's numbering — the brief
   *  restarts numbering (three tasks are labelled "Task 01"). See docs/brief.md. */
  id: string;
  slug: string;
  title: string;
  category: TaskCategory;
  /** One sentence: what the challenge actually requires. */
  summary: string;
  /** One technical detail worth noticing — not marketing copy. */
  highlight: string;
  /**
   * The piece of implementation worth reading.
   *
   * It is the real code, copied from the repository, so a reader can check
   * it against the source. It is the part of each challenge that actually
   * contains the difficulty.
   */
  code?: {
    language: string;
    file: string;
    source: string;
  };
  /**
   * The requirements the BRIEF imposes, in the brief's own words.
   *
   * Kept separate from `ourChoices` so nothing of ours is ever presented as
   * something the brief demanded.
   */
  briefRequirements: string[];
  /**
   * Rules we added that the brief does not impose.
   *
   * Worth stating plainly: a juror should be able to tell which requirements
   * were given and which were our own idea.
   */
  ourChoices: string[];
  status: TaskStatus;
  /** Whether this task is backed by a deployed HTTP API. */
  hasApi: boolean;
}

export const TASKS: Task[] = [
  {
    id: 'gip-01',
    slug: 'lost-found',
    title: 'Lost & Found API',
    category: 'Backend',
    summary:
      'Report lost and found items, search and filter reports, inspect details, update your own reports and mark items recovered.',
    highlight: 'Ownership enforced from a verified JWT, never a client-supplied ownerId',
    code: {
      language: 'ts',
      file: 'services/lost-found-api/src/routes/items.ts',
      source: `
// The owner comes from the VERIFIED TOKEN, never from the body.
const user = request.user!;
const report = await findReport(app, id);
if (!report) throw notFound('There is no report with that id.');
if (report.ownerId !== user.id) {
  throw forbidden('Only the user who created this report may change it.');
}`,
    },
    briefRequirements: [
      'Any technology you want',
      'No frontend is required',
    ],
    ourChoices: [],
    status: 'implemented',
    hasApi: true,
  },
  {
    id: 'gip-02',
    slug: 'calculator',
    title: 'Interactive Calculator',
    category: 'Frontend',
    summary:
      'A calculator UI with keyboard support and correct operator precedence.',
    highlight: 'Hand-written tokenizer and recursive-descent parser — no eval(), no framework',
    code: {
      language: 'js',
      file: 'apps/calculator/parser.js',
      source: `
// A recursive-descent parser: no eval(), no framework.
// Multiplication binds tighter than addition, because parseTerm is
// reached from parseExpression and consumes the * and / first.
function parseExpression() {
  let left = parseTerm();
  while (peek() && peek().type === 'operator' && (peek().value === '+' || peek().value === '-')) {
    const op = consume().value;
    const right = parseTerm();
    left = op === '+' ? left + right : left - right;
  }
  return left;
}`,
    },
    briefRequirements: ['Must use only HTML/CSS and JavaScript with no framework'],
    ourChoices: [
      'No expression-evaluation library either — the parser is written from scratch, so there is nothing to evaluate with',
    ],
    status: 'implemented',
    hasApi: false,
  },
  {
    id: 'gip-03',
    slug: 'binary-string',
    title: 'Missing Binary String',
    category: 'Algorithm',
    summary:
      'Given n unique binary strings of length n, return any binary string of length n that does not appear in the input.',
    highlight: 'Diagonal construction — the answer provably differs from every input',
    code: {
      language: 'ts',
      file: 'apps/portfolio/src/features/algorithms/binaryString.ts',
      source: `
// Diagonal construction.
// At index i, flip the bit nums[i][i]. The answer then differs from
// nums[i] AT POSITION i, so it cannot equal any row of the array.
export function findDifferentBinaryString(nums: readonly string[]): string {
  const n = validateBinaryInput(nums);

  const answer = new Array<string>(n);
  for (let i = 0; i < n; i++) {
    answer[i] = nums[i][i] === '0' ? '1' : '0';
  }

  return answer.join('');
}`,
    },
    briefRequirements: ['Any language'],
    ourChoices: [],
    status: 'implemented',
    hasApi: false,
  },
  {
    id: 'gip-04',
    slug: 'autocomplete',
    title: 'Autocomplete Search',
    category: 'Frontend',
    summary:
      'A performant client-side autocomplete over the supplied dataset, supporting mid-word, accent and apostrophe matches.',
    highlight: 'Hand-written search over the full 110-record dataset, normalised once at load',
    code: {
      language: 'js',
      file: 'apps/autocomplete/search.js',
      source: `
// A SUBSTRING search, so "land" finds "Iceland" and "Ireland".
// The exact and prefix cases are ranked above the rest.
export function search(entries, query, limit = DEFAULT_LIMIT) {
  const needle = normalizeText(query);
  if (needle === '') return [];

  for (const entry of entries) {
    const index = entry.normalized.indexOf(needle);
    if (index === -1) continue;

    const rank =
      entry.normalized === needle ? RANK_EXACT
      : entry.normalized.startsWith(needle) ? RANK_PREFIX
      : RANK_SUBSTRING;

    // The match is mapped back onto the ORIGINAL label, so the highlighted
    // range is right even when it spans a folded character.
  }
}`,
    },
    briefRequirements: [
      'The autocomplete algorithm must be written by you',
      'The supplied data.js dataset must be used',
    ],
    ourChoices: [
      'Built without a framework, by choice. The brief places no restriction on the stack for this task.',
    ],
    status: 'implemented',
    hasApi: false,
  },
  {
    id: 'gip-05',
    slug: 'auth',
    title: 'Authentication API',
    category: 'Security',
    summary:
      'Signup and login endpoints with password hashing and JWT issuing and verification.',
    highlight: 'Argon2id hashing, pinned signing algorithm, short-lived tokens, login rate limiting',
    code: {
      language: 'ts',
      file: 'services/auth-api/src/lib/crypto.ts',
      source: `
// Argon2id. The memory cost is the main dial and is deliberately
// generous: 64 MiB per hash makes a large-scale attack expensive.
const HASH_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65_536, // 64 MiB
  timeCost: 3,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, HASH_OPTIONS);
}`,
    },
    briefRequirements: ['Any language or framework'],
    ourChoices: [],
    status: 'implemented',
    hasApi: true,
  },
  {
    id: 'gip-06',
    slug: 'missing-positive',
    title: 'Smallest Missing Positive',
    category: 'Algorithm',
    summary:
      'Given an unsorted integer array, return the smallest positive integer that is not present.',
    highlight: 'O(n) time, O(1) auxiliary space via in-place index placement',
    code: {
      language: 'ts',
      file: 'apps/portfolio/src/features/algorithms/smallestMissingPositive.ts',
      source: `
// O(n) time, O(1) extra space.
// Place nums[i] at index nums[i]-1 while it is in range and not already
// home. The second condition is what prevents an infinite loop on duplicates.
for (let i = 0; i < n; i++) {
  while (nums[i] >= 1 && nums[i] <= n && nums[nums[i] - 1] !== nums[i]) {
    const target = nums[i] - 1;
    const tmp = nums[target];
    nums[target] = nums[i];
    nums[i] = tmp;
  }
}

// The first index that is not "home" is the answer.
for (let i = 0; i < n; i++) {
  if (nums[i] !== i + 1) return i + 1;
}`,
    },
    briefRequirements: ['Any language'],
    ourChoices: [],
    status: 'implemented',
    hasApi: false,
  },
  {
    id: 'gip-07',
    slug: 'flash-sale',
    title: 'Flash Sale API',
    category: 'Concurrency',
    summary:
      'Browse products, view stock, place orders and view orders while hundreds of customers race for the same units.',
    highlight: 'Atomic conditional UPDATE plus database-enforced idempotency — proven under real concurrency',
    code: {
      language: 'ts',
      file: 'services/flash-sale-api/src/lib/orders.ts',
      source: `
// The reservation is ONE conditional statement. The database evaluates
// the condition and the update together, so the check cannot be
// interleaved with another request: two requests can never both take
// the last unit.
const [reserved] = await tx
  .update(products)
  .set({ stock: sql\`\${products.stock} - \${input.quantity}\`, updatedAt: new Date() })
  .where(
    sql\`\${products.id} = \${input.productId} AND \${products.stock} >= \${input.quantity}\`,
  )
  .returning();

if (!reserved) {
  // No rows: the product does not exist, or there is not enough stock.
}`,
    },
    briefRequirements: ['Any language or framework'],
    ourChoices: [],
    status: 'implemented',
    hasApi: true,
  },
];

export const getTaskBySlug = (slug: string): Task | undefined =>
  TASKS.find((task) => task.slug === slug);