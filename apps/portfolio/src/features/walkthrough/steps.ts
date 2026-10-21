/**
 * The guided walkthrough.
 *
 * One story through all seven challenges, in the order that makes the
 * connections visible. A visitor can follow it from the first step to the
 * last, or ignore it entirely — it never blocks anything.
 *
 * The steps deliberately build on each other: the token from the first step
 * is the token the second step needs, which is the whole point of the three
 * services sharing a secret.
 *
 * The steps are a STRIP, not an overlay.
 *
 * The tour used to dim the page and cut a hole over the thing it was
 * talking about. It was precise and it was useless: the thing being
 * explained is usually a whole panel, so the "hole" was most of the page
 * and the page behind it was too dark to read. A slim bar under the
 * header says the same thing and leaves the page alone.
 */

export interface WalkthroughStep {
  id: string;
  /** The step title, shown in the card. */
  title: string;
  /** What to do. */
  instruction: string;
  /** Where to go to do it. */
  href: string;
  /** The label for the link. */
  action: string;
  /** The challenge this step belongs to, for the card's context line. */
  challenge: string;
}

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 'sign-in',
    title: 'Get a token',
    instruction:
      'Create an account and sign in. The sign-in response carries a token, and the button next to it copies it.',
    href: '/tasks/auth',
    action: 'Open the Authentication API',
    challenge: 'gip-05 · Authentication API',
  },
  {
    id: 'create-report',
    title: 'File a lost item with that token',
    instruction:
      'The token is already set. Creating a report takes the owner from the token — there is no owner field in the request body at all.',
    href: '/tasks/lost-found',
    action: 'Open the Lost & Found API',
    challenge: 'gip-01 · Lost & Found API',
  },
  {
    id: 'forbidden',
    title: 'Try to change it as somebody else',
    instruction:
      'Sign in as a second user and attempt the same update. The service answers 403 — only the owner may change a report.',
    href: '/tasks/lost-found',
    action: 'Try it',
    challenge: 'gip-01 · Lost & Found API',
  },
  {
    id: 'filter',
    title: 'Search and filter the reports',
    instruction:
      'Filter by type, status or category, or search across the title, description and location.',
    href: '/tasks/lost-found',
    action: 'Filter the reports',
    challenge: 'gip-01 · Lost & Found API',
  },
  {
    id: 'overselling',
    title: 'Fire thirty simultaneous orders at ten units',
    instruction:
      'The hardest requirement in the brief. Exactly ten orders succeed, twenty are refused as sold out, and the stock ends at zero — never below it.',
    href: '/tasks/flash-sale',
    action: 'Open the Flash Sale Lab',
    challenge: 'gip-07 · Flash Sale API',
  },
  {
    id: 'idempotency',
    title: 'Retry the same order',
    instruction:
      'The same key with the same payload returns the original order instead of creating a second one. The same key with a different payload is refused.',
    href: '/tasks/flash-sale',
    action: 'Retry an order',
    challenge: 'gip-07 · Flash Sale API',
  },
  {
    id: 'the-rest',
    title: 'The two algorithms and the two frontends',
    instruction:
      'A binary string that is provably absent from its input, the smallest missing positive integer, a calculator with a hand-written parser, and an autocomplete over all 110 supplied records.',
    href: '/tasks',
    action: 'See the remaining four',
    challenge: 'gip-02, gip-03, gip-04, gip-06',
  },
];

/** The key the walkthrough position is remembered under. */
export const WALKTHROUGH_STORAGE_KEY = 'gip-walkthrough-step';
