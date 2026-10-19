import { Link } from 'react-router-dom';

import { useWalkthrough } from './WalkthroughContext';

/**
 * The walkthrough panel.
 *
 * A suggestion, not a gate. It can be dismissed and the site behaves
 * identically; it can be brought back from the footer.
 */
export default function WalkthroughPanel() {
  const walkthrough = useWalkthrough();

  if (!walkthrough.open || !walkthrough.current) return null;

  const step = walkthrough.current;

  return (
    <aside
      aria-label="Guided walkthrough"
      className="fixed inset-x-3 top-[4.75rem] z-50 sm:inset-x-auto sm:right-4 sm:top-[4.75rem] sm:w-[24rem]"
    >
      <div className="rounded-xl border border-accent/40 bg-surface/95 p-4 shadow-2xl backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-wide text-accent">
              Step {walkthrough.index + 1} of {walkthrough.total} · {step.challenge}
            </p>
            <h2 className="mt-1 text-sm font-semibold">{step.title}</h2>
          </div>
          <button
            type="button"
            onClick={walkthrough.dismiss}
            aria-label="Dismiss the walkthrough"
            className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-text-subtle transition-colors hover:bg-surface-elevated hover:text-text"
          >
            ✕
          </button>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-text-muted">{step.instruction}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            to={step.href}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-bg transition-colors hover:bg-accent-strong"
          >
            {step.action} →
          </Link>
          <button
            type="button"
            onClick={walkthrough.next}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text"
          >
            {walkthrough.index >= walkthrough.total - 1 ? 'Finish' : 'Next step'}
          </button>
          {walkthrough.index > 0 && (
            <button
              type="button"
              onClick={() => walkthrough.goTo(walkthrough.index - 1)}
              className="px-1 py-1.5 text-xs text-text-subtle transition-colors hover:text-text"
            >
              Back
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
