import { Link } from 'react-router-dom';

import TaskCard from '@/components/TaskCard';
import LiveTerminal from '@/components/LiveTerminal';
import { TASKS } from '@/data/tasks';

const GITHUB_URL = 'https://github.com/LebgaaAbderrahmane/gip-challenges';
const CI_BADGE_URL = `${GITHUB_URL}/actions/workflows/ci.yml/badge.svg`;
const CI_URL = `${GITHUB_URL}/actions/workflows/ci.yml`;

const highlights = [
  {
    title: 'Real APIs, not mocks',
    body: 'Three independently deployed Fastify services with persistent PostgreSQL storage, OpenAPI documentation and an embedded tester that makes genuine HTTP requests from your browser.',
  },
  {
    title: 'Correctness under concurrency',
    body: 'The Flash Sale API reserves stock with a single conditional UPDATE and relies on a unique constraint for idempotency. The overselling and duplicate-retry tests fire genuinely simultaneous requests against a real database.',
  },
  {
    title: 'Constraints taken literally',
    body: 'The calculator is hand-written vanilla HTML, CSS and JavaScript with its own tokenizer and recursive-descent parser — no framework, and no eval(). The autocomplete searches the full supplied 110-record dataset.',
  },
  {
    title: 'Honest status',
    body: 'Badges are advanced by hand, and only after an exit criterion is genuinely met. Test results are read from the CI workflow below, so they cannot drift from what the tests actually report.',
  },
];

const documents = [
  {
    label: 'How to evaluate this',
    description: 'What the brief asked, where to see it, and what to look for',
    href: `${GITHUB_URL}/blob/main/docs/evaluation-map.md`,
  },
  {
    label: 'README',
    description: 'Setup, commands, architecture and the known caveats',
    href: `${GITHUB_URL}#readme`,
  },
  {
    label: 'Architecture',
    description: 'Repository layout, request flow, schema ownership and the trade-offs',
    href: `${GITHUB_URL}/blob/main/docs/architecture.md`,
  },
  {
    label: 'Deployment',
    description: 'The live URLs, the environment variables and what the free tier means',
    href: `${GITHUB_URL}/blob/main/docs/deployment.md`,
  },
  {
    label: 'Jury guide',
    description: 'Where to start, and what to try on each challenge',
    href: `${GITHUB_URL}/blob/main/docs/jury-guide.md`,
  },
  {
    label: 'Task documents',
    description: 'One per challenge: the approach, the edge cases and the measured results',
    href: `${GITHUB_URL}/tree/main/docs/tasks`,
  },
  {
    label: 'Source',
    description: 'The whole repository — one commit per completed task',
    href: GITHUB_URL,
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-border">
        <div className="container-page grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div>
            <p className="font-mono text-sm text-accent">gip-challenges</p>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Seven challenges. One engineering workspace.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-muted">
              A working portfolio covering seven challenges: three deployed backend APIs, two
              vanilla-JavaScript frontends and two algorithm implementations — each with its own
              tests, documentation and demo route.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/tasks"
                className="rounded-lg bg-accent px-5 py-2.5 font-medium text-bg transition-colors hover:bg-accent-strong"
              >
                Explore challenges
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-lg border border-border px-5 py-2.5 font-medium transition-colors hover:border-border-strong hover:bg-surface"
              >
                View source
              </a>
              <a
                href={CI_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 transition-colors hover:border-border-strong hover:bg-surface"
              >
                <img
                  src={CI_BADGE_URL}
                  alt="CI status: the test, lint and build workflow"
                  width={92}
                  height={20}
                  className="h-5 w-auto"
                />
                <span className="text-sm text-text-muted">CI</span>
              </a>
            </div>
          </div>

          {/* The system, running, right here in the page. */}
          <LiveTerminal />
        </div>
      </section>

      {/* The challenges */}
      <section className="container-page py-16">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">The challenges</h2>
          <Link to="/tasks" className="text-sm font-medium text-accent hover:underline">
            View all →
          </Link>
        </div>
        <p className="mt-3 max-w-2xl text-text-muted">
          Every challenge has its own route, its own implementation, its own tests and its own
          document. The identifiers are stable names rather than the brief&rsquo;s numbering, because
          the brief restarts its numbering — three of its tasks are labelled &ldquo;Task 01&rdquo;.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TASKS.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </section>

      {/* The engineering highlights */}
      <section className="border-y border-border bg-surface/40">
        <div className="container-page py-16">
          <h2 className="text-2xl font-semibold tracking-tight">Engineering highlights</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {highlights.map((item) => (
              <div key={item.title}>
                <h3 className="font-medium">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The documentation */}
      <section className="container-page py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Documentation and source</h2>
        <p className="mt-3 max-w-2xl text-text-muted">
          The reasoning is written down, not just the code. Every claim on this page can be checked
          against the repository.
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((document) => (
            <li key={document.label}>
              <a
                href={document.href}
                target="_blank"
                rel="noreferrer noopener"
                className="block h-full rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong"
              >
                <span className="block font-medium">{document.label}</span>
                <span className="mt-1 block text-sm text-text-muted">
                  {document.description}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
