import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { isDeployed, REQUEST_TIMEOUT_MS } from '@/config/api';
import { useSession } from '@/features/session/SessionContext';
import { findCopyables, type Copyable } from './copyables';

/**
 * The other services a token can be used on.
 *
 * The three services share one signing secret, so a token issued by one is
 * accepted by the others. This is where that becomes useful.
 */
const TOKEN_DESTINATIONS: { href: string; label: string }[] = [
  { href: '/tasks/lost-found', label: 'Lost & Found API' },
  { href: '/tasks/flash-sale', label: 'Flash Sale API' },
];
import type { ApiOperation, ApiService, RequestOutcome } from './types.ts';

/**
 * The API tester.
 *
 * A shared PRESENTATION component: it makes real requests to the deployed
 * service from the browser. It holds no business logic and talks to no
 * database — the services are the deliverable, and this exists so a visitor
 * can exercise them without a command line.
 *
 * The requests are made from the browser, so CORS applies and the outcome
 * depends on the service's own configuration. A network failure is therefore
 * reported differently from an API error, because they mean different things:
 * one is "the request never arrived", the other is "the service answered".
 */
export default function ApiTester({
  service,
  initialOperationId,
}: {
  service: ApiService;
  initialOperationId?: string;
}) {
  const [operationId, setOperationId] = useState(
    initialOperationId ?? service.operations[0]?.id ?? '',
  );
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [bodyText, setBodyText] = useState('');
  const session = useSession();
  const [localToken, setLocalToken] = useState('');
  const [outcome, setOutcome] = useState<RequestOutcome>({ kind: 'idle' });
  const [copied, setCopied] = useState<string | null>(null);
  const [copyables, setCopyables] = useState<Copyable[]>([]);

  /**
   * The token to send.
   *
   * The session wins when there is one: a visitor who signed in on the
   * Authentication API should not have to paste the token again to use it
   * here. A token typed into this panel still works, and takes precedence
   * over the session, so a visitor can test with a different user.
   */
  const token = localToken.trim() || session.token || '';

  const abortRef = useRef<AbortController | null>(null);

  const operation = useMemo<ApiOperation | undefined>(
    () => service.operations.find((op) => op.id === operationId),
    [service.operations, operationId],
  );

  const selectOperation = (op: ApiOperation) => {
    setOperationId(op.id);
    setParameters({});
    setBodyText(op.body === undefined ? '' : JSON.stringify(op.body, null, 2));
    setOutcome({ kind: 'idle' });
    setCopyables([]);
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 1600);
    } catch {
      // Clipboard access can be refused; the request itself is still copyable
      // by hand from the panel.
      setCopied(null);
    }
  };

  const send = useCallback(async () => {
    if (!operation) return;

    setOutcome({ kind: 'pending' });

    // Fill the path parameters.
    let path = operation.path;
    for (const parameter of operation.parameters ?? []) {
      const value = parameters[parameter.name]?.trim();
      if (!value) {
        setOutcome({
          kind: 'failure',
          durationMs: 0,
          message: `Fill in "${parameter.label}" before sending.`,
          retryable: false,
        });
        return;
      }
      path = path.replace(`{${parameter.name}}`, encodeURIComponent(value));
    }

    // Parse the body, if there is one.
    let body: string | undefined;
    if (bodyText.trim() !== '') {
      try {
        body = JSON.stringify(JSON.parse(bodyText));
      } catch {
        setOutcome({
          kind: 'failure',
          durationMs: 0,
          message: 'The request body is not valid JSON.',
          retryable: false,
        });
        return;
      }
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (operation.requiresAuth) {
      if (!token.trim()) {
        clearTimeout(timer);
        setOutcome({
          kind: 'failure',
          durationMs: 0,
          message:
            'This operation needs a bearer token. Sign in with the Authentication API and paste the token here.',
          retryable: false,
        });
        return;
      }
      headers.Authorization = `Bearer ${token.trim()}`;
    }

    const started = performance.now();

    try {
      const response = await fetch(`${service.baseUrl}${path}`, {
        method: operation.method,
        headers,
        body,
        signal: controller.signal,
      });

      const durationMs = Math.round(performance.now() - started);
      const rawBody = await response.text();

      let parsed: unknown = rawBody;
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        // Not JSON — the raw text is shown instead.
      }

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        // Only the headers that are safe and useful to show.
        if (
          ['content-type', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'retry-after'].includes(
            key.toLowerCase(),
          )
        ) {
          responseHeaders[key] = value;
        }
      });

      setOutcome({
        kind: 'success',
        status: response.status,
        statusText: response.statusText,
        durationMs,
        body: parsed,
        rawBody,
        headers: responseHeaders,
      });

      /*
       * A response that carries a token signs the visitor in for the rest of
       * the portfolio. The three services share one signing secret, so the
       * token that the Authentication API just issued is valid on the other
       * two — and that is the design, made visible.
       */
      const issued = (parsed as { token?: unknown } | null)?.token;
      if (typeof issued === 'string' && issued !== '') {
        const user = (parsed as { user?: { email?: unknown } } | null)?.user;
        const email = typeof user?.email === 'string' ? user.email : 'signed in';
        session.signIn(issued, email);
      }

      // Offer the parts of the response that are actually worth copying.
      setCopyables(findCopyables(parsed, { isOrder: operation.id === 'order' }));
    } catch (error) {
      const durationMs = Math.round(performance.now() - started);

      if (error instanceof DOMException && error.name === 'AbortError') {
        setOutcome({
          kind: 'failure',
          durationMs,
          message: `The request took longer than ${REQUEST_TIMEOUT_MS / 1000} seconds and was cancelled. If the service is asleep it may need a moment to wake — try again.`,
          retryable: true,
        });
        return;
      }

      /*
       * A fetch that throws is a request that never completed: the service
       * could not be reached, the address may be wrong, or the browser
       * blocked it. The three look identical from here, so the message says
       * so — and the links below open /health and /docs as ordinary
       * navigations, which bypass CORS entirely. If those work, the address
       * is right and the problem is CORS. If they 404, the address is wrong.
       */
      const local = /localhost|127\.0\.0\.1/i.test(service.baseUrl);
      setOutcome({
        kind: 'failure',
        durationMs,
        message: local
          ? `The request did not reach ${service.baseUrl}. Is the service running locally?`
          : `The request did not reach ${service.baseUrl}. Either the address is wrong, or the service is not listing this site's origin in CORS_ORIGINS. Open the service link below to tell the two apart.`,
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
      abortRef.current = null;
    }
  }, [operation, parameters, bodyText, token, service.baseUrl]);

  if (!operation) {
    return (
      <p className="rounded-xl border border-border bg-surface p-6 text-sm text-text-muted">
        This service has no operations configured.
      </p>
    );
  }

  const curlCommand = useMemo(() => {
    const headers = ['-H "Accept: application/json"'];
    if (operation.requiresAuth) headers.push('-H "Authorization: Bearer <token>"');
    if (bodyText.trim() !== '') headers.push('-H "Content-Type: application/json"');
    const body = bodyText.trim() !== '' ? ` \\\n  -d '${bodyText.replace(/\n\s*/g, '')}'` : '';
    return `curl -X ${operation.method} "${service.baseUrl}${operation.path}" \\\n  ${headers.join(' \\\n  ')}${body}`;
  }, [operation, service.baseUrl, bodyText]);

  return (
    <div className="space-y-4">
      {/* The service and its address */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
        <div>
          <p className="text-sm font-medium">{service.name}</p>
          <p className="mt-0.5 font-mono text-xs text-text-muted">{service.baseUrl}</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {!isDeployed(service.baseUrl) && (
            <span className="rounded-full border border-warning/40 px-2.5 py-1 text-warning">
              local address
            </span>
          )}
          <a
            href={`${service.baseUrl}/docs`}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-accent hover:underline"
          >
            Open Swagger ↗
          </a>
        </div>
      </div>

      {/* The operations */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-subtle">
          Operation
        </p>
        <div className="flex flex-wrap gap-2">
          {service.operations.map((op) => (
            <button
              key={op.id}
              type="button"
              onClick={() => selectOperation(op)}
              aria-pressed={op.id === operation.id}
              className={[
                'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                op.id === operation.id
                  ? 'border-accent bg-accent-muted text-accent'
                  : 'border-border text-text-muted hover:border-border-strong hover:text-text',
              ].join(' ')}
            >
              {/* No opacity here: it reduced the contrast of the label
                  against the background it sat on, and the labels are
                  already distinguished by colour. */}
              <span className="mr-2 font-mono text-xs text-text-muted">{op.method}</span>
              {op.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-text-muted">{operation.description}</p>
      </div>

      {/* The request */}
      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <span className="rounded bg-surface-elevated px-2 py-1 font-semibold text-accent">
            {operation.method}
          </span>
          {/* The FULL address, not just the path. The base URL comes from a
              build-time variable, so showing the two separately made a
              mismatch easy to miss — the path looked right while the host
              was another service entirely. */}
          <span className="break-all text-text-muted">
            {service.baseUrl}
            {operation.path}
          </span>
        </div>

        {operation.parameters && operation.parameters.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {operation.parameters.map((parameter) => (
              <label key={parameter.name} className="flex-1 text-xs">
                <span className="mb-1 block text-text-subtle">{parameter.label}</span>
                <input
                  type="text"
                  value={parameters[parameter.name] ?? ''}
                  onChange={(event) =>
                    setParameters((current) => ({
                      ...current,
                      [parameter.name]: event.target.value,
                    }))
                  }
                  placeholder={parameter.placeholder}
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm text-text focus-visible:border-accent"
                />
              </label>
            ))}
          </div>
        )}

        {operation.requiresAuth && (
          <div className="rounded-lg border border-border bg-bg p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-text-muted">Bearer token</span>
              {session.token && !localToken.trim() && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success-muted px-2.5 py-0.5 text-xs text-success">
                  <span aria-hidden="true">✓</span>
                  Signed in as {session.email}
                </span>
              )}
            </div>

            <input
              type="password"
              value={token}
              onChange={(event) => setLocalToken(event.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiJ9…"
              autoComplete="off"
              spellCheck={false}
              aria-label="Bearer token"
              className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm text-text focus-visible:border-accent"
            />

            <p className="mt-2 text-xs text-text-subtle">
              {session.token
                ? 'The token from the Authentication API is used automatically. Paste one here to override it.'
                : 'Sign in on the Authentication API and it will be used here. Otherwise paste a token.'}
            </p>

            {!session.token && !localToken.trim() && (
              <p className="mt-2 rounded-md border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-warning">
                This operation needs a bearer token.{' '}
                <Link to="/tasks/auth" className="font-medium underline underline-offset-2">
                  Sign in on the Authentication API
                </Link>{' '}
                and it will be used here.
              </p>
            )}
          </div>
        )}

        {operation.method !== 'GET' && operation.body !== undefined && (
          <label className="block text-xs">
            <span className="mb-1 block text-text-subtle">Request body (JSON)</span>
            <textarea
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
              rows={Math.min(12, bodyText.split('\n').length + 1)}
              spellCheck={false}
              className="w-full resize-y rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm text-text focus-visible:border-accent"
            />
          </label>
        )}

        {/*
          The three services share one signing secret, so this token is already
          valid on the other two. The links are here so following it is one
          click rather than a copy and a paste. Shown whenever a token exists,
          including on the sign-in operation itself.
        */}
        {token.trim() && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-text-subtle">
            <span>Use this token on</span>
            {TOKEN_DESTINATIONS.map((destination) => (
              <Link
                key={destination.href}
                to={destination.href}
                className="rounded-md border border-border px-2 py-1 font-medium text-accent transition-colors hover:border-border-strong hover:bg-surface-elevated"
              >
                {destination.label} →
              </Link>
            ))}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={send}
            disabled={outcome.kind === 'pending'}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-accent-strong disabled:opacity-60"
          >
            {outcome.kind === 'pending' ? 'Sending…' : 'Send request'}
          </button>

          <button
            type="button"
            onClick={() => copy(curlCommand, 'curl')}
            className="rounded-lg border border-border px-3 py-2 text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text"
          >
            {copied === 'curl' ? 'Copied' : 'Copy as curl'}
          </button>

          {outcome.kind === 'failure' && outcome.retryable && (
            <button
              type="button"
              onClick={send}
              className="rounded-lg border border-border px-3 py-2 text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text"
            >
              Try again
            </button>
          )}
        </div>
      </div>

      {/* The response */}
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-border bg-surface p-4"
      >
        {outcome.kind === 'idle' && (
          <p className="text-sm text-text-muted">
            Choose an operation and press <span className="text-text">Send request</span>.
            The request goes from your browser straight to the deployed API.
          </p>
        )}

        {outcome.kind === 'pending' && (
          <p className="text-sm text-text-muted">
            {isDeployed(service.baseUrl)
              ? 'Waiting for the service… a free-tier service can take a moment to wake.'
              : 'Waiting for the service…'}
          </p>
        )}

        {outcome.kind === 'failure' && (
          <div>
            <p className="text-sm font-medium text-danger">The request did not complete</p>
            <p className="mt-1 text-sm text-text-muted">{outcome.message}</p>
            <p className="mt-1 font-mono text-xs text-text-subtle">
              {outcome.durationMs} ms
            </p>
            <p className="mt-3 flex flex-wrap gap-3 text-xs">
              <a
                href={`${service.baseUrl}/health`}
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-accent hover:underline"
              >
                Open the service health ↗
              </a>
              <a
                href={`${service.baseUrl}/docs`}
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-accent hover:underline"
              >
                Open Swagger ↗
              </a>
            </p>
          </div>
        )}

        {outcome.kind === 'success' && (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={[
                  'rounded-md px-2 py-1 font-mono text-xs font-semibold',
                  outcome.status < 300
                    ? 'bg-success-muted text-success'
                    : outcome.status < 400
                      ? 'bg-warning-muted text-warning'
                      : 'bg-danger-muted text-danger',
                ].join(' ')}
              >
                {outcome.status} {outcome.statusText}
              </span>
              <span className="font-mono text-xs text-text-subtle">
                {outcome.durationMs} ms
              </span>
              <button
                type="button"
                onClick={() =>
                  copy(
                    typeof outcome.body === 'string'
                      ? outcome.rawBody
                      : JSON.stringify(outcome.body, null, 2),
                    'body',
                  )
                }
                className="ml-auto text-xs font-medium text-text-muted hover:text-text"
              >
                {copied === 'body' ? 'Copied' : 'Copy response'}
              </button>
            </div>

            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg p-3 font-mono text-xs leading-relaxed text-text-muted">
              {typeof outcome.body === 'string'
                ? outcome.rawBody
                : JSON.stringify(outcome.body, null, 2)}
            </pre>

            {Object.keys(outcome.headers).length > 0 && (
              <p className="mt-2 font-mono text-[11px] text-text-subtle">
                {Object.entries(outcome.headers)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join('  ·  ')}
              </p>
            )}

            {/*
              The parts of the response that are actually worth taking away:
              the token that was just issued, the id of the row that was just
              created. A generic "copy response" leaves the visitor to dig
              for them.
            */}
            {copyables.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-text-subtle">
                  Worth keeping
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {copyables.map((item) => (
                    <li key={`${item.label}-${item.value}`}>
                      <button
                        type="button"
                        onClick={() => copy(item.value, `${item.label}-${item.value}`)}
                        title={item.note ?? item.value}
                        className="rounded-md border border-border px-2.5 py-1.5 text-left transition-colors hover:border-border-strong hover:bg-surface-elevated"
                      >
                        <span className="block text-xs font-medium text-accent">
                          {copied === `${item.label}-${item.value}`
                            ? 'Copied'
                            : `Copy ${item.label}`}
                        </span>
                        {item.note && (
                          <span className="mt-0.5 block max-w-[16rem] truncate text-[11px] text-text-subtle">
                            {item.note}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
