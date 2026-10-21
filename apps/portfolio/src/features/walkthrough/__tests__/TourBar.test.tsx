import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { WalkthroughProvider } from '@/features/walkthrough/WalkthroughContext';
import TourBar from '@/features/walkthrough/TourBar';
import TourButton from '@/features/walkthrough/TourButton';

/**
 * The guided tour.
 *
 * It used to be a card in the corner of every page, and then a spotlight
 * that dimmed the page and cut a hole over the thing it was talking about.
 * Both took the page away from the visitor. It is now a strip under the
 * header, and the page stays exactly as it was.
 *
 * The behaviour that matters:
 *
 *   - it is NOT on screen until it is asked for
 *   - it opens from one button
 *   - it moves between steps
 *   - it can be closed, and opened again
 *   - it remembers where it got to
 */

const TestApp = () => (
  <WalkthroughProvider>
    <MemoryRouter initialEntries={['/tasks/auth']}>
      <TourButton />
      <Routes>
        <Route path="/tasks/:slug" element={<h1>The challenge page</h1>} />
        <Route path="/tasks" element={<h1>Challenges</h1>} />
      </Routes>
      <TourBar />
    </MemoryRouter>
  </WalkthroughProvider>
);

beforeEach(() => {
  window.localStorage.clear();
});

describe('the tour strip', () => {
  it('is not on screen until it is asked for', () => {
    render(<TestApp />);

    expect(screen.queryByRole('region', { name: /guided walkthrough/i })).toBeNull();
    expect(screen.getByRole('button', { name: /tour/i })).toBeInTheDocument();
  });

  it('opens from the header button', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await user.click(screen.getByRole('button', { name: /tour/i }));

    const bar = await screen.findByRole('region', { name: /guided walkthrough/i });
    expect(within(bar).getByText(/step 1\/7/i)).toBeInTheDocument();
    expect(within(bar).getByText('Get a token')).toBeInTheDocument();
  });

  it('does not cover the page', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await user.click(screen.getByRole('button', { name: /tour/i }));

    const bar = await screen.findByRole('region', { name: /guided walkthrough/i });
    // A strip, not a modal: it is not a dialog, and it does not lock the
    // page behind it.
    expect(bar).not.toHaveAttribute('aria-modal');
    expect(screen.queryByRole('dialog')).toBeNull();
    // The rest of the page is still there and still reachable.
    expect(screen.getByRole('heading', { name: 'The challenge page' })).toBeInTheDocument();
  });

  it('closes with the close button', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await user.click(screen.getByRole('button', { name: /tour/i }));
    await screen.findByRole('region', { name: /guided walkthrough/i });

    await user.click(screen.getByRole('button', { name: /close the guided walkthrough/i }));

    await waitFor(() =>
      expect(screen.queryByRole('region', { name: /guided walkthrough/i })).toBeNull(),
    );
  });

  it('can be opened again after it is closed', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await user.click(screen.getByRole('button', { name: /tour/i }));
    await screen.findByRole('region', { name: /guided walkthrough/i });
    await user.click(screen.getByRole('button', { name: /close the guided walkthrough/i }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: /guided walkthrough/i })).toBeNull(),
    );

    await user.click(screen.getByRole('button', { name: /tour/i }));
    expect(await screen.findByRole('region', { name: /guided walkthrough/i })).toBeInTheDocument();
  });

  it('moves to the next step', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await user.click(screen.getByRole('button', { name: /tour/i }));
    const bar = await screen.findByRole('region', { name: /guided walkthrough/i });

    await user.click(within(bar).getByRole('button', { name: /^next$/i }));

    await waitFor(() => expect(within(bar).getByText(/step 2\/7/i)).toBeInTheDocument());
    expect(within(bar).getByText('File a lost item with that token')).toBeInTheDocument();
  });

  it('goes back', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await user.click(screen.getByRole('button', { name: /tour/i }));
    const bar = await screen.findByRole('region', { name: /guided walkthrough/i });

    await user.click(within(bar).getByRole('button', { name: /^next$/i }));
    await waitFor(() => expect(within(bar).getByText(/step 2\/7/i)).toBeInTheDocument());

    await user.click(within(bar).getByRole('button', { name: /back/i }));
    await waitFor(() => expect(within(bar).getByText(/step 1\/7/i)).toBeInTheDocument());
  });

  it('links to the page the step is about', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await user.click(screen.getByRole('button', { name: /tour/i }));
    const bar = await screen.findByRole('region', { name: /guided walkthrough/i });

    const link = within(bar).getByRole('link', { name: /open the authentication api/i });
    expect(link).toHaveAttribute('href', '/tasks/auth');
  });

  it('remembers where it got to', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TestApp />);

    await user.click(screen.getByRole('button', { name: /tour/i }));
    const bar = await screen.findByRole('region', { name: /guided walkthrough/i });
    await user.click(within(bar).getByRole('button', { name: /^next$/i }));

    await waitFor(() =>
      expect(window.localStorage.getItem('gip-walkthrough-step')).toBe('1'),
    );

    unmount();

    // A return visit picks up at the same step.
    render(<TestApp />);
    await user.click(screen.getByRole('button', { name: /tour/i }));

    const resumed = await screen.findByRole('region', { name: /guided walkthrough/i });
    expect(within(resumed).getByText(/step 2\/7/i)).toBeInTheDocument();
  });
});
