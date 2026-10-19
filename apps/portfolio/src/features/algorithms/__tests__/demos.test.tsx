import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BinaryStringDemo from '../BinaryStringDemo';
import SmallestMissingPositiveDemo from '../SmallestMissingPositiveDemo';

describe('BinaryStringDemo', () => {
  it('renders a valid answer for the default input', () => {
    render(<BinaryStringDemo />);
    const status = screen.getByRole('status');
    // Default input is ["01", "10"] -> diagonal bits are "0","0" -> answer "11".
    expect(status).toHaveTextContent('11');
  });

  it('renders an error for malformed input without crashing', async () => {
    const user = userEvent.setup();
    render(<BinaryStringDemo />);

    const input = screen.getByLabelText(/array of binary strings/i);
    await user.clear(input);
    await user.type(input, '[["01", "1"]');

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/must have length 2/i);
  });

  it('loads an example when its button is pressed', async () => {
    const user = userEvent.setup();
    render(<BinaryStringDemo />);

    await user.click(screen.getByRole('button', { name: 'n = 1' }));
    expect(screen.getByLabelText(/array of binary strings/i)).toHaveValue('["0"]');
    expect(screen.getByRole('status')).toHaveTextContent('1');
  });
});

describe('SmallestMissingPositiveDemo', () => {
  it('solves the brief\'s worked example', () => {
    render(<SmallestMissingPositiveDemo />);
    expect(screen.getByRole('status')).toHaveTextContent('3');
  });

  it('handles an empty array', async () => {
    const user = userEvent.setup();
    render(<SmallestMissingPositiveDemo />);

    await user.click(screen.getByRole('button', { name: 'Empty' }));
    expect(screen.getByRole('status')).toHaveTextContent('1');
  });

  it('reports invalid input without crashing', async () => {
    const user = userEvent.setup();
    render(<SmallestMissingPositiveDemo />);

    const input = screen.getByLabelText(/unsorted integer array/i);
    await user.clear(input);
    await user.type(input, '[[1.5, 2]');

    expect(screen.getByRole('status')).toHaveTextContent(/not an integer/i);
  });
});