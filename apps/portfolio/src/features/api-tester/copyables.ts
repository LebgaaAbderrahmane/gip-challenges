/**
 * Finding the parts of a response worth copying.
 *
 * A raw JSON blob is not something a visitor can do much with. What they
 * actually want is the token that was just issued, or the id of the row that
 * was just created. This looks for those specific things and offers a copy
 * button for each, so the useful bit is one click away.
 */

/** A value worth offering a copy button for. */
export interface Copyable {
  /** What to call it, e.g. "token" or "order id". */
  label: string;
  /** The value itself. */
  value: string;
  /** A short note about what it is, shown under the button. */
  note?: string;
}

/** The keys that are worth surfacing, and how to name them. */
const INTERESTING_KEYS: Record<string, string> = {
  token: 'token',
  id: 'id',
  orderId: 'order id',
  productId: 'product id',
  customerId: 'customer id',
  idempotencyKey: 'idempotency key',
  email: 'email',
  totalPriceCents: 'total',
};

/**
 * The things in a response body worth offering to copy.
 *
 * @param body the parsed response body
 * @param options.isOrder whether the body describes a single order, which is
 *   what the id of a row refers to
 */
export function findCopyables(body: unknown, options: { isOrder?: boolean } = {}): Copyable[] {
  void options;
  if (!body || typeof body !== 'object') return [];

  const found: Copyable[] = [];
  const seen = new Set<string>();

  const record = body as Record<string, unknown>;

  for (const [key, label] of Object.entries(INTERESTING_KEYS)) {
    const value = record[key];
    if (typeof value !== 'string' || value === '' || seen.has(key)) continue;
    seen.add(key);
    found.push({
      label,
      value,
      note:
        key === 'token'
          ? 'Paste it into any other API on this site, or use the "Use this token" button.'
          : key === 'idempotencyKey'
            ? 'The key that makes a retry safe.'
            : undefined,
    });
  }

  // A list of rows: offer the id of each, so a visitor can go and look at
  // one specific record.
  const rows = Array.isArray(record.data) ? record.data : null;
  if (rows) {
    rows.slice(0, 8).forEach((row, index) => {
      if (!row || typeof row !== 'object') return;
      const id = (row as Record<string, unknown>).id;
      if (typeof id !== 'string' || id === '') return;
      found.push({
        label: `id #${index + 1}`,
        value: id,
        note: (row as Record<string, unknown>).name as string | undefined,
      });
    });
  }

  return found;
}
