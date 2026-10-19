export default function NotFoundPage() {
  return (
    <div className="container-page py-24 text-center">
      <p className="font-mono text-sm text-text-subtle">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mx-auto mt-3 max-w-md text-text-muted">
        That route does not exist. It may have been renamed, or the link may be out of date.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <a
          href="/"
          className="rounded-lg bg-accent px-5 py-2.5 font-medium text-bg transition-colors hover:bg-accent-strong"
        >
          Back to home
        </a>
        <a
          href="/tasks"
          className="rounded-lg border border-border px-5 py-2.5 font-medium transition-colors hover:bg-border-strong hover:bg-surface"
        >
          Browse challenges
        </a>
      </div>
    </div>
  );
}