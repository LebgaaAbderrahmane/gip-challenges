import { useCallback, useEffect, useRef, useState } from 'react';

import { API_BASE_URLS } from '@/config/api';
import PendingState, { Skeleton } from '@/components/PendingState';

/**
 * The Flash Sale Lab.
 *
 * The point of this panel is to make the concurrency behaviour VISIBLE. The
 * API already proves it in its test suite; here a visitor watches fifty
 * simultaneous requests come back, sees exactly how many won the last unit,
 * and sees the stock fall to zero without ever going negative.
 *
 * Everything shown is API-backed. There are no mock numbers: the stock comes
 * from the products endpoint, the outcomes come from the responses, and the
 * order list is read back from the API.
 */

const BASE = API_BASE_URLS.flashSale;

/** How long a single request may take before it is given up on. */
const REQUEST_TIMEOUT_MS = 20_000;

interface Product {
  id: string;
  name: string;
  priceCents: number;
  stock: number;
}

interface Attempt {
  index: number;
  /** What the request was for. */
  label: string;
  status: number | 'failed';
  /** How the API responded. */
  outcome: 'created' | 'replayed' | 'sold-out' | 'conflict' | 'error' | 'cancelled';
  orderId?: string;
  durationMs: number;
  message?: string;
}

const outcomeLabel: Record<Attempt['outcome'], string> = {
  created: 'Order created',
  replayed: 'Replayed — the original order',
  'sold-out': 'Sold out',
  conflict: 'Conflict',
  error: 'Failed',
  cancelled: 'Cancelled',
};

const outcomeColour: Record<Attempt['outcome'], string> = {
  created: 'text-success',
  replayed: 'text-accent',
  'sold-out': 'text-warning',
  conflict: 'text-warning',
  error: 'text-danger',
  cancelled: 'text-text-subtle',
};

