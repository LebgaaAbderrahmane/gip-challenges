import { useEffect, useState } from 'react';

/**
 * A small animated visual for each challenge.
 *
 * The site was almost entirely text, which made it dull to look at and
 * gave no hint of what a challenge actually does. Each of these is a tiny,
 * honest picture of the mechanism — the calculator really evaluates
 * `2 + 3 * 4`, the autocomplete really searches the supplied records, the
 * stock bar really counts down.
 *
 * They are CSS and a few numbers, not images, so they are sharp, tiny and
 * they respect the OS motion setting.
 */

type VisualId =
  | 'lost-found'
  | 'calculator'
  | 'binary-string'
  | 'autocomplete'
  | 'auth'
  | 'missing-positive'
  | 'flash-sale';

interface Props {
  id: string;
  className?: string;
}

/** Advances through `steps` positions, one every `ms`. */
function useCycle(steps: number, ms: number, initial = 0): number {
  const [index, setIndex] = useState(initial);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % steps), ms);
    return () => clearInterval(timer);
  }, [steps, ms]);

  return index % steps;
}

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/* ------------------------------------------------------------------ */
/* The seven visuals                                                    */
/* ------------------------------------------------------------------ */

function LostFoundVisual() {
  const step = useCycle(3, 1_400);
  const rows = [
    { title: 'Black leather wallet', status: 'open' },
    { title: 'Silver house keys', status: 'open' },
    { title: 'Blue backpack', status: 'recovered' },
  ];

  return (
    <div className="w-full space-y-1.5">
      {rows.map((row, index) => (
        <div
          key={row.title}
          className={`flex items-center gap-2 rounded-md border px-2 py-1.5 transition-all duration-500 ${
            index === step
              ? 'border-accent/40 bg-accent-muted'
              : 'border-border bg-bg/60'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              row.status === 'open' ? 'bg-accent' : 'bg-success'
            }`}
          />
          {/*
            The highlight is a COLOUR, not an opacity. Fading the text out
            reduces its contrast against the background, and an animation
            that makes the words harder to read is not a decoration.
          */}
          <span
            className={`truncate text-[11px] ${
              index === step ? 'text-text' : 'text-text-subtle'
            }`}
          >
            {row.title}
          </span>
          {/* The status follows the row's colour, because the subtle
              colour on the accent-tinted background is not quite enough
              contrast at this size. */}
          <span
            className={`ml-auto shrink-0 font-mono text-[10px] ${
              index === step ? 'text-text' : 'text-text-subtle'
            }`}
          >
            {row.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function CalculatorVisual() {
  // It starts mid-type rather than on an empty display, so the first frame
  // reads as a calculator working rather than as a broken box.
  const stage = useCycle(3, 1_100, 1);
  const typed = '2 + 3 * 4'.slice(0, stage === 0 ? 0 : stage === 1 ? 5 : 9);
  const result = stage === 2 ? '14' : '…';

  return (
    <div className="w-full rounded-md border border-border bg-bg/60 p-2.5">
      <p className="text-right font-mono text-sm text-text-muted">
        {typed}
        <span className="ml-1 animate-pulse text-accent">▌</span>
      </p>
      <p className="mt-1 border-t border-border/70 pt-1 text-right font-mono text-lg font-semibold text-accent">
        {result}
      </p>
    </div>
  );
}

function BinaryStringVisual() {
  const step = useCycle(4, 900);
  const rows = ['011', '101', '110'];
  const answer = '000';

  return (
    <div className="w-full space-y-1">
      {[...rows, answer].map((row, index) => {
        const isAnswer = index === 3;
        const isActive = index === step % 4;
        return (
          <div
            key={`${row}-${index}`}
            className={`flex items-center gap-2 rounded px-2 py-1 font-mono text-[11px] transition-all duration-500 ${
              isAnswer
                ? 'border border-accent/50 bg-accent-muted text-accent'
                : isActive
                  ? 'text-text'
                  : 'text-text-subtle'
            }`}
          >
            <span>{row}</span>
            {isAnswer && <span className="ml-auto text-[10px]">not in the input</span>}
          </div>
        );
      })}
    </div>
  );
}

function AutocompleteVisual() {
  // It starts mid-type, so the first frame shows a search rather than an
  // empty box.
  const stage = useCycle(3, 1_200, 1);
  const typed = 'land'.slice(0, stage === 0 ? 0 : stage === 1 ? 2 : 4);
  const results = stage >= 1 ? ['Iceland', 'Ireland', 'New Zealand'] : [];

  return (
    <div className="w-full">
      <p className="rounded-md border border-border bg-bg/60 px-2 py-1.5 font-mono text-[11px] text-text-muted">
        {typed}
        <span className="ml-0.5 animate-pulse text-accent">▌</span>
      </p>
      <div className="mt-1.5 space-y-1">
        {results.map((result, index) => (
          <p
            key={result}
            className={`rounded bg-surface-elevated/60 px-2 py-1 font-mono text-[11px] transition-colors duration-300 ${
              index === 0 ? 'text-text' : 'text-text-subtle'
            }`}
          >
            {result}
          </p>
        ))}
      </div>
    </div>
  );
}

function AuthVisual() {
  const step = useCycle(3, 1_300);
  const services = ['Auth', 'Lost & Found', 'Flash Sale'];
  const active = step % 3;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-1.5">
        {services.map((service, index) => (
          <div key={service} className="flex flex-1 flex-col items-center gap-1">
            <span
              className={`grid h-7 w-7 place-items-center rounded-md border text-[9px] font-semibold transition-all duration-500 ${
                index === active
                  ? 'border-accent bg-accent-muted text-accent'
                  : 'border-border text-text-subtle'
              }`}
            >
              {service === 'Auth' ? 'A' : service === 'Lost & Found' ? 'L' : 'F'}
            </span>
            <span className="text-center text-[9px] leading-tight text-text-subtle">
              {service}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center font-mono text-[10px] text-text-subtle">
        one secret, one token
      </p>
    </div>
  );
}

function MissingPositiveVisual() {
  const step = useCycle(4, 1_000);
  const values = [0, -2, 1, 2];
  const missing = 3;

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-1">
        {values.map((value, index) => (
          <span
            key={index}
            className="grid h-7 w-7 place-items-center rounded border border-border bg-bg/60 font-mono text-[11px] text-text-muted transition-all duration-300"
            style={{
              borderColor: index === step ? 'var(--color-accent)' : undefined,
              color: index === step ? 'var(--color-accent)' : undefined,
            }}
          >
            {value}
          </span>
        ))}
        <span
          className="grid h-7 w-7 place-items-center rounded border border-dashed border-accent/60 bg-accent-muted font-mono text-[11px] text-accent"
          title="the missing positive"
        >
          ?
        </span>
      </div>
      <p className="mt-2 font-mono text-[10px] text-text-subtle">
        the answer is <span className="text-accent">{missing}</span>
      </p>
    </div>
  );
}

function FlashSaleVisual() {
  const [stock, setStock] = useState(10);
  const [won, setWon] = useState(0);
  const [refused, setRefused] = useState(0);

  useEffect(() => {
    if (reduced()) return;
    const timer = setInterval(() => {
      setStock((current) => {
        if (current <= 0) {
          // Reset and start again, so the animation keeps going.
          setWon(0);
          setRefused(0);
          return 10;
        }
        setWon((w) => w + 1);
        setRefused((r) => r + 1);
        return current - 1;
      });
    }, 220);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full">
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-elevated">
        <div
          className="h-full bg-accent transition-[width] duration-200"
          style={{ width: `${(stock / 10) * 100}%` }}
        />
      </div>
      <div className="mt-2 flex items-center gap-3 font-mono text-[10px]">
        <span className="text-accent">{stock} left</span>
        <span className="text-success">{won} won</span>
        <span className="text-warning">{refused} refused</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function ChallengeVisual({ id, className = '' }: Props) {
  let visual: React.ReactNode = null;

  switch (id as VisualId) {
    case 'lost-found':
      visual = <LostFoundVisual />;
      break;
    case 'calculator':
      visual = <CalculatorVisual />;
      break;
    case 'binary-string':
      visual = <BinaryStringVisual />;
      break;
    case 'autocomplete':
      visual = <AutocompleteVisual />;
      break;
    case 'auth':
      visual = <AuthVisual />;
      break;
    case 'missing-positive':
      visual = <MissingPositiveVisual />;
      break;
    case 'flash-sale':
      visual = <FlashSaleVisual />;
      break;
    default:
      return null;
  }

  return (
    <div
      aria-hidden="true"
      className={`flex h-28 items-center rounded-lg border border-border bg-bg/40 p-3 ${className}`}
    >
      {visual}
    </div>
  );
}
