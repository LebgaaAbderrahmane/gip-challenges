import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ApiTester from '@/features/api-tester/ApiTester';
import type { ApiService } from '@/features/api-tester/types.ts';

const service: ApiService = {
  name: 'Test API',
  baseUrl: 'https://api.example.test',
  operations: [
    {
      id: 'list',
      label: 'List things',
      method: 'GET',
      path: '/api/things',
      requiresAuth: false,
      description: 'Lists the things.',
    },
    {
      id: 'create',
      label: 'Create a thing',
      method: 'POST',
      path: '/api/things',
      requiresAuth: true,
      body: { name: 'A thing' },
      description: 'Creates a thing.',
    },
  ],
};

/** A fetch that records the call and answers with a JSON body. */
const stubFetch = (
  body: unknown,
  init: { status?: number; ok?: boolean; statusText?: string } = {},
) => {
  const mock = vi.fn().mockResolvedValue({
    status: init.status ?? 200,
    ok: init.ok ?? true,
    statusText: init.statusText ?? 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify(body),
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ApiTester', () => {
  it('starts idle, with the send button enabled', () => {
    stubFetch({});
    render(<ApiTester service={service} />);

    const button = screen.getByRole('button', { name: /send request/i });
    expect(button).toBeEnabled();
    expect(screen.getByText(/press/i)).toBeInTheDocument();
  });

  it('sends a request to the service and shows the response', async () => {
    const user = userEvent.setup();
    const mock = stubFetch({ data: [{ id: '1' }] });

    render(<ApiTester service={service} />);
    await user.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => expect(screen.getByText(/200 OK/)).toBeInTheDocument());
    expect(mock).toHaveBeenCalledWith(
      'https://api.example.test/api/things',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(screen.getByText(/"id": "1"/)).toBeInTheDocument();
  });

  it('shows the status and the body of an error response', async () => {
    const user = userEvent.setup();
    stubFetch(
      { error: { code: 'NOT_FOUND', message: 'No such thing.' } },
      { status: 404, ok: false, statusText: 'Not Found' },
    );

    render(<ApiTester service={service} />);
    await user.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => expect(screen.getByText(/404 Not Found/)).toBeInTheDocument());
    expect(screen.getByText(/NOT_FOUND/)).toBeInTheDocument();
  });

  it('refuses to send an operation that needs a token, without one', async () => {
    const user = userEvent.setup();
    const mock = stubFetch({});

    render(<ApiTester service={service} />);
    await user.click(screen.getByRole('button', { name: /create a thing/i }));
    await user.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => expect(screen.getByText(/needs a bearer token/i)).toBeInTheDocument());
    expect(mock).not.toHaveBeenCalled();
  });

  it('sends the token when one is supplied', async () => {
    const user = userEvent.setup();
    const mock = stubFetch({ token: 'abc' });

    render(<ApiTester service={service} />);
    await user.click(screen.getByRole('button', { name: /create a thing/i }));

    const tokenField = screen.getByLabelText(/bearer token/i);
    await user.type(tokenField, 'a-token');
    await user.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => expect(mock).toHaveBeenCalled());
    expect(mock.mock.calls[0][1].headers.Authorization).toBe('Bearer a-token');
    expect(mock.mock.calls[0][1].method).toBe('POST');
  });

  it('explains a network failure as a failure to reach the service', async () => {
    const user = userEvent.setup();
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as never;

    render(<ApiTester service={service} />);
    await user.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() =>
      expect(screen.getByText(/did not reach/i)).toBeInTheDocument(),
    );
    // The CORS hint is the most common cause, so it is offered.
    expect(screen.getByText(/CORS/i)).toBeInTheDocument();
  });

  it('rejects a body that is not valid JSON, without sending it', async () => {
    const user = userEvent.setup();
    const mock = stubFetch({});

    render(<ApiTester service={service} />);
    await user.click(screen.getByRole('button', { name: /create a thing/i }));

    const area = screen.getByLabelText(/request body/i);
    await user.clear(area);
    await user.type(area, '{{not json');
    await user.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => expect(screen.getByText(/not valid JSON/i)).toBeInTheDocument());
    expect(mock).not.toHaveBeenCalled();
  });

  it('offers a copy of the request as curl', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    // navigator.clipboard is a read-only getter, so it is replaced rather
    // than assigned.
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    stubFetch({});
    render(<ApiTester service={service} />);
    await user.click(screen.getByRole('button', { name: /copy as curl/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain('curl -X GET');
    expect(writeText.mock.calls[0][0]).toContain('https://api.example.test/api/things');
  });
});
