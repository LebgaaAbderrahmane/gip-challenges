import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import ApiTester from '@/features/api-tester/ApiTester';
import { SessionProvider } from '@/features/session/SessionContext';
import type { ApiService } from '@/features/api-tester/types.ts';

/**
 * The blank page on navigation.
 *
 * Navigating between two challenge pages reused the same ApiTester instance,
 * so its state carried over: the selected operation belonged to the previous
 * service and matched nothing in the new one. The component then took an
 * early return that sat BELOW a hook, so it called one hook fewer than
 * before — and React reported "Rendered fewer hooks than expected", which
 * blanked the page until it was refreshed.
 *
 * Two things prevent it: the hook is above the early return, and the tester
 * is keyed by service so its state never survives a change of service.
 */

const lostFound: ApiService = {
  name: 'Lost & Found API',
  baseUrl: 'https://lost-found.example.test',
  operations: [
    { id: 'list', label: 'List reports', method: 'GET', path: '/api/items', requiresAuth: false, description: 'Lists.' },
  ],
};

const auth: ApiService = {
  name: 'Authentication API',
  baseUrl: 'https://auth.example.test',
  operations: [
    { id: 'login', label: 'Sign in', method: 'POST', path: '/api/auth/login', requiresAuth: false, description: 'Signs in.' },
  ],
};

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => ({
    status: 200,
    ok: true,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ data: [] }),
    text: async () => '{}',
  })) as unknown as typeof fetch;
});

describe('navigating between challenge pages', () => {
  /**
   * The tester is reused across a route change, so its props change while
   * the instance stays the same. If the hook count changed with the props,
   * React reports "Rendered fewer hooks than expected" and the page goes
   * blank until it is refreshed.
   *
   * The test rerenders with a different service — the transition that broke
   * it — and asserts React never logs the error.
   */
  const captureHookErrors = (run: () => void) => {
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(String(args[0]));
      originalError(...args);
    };
    try {
      run();
    } finally {
      console.error = originalError;
    }
    return errors.filter((error) => error.includes('fewer hooks'));
  };

  it('shows the new service after a change, with no hooks error', () => {
    const hookErrors = captureHookErrors(() => {
      const { rerender } = render(
        <SessionProvider>
          <MemoryRouter>
            {/* Keyed by service, exactly as the page does it. */}
            <ApiTester key={lostFound.name} service={lostFound} />
          </MemoryRouter>
        </SessionProvider>,
      );

      expect(screen.getByText('Lost & Found API')).toBeInTheDocument();

      rerender(
        <SessionProvider>
          <MemoryRouter>
            <ApiTester key={auth.name} service={auth} />
          </MemoryRouter>
        </SessionProvider>,
      );

      // The new service is shown, with ITS operation selected — not the
      // previous service's, which would have matched nothing.
      expect(screen.getByText('Authentication API')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    expect(hookErrors).toEqual([]);
  });

  it('keeps the hook count stable even without the key', () => {
    // Even if the key were removed, the hook order must not change, because
    // that is what React reported as "Rendered fewer hooks than expected".
    const hookErrors = captureHookErrors(() => {
      const { rerender } = render(
        <SessionProvider>
          <MemoryRouter>
            <ApiTester service={lostFound} />
          </MemoryRouter>
        </SessionProvider>,
      );

      rerender(
        <SessionProvider>
          <MemoryRouter>
            <ApiTester service={auth} />
          </MemoryRouter>
        </SessionProvider>,
      );

      // Without the key the stale selection matches nothing in the new
      // service, and the panel says so. What matters here is that the
      // component did not change its hook count on the way — that is what
      // React reported as "Rendered fewer hooks than expected".
      expect(screen.getByText(/no operations configured/i)).toBeInTheDocument();
    });

    expect(hookErrors).toEqual([]);
  });

  it('keeps the hook order stable when there are no operations', () => {
    const empty: ApiService = { name: 'Empty', baseUrl: 'https://empty.example.test', operations: [] };

    const hookErrors = captureHookErrors(() => {
      const { rerender } = render(
        <SessionProvider>
          <MemoryRouter>
            <ApiTester service={lostFound} />
          </MemoryRouter>
        </SessionProvider>,
      );

      rerender(
        <SessionProvider>
          <MemoryRouter>
            <ApiTester service={empty} />
          </MemoryRouter>
        </SessionProvider>,
      );

      expect(screen.getByText(/no operations configured/i)).toBeInTheDocument();
    });

    expect(hookErrors).toEqual([]);
  });
});
