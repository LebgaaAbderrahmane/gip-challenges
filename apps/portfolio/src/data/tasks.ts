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
  /** Constraints taken verbatim from the brief, or an explicit note that the
   *  brief imposes none. */
  constraints: string[];
  /** Whether the brief mandates the constraint, or we chose it. */
  constraintsAreMandatory: boolean;
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
    constraints: ['Technology choice is free', 'No frontend required'],
    constraintsAreMandatory: true,
    status: 'planned',
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
    constraints: [
      'Must use only HTML/CSS and JavaScript with no framework',
      'No expression-evaluation library',
    ],
    constraintsAreMandatory: true,
    status: 'planned',
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
    constraints: ['Any language'],
    constraintsAreMandatory: true,
    status: 'planned',
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
    constraints: [
      'The autocomplete algorithm must be written by you',
      'The supplied data.js dataset must be used',
      'NO framework prohibition exists in the brief for this task — see below',
    ],
    constraintsAreMandatory: false,
    status: 'planned',
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
    constraints: ['Any language or framework'],
    constraintsAreMandatory: true,
    status: 'planned',
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
    constraints: ['Any language'],
    constraintsAreMandatory: true,
    status: 'planned',
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
    constraints: ['Any language or framework'],
    constraintsAreMandatory: true,
    status: 'planned',
    hasApi: true,
  },
];

export const getTaskBySlug = (slug: string): Task | undefined =>
  TASKS.find((task) => task.slug === slug);