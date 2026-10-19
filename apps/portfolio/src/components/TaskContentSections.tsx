import { TASK_CONTENT } from '@/data/taskContent';

/** Renders plan §5.5 sections 5–8 for tasks that have content. */
export default function TaskContentSections({ slug }: { slug: string }) {
  const content = TASK_CONTENT[slug];

  if (!content) {
    return (
      <section className="mt-8 rounded-xl border border-dashed border-border bg-surface/50 p-8 text-center text-text-muted">
        <p>
          The write-up for this challenge is added when it is implemented. See the task document in
          the repository.
        </p>
      </section>
    );
  }

  return (
    <div className="mt-10 space-y-10">
      {/* 6 — How it works */}
      <section aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="text-xl font-semibold tracking-tight">
          How it works
        </h2>
        <div className="mt-4 space-y-5">
          {content.howItWorks.map((block) => (
            <div key={block.heading ?? block.body.slice(0, 32)}>
              {block.heading && (
                <h3 className="text-sm font-semibold text-text">{block.heading}</h3>
              )}
              <p className="mt-1 text-sm leading-relaxed text-text-muted">{block.body}</p>
              {block.code && (
                <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface p-4 text-xs leading-relaxed text-text-muted">
                  <code>{block.code}</code>
                </pre>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Complexity */}
      <section aria-labelledby="complexity">
        <h2 id="complexity" className="text-xl font-semibold tracking-tight">
          Complexity
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {content.complexity.map((item) => (
            <div key={item.measure} className="rounded-lg border border-border bg-surface p-4">
              <dt className="text-xs uppercase tracking-wide text-text-subtle">{item.measure}</dt>
              <dd className="mt-1 text-sm text-text">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 7 — Edge cases */}
      <section aria-labelledby="edge-cases">
        <h2 id="edge-cases" className="text-xl font-semibold tracking-tight">
          Validation and edge cases
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-text-subtle">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Input
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Result
                </th>
                <th scope="col" className="py-2 font-medium">
                  Note
                </th>
              </tr>
            </thead>
            <tbody>
              {content.edgeCases.map((row, i) => (
                <tr key={i} className="border-t border-border/60">
                  <td className="py-2 pr-4 font-mono text-xs text-text">{row.input}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-accent">{row.result}</td>
                  <td className="py-2 text-xs text-text-muted">{row.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 8 — Tests */}
      <section aria-labelledby="tests">
        <h2 id="tests" className="text-xl font-semibold tracking-tight">
          Tests
        </h2>
        <p className="mt-3 text-sm text-text-muted">
          <strong className="text-text">{content.tests.total} tests</strong> covering this
          challenge, run with{' '}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-accent">
            {content.tests.command}
          </code>
        </p>
        <ul className="mt-4 space-y-2">
          {content.tests.highlights.map((item) => (
            <li key={item} className="flex gap-2 text-sm leading-relaxed text-text-muted">
              <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Limitations */}
      {content.notes && content.notes.length > 0 && (
        <section aria-labelledby="limitations">
          <h2 id="limitations" className="text-xl font-semibold tracking-tight">
            Notes and limitations
          </h2>
          <ul className="mt-4 space-y-2">
            {content.notes.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-relaxed text-text-muted">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-text-subtle" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}