import { useWalkthrough } from './WalkthroughContext';

/**
 * The button that opens the tour.
 *
 * It lives in the header, where the eye already is, so it costs no screen
 * space over the content and it is findable without being loud. The
 * walkthrough used to be a card that sat in the corner of every page; that
 * was a thing to ignore, and this is a thing to click.
 */
export default function TourButton() {
  const walkthrough = useWalkthrough();

  return (
    <button
      type="button"
      onClick={walkthrough.start}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm font-medium text-text-muted transition-colors hover:border-border-strong hover:bg-surface hover:text-text"
    >
      {/* A small compass: a way to be shown around. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 text-accent"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="8" cy="8" r="6.25" />
        <path d="M10.5 5.5 9.2 9.2 5.5 10.5 6.8 6.8z" />
      </svg>
      Tour
      <span className="hidden text-xs font-normal text-text-subtle sm:inline">
        {walkthrough.total} steps
      </span>
    </button>
  );
}
