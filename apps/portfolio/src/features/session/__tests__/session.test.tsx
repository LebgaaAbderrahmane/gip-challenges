import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import ApiTester from '@/features/api-tester/ApiTester';
import { SessionProvider } from '@/features/session/SessionContext';
import type { ApiService } from '@/features/api-tester/types.ts';

/**
 * The shared session.
 *
 * The three services share one signing secret, so a token issued by the
 * Authentication API is accepted by the other two. The portfolio behaves the
 * same way: sign in once, and the token is used by every tester.
 *
 * The token is held in memory only. It is never written to storage, never put
 * in a URL, and never sent anywhere except the API being tested.
 */

const authService: ApiService = {
  name: 'Authentication API',
  baseUrl: 'https://auth.example.test',
  operations: [
    {
      id: 'login',
      label: 'Sign in',
      method: 'POST',
      path: '/api/auth/login',
      requiresAuth: false,
      body: { email: 'ada@example.test', password: 'a-strong-demo-password' },
      description: 'Exchanges credentials for a token.',
    },
  ],
};

const lostFoundService: ApiService = {
  name: 'Lost & Found API',
  baseUrl: 'https://lost-found.example.test',
  operations: [
    {
      id: 'create',
      label: 'Create a report',
      method: 'POST',
      path: '/api/items',
      requiresAuth: true,
      body: { title: 'A wallet' },
      description: 'Creates a report.',
    },
  ],
};

let fetchMock: ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200) {
  return {
    status,
    ok: status < 400,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes('/api/auth/login')) {
      return jsonResponse({
        token: 'a-issued-token',
        tokenType: 'Bearer',
        expiresIn: '15m',
        user: { id: 'user-1', email: 'ada@example.test' },
      });
    }
    return jsonResponse({ id: 'report-1', ownerId: 'user-1', title: 'A wallet' }, 201);
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('the shared session', () => {
  it('captures a token from a sign-in and offers it to the other services', async () => {
    const user = userEvent.setup();

    render(
      <SessionProvider>
        <MemoryRouter>
          <ApiTester service={authService} />
        </MemoryRouter>
      </SessionProvider>,
    );

    await user.click(screen.getByRole('button', { name: /send request/i }));
    await waitFor(() => expect(screen.getByText(/200 OK/)).toBeInTheDocument());

    // A "Copy token" button appears, because the response carried a token.
    expect(screen.getByRole('button', { name: /copy token/i })).toBeInTheDocument();
  });

  it('sends the session token on another service without it being pasted', async () => {
    render(
      <SessionProvider>
        <MemoryRouter>
          {/* The auth tester signs in. */}
          <ApiTester service={authService} />
          {/* The lost-and-found tester, same provider, same page. */}
          <ApiTester service={lostFoundService} />
        </MemoryRouter>
      </SessionProvider>,
    );

    // The panel whose heading is the service name.
    const panelFor = (name: string) => {
      const heading = screen.getByText(name);
      const panel = heading.closest('div.space-y-4');
      if (!panel) throw new Error(`no panel for ${name}`);
      return panel;
    };

    // Sign in on the first tester.
    const signInPanel = panelFor('Authentication API');
    const signInButton = [...signInPanel.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Send request'),
    )!;
    fireEvent.click(signInButton);

    await waitFor(() => expect(screen.getAllByText(/200 OK/).length).toBeGreaterThan(0));

    // The second tester now knows who is signed in.
    await waitFor(() =>
      expect(screen.getByText(/signed in as ada@example\.test/i)).toBeInTheDocument(),
    );

    // And it uses that token, without anything being pasted.
    const lostFoundPanel = panelFor('Lost & Found API');
    const createButton = [...lostFoundPanel.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Create a report'),
    )!;
    fireEvent.click(createButton);
    await waitFor(() => {
      const sendButton = [...lostFoundPanel.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Send request'),
      );
      expect(sendButton).toBeTruthy();
      fireEvent.click(sendButton!);
    });

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === 'POST' && String((init as RequestInit).body ?? '').includes('A wallet'),
      );
      expect(post).toBeTruthy();
      const headers = (post![1] as RequestInit & { headers: Record<string, string> }).headers;
      expect(headers.Authorization).toBe('Bearer a-issued-token');
    });
  });

  it('offers links to the other services when a token is available', async () => {
    const user = userEvent.setup();

    render(
      <SessionProvider>
        <MemoryRouter>
          <ApiTester service={authService} />
        </MemoryRouter>
      </SessionProvider>,
    );

    await user.click(screen.getByRole('button', { name: /send request/i }));
    await waitFor(() => expect(screen.getByText(/200 OK/)).toBeInTheDocument());

    expect(screen.getByRole('link', { name: /Lost & Found API/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Flash Sale API/ })).toBeInTheDocument();
  });

  it('never writes the token to storage', async () => {
    const user = userEvent.setup();

    render(
      <SessionProvider>
        <MemoryRouter>
          <ApiTester service={authService} />
        </MemoryRouter>
      </SessionProvider>,
    );

    await user.click(screen.getByRole('button', { name: /send request/i }));
    await waitFor(() => expect(screen.getByText(/200 OK/)).toBeInTheDocument());

    // The token is in memory and nowhere else.
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(document.cookie).not.toContain('a-issued-token');
  });
});
