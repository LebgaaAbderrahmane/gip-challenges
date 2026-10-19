import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import FlashSaleLab from '../FlashSaleLab';

/**
 * The Lab shows API-backed numbers, so the tests stub the API and check that
 * what is displayed comes from the responses.
 */

const PRODUCTS = [
  { id: 'p-1', name: 'Limited Edition Field Watch', priceCents: 39_900, stock: 10 },
  { id: 'p-2', name: 'Aurora Desk Lamp', priceCents: 4_900, stock: 25 },
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    // A fetch without a method is a GET. Comparing against the literal
    // 'GET' made a plain GET fall through and return a 404.
    const method = init?.method ?? 'GET';
    if (String(url).includes('/api/products') && method === 'GET') {
      return jsonResponse({ data: PRODUCTS });
    }
    if (String(url).includes('/api/orders') && method === 'GET') {
      return jsonResponse({ data: [] });
    }
    if (String(url).includes('/api/orders') && init?.method === 'POST') {
      return jsonResponse(
        { id: 'order-1', quantity: 1, totalPriceCents: 39_900, idempotencyKey: 'k', createdAt: '' },
        201,
      );
    }
    if (String(url).includes('/api/demo/reset')) {
      return jsonResponse({ restored: [], count: 0 });
    }
    return jsonResponse({ error: { code: 'NOT_FOUND', message: 'no' } }, 404);
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

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

describe('FlashSaleLab', () => {
  it('shows the products and their stock, from the API', async () => {
    render(<FlashSaleLab />);

    await waitFor(() =>
      expect(screen.getByText('Limited Edition Field Watch')).toBeInTheDocument(),
    );
    expect(screen.getAllByText(/10 in stock/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/€399\.00/).length).toBeGreaterThan(0);
  });

  it('fires the requested number of simultaneous orders, each with its own key', async () => {
    const user = userEvent.setup();
    render(<FlashSaleLab />);
    await waitFor(() => expect(screen.getByText('Aurora Desk Lamp')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/simultaneous requests/i), {
      target: { value: '5' },
    });

    await user.click(screen.getByRole('button', { name: /fire simultaneous orders/i }));

    await waitFor(() => expect(screen.getByText(/simultaneous requests for/i)).toBeInTheDocument());

    const posts = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(posts).toHaveLength(5);

    // Each is a distinct logical order, so each has its own key.
    const keys = posts.map(
      ([, init]) => (init as RequestInit & { headers: Record<string, string> }).headers[
        'Idempotency-Key'
      ],
    );
    expect(new Set(keys).size).toBe(5);
  });

  it('sends the Idempotency-Key header, and the demo customer', async () => {
    const user = userEvent.setup();
    render(<FlashSaleLab />);
    await waitFor(() => expect(screen.getByText('Aurora Desk Lamp')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /fire simultaneous orders/i }));

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(0));

    const post = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    )!;
    const headers = (post[1] as RequestInit & { headers: Record<string, string> }).headers;

    expect(headers['Idempotency-Key']).toBeTruthy();
    expect(headers['X-Demo-Customer']).toMatch(/^demo_lab_/);
  });

  it('reports how many succeeded and how many were sold out', async () => {
    const user = userEvent.setup();

    // One succeeds, the rest are told the product is sold out.
    let post = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/api/orders') && init?.method === 'POST') {
        post += 1;
        if (post === 1) {
          return jsonResponse({ id: 'o1', quantity: 1, totalPriceCents: 100, idempotencyKey: 'k', createdAt: '' }, 201);
        }
        return jsonResponse(
          { error: { code: 'CONFLICT', message: 'There is not enough stock for that quantity.' } },
          409,
        );
      }
      if (String(url).includes('/api/products') && (init?.method ?? 'GET') === 'GET') {
        return jsonResponse({ data: PRODUCTS });
      }
      return jsonResponse({ data: [] });
    });

    render(<FlashSaleLab />);
    await waitFor(() => expect(screen.getByText('Aurora Desk Lamp')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/simultaneous requests/i), {
      target: { value: '3' },
    });

    await user.click(screen.getByRole('button', { name: /fire simultaneous orders/i }));

    // "Order created" appears in the summary and in the results table, so the
    // matchers are scoped rather than exact.
    await waitFor(() =>
      expect(screen.getAllByText(/order created/i).length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText(/sold out/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 order created, 2 refused as sold out/)).toBeInTheDocument();
  });

  it('distinguishes a replay from a new order', async () => {
    const user = userEvent.setup();

    let post = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/api/orders') && init?.method === 'POST') {
        post += 1;
        if (post === 1) {
          return jsonResponse({ id: 'o1', quantity: 1, totalPriceCents: 100, idempotencyKey: 'k', createdAt: '' }, 201);
        }
        return jsonResponse({ id: 'o1', quantity: 1, totalPriceCents: 100, idempotencyKey: 'k', createdAt: '' }, 200);
      }
      if (String(url).includes('/api/products') && (init?.method ?? 'GET') === 'GET') {
        return jsonResponse({ data: PRODUCTS });
      }
      return jsonResponse({ data: [] });
    });

    render(<FlashSaleLab />);
    await waitFor(() => expect(screen.getByText('Aurora Desk Lamp')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /retry the same order/i }));

    await waitFor(() =>
      expect(screen.getAllByText(/order created/i).length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText(/replayed — the original order/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/one order, one decrement/i)).toBeInTheDocument();
  });

  it('says so when the products could not be loaded', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });

    render(<FlashSaleLab />);

    await waitFor(() =>
      expect(screen.getByText(/products could not be loaded/i)).toBeInTheDocument(),
    );
  });
});
