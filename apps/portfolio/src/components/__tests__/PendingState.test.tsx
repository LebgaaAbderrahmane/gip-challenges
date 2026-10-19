import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import PendingState from '@/components/PendingState';
import ApiTester from '@/features/api-tester/ApiTester';
import { SessionProvider } from '@/features/session/SessionContext';
import type { ApiService } from '@/features/api-tester/types.ts';

/**
 * The waiting states.
 *
 * A waiting state that says nothing is indistinguishable from a broken one.
 * These tests pin down that the wait is visible, that it counts, and that it
 * can be ended — which is the difference between "slow" and "stuck".
 */

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the pending state', () => {
  it('says what is being waited for', () => {
    render(<PendingState title="Waiting for the service…" detail="The request is on its way." />);

    expect(screen.getByText('Waiting for the service…')).toBeInTheDocument();
    expect(screen.getByText('The request is on its way.')).toBeInTheDocument();
  });

  it('counts the elapsed time', () => {
    render(<PendingState title="Waiting…" />);

    // The counter starts at zero and is shown with one decimal place.
    expect(screen.getByText('0.0s')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_500);
    });

    expect(screen.getByText('1.5s')).toBeInTheDocument();
  });

  it('warns when the wait goes on, and says why', () => {
    render(<PendingState title="Waiting…" slowAfterMs={1_000} />);

    act(() => {
      vi.advanceTimersByTime(1_200);
    });

    expect(screen.getByText(/taking a while/i)).toBeInTheDocument();
    expect(screen.getByText(/free-tier service may be waking up/i)).toBeInTheDocument();
  });

  it('offers a way out when one is given', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<PendingState title="Waiting…" onCancel={onCancel} cancelLabel="Cancel the request" />);

    await user.click(screen.getByRole('button', { name: 'Cancel the request' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('has no button when there is nothing to cancel', () => {
    render(<PendingState title="Waiting…" />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('the API tester while a request is running', () => {
  const service: ApiService = {
    name: 'Test API',
    baseUrl: 'https://test.example.test',
    operations: [
      {
        id: 'list',
        label: 'List items',
        method: 'GET',
        path: '/api/items',
        requiresAuth: false,
        description: 'Lists the items.',
      },
    ],
  };

  /**
   * A fetch that never answers on its own, but does honour the abort
   * signal — which is how a cancelled request ends.
   */
  const pendingFetch = () =>
    vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The request was aborted.', 'AbortError'));
          });
        }),
    );

  beforeEach(() => {
    globalThis.fetch = pendingFetch() as unknown as typeof fetch;
  });

  it('shows a live pending state with a cancel button', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <SessionProvider>
        <PendingStateHarness service={service} />
      </SessionProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Send request' }));

    expect(await screen.findByText('Waiting for the service…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel the request' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
  });

  it('reports a cancel as the visitor’s own doing', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <SessionProvider>
        <PendingStateHarness service={service} />
      </SessionProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Send request' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel the request' }));

    expect(await screen.findByText(/you cancelled the request/i)).toBeInTheDocument();
  });
});

/**
 * The tester needs a router, and the session, to render.
 */
function PendingStateHarness({ service }: { service: ApiService }) {
  return (
    <MemoryRouter>
      <ApiTester service={service} />
    </MemoryRouter>
  );
}
