import { useEffect, useState } from 'react';

/**
 * A pending state that tells the visitor what is happening.
 *
 * A spinner alone says "something is happening". This says what, for how
 * long, and what to do about it if it takes too long — which matters here,
 * because a service on a free tier can take a minute to wake up and a blank
 * panel would look broken.
 *
 * It is also interactive: the request can be cancelled, and the elapsed
 * time is live, so the page is never a dead rectangle.
 */

interface PendingStateProps {
  /** What is being waited for, in the present tense. */
  title: string;
  /** Anything that explains the wait. */
  detail?: string;
  /** When to suggest that something might be wrong. */
  slowAfterMs?: number;
  /** Called when the visitor cancels. Omit to hide the button. */
  onCancel?: () => void;
  /** The label on the cancel button. */
  cancelLabel?: string;
}

/**
 * A shimmering placeholder.
 *
 * The shape of the thing that is coming tells the visitor what to expect,
 * so the wait is not a surprise. Used for the response body and for the
 * product grid.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-surface-elevated ${className}`}
    />
  );
}

/**
 * A few skeleton lines, for a block of text that has not arrived yet.
 */
export function SkeletonLines({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton
          key={index}
          // The last line is shorter, so it reads as text rather than a block.
          className={`h-3 ${index === rows - 1 ? 'w-2/5' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export default function PendingState({
  title,
  detail,
  slowAfterMs = 4_000,
  onCancel,
  cancelLabel = 'Cancel',
}: PendingStateProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = performance.now();
    const timer = setInterval(
      () => setElapsed(Math.round((performance.now() - started) / 100) / 10),
      100,
    );
    return () => clearInterval(timer);
  }, []);

  const slow = elapsed >= slowAfterMs / 1000;

  return (
    <div className="flex items-start gap-3">
      {/*
        An indeterminate bar. It moves, so the panel is visibly alive
        instead of looking like an empty box.
      */}
      <div
        aria-hidden="true"
        className="mt-1 h-0.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-elevated"
      >
        <div className="h-full w-1/2 animate-pulse rounded-full bg-accent" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-sm font-medium text-text">{title}</p>
          <p className="font-mono text-xs text-text-subtle" aria-live="polite">
            {elapsed.toFixed(1)}s
          </p>
        </div>

        {detail && <p className="mt-1 text-sm text-text-muted">{detail}</p>}

        {slow && (
          <p className="mt-1 text-sm text-warning">
            Taking a while. A free-tier service may be waking up — this usually ends on its
            own.
          </p>
        )}

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-2 text-xs font-medium text-accent underline underline-offset-2 hover:text-accent-strong"
          >
            {cancelLabel}
          </button>
        )}
      </div>
    </div>
  );
}
