/**
 * The Flash Sale data model.
 *
 * Two things here carry the weight:
 *
 *  - `stock` has a CHECK constraint so it can never go negative, whatever an
 *    application bug does.
 *  - the orders table has a UNIQUE constraint on (customer_id, idempotency_key).
 *    That constraint, not the application code, is what makes a retried request
 *    safe. A check-then-insert in the application would still race.
 */
import { pgTable, uuid, text, timestamp, pgEnum, index, integer, bigint, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const orderStatusEnum = pgEnum('order_status', ['placed', 'cancelled']);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    /** The price in MINOR UNITS — cents. Never a float. */
    priceCents: bigint('price_cents', { mode: 'number' }).notNull(),
    /** The stock. The CHECK constraint below is the last line of defence. */
    stock: integer('stock').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // The database refuses a negative stock, whatever the application does.
    stockNotNegative: check('products_stock_not_negative', sql`${table.stock} >= 0`),
  }),
);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    /** The customer. The token subject when authenticated, a demo id otherwise. */
    customerId: text('customer_id').notNull(),
    quantity: integer('quantity').notNull(),
    /** The price when the order was placed, so a later price change does not alter it. */
    unitPriceCents: bigint('unit_price_cents', { mode: 'number' }).notNull(),
    totalPriceCents: bigint('total_price_cents', { mode: 'number' }).notNull(),
    /** The key the client sent, scoped to the customer. */
    idempotencyKey: text('idempotency_key').notNull(),
    /** A hash of the request's semantic fields, so a reused key with a different payload can be told apart. */
    requestFingerprint: text('request_fingerprint').notNull(),
    status: orderStatusEnum('status').notNull().default('placed'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /**
     * The guarantee that makes a retried request safe.
     *
     * Two requests with the same key for the same customer cannot both
     * succeed, so the second one is rejected by the database rather than by
     * an application-level check that could race.
     */
    customerKeyUnique: uniqueIndex('orders_customer_id_idempotency_key_idx').on(
      table.customerId,
      table.idempotencyKey,
    ),
    customerIdx: index('orders_customer_id_idx').on(table.customerId),
    productIdx: index('orders_product_id_idx').on(table.productId),
  }),
);

export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
