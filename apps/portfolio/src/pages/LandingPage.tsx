import { Link } from 'react-router-dom';

import TaskCard from '@/components/TaskCard';
import { TASKS } from '@/data/tasks';

const GITHUB_URL = 'https://github.com/LebgaaAbderrahmane/gip-challenges';

const highlights = [
  {
    title: 'Real APIs, not mocks',
    body: 'Three independently deployed Fastify services with persistent PostgreSQL storage, OpenAPI docs and an embedded tester that makes genuine HTTP requests from your browser.',
  },
  {
    title: 'Correctness under concurrency',
    body: 'The Flash Sale API uses an atomic conditional UPDATE and database-enforced idempotency. The overselling and duplicate-retry tests run against real concurrent connections.',
  },
  {
    title: 'Constraints taken literally',
    body: 'The calculator is hand-written vanilla HTML/CSS/JS with its own tokenizer and recursive-descent parser — no framework, no eval(). Autocomplete searches the full supplied 110-record dataset.',
  },
  {
    title: 'Honest status',
    body: 'Badges are advanced by hand only after an exit criterion is met. Test results come from the CI workflow, so they cannot drift from reality.',
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-border">
        <div className="container-page py-20 sm:py-28">
          <p className="font-mono text-sm text-accent">gip-challenges</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Seven challenges. One engineering workspace.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-muted">
            A working portfolio covering seven challenges: three deployed backend APIs, two
            vanilla-JavaScript frontends and two algorithm implementations — each with its own
            tests, documentation and demo route.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
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
          </div>
        </div>
      </section>

      {/* Challenge grid */}
      <section className="container-page py-16">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">The challenges</h2>
          <Link to="/tasks" className="text-sm font-medium text-accent hover:underline">
            View all →
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TASKS.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </section>

      {/* Engineering highlights */}
      <section className="border-t border-border bg-surface/40">
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
    </>
  );
}