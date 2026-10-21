import { Link } from 'react-router-dom';

import StatusBadge from '@/components/StatusBadge';
import ChallengeVisual from '@/components/ChallengeVisual';
import type { Task } from '@/data/tasks';

export default function TaskCard({ task }: { task: Task }) {
  return (
    // `relative` is required, not decorative. The title link uses the
    // "stretched link" pattern — a pseudo-element covering the card so the
    // whole card is clickable — and an absolutely positioned overlay resolves
    // against the nearest POSITIONED ancestor. Without it the overlay was laid
    // out against <body>, so every card's invisible hit area covered the
    // entire page and the cards stacked on top of one another.
    /*
      A FIXED HEIGHT, from the small breakpoint up.
      The grid stretches the cards in a row to the tallest one, so a row of
      cards is only as even as its content. A fixed height makes every card
      the same size, and — more importantly — makes it IMPOSSIBLE for an
      animation inside one of them to change the height of the card and
      shove the rest of the grid around.
    */
    <article className="group relative flex h-[21.5rem] flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong">
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

      {/*
        A small picture of what the challenge actually does.

        The card used to carry a description as well, and it was the thing
        that made the grid hard to read: the descriptions are two or three
        lines each, they were the only text that needed reading before you
        got to the thing that mattered, and on a narrow card they were
        clipped. The visual says it better than a sentence does, and the
        full description is on the challenge's own page.
      */}
      <div className="mt-4">
        <ChallengeVisual id={task.slug} />
      </div>

      <p className="mt-4 line-clamp-2 flex-1 border-l-2 border-accent/50 pl-3 text-sm text-text">
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