import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import DemoFrame from '@/components/DemoFrame';

/**
 * The demo is embedded so its framework-free implementation stays untouched.
 * These tests cover the two problems that embedding created:
 * the visitor scrolling inside a frame, and keys not reaching the demo.
 */
describe('DemoFrame', () => {
  it('renders an iframe pointing at the static demo', () => {
    render(<DemoFrame name="calculator" src="/demos/calculator/index.html" />);
    const frame = screen.getByTitle('calculator demo');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', '/demos/calculator/index.html');
  });

  it('labels the frame for assistive technology', () => {
    render(<DemoFrame name="autocomplete" src="/demos/autocomplete/index.html" />);
    expect(screen.getByTitle('autocomplete demo')).toBeInTheDocument();
  });

  it('offers a standalone link, so the demo can be opened without the frame', () => {
    render(<DemoFrame name="calculator" src="/demos/calculator/index.html" />);
    expect(screen.getByRole('link', { name: /open standalone/i })).toHaveAttribute(
      'href',
      '/demos/calculator/index.html',
    );
  });

  it('offers a manual reload control', async () => {
    const user = await import('@testing-library/user-event').then((m) => m.default.setup());
    render(<DemoFrame name="calculator" src="/demos/calculator/index.html" />);
    const frame = screen.getByTitle('calculator demo');

    await user.click(screen.getByRole('button', { name: /reload/i }));

    // Reloading remounts the frame, so the element identity changes.
    await waitFor(() => {
      expect(screen.getByTitle('calculator demo')).not.toBe(frame);
    });
  });

  it('focuses the frame on load so typing works without clicking first', async () => {
    render(<DemoFrame name="calculator" src="/demos/calculator/index.html" />);
    const frame = screen.getByTitle('calculator demo');

    // jsdom does not load iframe content, so fire the load event manually.
    frame.dispatchEvent(new Event('load'));

    await waitFor(() => {
      expect(document.activeElement).toBe(frame);
    });
  });

  it('starts at the provided height before the content is measured', () => {
    render(<DemoFrame name="calculator" src="/demos/calculator/index.html" height={420} />);
    expect(screen.getByTitle('calculator demo')).toHaveAttribute('height', '420');
  });
});