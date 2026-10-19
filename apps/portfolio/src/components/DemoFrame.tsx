import { useState } from 'react';

const GITHUB_URL = 'https://github.com/LebgaaAbderrahmane/gip-challenges';

/**
 * Embeds a vanilla demo in an <iframe>.
 *
 * The demo's source is copied verbatim into the portfolio's public/demos
 * directory at build time and is never bundled or imported by React. That is
 * what keeps the challenge constraint auditable: there is no build step, no
 * transform, and no framework in the calculator's own code path.
 *
 * An iframe is used rather than inlining the markup so the demo keeps its own
 * document, stylesheet and module scope, exactly as it would if opened
 * standalone.
 */
export default function DemoFrame({
  name,
  src,
  height = 560,
}: {
  name: string;
  src: string;
  height?: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <p className="text-xs text-text-subtle">
          {loaded ? 'Interactive demo' : 'Loading demo…'}
        </p>
        <a
          href={src}
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs font-medium text-accent hover:underline"
        >
          Open standalone ↗
        </a>
      </div>

      {failed ? (
        <div className="rounded-xl border border-danger/40 bg-danger-muted p-6 text-sm text-danger">
          <p className="font-medium">The demo could not be loaded.</p>
          <p className="mt-2 text-danger-muted">
            Open it standalone instead — this usually means the demo files have not been
            copied into the build yet.
          </p>
        </div>
      ) : (
        <iframe
          src={src}
          title={`${name} demo`}
          height={height}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="w-full rounded-xl border border-border bg-surface"
        />
      )}

      <p className="mt-3 text-xs text-text-subtle">
        Source:{' '}
        <a
          href={`${GITHUB_URL}/tree/main/apps/${name}`}
          target="_blank"
          rel="noreferrer noopener"
          className="text-accent hover:underline"
        >
          apps/{name}
        </a>{' '}
        — plain HTML, CSS and JavaScript, served as-is with no build step.
      </p>
    </div>
  );
}