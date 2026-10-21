import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import ChallengeVisual from '@/components/ChallengeVisual';
import CodeSnippet from '@/components/CodeSnippet';
import LiveTerminal from '@/components/LiveTerminal';

/**
 * The visual work.
 *
 * The site was almost entirely text, so these three are what give it
 * something to look at: a picture per challenge, the real code, and a
 * terminal that makes real requests.
 */

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

describe('the challenge visual', () => {
  it('renders one for every challenge', () => {
    const slugs = [
      'lost-found',
      'calculator',
      'binary-string',
      'autocomplete',
      'auth',
      'missing-positive',
      'flash-sale',
    ];

    for (const slug of slugs) {
      const { container, unmount } = render(<ChallengeVisual id={slug} />);
      expect(container.firstChild).not.toBeNull();
      expect(container.textContent?.trim().length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('is decorative, so a screen reader skips it', () => {
    const { container } = render(<ChallengeVisual id="flash-sale" />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders nothing for a challenge with no visual', () => {
    const { container } = render(<ChallengeVisual id="nope" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the calculator working out the precedence', async () => {
    render(<ChallengeVisual id="calculator" />);
    // The expression is typed out and the result is 14, not 20. The
    // visual cycles, so the answer takes a moment to come round.
    expect(await screen.findByText('14', {}, { timeout: 4_000 })).toBeInTheDocument();
  });

  it('shows the flash sale stock counting down', () => {
    render(<ChallengeVisual id="flash-sale" />);
    expect(screen.getByText(/left/)).toBeInTheDocument();
  });
});

describe('the code snippet', () => {
  const source = `const user = request.user!;
if (report.ownerId !== user.id) {
  throw forbidden('Only the owner may change it.');
}`;

  it('shows the code', () => {
    render(<CodeSnippet code={source} file="items.ts" />);
    expect(screen.getByText('items.ts')).toBeInTheDocument();
    expect(screen.getByText(/ownerId/)).toBeInTheDocument();
  });

  it('copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<CodeSnippet code={source} />);

    // userEvent.setup() installs its own clipboard stub, which would
    // swallow the call, so the click is fired directly.
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(source));
  });
});

describe('the live terminal', () => {
  it('makes a real request and shows the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ name: 'Aurora Desk Lamp', stock: 25 }] }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<LiveTerminal />);

    // The command is typed out first.
    expect(await screen.findByText(/curl/)).toBeInTheDocument();

    // Then the real response arrives. The command is typed first, so this
    // takes a moment.
    expect(await screen.findByText(/Aurora Desk Lamp/, {}, { timeout: 5_000 })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('says so honestly when the service does not answer', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    render(<LiveTerminal />);

    expect(await screen.findByText(/did not answer/i, {}, { timeout: 5_000 })).toBeInTheDocument();
  });
});
