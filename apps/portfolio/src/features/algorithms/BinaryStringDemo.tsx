import { useMemo, useState } from 'react';

import {
  findDifferentBinaryString,
  InvalidBinaryInputError,
  validateBinaryInput,
} from './binaryString';

const EXAMPLES: { label: string; input: string }[] = [
  { label: 'Worked example', input: '["01", "10"]' },
  { label: 'n = 1', input: '["0"]' },
  { label: 'n = 3', input: '["000", "011", "101"]' },
  { label: 'n = 4', input: '["0000", "1110", "0011", "1101"]' },
];

/** Parses user input into string[], accepting a JSON array or a loose list. */
function parseInput(raw: string): string[] {
  const trimmed = raw.trim();

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v));
  } catch {
    // Fall through to the loose parser below.
  }

  // Accept: 01 10   /  01, 10   /  ["01", "10"]
  const inner = trimmed.replace(/^\[/, '').replace(/]$/, '');
  const parts = inner
    .split(',')
    .map((p) => p.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);

  if (parts.length === 0) throw new Error('Enter at least one binary string.');
  return parts;
}

export default function BinaryStringDemo() {
  const [raw, setRaw] = useState('["01", "10"]');

  const result = useMemo(() => {
    try {
      const nums = parseInput(raw);
      validateBinaryInput(nums);
      const answer = findDifferentBinaryString(nums);
      return {
        state: 'ok' as const,
        answer,
        rows: nums.map((row, i) => ({
          row,
          diagonal: row[i],
          flipped: answer[i],
        })),
      };
    } catch (error) {
      return {
        state: 'error' as const,
        message: error instanceof Error ? error.message : 'Invalid input.',
        rows: [] as { row: string; diagonal: string; flipped: string }[],
      };
    }
  }, [raw]);

  return (
    <div>
      <label htmlFor="bs-input" className="block text-sm font-medium">
        Input — an array of binary strings
      </label>
      <textarea
        id="bs-input"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={3}
        spellCheck={false}
        placeholder='["01", "10"]'
        aria-describedby="bs-help bs-result"
        className="mt-2 w-full rounded-lg border border-border bg-surface p-3 font-mono text-sm focus-visible:border-accent"
      />
      <p id="bs-help" className="mt-1 text-xs text-text-subtle">
        JSON array, or a plain list. Must contain n strings, each of length n,
        using only <code>0</code> and <code>1</code>.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => setRaw(example.input)}
            className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:border-border-strong hover:bg-surface"
          >
            {example.label}
          </button>
        ))}
      </div>

      <div
        id="bs-result"
        role="status"
        aria-live="polite"
        className="mt-5 rounded-lg border border-border bg-surface p-4"
      >
        {result.state === 'error' ? (
          <p className="flex items-start gap-2 text-sm text-danger">
            <span aria-hidden="true">✕</span>
            <span>{result.message}</span>
          </p>
        ) : (
          <>
            <p className="text-sm text-text-muted">A binary string not present in the input</p>
            <p className="mt-1 font-mono text-2xl tracking-widest text-accent">
              {result.answer}
            </p>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(result.answer)}
              className="mt-3 rounded-md border border-border px-3 py-1 text-xs transition-colors hover:border-border-strong"
            >
              Copy result
            </button>

            {result.rows.length > 0 && (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[22rem] text-left font-mono text-sm">
                  <caption className="sr-only">
                    Diagonal construction: each input bit and the flipped result bit
                  </caption>
                  <thead>
                    <tr className="text-xs text-text-subtle">
                      <th scope="col" className="py-1 pr-4 font-normal">
                        i
                      </th>
                      <th scope="col" className="py-1 pr-4 font-normal">
                        nums[i]
                      </th>
                      <th scope="col" className="py-1 pr-4 font-normal">
                        nums[i][i]
                      </th>
                      <th scope="col" className="py-1 font-normal">
                        answer[i]
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map(({ row, diagonal, flipped }, i) => (
                      <tr key={i} className="border-t border-border/60">
                        <td className="py-1 pr-4 text-text-subtle">{i}</td>
                        <td className="py-1 pr-4">{row}</td>
                        <td className="py-1 pr-4 text-text-muted">{diagonal}</td>
                        <td className="py-1 font-semibold text-accent">{flipped}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export { InvalidBinaryInputError };