import { Link, useParams } from 'react-router-dom';

import StatusBadge from '@/components/StatusBadge';
import { getTaskBySlug } from '@/data/tasks';
import NotFoundPage from '@/pages/NotFoundPage';

const GITHUB_URL = 'https://github.com/LebgaaAbderrahmane/gip-challenges';

/**
 * Shared challenge page shell (plan §5.5).
 *
 * The section order is fixed so every challenge reads the same way:
 *   1 breadcrumbs · 2 title + summary · 3 metadata · 4 interactive demo
 *   5 results/errors · 6 how it works · 7 edge cases · 8 tests · 9 links
 *
 * Individual tasks replace the demo slot and fill in their own long-form
 * sections; the surrounding structure stays identical.
 */
export default function TaskPage() {
  const { slug } = useParams<{ slug: string }>();
  const task = slug ? getTaskBySlug(slug) : undefined;

  if (!task) return <NotFoundPage />;

  const sourcePath = `apps/${['calculator', 'autocomplete'].includes(task.slug) ? task.slug : 'portfolio'}`;

  return (
    <div className="container-page py-10">
      {/* 1 — Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="text-sm text-text-subtle">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link to="/" className="hover:text-text">
              GIP
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link to="/tasks" className="hover:text-text">
              Challenges
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-text-muted">
            {task.title}
          </li>
        </ol>
      </nav>

      {/* 2 — Title and summary */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-text-subtle">{task.id}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{task.title}</h1>
          <p className="mt-3 max-w-2xl text-text-muted">{task.summary}</p>
        </div>
        <StatusBadge status={task.status} />
      </div>

      {/* 3 — Metadata */}
      <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
        <div>
          <dt className="text-text-subtle">Category</dt>
          <dd className="text-text">{task.category}</dd>
        </div>
        <div>
          <dt className="text-text-subtle">Backed by</dt>
          <dd className="text-text">{task.hasApi ? 'Deployed HTTP API' : 'Client-side only'}</dd>
        </div>
        <div>
          <dt className="text-text-subtle">Brief constraints</dt>
          <dd className="text-text">
            {task.constraintsAreMandatory ? 'Mandated' : 'Not mandated — our choice'}
          </dd>
        </div>
      </dl>

      {/* 4 — Interactive demo slot (implemented per task) */}
      <section
        aria-label="Interactive demo"
        className="mt-8 rounded-xl border border-dashed border-border bg-surface/50 p-8 text-center"
      >
        <p className="text-text-muted">
          The interactive demo for this challenge is being built.
        </p>
      </section>

      {/* 5–8 — filled in per task */}
      <section className="mt-8 space-y-6 text-text-muted">
        <p>
          How it works, validation rules, edge cases and verified test results are added when this
          challenge is implemented. See the task document in the repository for the full write-up.
        </p>
      </section>

      {/* 9 — Links */}
      <section className="mt-10 flex flex-wrap gap-3 border-t border-border pt-6 text-sm">
        <a
          href={`${GITHUB_URL}/tree/main/${sourcePath}`}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-lg border border-border px-4 py-2 transition-colors hover:border-border-strong hover:bg-surface"
        >
          Source
        </a>
        <a
          href={`${GITHUB_URL}/blob/main/docs/tasks/${task.slug}.md`}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-lg border border-border px-4 py-2 transition-colors hover:border-border-strong hover:bg-surface"
        >
          Task documentation
        </a>
        {task.hasApi && (
          <span className="rounded-lg border border-border px-4 py-2 text-text-subtle">
            Swagger — available once deployed
          </span>
        )}
      </section>
    </div>
  );
}