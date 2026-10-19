import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import TaskPage from '@/pages/TaskPage';
import { TASK_CONTENT } from '@/data/taskContent';
import { TASKS } from '@/data/tasks';

const renderAt = (slug: string) =>
  render(
    <MemoryRouter initialEntries={[`/tasks/${slug}`]}>
      <Routes>
        <Route path="/tasks/:slug" element={<TaskPage />} />
      </Routes>
    </MemoryRouter>,
  );

/** Slugs that have finished content sections wired up. */
const IMPLEMENTED = Object.keys(TASK_CONTENT);

describe('TaskPage content sections', () => {
  it.each(IMPLEMENTED)('%s renders the full write-up', (slug) => {
    renderAt(slug);
    expect(screen.getByRole('heading', { name: /how it works/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /complexity/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /validation and edge cases/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^tests$/i })).toBeInTheDocument();
  });

  it.each(IMPLEMENTED)('%s shows its real test count', (slug) => {
    renderAt(slug);
    const count = TASK_CONTENT[slug].tests.total;
    expect(screen.getByText(new RegExp(`\\b${count} tests\\b`))).toBeInTheDocument();
  });

  it('shows an honest placeholder for tasks without content yet', () => {
    const notDone = TASKS.find((t) => !TASK_CONTENT[t.slug]);
    expect(notDone).toBeDefined();
    renderAt(notDone!.slug);
    expect(screen.getByText(/added when it is implemented/i)).toBeInTheDocument();
  });

  it('embeds the calculator as an iframe pointing at the static demo', () => {
    renderAt('calculator');
    const frame = screen.getByTitle('calculator demo');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', '/demos/calculator/index.html');
  });

  it('offers a standalone link for the vanilla demos', () => {
    renderAt('calculator');
    expect(screen.getByRole('link', { name: /open standalone/i })).toHaveAttribute(
      'href',
      '/demos/calculator/index.html',
    );
  });

  it('renders the binary string and missing positive demos inline', () => {
    const { unmount } = renderAt('binary-string');
    expect(screen.getByLabelText(/array of binary strings/i)).toBeInTheDocument();
    unmount();

    renderAt('missing-positive');
    expect(screen.getByLabelText(/unsorted integer array/i)).toBeInTheDocument();
  });

  it('shows a 404 page for an unknown slug', () => {
    renderAt('does-not-exist');
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });
});