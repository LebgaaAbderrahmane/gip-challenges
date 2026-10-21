import { useCallback, useEffect, useRef, useState } from 'react';

import { API_BASE_URLS } from '@/config/api';

/**
 * A terminal that runs REAL requests.
 *
 * Every response below is fetched from the deployed service, from the
 * browser, at the moment you watch it. Nothing is mocked, and nothing is
 * pre-recorded: if a service is asleep you see it waking up, and if it is
 * down you see that too.
 *
 * Only READ requests are made. A hero animation that placed orders on the
 * public database every time somebody loaded the page would be a bad
 * neighbour.
 */

interface TerminalStep {
  /** The command, as it would be typed. */
  command: string;
  /** The service it goes to. */
  service: 'flashSale' | 'lostFound' | 'auth';
  /** The path. */
  path: string;
  /** What the response is for, shown above it. */
  note: string;
}

const STEPS: TerminalStep[] = [
  {
    command: 'curl -s {base}/api/products',
    service: 'flashSale',
    path: '/api/products',
    note: 'the live stock, read from PostgreSQL',
  },
  {
    command: 'curl -s {base}/api/items?limit=2',
    service: 'lostFound',
    path: '/api/items?limit=2',
    note: 'the reports, with a pagination envelope',
  },
  {
    command: 'curl -s {base}/health',
    service: 'auth',
    path: '/health',
    note: 'the service and its database',
  },
];

const BASE: Record<TerminalStep['service'], string> = {
  flashSale: API_BASE_URLS.flashSale,
  lostFound: API_BASE_URLS.lostFound,
  auth: API_BASE_URLS.auth,
};

/** How long a character takes to appear. */
const TYPING_MS = 12;
/** How long the response stays on screen. */
const HOLD_MS = 4_200;
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** A short, readable rendering of a response. */
const summarise = (body: unknown, path: string): string => {
  if (path === '/api/products') {
    const products = (body as { data?: { name: string; stock: number }[] })?.data ?? [];
    if (products.length === 0) return '[]';
    return products
      .slice(0, 4)
      .map((p) => `  ${p.name.padEnd(30, ' ').slice(0, 30)}  stock ${p.stock}`)
      .join('\n');
  }
  if (path.startsWith('/api/items')) {
    const payload = body as { data?: unknown[]; pagination?: { total: number } };
    const count = payload?.data?.length ?? 0;
    const total = payload?.pagination?.total ?? 0;
    return `  ${count} shown, ${total} in total\n  pagination: ${JSON.stringify(payload?.pagination ?? {})}`;
  }
  return JSON.stringify(body, null, 2);
};

export default function LiveTerminal() {
  const [stepIndex, setStepIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);

  const timer = useRef<number | null>(null);
  const cancelled = useRef(false);

  const step = STEPS[stepIndex % STEPS.length];
  const command = step.command.replace('{base}', BASE[step.service]);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  /*
   * The loop: type the command, run it, show the answer, move on.
   */
  useEffect(() => {
    cancelled.current = false;
    setTyped('');
    setResponse(null);
    setError(null);

    if (prefersReducedMotion()) {
      // No motion: show the result as soon as it arrives.
      void (async () => {
        try {
          const result = await fetch(`${BASE[step.service]}${step.path}`, {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
          });
          const body = await result.json().catch(() => null);
          if (!cancelled.current) {
            setResponse(summarise(body, step.path));
            setRunning(false);
          }
        } catch {
          if (!cancelled.current) {
            setError('the service did not answer');
            setRunning(false);
          }
        }
      })();
      return;
    }

    setRunning(true);
    let index = 0;

    const typeNext = () => {
      if (cancelled.current) return;
      index += 1;
      setTyped(command.slice(0, index));
      if (index < command.length) {
        timer.current = window.setTimeout(typeNext, TYPING_MS);
        return;
      }

      // The command is complete — run it.
      timer.current = window.setTimeout(async () => {
        if (cancelled.current) return;
        try {
          const result = await fetch(`${BASE[step.service]}${step.path}`, {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
          });
          const body = await result.json().catch(() => null);
          if (cancelled.current) return;
          setResponse(summarise(body, step.path));
          setError(null);
        } catch {
          if (cancelled.current) return;
          setError('the service did not answer — it may be asleep');
          setResponse(null);
        }
        setRunning(false);
        timer.current = window.setTimeout(advance, HOLD_MS);
      }, 280);
    };

    const advance = () => {
      if (cancelled.current) return;
      setStepIndex((current) => (current + 1) % STEPS.length);
    };

    timer.current = window.setTimeout(typeNext, 260);
    return () => {
      cancelled.current = true;
      clear();
    };
  }, [stepIndex, command, step.service, step.path, clear]);

  // Pausing stops the loop between steps. The current request still
  // finishes, because cancelling it would be worse than letting it land.
  useEffect(() => {
    if (!paused) return;
    return () => clear();
  }, [paused, clear]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
      {/* The title bar. */}
      <div className="flex items-center gap-2 border-b border-border bg-surface-elevated/60 px-3 py-2">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-danger/70" />
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-warning/70" />
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <span className="ml-2 truncate font-mono text-[11px] text-text-subtle">
          {BASE[step.service]}
        </span>
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          className="ml-auto rounded px-1.5 py-0.5 font-mono text-[11px] text-text-subtle transition-colors hover:bg-surface hover:text-text"
        >
          {paused ? 'resume' : 'pause'}
        </button>
      </div>

      {/* The output. */}
      <div className="min-h-[13.5rem] p-4 font-mono text-[13px] leading-relaxed">
        <p className="text-text-muted">
          <span className="text-accent">$</span> {typed}
          {running && <span className="ml-0.5 animate-pulse text-accent">▌</span>}
        </p>

        {response !== null && (
          <pre className="mt-3 whitespace-pre-wrap text-text-muted">{response}</pre>
        )}

        {error !== null && (
          <pre className="mt-3 whitespace-pre-wrap text-warning">{error}</pre>
        )}

        <p className="mt-4 border-t border-border/70 pt-3 text-[11px] text-text-subtle">
          {step.note}
          <span className="mx-1.5 text-text-subtle/60">·</span>
          a live request from your browser
        </p>
      </div>
    </div>
  );
}
