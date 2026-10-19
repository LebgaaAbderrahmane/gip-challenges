import { Link, useParams } from 'react-router-dom';

import DemoFrame from '@/components/DemoFrame';
import StatusBadge from '@/components/StatusBadge';
import TaskContentSections from '@/components/TaskContentSections';
import { getTaskBySlug } from '@/data/tasks';
import BinaryStringDemo from '@/features/algorithms/BinaryStringDemo';
import SmallestMissingPositiveDemo from '@/features/algorithms/SmallestMissingPositiveDemo';
import NotFoundPage from '@/pages/NotFoundPage';

const GITHUB_URL = 'https://github.com/LebgaaAbderrahmane/gip-challenges';

/** Interactive demos, keyed by task slug. */
const DEMOS: Record<string, React.ComponentType> = {
  'binary-string': BinaryStringDemo,
  'missing-positive': SmallestMissingPositiveDemo,
};

/** Vanilla demos embedded as static iframes, keyed by task slug. */
const IFRAME_DEMOS: Record<string, { name: string; src: string }> = {
  calculator: { name: 'calculator', src: '/demos/calculator/index.html' },
  autocomplete: { name: 'autocomplete', src: '/demos/autocomplete/index.html' },
};

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

  const Demo = slug ? DEMOS[slug] : undefined;
  const iframeDemo = slug ? IFRAME_DEMOS[slug] : undefined;
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

      {/* 4 — Interactive demo */}
      {Demo ? (
        <section
          aria-label="Interactive demo"
          className="mt-8 rounded-xl border border-border bg-surface/40 p-5 sm:p-6"
        >
          <Demo />
        </section>
      ) : iframeDemo ? (
        <section aria-label="Interactive demo" className="mt-8">
          <DemoFrame name={iframeDemo.name} src={iframeDemo.src} />
        </section>
      ) : (
        <section
          aria-label="Interactive demo"
          className="mt-8 rounded-xl border border-dashed border-border bg-surface/50 p-8 text-center"
        >
          <p className="text-text-muted">The interactive demo for this challenge is being built.</p>
        </section>
      )}

      {/* 5–8 — how it works, complexity, edge cases, tests */}
      {slug && <TaskContentSections slug={slug} />}

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