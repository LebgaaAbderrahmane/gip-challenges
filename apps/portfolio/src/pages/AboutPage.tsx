export default function AboutPage() {
  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-semibold tracking-tight">About this project</h1>
      <p className="mt-4 max-w-2xl text-text-muted">
        This repository is a working engineering portfolio built from a seven-task challenge brief.
        It is deliberately structured as one monorepo with independently deployable applications,
        so that each challenge keeps its own implementation, tests and documentation while the
        portfolio acts as a single front door.
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">Where the requirements come from</h2>
      <p className="mt-3 max-w-2xl text-text-muted">
        Every requirement is traceable to <code>docs/brief.md</code>, which preserves the supplied
        brief verbatim. The brief&rsquo;s own task numbering restarts partway through &mdash; three
        tasks are labelled &ldquo;Task 01&rdquo; &mdash; so this project identifies tasks by stable
        names instead.
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">How status is reported</h2>
      <p className="mt-3 max-w-2xl text-text-muted">
        Challenge badges are advanced by hand, and only after the corresponding exit criterion has
        actually been met. Test results are shown from the CI workflow rather than typed into a
        page, so they cannot drift from what the tests really report. Where a free-tier host
        introduces a limitation, it is documented rather than hidden.
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">Source</h2>
      <p className="mt-3 text-text-muted">
        <a
          href="https://github.com/LebgaaAbderrahmane/gip-challenges"
          target="_blank"
          rel="noreferrer noopener"
          className="text-accent underline underline-offset-4"
        >
          github.com/LebgaaAbderrahmane/gip-challenges
        </a>
      </p>
    </div>
  );
}