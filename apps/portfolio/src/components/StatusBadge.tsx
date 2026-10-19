import type { TaskStatus } from '@/data/tasks';

/**
 * Status is communicated with a text label *and* a dot, never colour alone
 * (plan §5.2). The mapping is intentionally conservative — there is no
 * "live"/"completed" state that could be displayed without evidence.
 */
const STATUS_META: Record<TaskStatus, { label: string; dot: string; className: string }> = {
  planned: {
    label: 'Planned',
    dot: 'bg-text-subtle',
    className: 'border-border text-text-muted',
  },
  'in-progress': {
    label: 'In progress',
    dot: 'bg-warning',
    className: 'border-warning/40 text-warning',
  },
  implemented: {
    label: 'Implemented',
    dot: 'bg-accent',
    className: 'border-accent/40 text-accent',
  },
  verified: {
    label: 'Verified',
    dot: 'bg-success',
    className: 'border-success/40 text-success',
  },
};

export default function StatusBadge({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}