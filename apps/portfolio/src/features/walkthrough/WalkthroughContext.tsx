import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { WALKTHROUGH_STORAGE_KEY, WALKTHROUGH_STEPS } from './steps';

/**
 * The guided walkthrough.
 *
 * It is a suggestion, never a gate. Nothing about it is on screen until a
 * visitor asks for it, and the site works exactly the same either way.
 *
 * Two decisions worth recording, both of them the reason this is not the
 * panel it used to be:
 *
 *   - It OPENS, it does not SIT. A docked card that is always there takes
 *     screen space from every page and becomes something to ignore. A
 *     spotlight that appears when asked for is an event.
 *
 *   - It can be RECALLED. Closing it must not lose it: the same button
 *     brings it back, and the position is remembered, so a return visit
 *     picks up where they left off. Being easy to dismiss AND easy to
 *     find again is the whole trick.
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
  /** Whether the tour is running. */
  open: boolean;
  /** Starts the tour, at the remembered step. */
  start: () => void;
  /** Moves to a step. */
  goTo: (index: number) => void;
  /** Moves to the next step. */
  next: () => void;
  /** Closes the tour, remembering the position. */
  close: () => void;
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
    // Storage can be refused. The tour still works for this visit.
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
  const [open, setOpen] = useState(false);

  const goTo = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(WALKTHROUGH_STEPS.length - 1, next));
    setIndex(clamped);
    writeStoredStep(clamped);
  }, []);

  const next = useCallback(() => {
    if (index >= WALKTHROUGH_STEPS.length - 1) {
      // The last step closes the tour and clears the position, because
      // somebody who has finished the story has nothing to come back to.
      setOpen(false);
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
      open,
      start: () => setOpen(true),
      goTo,
      next,
      close: () => setOpen(false),
    }),
    [index, open, goTo, next],
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
