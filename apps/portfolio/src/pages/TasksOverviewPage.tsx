import TaskCard from '@/components/TaskCard';
import { TASKS } from '@/data/tasks';

export default function TasksOverviewPage() {
  const byCategory = TASKS.reduce<Record<string, number>>((acc, task) => {
    acc[task.category] = (acc[task.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Challenges</h1>
      <p className="mt-3 max-w-2xl text-text-muted">
        Seven challenges from the supplied brief. Each has its own route, implementation, tests and
        documentation. Identifiers are stable names rather than the brief's numbering, because the
        brief restarts its numbering — three tasks are labelled &ldquo;Task 01&rdquo;.
      </p>

      <ul className="mt-6 flex flex-wrap gap-2 text-xs">
        {Object.entries(byCategory).map(([category, count]) => (
          <li
            key={category}
            className="rounded-full border border-border bg-surface px-3 py-1 text-text-muted"
          >
            {category} · {count}
          </li>
        ))}
      </ul>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TASKS.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}