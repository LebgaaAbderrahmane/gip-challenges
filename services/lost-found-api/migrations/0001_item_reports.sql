-- The Lost & Found schema.
--
-- Applied by the service's own migration runner. The table lives in the
-- "lost_found" schema, which the service owns exclusively.
--
-- The enum types are created in a conditional block because PostgreSQL has no
-- "CREATE TYPE IF NOT EXISTS" — only tables and indexes have that clause.
--
-- The existence check is scoped to the CURRENT schema. An unqualified check
-- would find the type in another schema — the test schema, say — and skip
-- creating it here, which left the service with a table whose column type did
-- not exist.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'report_type'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE report_type AS ENUM ('lost', 'found');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'report_status'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE report_status AS ENUM ('open', 'recovered');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS item_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        report_type      NOT NULL,
  title       TEXT             NOT NULL,
  description TEXT             NOT NULL,
  category    TEXT             NOT NULL,
  location    TEXT             NOT NULL,
  event_date  TIMESTAMPTZ      NOT NULL,
  status      report_status    NOT NULL DEFAULT 'open',
  owner_id    TEXT             NOT NULL,
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ      NOT NULL DEFAULT now()
);

-- The list endpoint filters on these, so they are indexed.
CREATE INDEX IF NOT EXISTS item_reports_owner_id_idx    ON item_reports (owner_id);
CREATE INDEX IF NOT EXISTS item_reports_status_idx     ON item_reports (status);
CREATE INDEX IF NOT EXISTS item_reports_type_idx       ON item_reports (type);
CREATE INDEX IF NOT EXISTS item_reports_created_at_idx ON item_reports (created_at);