export default function FlashSaleLab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [concurrency, setConcurrency] = useState(20);

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  /*
   * The live view of a running batch.
   *
   * The batch waits for every request before it says anything, which leaves
   * the panel looking dead while it works. These two states fill that gap:
   * the rows appear as each request lands, and the counter says how many
   * have answered.
   */
  const [liveAttempts, setLiveAttempts] = useState<Attempt[]>([]);
  const [progress, setProgress] = useState<{ settled: number; total: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [orders, setOrders] = useState<unknown[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  /** A demo customer id, generated once per tab. */
  const customerId = useRef<string>(
    `demo_lab_${Math.random().toString(36).slice(2, 10)}`,
  );

  /**
   * Loads the products, and returns them.
   *
   * The caller needs the stock that is on the server now, not the copy it
   * had before the request. Reading the old state would report a stock
   * change that never happened — or hide one that did.
   */
  const loadProducts = useCallback(async (): Promise<Product[]> => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`${BASE}/api/products`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`The service answered ${response.status}.`);
      }
      const body = await response.json();
      const loaded: Product[] = body.data ?? [];
      setProducts(loaded);

      /*
       * The scarcest product is selected by default.
       *
       * It is the one that demonstrates something: with ten units and thirty
       * simultaneous requests, ten orders win the last unit and twenty are
       * refused. A product with forty in stock would just succeed thirty
       * times, which shows nothing.
       */
      if (body.data?.length && !selectedId) {
        const scarcest = body.data.reduce((lowest: Product, product: Product) =>
          product.stock < lowest.stock ? product : lowest,
        );
        setSelectedId(scarcest.id);
      }
      return loaded;
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? `The products could not be loaded. ${error.message}`
          : 'The products could not be loaded.',
      );
      return [];
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch(`${BASE}/api/orders`, {
        headers: {
          Accept: 'application/json',
          'X-Demo-Customer': customerId.current,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) return;
      const body = await response.json();
      setOrders(body.data ?? []);
    } catch {
      // The order list is a convenience; a failure here must not break the
      // demonstration.
    }
  }, []);

  useEffect(() => {
    void loadProducts();
    void loadOrders();
  }, [loadProducts, loadOrders]);

  /** Places one order and reports what happened. */
  const placeOrder = useCallback(
    async (
      index: number,
      label: string,
      productId: string,
      orderQuantity: number,
      idempotencyKey: string,
      signal: AbortSignal,
    ): Promise<Attempt> => {
      const started = performance.now();

      try {
        const response = await fetch(`${BASE}/api/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Idempotency-Key': idempotencyKey,
            'X-Demo-Customer': customerId.current,
          },
          body: JSON.stringify({ productId, quantity: orderQuantity }),
          signal,
        });

        const durationMs = Math.round(performance.now() - started);
        const body = await response.json().catch(() => ({}));

        if (response.status === 201) {
          return {
            index,
            label,
            status: 201,
            outcome: 'created',
            orderId: body.id,
            durationMs,
          };
        }
        if (response.status === 200) {
          return {
            index,
            label,
            status: 200,
            outcome: 'replayed',
            orderId: body.id,
            durationMs,
          };
        }
        if (response.status === 409) {
          const message: string = body?.error?.message ?? '';
          const outcome: Attempt['outcome'] = /stock/i.test(message)
            ? 'sold-out'
            : 'conflict';
          return { index, label, status: 409, outcome, durationMs, message };
        }

        return {
          index,
          label,
          status: response.status,
          outcome: 'error',
          durationMs,
          message: body?.error?.message,
        };
      } catch (error) {
        const durationMs = Math.round(performance.now() - started);
        const aborted =
          error instanceof DOMException && error.name === 'AbortError';
        return {
          index,
          label,
          status: 'failed',
          outcome: aborted ? 'cancelled' : 'error',
          durationMs,
          message: aborted
            ? 'Cancelled.'
            : error instanceof Error
              ? error.message
              : 'The request failed.',
        };
      }
    },
    [],
  );

  /**
   * Fires N simultaneous requests for the same product.
   *
   * Each request uses its OWN idempotency key, because these are N distinct
   * logical orders. The point is the stock: only as many as there is stock
   * should succeed.
   */
  const runStorm = useCallback(async () => {
    if (!selectedId || running) return;

    setRunning(true);
    setAttempts([]);
    setSummary(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const product = products.find((p) => p.id === selectedId);
    const before = product?.stock ?? 0;
    const count = Math.max(1, Math.min(100, concurrency));

    setLiveAttempts([]);
    setProgress({ settled: 0, total: count });

    const results = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        placeOrder(
          i,
          `#${i + 1}`,
          selectedId,
          quantity,
          `storm-${Date.now()}-${i}`,
          controller.signal,
        ).then((result) => {
          // Each request reports itself the moment it lands.
          setLiveAttempts((previous) => [...previous, result]);
          setProgress((previous) => ({
            settled: (previous?.settled ?? 0) + 1,
            total: count,
          }));
          return result;
        }),
      ),
    );

    setAttempts(results);
    setProgress(null);

    const created = results.filter((r) => r.outcome === 'created').length;
    const soldOut = results.filter((r) => r.outcome === 'sold-out').length;
    const other = results.length - created - soldOut;

    const after = (await loadProducts()).find((p) => p.id === selectedId)?.stock;
    await loadOrders();

    setSummary(
      `${count} simultaneous requests for ${quantity} unit${quantity === 1 ? '' : 's'} each. ` +
        `${created} order${created === 1 ? '' : 's'} created, ${soldOut} refused as sold out` +
        (other > 0 ? `, ${other} other` : '') +
        `. Stock ${before} → ${after ?? '?'}.`,
    );

    setRunning(false);
    abortRef.current = null;
  }, [selectedId, running, concurrency, quantity, products, placeOrder, loadProducts, loadOrders]);

  /**
   * Places one order and then retries it, with the SAME key and the SAME
   * payload — the case the brief calls out.
   */
  const runRetry = useCallback(async () => {
    if (!selectedId || running) return;

    setRunning(true);
    setAttempts([]);
    setLiveAttempts([]);
    setProgress(null);
    setSummary(null);

    const controller = new AbortController();
    abortRef.current = controller;

    // One key, one payload. The first call creates the order; the second is
    // the retry.
    const key = `retry-${Date.now()}`;
    const first = await placeOrder(0, 'first request', selectedId, quantity, key, controller.signal);
    const second = await placeOrder(1, 'retry, same key', selectedId, quantity, key, controller.signal);

    setAttempts([first, second]);
    await loadProducts();
    await loadOrders();

    setSummary(
      first.outcome === 'created' && second.outcome === 'replayed'
        ? 'The retry returned the original order. One order, one decrement — no duplicate.'
        : first.outcome === 'created' && second.outcome === 'conflict'
          ? 'The retry was refused: the key was reused for a different order.'
          : 'See the results below.',
    );

    setRunning(false);
    abortRef.current = null;
  }, [selectedId, running, quantity, placeOrder, loadProducts, loadOrders]);

  /**
   * Reuses the same key with a DIFFERENT payload — the conflict case.
   */
  const runConflict = useCallback(async () => {
    if (!selectedId || running) return;

    setRunning(true);
    setAttempts([]);
    setLiveAttempts([]);
    setProgress(null);
    setSummary(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const key = `conflict-${Date.now()}`;
    const first = await placeOrder(0, 'first request', selectedId, 1, key, controller.signal);
    const second = await placeOrder(
      1,
      'same key, different quantity',
      selectedId,
      Math.max(1, quantity),
      key,
      controller.signal,
    );

    setAttempts([first, second]);
    await loadProducts();
    await loadOrders();

    setSummary(
      second.outcome === 'conflict'
        ? 'The second request was refused with a conflict. The key identifies one logical order, so reusing it for a different one is an error.'
        : 'See the results below.',
    );

    setRunning(false);
    abortRef.current = null;
  }, [selectedId, running, quantity, placeOrder, loadProducts, loadOrders]);

  const resetDemo = useCallback(async () => {
    setRunning(true);
    try {
      await fetch(`${BASE}/api/demo/reset`, { method: 'POST' });
      await loadProducts();
      await loadOrders();
      setAttempts([]);
      setSummary('The demo stock was restored.');
    } finally {
      setRunning(false);
    }
  }, [loadProducts, loadOrders]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const selected = products.find((p) => p.id === selectedId);

  return (
    <div className="space-y-5">
      {/* The service */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
        <div>
          <p className="text-sm font-medium">Flash Sale API</p>
          <p className="mt-0.5 font-mono text-xs text-text-muted">{BASE}</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <a
            href={`${BASE}/docs`}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-accent hover:underline"
          >
            Open Swagger ↗
          </a>
          <button
            type="button"
            onClick={resetDemo}
            disabled={running}
            className="rounded-md border border-border px-2.5 py-1 text-text-muted transition-colors hover:border-border-strong hover:text-text disabled:opacity-60"
          >
            Reset demo stock
          </button>
        </div>
      </div>

      {loadError && (
        <p className="rounded-lg border border-danger/40 bg-danger-muted p-4 text-sm text-danger">
          {loadError}
        </p>
      )}

      {/* The products */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-subtle">
          Products, with their live stock
        </p>
        {loading ? (
          <div className="rounded-xl border border-border bg-surface p-4">
            <PendingState
              title="Loading the products…"
              detail="Reading the live stock from the Flash Sale API."
            />
            {/* The shape of what is coming, so the wait is not a surprise. */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-hidden="true">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="rounded-lg border border-border p-3">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="mt-2 h-2.5 w-1/3" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {products.map((product) => {
              const isSelected = product.id === selectedId;
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(product.id)}
                    aria-pressed={isSelected}
                    className={[
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      isSelected
                        ? 'border-accent bg-accent-muted'
                        : 'border-border hover:border-border-strong',
                    ].join(' ')}
                  >
                    <span className="block text-sm font-medium">{product.name}</span>
                    <span className="mt-1 block font-mono text-xs text-text-muted">
                      {product.stock} in stock · €{(product.priceCents / 100).toFixed(2)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* The controls */}
      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap gap-4">
          <label className="text-xs">
            <span className="mb-1 block text-text-subtle">Quantity each</span>
            <input
              type="number"
              min={1}
              max={100}
              value={quantity}
              onChange={(event) =>
                setQuantity(Math.max(1, Math.min(100, Number(event.target.value) || 1)))
              }
              className="w-20 rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm text-text focus-visible:border-accent"
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block text-text-subtle">Simultaneous requests</span>
            <input
              type="number"
              min={1}
              max={100}
              value={concurrency}
              onChange={(event) =>
                setConcurrency(Math.max(1, Math.min(100, Number(event.target.value) || 1)))
              }
              className="w-20 rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm text-text focus-visible:border-accent"
            />
          </label>
        </div>

        <p className="text-xs text-text-subtle">
          {selected
            ? `Ordering ${quantity} × ${selected.name}. ${selected.stock} in stock.`
            : 'Choose a product.'}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runStorm}
            disabled={running || !selectedId}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-accent-strong disabled:opacity-60"
          >
            {running ? 'Running…' : 'Fire simultaneous orders'}
          </button>
          <button
            type="button"
            onClick={runRetry}
            disabled={running || !selectedId}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text disabled:opacity-60"
          >
            Retry the same order
          </button>
          <button
            type="button"
            onClick={runConflict}
            disabled={running || !selectedId}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text disabled:opacity-60"
          >
            Reuse the key, change the order
          </button>
          {running && (
            <button
              type="button"
              onClick={stop}
              className="rounded-lg border border-danger/40 px-4 py-2 text-sm text-danger"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {/* The results */}
      {summary && (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
          {summary}
        </p>
      )}

      {/* The live progress, while a batch is running. */}
      {running && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <PendingState
            title={
              progress
                ? `${progress.settled} of ${progress.total} requests answered`
                : 'Working…'
            }
            detail="Each request is independent. The rows appear as they come back, and the stock is only updated by the requests that win."
            onCancel={stop}
            cancelLabel="Stop the batch"
          />
          {progress && progress.total > 0 && (
            <div
              aria-hidden="true"
              className="mt-3 h-1 overflow-hidden rounded-full bg-surface-elevated"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200"
                style={{
                  width: `${Math.round((progress.settled / progress.total) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {(attempts.length > 0 || liveAttempts.length > 0) && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-subtle">
            Results
            {running && ' — live'}
          </p>
          <div className="max-h-72 overflow-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-xs uppercase tracking-wide text-text-subtle">
                  <th className="px-3 py-2 font-medium">Request</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Outcome</th>
                  <th className="px-3 py-2 text-right font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {(running ? liveAttempts : attempts).map((attempt) => (
                  <tr key={attempt.index} className="border-t border-border/60">
                    <td className="px-3 py-1.5 font-mono text-xs">{attempt.label}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{attempt.status}</td>
                    <td
                      className={`px-3 py-1.5 text-xs ${outcomeColour[attempt.outcome]}`}
                      title={attempt.message}
                    >
                      {outcomeLabel[attempt.outcome]}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs text-text-subtle">
                      {attempt.durationMs} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* The orders, read back from the API */}
      {orders.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-subtle">
            Orders placed from this browser
          </p>
          <ul className="space-y-1">
            {orders.map((order) => {
              const o = order as {
                id: string;
                quantity: number;
                totalPriceCents: number;
                idempotencyKey: string;
                createdAt: string;
              };
              return (
                <li
                  key={o.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  <span>
                    {o.quantity} ×{' '}
                    <span className="font-mono text-xs text-text-muted">
                      {o.idempotencyKey}
                    </span>
                  </span>
                  <span className="font-mono text-xs text-text-muted">
                    €{(o.totalPriceCents / 100).toFixed(2)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
