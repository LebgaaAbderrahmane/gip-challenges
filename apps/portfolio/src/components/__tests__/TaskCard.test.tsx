import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import TaskCard from '@/components/TaskCard';
import { TASKS } from '@/data/tasks';

/**
 * The challenge cards use the "stretched link" pattern: the title is the
 * only real link, and a pseudo-element on it makes the whole card clickable.
 *
 * That only works if the card is positioned. An absolutely positioned
 * pseudo-element resolves against the nearest positioned ancestor, and a
 * static <article> left it resolving against <body> — so every card's
 * invisible hit area covered the entire page, and all seven stacked on top of
 * one another. Clicking anywhere navigated to whichever card was on top.
 */
describe('TaskCard', () => {
  const renderCard = (slug: string) => {
    const task = TASKS.find((t) => t.slug === slug)!;
    return render(
      <MemoryRouter>
        <TaskCard task={task} />
      </MemoryRouter>,
    );
  };

  it('links to the task route', () => {
    renderCard('flash-sale');
    expect(screen.getByRole('link', { name: 'Flash Sale API' })).toHaveAttribute(
      'href',
      '/tasks/flash-sale',
    );
  });

  it('positions the card, so the stretched link is scoped to it', () => {
    // The class is asserted rather than the computed style, because jsdom
    // does not process Tailwind's generated CSS. The layout itself is
    // verified in a real browser, where the overlay's offsetParent is the
    // card rather than <body>.
    const { container } = renderCard('calculator');
    const card = container.querySelector('article')!;
    expect(card.className.split(' ')).toContain('relative');
  });

  it('has exactly one link, so the card is not a nest of tab stops', () => {
    const { container } = renderCard('auth');
    expect(container.querySelectorAll('a')).toHaveLength(1);
  });

  it('shows the task identifier, category and highlight', () => {
    const { container } = renderCard('binary-string');
    expect(container.textContent).toContain('gip-03');
    expect(container.textContent).toContain('Algorithm');
    expect(container.textContent).toContain('Diagonal construction');
  });

  it('links every task to its own route', () => {
    for (const task of TASKS) {
      const { container, unmount } = render(
        <MemoryRouter>
          <TaskCard task={task} />
        </MemoryRouter>,
      );
      const link = container.querySelector('a')!;
      expect(link.getAttribute('href')).toBe(`/tasks/${task.slug}`);
      unmount();
    }
  });
});
