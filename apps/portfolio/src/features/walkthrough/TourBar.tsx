import { Link } from 'react-router-dom';

import { useWalkthrough } from './WalkthroughContext';

/**
 * The tour strip.
 *
 * A slim bar under the header. It says which step you are on, what to do,
 * and how to get to the next one — and then it gets out of the way.
 *
 * It replaces a panel that sat in the corner of every page, and a spotlight
 * that dimmed the page and cut a hole over it. Both of those took the page
 * away from the visitor to say something about the page. This one does not:
 * the page stays fully visible, fully clickable, and the strip is one line
 * tall.
 */
export default function TourBar() {
  const walkthrough = useWalkthrough();

  if (!walkthrough.open || !walkthrough.current) return null;

  const step = walkthrough.current;
  const isLast = walkthrough.index >= walkthrough.total - 1;

  return (
    <div
      role="region"
      aria-label="Guided walkthrough"
      className="sticky top-16 z-30 border-b border-border bg-surface/95 backdrop-blur"
    >
      <div className="container-page flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
        <p className="font-mono text-[11px] uppercase tracking-wide text-accent">
          Step {walkthrough.index + 1}/{walkthrough.total}
          <span className="ml-2 hidden text-text-subtle sm:inline">{step.challenge}</span>
        </p>

        <p className="min-w-0 flex-1 truncate text-sm text-text">{step.title}</p>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to={step.href}
            className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-bg transition-colors hover:bg-accent-strong"
          >
            {step.action} →
          </Link>
          <button
            type="button"
            onClick={walkthrough.next}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text"
          >
            {isLast ? 'Finish' : 'Next'}
          </button>
          {walkthrough.index > 0 && (
            <button
              type="button"
              onClick={() => walkthrough.goTo(walkthrough.index - 1)}
              className="px-1 py-1 text-xs text-text-subtle transition-colors hover:text-text"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={walkthrough.close}
            aria-label="Close the guided walkthrough"
            className="rounded-md px-1.5 py-1 text-xs text-text-subtle transition-colors hover:bg-surface-elevated hover:text-text"
          >
            ✕
          </button>
        </div>
      </div>

      {/* The progress, as a hairline under the bar. */}
      <div
        className="h-px w-full bg-surface-elevated"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={walkthrough.total}
        aria-valuenow={walkthrough.index + 1}
        aria-label="Walkthrough progress"
      >
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${((walkthrough.index + 1) / walkthrough.total) * 100}%` }}
        />
      </div>
    </div>
  );
}
