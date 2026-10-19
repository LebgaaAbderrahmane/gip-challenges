import { Link } from 'react-router-dom';

import StatusBadge from '@/components/StatusBadge';
import type { Task } from '@/data/tasks';

export default function TaskCard({ task }: { task: Task }) {
  return (
    <article className="group flex flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-text-subtle">{task.id}</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">
            <Link
              to={`/tasks/${task.slug}`}
              className="after:absolute after:inset-0 hover:text-accent focus-visible:text-accent"
            >
              {task.title}
            </Link>
          </h3>
        </div>
        <StatusBadge status={task.status} />
      </div>

      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-text-subtle">
        {task.category}
      </p>

      <p className="mt-3 flex-1 text-sm leading-relaxed text-text-muted">{task.summary}</p>

      <p className="mt-4 border-l-2 border-accent/50 pl-3 text-sm text-text">
        {task.highlight}
      </p>

      <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent">
        Open challenge
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </article>
  );
}