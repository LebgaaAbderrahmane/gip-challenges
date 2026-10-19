-- The Flash Sale schema.
--
-- Two constraints here are the whole point of the service:
--
--   products_stock_not_negative
--     The database refuses a negative stock, whatever the application does.
--
--   orders_customer_id_idempotency_key_idx
--     A UNIQUE index, so two requests with the same idempotency key for the
--     same customer cannot both succeed. This is what makes a retried
--     request safe — an application-level "does this key already exist?"
--     check would still race, because two requests can both find that it
--     does not.

CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  -- The price in MINOR UNITS (cents). An integer, never a float, so money
  -- arithmetic is exact.
  price_cents BIGINT      NOT NULL CHECK (price_cents >= 0),
  stock       INTEGER     NOT NULL CHECK (stock >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         UUID        NOT NULL REFERENCES products (id),
  customer_id        TEXT        NOT NULL,
  quantity           INTEGER     NOT NULL CHECK (quantity > 0),
  -- The price at the time of the order, so a later price change does not
  -- alter an order that has already been placed.
  unit_price_cents   BIGINT      NOT NULL,
  total_price_cents  BIGINT      NOT NULL,
  idempotency_key    TEXT        NOT NULL,
  -- A hash of the request's semantic fields, so the same key used for a
  -- different payload can be told apart from a genuine retry.
  request_fingerprint TEXT       NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'placed',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The guarantee that a retried request cannot create a second order.
CREATE UNIQUE INDEX IF NOT EXISTS orders_customer_id_idempotency_key_idx
  ON orders (customer_id, idempotency_key);

CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders (customer_id);
CREATE INDEX IF NOT EXISTS orders_product_id_idx  ON orders (product_id);
