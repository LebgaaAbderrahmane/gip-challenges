import { Link } from 'react-router-dom';

/**
 * How to evaluate this project.
 *
 * A jury has seven challenges and a brief, and the hardest part of the job
 * is working out what "done" looks like for each one. This page answers that
 * directly: for every challenge, the requirement in the brief's own words,
 * where to see it working, and the one thing to look for.
 *
 * Every row links straight to the demonstration, and every "look for" is
 * something that can be checked in the browser.
 */

interface EvaluationRow {
  id: string;
  title: string;
  /** The requirement, in the brief's own words. */
  requirement: string;
  /** Where to see it. */
  where: { href: string; label: string };
  /** What to look for — a specific, checkable behaviour. */
  lookFor: string;
}

const rows: EvaluationRow[] = [
  {
    id: 'gip-01',
    title: 'Lost & Found API',
    requirement:
      '"search and filter reported items, view the details of the item, update their own reports & mark an item as recovered"',
    where: { href: '/tasks/lost-found', label: 'Open the tester' },
    lookFor:
      'Sign in on the Authentication API, then use that token here. Update a report as its owner, then as a different user — the second attempt is refused with 403.',
  },
  {
    id: 'gip-02',
    title: 'Interactive Calculator',
    requirement:
      '"a working calculator UI with keyboard support and proper operator precedence handling in vanilla JS" — "You must use only HTML/CSS and javascript with no framework"',
    where: { href: '/tasks/calculator', label: 'Open the calculator' },
    lookFor:
      'Type 2 + 3 * 4 and press Enter: the answer is 14, not 20. The source is three plain files with no framework and no eval().',
  },
  {
    id: 'gip-03',
    title: 'Missing Binary String',
    requirement:
      '"return a binary string of length n that does not appear in nums. If there are multiple answers, you may return any of them."',
    where: { href: '/tasks/binary-string', label: 'Open the demo' },
    lookFor:
      'The answer is always absent from the input, and it differs from every input row at that row\'s own index.',
  },
  {
    id: 'gip-04',
    title: 'Autocomplete Search',
    requirement:
      '"It should support mid-word matches (typing land returns you iceland, ireland...)" and "Accents and apostrophes should be handled too (cote d\'ivoire returns côte d\'ivoire)"',
    where: { href: '/tasks/autocomplete', label: 'Open the autocomplete' },
    lookFor:
      'Type "land" — it is a mid-word match. Type "cote d\'ivoire" — it finds "Côte d\'Ivoire". The search runs over all 110 supplied records.',
  },
  {
    id: 'gip-05',
    title: 'Authentication API',
    requirement:
      '"Build signup/login endpoints with password hashing and JWT issuing/verification" — "secured signup/login endpoints"',
    where: { href: '/tasks/auth', label: 'Open the tester' },
    lookFor:
      'Sign up, then sign in: the response carries a token and the user without a password hash. Try the same token on a different page — it is accepted, because all three services share one secret.',
  },
  {
    id: 'gip-06',
    title: 'Smallest Missing Positive',
    requirement:
      '"Return the smallest positive integer (n > 0) that is not present in nums." The brief\'s example: [0, -2, 1, 2] gives 3.',
    where: { href: '/tasks/missing-positive', label: 'Open the demo' },
    lookFor:
      'The brief\'s example gives 3. An empty array gives 1, and a fully consecutive array gives n + 1.',
  },
  {
    id: 'gip-07',
    title: 'Flash Sale API',
    requirement:
      '"prevent stock from going negative, ensure a product isn\'t oversold, correctly handle simultaneous requests... prevent a client from accidentally creating multiple orders by retrying the same request."',
    where: { href: '/tasks/flash-sale', label: 'Open the Lab' },
    lookFor:
      'Fire 30 simultaneous orders at a product with 10 in stock: exactly 10 succeed, 20 are refused, and the stock ends at 0 — never below it. Then retry the same order: one order, one decrement.',
  },
];

export default function EvaluationMapPage() {
  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-semibold tracking-tight">How to evaluate this</h1>
      <p className="mt-4 max-w-2xl text-text-muted">
        Seven challenges, one brief. This page lists, for each challenge, the requirement in the
        brief&rsquo;s own words, where to see it working, and the one behaviour worth checking.
        Everything runs in your browser against the deployed services — there is nothing to install
        and nothing to believe but the responses.
      </p>

      <div className="mt-8 rounded-xl border border-accent/40 bg-accent-muted p-4">
        <p className="text-sm font-medium">Start with one thing</p>
        <p className="mt-1 text-sm text-text-muted">
          If you only do one, do the last one: open the Flash Sale Lab and fire thirty
          simultaneous orders. It is the hardest requirement in the brief, and it is the clearest
          thing to watch.
        </p>
      </div>

      <ol className="mt-8 space-y-4">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">
                <span className="mr-2 font-mono text-xs text-text-subtle">{row.id}</span>
                {row.title}
              </h2>
              <Link
                to={row.where.href}
                className="text-sm font-medium text-accent hover:underline"
              >
                {row.where.label} →
              </Link>
            </div>

            <blockquote className="mt-3 border-l-2 border-accent/50 pl-3 text-sm italic text-text-muted">
              {row.requirement}
            </blockquote>

            <p className="mt-3 text-sm text-text-muted">
              <span className="font-medium text-text">Look for:</span> {row.lookFor}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-10 border-t border-border pt-6">
        <h2 className="text-xl font-semibold tracking-tight">Two things worth knowing</h2>
        <p className="mt-3 max-w-2xl text-text-muted">
          <strong className="text-text">The task identifiers are not the brief&rsquo;s.</strong>{' '}
          The brief restarts its own numbering partway through — three of its tasks are labelled
          &ldquo;Task 01&rdquo; — so each challenge here carries a stable name instead. The brief is
          reproduced verbatim in the repository, so every requirement can be traced.
        </p>
        <p className="mt-3 max-w-2xl text-text-muted">
          <strong className="text-text">The three APIs are one system, not three demos.</strong>{' '}
          They share one signing secret, so a token issued by the Authentication API is accepted by
          the other two. Sign in once and it follows you around the site.
        </p>
      </div>
    </div>
  );
}
