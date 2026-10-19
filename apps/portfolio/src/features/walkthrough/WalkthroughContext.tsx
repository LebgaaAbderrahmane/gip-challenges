import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { WALKTHROUGH_STORAGE_KEY, WALKTHROUGH_STEPS } from './steps';

/**
 * The guided walkthrough.
 *
 * It is a suggestion, never a gate: a visitor can dismiss it and the site
 * works exactly the same. The position is remembered so a return visit picks
 * up where they left off.
 *
 * Only the STEP NUMBER is stored — never anything about the session or the
 * token. The walkthrough and the session are kept apart on purpose.
 */
export interface Walkthrough {
  /** The step to show, or null when the walkthrough is finished. */
  current: (typeof WALKTHROUGH_STEPS)[number] | null;
  /** Which step it is, counting from 1. */
  index: number;
  total: number;
  /** Whether the panel is showing at all. */
  open: boolean;
  /** Moves to a step. */
  goTo: (index: number) => void;
  /** Moves to the next step. */
  next: () => void;
  /** Hides the panel for good. */
  dismiss: () => void;
  /** Brings it back. */
  restore: () => void;
}

const WalkthroughContext = createContext<Walkthrough | null>(null);

const readStoredStep = (): number => {
  try {
    const stored = window.localStorage.getItem(WALKTHROUGH_STORAGE_KEY);
    const parsed = stored === null ? NaN : Number(stored);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed < WALKTHROUGH_STEPS.length) {
      return parsed;
    }
  } catch {
    // Storage can be refused. The walkthrough still works for this visit.
  }
  return 0;
};

const writeStoredStep = (index: number) => {
  try {
    window.localStorage.setItem(WALKTHROUGH_STORAGE_KEY, String(index));
  } catch {
    // Not being able to remember the position is not a failure.
  }
};

export function WalkthroughProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState(readStoredStep);
  const [dismissed, setDismissed] = useState(false);

  const goTo = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(WALKTHROUGH_STEPS.length - 1, next));
    setIndex(clamped);
    writeStoredStep(clamped);
  }, []);

  const next = useCallback(() => {
    if (index >= WALKTHROUGH_STEPS.length - 1) {
      setDismissed(true);
      try {
        window.localStorage.removeItem(WALKTHROUGH_STORAGE_KEY);
      } catch {
        /* nothing to do */
      }
      return;
    }
    goTo(index + 1);
  }, [goTo, index]);

  const value = useMemo<Walkthrough>(
    () => ({
      current: WALKTHROUGH_STEPS[index] ?? null,
      index,
      total: WALKTHROUGH_STEPS.length,
      open: !dismissed,
      goTo,
      next,
      dismiss: () => setDismissed(true),
      restore: () => setDismissed(false),
    }),
    [index, dismissed, goTo, next],
  );

  return (
    <WalkthroughContext.Provider value={value}>{children}</WalkthroughContext.Provider>
  );
}

export function useWalkthrough(): Walkthrough {
  const walkthrough = useContext(WalkthroughContext);
  if (!walkthrough) {
    throw new Error('useWalkthrough must be used inside a WalkthroughProvider.');
  }
  return walkthrough;
}
