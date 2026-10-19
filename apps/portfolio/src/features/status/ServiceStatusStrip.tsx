import { useCallback, useEffect, useState } from 'react';

import { API_BASE_URLS } from '@/config/api';

/**
 * The live service status.
 *
 * The three APIs are deployed, and this shows it rather than claiming it. It
 * also surfaces the free tier's honest behaviour: a service that has been idle
 * for a while is asleep, and the first request wakes it.
 *
 * A failed check is reported as "unreachable" rather than hidden, because a
 * service that cannot be reached is exactly what a visitor needs to know.
 */

interface ServiceStatus {
  name: string;
  baseUrl: string;
  state: 'checking' | 'ok' | 'slow' | 'unreachable';
  detail: string;
}

const SERVICES: { name: string; baseUrl: string }[] = [
  { name: 'Lost & Found', baseUrl: API_BASE_URLS.lostFound },
  { name: 'Authentication', baseUrl: API_BASE_URLS.auth },
  { name: 'Flash Sale', baseUrl: API_BASE_URLS.flashSale },
];

/** How often to re-check. A minute is enough to notice a change. */
const POLL_INTERVAL_MS = 60_000;
/** Longer than this means the service is waking up. */
const SLOW_THRESHOLD_MS = 3_000;

const check = async (service: { name: string; baseUrl: string }): Promise<ServiceStatus> => {
  const started = performance.now();
  try {
    const response = await fetch(`${service.baseUrl}/health`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const elapsed = Math.round(performance.now() - started);

    if (!response.ok) {
      return {
        ...service,
        state: 'unreachable',
        detail: `answered ${response.status}`,
      };
    }

    const body = await response.json().catch(() => ({}));
    const database = typeof body.database === 'string' ? body.database : 'unknown';

    return {
      ...service,
      state: elapsed > SLOW_THRESHOLD_MS ? 'slow' : 'ok',
      detail:
        elapsed > SLOW_THRESHOLD_MS
          ? `awake, ${elapsed} ms (waking up)`
          : `live, database ${database}`,
    };
  } catch {
    return {
      ...service,
      state: 'unreachable',
      detail: 'no response',
    };
  }
};

const stateColour: Record<ServiceStatus['state'], string> = {
  checking: 'bg-text-subtle animate-pulse',
  ok: 'bg-success',
  slow: 'bg-warning',
  unreachable: 'bg-danger',
};

const stateLabel: Record<ServiceStatus['state'], string> = {
  checking: 'checking',
  ok: 'live',
  slow: 'waking up',
  unreachable: 'unreachable',
};

export default function ServiceStatusStrip() {
  const [statuses, setStatuses] = useState<ServiceStatus[]>(() =>
    SERVICES.map((service) => ({ ...service, state: 'checking', detail: '' })),
  );
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setChecking(true);
      const results = await Promise.all(SERVICES.map(check));
      if (!cancelled) {
        setStatuses(results);
        setChecking(false);
      }
    };

    void run();
    const timer = setInterval(() => void run(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  /*
   * The check can be run again by hand.
   *
   * A service on a free tier is asleep most of the time, and the first
   * request wakes it. That can take a moment, and a visitor who is looking
   * at "unreachable" deserves to be able to try again without waiting for
   * the next poll.
   */
  const [refreshing, setRefreshing] = useState(false);
  const recheck = useCallback(async () => {
    setRefreshing(true);
    const results = await Promise.all(SERVICES.map(check));
    setStatuses(results);
    setRefreshing(false);
  }, []);

  return (
    <section aria-label="Service status" className="mt-6 border-t border-border pt-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-text-subtle">
        The three APIs, live
      </h2>
      <ul className="mt-2 space-y-1">
        {statuses.map((status) => (
          <li key={status.name} className="flex flex-wrap items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${stateColour[status.state]}`}
            />
            <span className="text-text-muted">{status.name}</span>
            <span className="text-text-subtle">— {stateLabel[status.state]}</span>
            {status.detail && (
              <span className="font-mono text-text-subtle">({status.detail})</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-text-subtle">
        Checked from your browser, against the deployed services. A service that has been idle
        may be waking up, which takes a moment on the free tier.
      </p>
      <button
        type="button"
        onClick={() => void recheck()}
        disabled={refreshing || checking}
        className="mt-2 rounded-md border border-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text disabled:opacity-60"
      >
        {refreshing || checking ? 'Checking…' : 'Check again now'}
      </button>
    </section>
  );
}
