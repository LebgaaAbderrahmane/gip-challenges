import { useMemo, useState } from 'react';

import { firstMissingPositive } from './smallestMissingPositive';

const EXAMPLES: { label: string; input: string }[] = [
  { label: "Brief's example", input: '[0, -2, 1, 2]' },
  { label: 'Consecutive', input: '[1, 2, 3]' },
  { label: 'Gap at start', input: '[7, 8, 9, 11, 12]' },
  { label: 'Duplicates', input: '[1, 1]' },
  { label: 'Empty', input: '[]' },
  { label: 'All negative', input: '[-1, -2]' },
];

function parseInput(raw: string): number[] {
  const trimmed = raw.trim();
  if (trimmed === '') return [];

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error('Input must be an array.');
    return parsed.map((v) => {
      const n = Number(v);
      if (!Number.isInteger(n)) throw new Error(`"${String(v)}" is not an integer.`);
      return n;
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('is not an integer')) throw error;
    // Loose fallback: 0 -2 1 2   /  0, -2, 1, 2
    const parts = trimmed
      .replace(/^\[/, '')
      .replace(/]$/, '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length === 0) return [];
    return parts.map((p) => {
      const n = Number(p);
      if (!Number.isInteger(n)) throw new Error(`"${p}" is not an integer.`);
      return n;
    });
  }
}

export default function SmallestMissingPositiveDemo() {
  const [raw, setRaw] = useState('[0, -2, 1, 2]');

  const result = useMemo(() => {
    try {
      const nums = parseInput(raw);
      const before = [...nums];
      const answer = firstMissingPositive([...nums]);
      return {
        state: 'ok' as const,
        answer,
        before,
        after: nums,
        mutated: before.join() !== nums.join(),
      };
    } catch (error) {
      return {
        state: 'error' as const,
        message: error instanceof Error ? error.message : 'Invalid input.',
      };
    }
  }, [raw]);

  return (
    <div>
      <label htmlFor="smp-input" className="block text-sm font-medium">
        Input — an unsorted integer array
      </label>
      <input
        id="smp-input"
        type="text"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        spellCheck={false}
        placeholder="[0, -2, 1, 2]"
        aria-describedby="smp-help smp-result"
        className="mt-2 w-full rounded-lg border border-border bg-surface p-3 font-mono text-sm focus-visible:border-accent"
      />
      <p id="smp-help" className="mt-1 text-xs text-text-subtle">
        JSON array or a plain list. Integers only. An empty array returns 1.
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
        id="smp-result"
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
            <p className="text-sm text-text-muted">Smallest positive integer not present</p>
            <p className="mt-1 font-mono text-2xl text-accent">{result.answer}</p>

            {result.answer >= 1 && result.answer <= result.before.length && (
              <p className="mt-2 text-xs text-text-subtle">
                It would belong at index {result.answer - 1} (0-based), which is the first
                position not holding its own value.
              </p>
            )}

            {result.mutated && (
              <p className="mt-4 border-t border-border pt-3 text-xs text-text-subtle">
                The algorithm reorders its argument in place to stay in O(1) space. The page
                keeps a copy so your input stays readable:
                <span className="mt-1 block font-mono text-text-muted">
                  before [{result.before.join(', ')}] → after [{result.after.join(', ')}]
                </span>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}