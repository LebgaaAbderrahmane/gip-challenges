# gip-07 — Flash Sale API

> Source: [`services/flash-sale-api/`](../../services/flash-sale-api/)
> Demo: `/tasks/flash-sale`

## 1. Problem statement

> An online store is preparing for a limited time flash sale. Some products have only a few
> units available, but hundreds of customers may try to purchase them at almost exactly the
> same time.
>
> Build a backend API where users can browse products, view available stock, place an order and
> view their orders.
>
> When multiple users attempt to purchase the same product at the same time, the backend must
> prevent stock from going negative, ensure a product isn't oversold, correctly handle simultaneous
> requests, return an appropriate message when the product is sold out, prevent a client from
> accidentally creating multiple orders by retrying the same request.
>
> — challenge brief, `docs/brief.md`

## 2. The two hard parts

The brief lists five requirements. Four of them are ordinary CRUD. The two that are genuinely
difficult are **not overselling** and **not creating a duplicate order** — and they need different
mechanisms.

## 3. Not overselling

A read-then-write in the application is not safe. Two requests can both read the same stock and
both conclude there is enough. The reservation is therefore a **single conditional statement**:

```sql
UPDATE products
   SET stock = stock - $1, updated_at = now()
 WHERE id = $2 AND stock >= $1
RETURNING id, price_cents, stock;
```

The database evaluates the condition and the update together, so the check cannot be interleaved
with another request. Two requests can never both take the last unit.

Three further layers back it up:

- A **CHECK constraint** (`stock >= 0`) so the database refuses a negative stock whatever an
  application bug does.
- The stock is **never** held in an in-memory map. The database is the only authority.
- The whole reservation and the order insert happen in **one transaction**, so a failure to write
  the order rolls the stock back.

## 4. Not creating a duplicate order

The client may time out after the order succeeded, and retry. The guarantee is a **UNIQUE index** on
`(customer_id, idempotency_key)`:

```sql
CREATE UNIQUE INDEX orders_customer_id_idempotency_key_idx
  ON orders (customer_id, idempotency_key);
```

An application-level "does this key already exist?" check would still race, because two requests
can both find that it does not. The constraint is what actually prevents the duplicate.

### The subtlety that is easy to get wrong

When the INSERT is rejected, the transaction is aborted — and an aborted transaction **cannot see
the row the other transaction created**. That row is not committed yet, and the aborted
transaction is no longer a transaction that can read anything.

The correct sequence is:

1. the INSERT fails and the transaction rolls back — which also restores the stock it had
   decremented;
2. the order is read in a **fresh** transaction;
3. if it is not there yet, the other transaction has not committed, so the read is retried a few
   times before the client is told it may try again.

Reading it inside the aborted transaction is the classic mistake, and it produces either a 500 or —
worse — a second order.

### The fingerprint

The same key with a *different* payload is a conflict, not a retry. The order stores a fingerprint
of the request's **semantic** fields — the product id and the quantity:

```
sha256(productId:quantity)
```

Headers are deliberately excluded. The same logical request can arrive with a different User-Agent
or a different request id, and that must still count as a retry.

## 5. The API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/products` | Browse the products and their stock |
| `GET` | `/api/products/:id` | One product and its current stock |
| `POST` | `/api/orders` | Place an order. **`Idempotency-Key` header required** |
| `GET` | `/api/orders` | The current customer's orders |
| `GET` | `/api/orders/:id` | One order |
| `GET` | `/health` | Service and database health |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/openapi.json` | The OpenAPI specification |

### Status codes

| Code | When |
|---|---|
| `201` | The order was created |
| `200` | A retry with the same key and payload — the original order, returned again |
| `400` | The request is not valid, or the `Idempotency-Key` header is missing |
| `404` | No such product, or no such order |
| `409` | Sold out · the key was reused for a different payload · the other attempt is still in flight |

The two 409s carry different messages, and the retryable one carries `Retry-After`.

### The customer

When the request carries a valid bearer token, the customer is the user the token identifies — a
real identity, verified by the auth service.

Without one, a **demo** customer id is taken from the `X-Demo-Customer` header. That is a
convenience for the public demo, and it is clearly a demo: the header is a name the client chose
for itself and nothing is verified. It is namespaced `demo_` so it can never collide with a real
user id.

### Money

Prices are stored in **whole cents** as a `BIGINT`. Never a float, so the arithmetic is exact. The
order records the unit price as well as the total, so a later price change does not alter an order
that has already been placed.

## 6. Test cases and actual results

**27 tests, all passing**, against a real PostgreSQL instance. The requests are genuinely
concurrent — `Promise.all` over separate requests, not a loop awaiting each one.

### The scenarios from the plan

| Scenario | What is asserted | Result |
|---|---|---|
| **A — overselling** | 50 simultaneous orders for a product with 10 in stock: exactly **10** succeed, 40 get 409, the stock ends at **0**, exactly 10 orders exist, and the stock never goes negative | ✅ |
| **B — idempotency under concurrent retries** | One logical order retried 10 times at once: exactly **1** order is created, there is **1** distinct order id, and the stock falls by exactly the ordered quantity | ✅ |
| **C — the same key, a different payload** | The second request is a **409**, no extra order, and **no** extra stock is taken | ✅ |
| **D — rollback** | The order insert is rejected after the stock was reserved: the stock is exactly what it was before the attempt, and only one order exists | ✅ |

### Also asserted

- A sold-out product is a 409, not a server error, and the stock is untouched
- A quantity larger than the stock is refused and the stock is unchanged
- An unknown product is a 404, and no order is created
- The `Idempotency-Key` header is required; without it the request is refused and no order is created
- The key is **scoped to the customer**, so two customers may use the same key
- A token identifies the customer; without one the demo id is used, and it is namespaced
- A customer cannot read another customer's order
- The price is stored in whole cents, and the total is exact
- The OpenAPI document describes every route and the `Idempotency-Key` header

### Verified over real HTTP, against the live database

The running service was exercised with 50 genuinely simultaneous requests:

```
Scenario A: 50 simultaneous orders, 10 in stock
  created   : 10
  409       : 40
  other     : 0
  stock before: 10
  stock after : 0
  RESULT: PASS - no overselling

Scenario B: one logical order, retried 10 times at once
  created (201): 1
  distinct order ids: 1
  stock before: 25  after: 23  (2 units expected)
  RESULT: PASS - one order, one decrement

Scenario C: the same key, a different quantity
  status: 409  "CONFLICT"
  stock after: 23  (unchanged expected)
  RESULT: PASS
```

## 7. Links and limitations

- Source: [`services/flash-sale-api/`](../../services/flash-sale-api/)
- Tests: [`concurrency.test.ts`](../../services/flash-sale-api/tests/concurrency.test.ts),
  [`api.test.ts`](../../services/flash-sale-api/tests/api.test.ts)
- API: `/api` on the deployed host · Swagger at `/docs`

**Limitations.** An order contains a single product — a cart would need a different order model. The
idempotency key is scoped to the customer rather than to the key alone, so two customers may use
the same key. There is no order cancellation and no payment: an order is a record of a purchase,
not a transaction with a payment provider. The demo identity is clearly a demo and is not a
verified identity.
