/**
 * Placing an order.
 *
 * This is the hard part of the whole project, and the two problems it has to
 * solve are subtly different.
 *
 * NOT OVERSELLING
 * A read-then-write in the application is not safe: two requests can both
 * read the same stock and both decide there is enough. The reservation is
 * therefore a single conditional statement:
 *
 *   UPDATE products SET stock = stock - $1
 *    WHERE id = $2 AND stock >= $1
 *    RETURNING id, price_cents
 *
 * The database evaluates the condition and the update together, so the stock
 * can never go below zero and two requests can never both take the last unit.
 *
 * NOT CREATING A DUPLICATE ORDER
 * The client may time out after the order succeeded and retry. The guarantee
 * is a UNIQUE index on (customer_id, idempotency_key): the second attempt is
 * rejected by the database.
 *
 * There is a subtlety that is easy to get wrong. When the INSERT is rejected,
 * the transaction is aborted, and an aborted transaction CANNOT see the row
 * the other transaction created — that row is not committed yet, and the
 * aborted transaction is no longer a transaction that can read anything.
 *
 * The correct sequence is therefore:
 *
 *   1. the INSERT fails, the transaction rolls back (which also restores the
 *      stock it had decremented)
 *   2. the order is read in a FRESH transaction
 *   3. if it is not there yet, the other transaction has not committed, so the
 *      read is retried a few times
 *
 * Reading it inside the aborted transaction is the classic mistake, and it
 * produces either a 500 or — worse — a second order.
 */
import { createHash } from 'node:crypto';

import { and, eq, sql } from 'drizzle-orm';

import { orders, products, type Order, type Product } from '../db/schema.ts';
import type { Database } from '@gip/service-core/db';

/** Thrown when there is not enough stock. */
export class SoldOutError extends Error {
  constructor(public readonly productId: string, public readonly requested: number) {
    super('There is not enough stock for that quantity.');
    this.name = 'SoldOutError';
  }
}

/** Thrown when the product does not exist. */
export class UnknownProductError extends Error {
  constructor(public readonly productId: string) {
    super('No such product.');
    this.name = 'UnknownProductError';
  }
}

/**
 * The fingerprint of a request's SEMANTIC fields.
 *
 * Only the fields that decide what is ordered go in. Headers are excluded
 * deliberately: the same logical request can arrive with a different
 * User-Agent or a different request id, and that must still count as a
 * retry rather than as a conflicting request.
 */
export function fingerprintOf(productId: string, quantity: number): string {
  return createHash('sha256')
    .update(`${productId}:${quantity}`)
    .digest('hex');
}

export type PlacementResult =
  | { kind: 'created'; order: Order; product: Product }
  | { kind: 'replayed'; order: Order }
  | { kind: 'conflict'; order: Order }
  /** The other attempt has not committed yet. The client may retry. */
  | { kind: 'in-progress' };

/** PostgreSQL's unique violation. */
const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: string }).code === '23505';

/**
 * Reads an order by its customer and idempotency key.
 */
export async function findOrderByKey(
  db: Database,
  customerId: string,
  idempotencyKey: string,
): Promise<Order | undefined> {
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.customerId, customerId), eq(orders.idempotencyKey, idempotencyKey)))
    .limit(1);
  return rows[0];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Places an order, atomically and idempotently.
 */
export async function placeOrder(
  db: Database,
  input: {
    productId: string;
    quantity: number;
    customerId: string;
    idempotencyKey: string;
  },
): Promise<PlacementResult> {
  const fingerprint = fingerprintOf(input.productId, input.quantity);

  // A key that has already been used is answered straight away.
  const existing = await findOrderByKey(db, input.customerId, input.idempotencyKey);
  if (existing) {
    return existing.requestFingerprint === fingerprint
      ? { kind: 'replayed', order: existing }
      : { kind: 'conflict', order: existing };
  }

  try {
    return await db.transaction(async (tx) => {
      /*
       * The reservation. One statement, so the check and the update are the
       * same operation and cannot be interleaved with another request.
       */
      const reserved = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${input.quantity}`, updatedAt: new Date() })
        .where(
          sql`${products.id} = ${input.productId} AND ${products.stock} >= ${input.quantity}`,
        )
        .returning();

      const product = reserved[0];

      if (!product) {
        // No rows. Either the product does not exist, or there is not enough
        // stock. The two are told apart by looking the product up.
        const [existingProduct] = await tx
          .select()
          .from(products)
          .where(eq(products.id, input.productId))
          .limit(1);

        if (!existingProduct) {
          throw new UnknownProductError(input.productId);
        }
        throw new SoldOutError(input.productId, input.quantity);
      }

      /*
       * The order. The UNIQUE index on (customer_id, idempotency_key) is what
       * actually prevents a duplicate — an application-level check would race.
       */
      const totalPriceCents = product.priceCents * input.quantity;

      const [order] = await tx
        .insert(orders)
        .values({
          productId: input.productId,
          customerId: input.customerId,
          quantity: input.quantity,
          unitPriceCents: product.priceCents,
          totalPriceCents,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: fingerprint,
        })
        .returning();

      return { kind: 'created' as const, order, product };
    });
  } catch (error) {
    if (error instanceof SoldOutError) throw error;
    if (error instanceof UnknownProductError) throw error;

    if (!isUniqueViolation(error)) throw error;

    /*
     * The race was lost: another request with the same key inserted first.
     * The transaction has rolled back, which also restored the stock this
     * attempt had decremented.
     *
     * The order is now read in a FRESH transaction. It may not be committed
     * yet, so the read is retried for a short while before giving up and
     * telling the client it may try again.
     */
    for (let attempt = 0; attempt < 5; attempt++) {
      const found = await findOrderByKey(db, input.customerId, input.idempotencyKey);
      if (found) {
        return found.requestFingerprint === fingerprint
          ? { kind: 'replayed', order: found }
          : { kind: 'conflict', order: found };
      }
      await sleep(25 * (attempt + 1));
    }

    return { kind: 'in-progress' };
  }
}
