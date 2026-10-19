-- Local development database bootstrap.
--
-- Mirrors the production topology described in plan.md §15.2: one PostgreSQL
-- instance, three isolated schemas, each owned by its own restricted role so
-- that one service cannot read or write another's tables.
--
-- Runs automatically the first time the container initialises its data
-- directory. To rebuild from scratch: pnpm db:reset
--
-- Each service has TWO roles: one for the service itself and one for its
-- tests. The test role points at the test schema, so the integration tests
-- run with exactly the same isolation as production — a restricted role that
-- can only see its own schema — rather than with the superuser.

-- ---------------------------------------------------------------------------
-- Roles (must exist before schemas can be AUTHORIZEd to them)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lost_found_role') THEN
    CREATE ROLE lost_found_role LOGIN PASSWORD 'gip_local_dev_only';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'auth_role') THEN
    CREATE ROLE auth_role LOGIN PASSWORD 'gip_local_dev_only';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'flash_sale_role') THEN
    CREATE ROLE flash_sale_role LOGIN PASSWORD 'gip_local_dev_only';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lost_found_test_role') THEN
    CREATE ROLE lost_found_test_role LOGIN PASSWORD 'gip_local_dev_only';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'auth_test_role') THEN
    CREATE ROLE auth_test_role LOGIN PASSWORD 'gip_local_dev_only';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'flash_sale_test_role') THEN
    CREATE ROLE flash_sale_test_role LOGIN PASSWORD 'gip_local_dev_only';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Production schemas — one per service
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS lost_found  AUTHORIZATION lost_found_role;
CREATE SCHEMA IF NOT EXISTS auth        AUTHORIZATION auth_role;
CREATE SCHEMA IF NOT EXISTS flash_sale  AUTHORIZATION flash_sale_role;

-- ---------------------------------------------------------------------------
-- Test schemas, each owned by its own test role
--
-- Each integration-test suite truncates its own schema between suites rather
-- than recreating the database (plan decisions P2 / P15).
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS lost_found_test AUTHORIZATION lost_found_test_role;
CREATE SCHEMA IF NOT EXISTS auth_test       AUTHORIZATION auth_test_role;
CREATE SCHEMA IF NOT EXISTS flash_sale_test AUTHORIZATION flash_sale_test_role;

-- ---------------------------------------------------------------------------
-- The search path is set on the ROLE rather than passed as a startup
-- parameter, because Neon's pooler rejects `search_path` in the startup
-- package ("unsupported startup parameter in options: search_path"). The
-- pooler does apply role settings at login, so this works on both the local
-- instance and the hosted one — and it is enforced by PostgreSQL rather than
-- by convention: a role cannot reach another schema even if the code tried.
-- ---------------------------------------------------------------------------
ALTER ROLE lost_found_role      SET search_path TO lost_found, public;
ALTER ROLE auth_role            SET search_path TO auth, public;
ALTER ROLE flash_sale_role      SET search_path TO flash_sale, public;

ALTER ROLE lost_found_test_role SET search_path TO lost_found_test, public;
ALTER ROLE auth_test_role       SET search_path TO auth_test, public;
ALTER ROLE flash_sale_test_role SET search_path TO flash_sale_test, public;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- CONNECT on the database itself. A role with no CONNECT privilege cannot
-- reach the database at all, whatever it owns inside it.
GRANT CONNECT ON DATABASE gip TO
  lost_found_role, auth_role, flash_sale_role,
  lost_found_test_role, auth_test_role, flash_sale_test_role;

GRANT USAGE ON SCHEMA lost_found  TO lost_found_role;
GRANT USAGE ON SCHEMA auth        TO auth_role;
GRANT USAGE ON SCHEMA flash_sale  TO flash_sale_role;

GRANT ALL ON SCHEMA lost_found_test TO lost_found_test_role;
GRANT ALL ON SCHEMA auth_test       TO auth_test_role;
GRANT ALL ON SCHEMA flash_sale_test TO flash_sale_test_role;

-- The service role may not create anything in the test schema, and the test
-- role may not touch the service schema. Neither can reach `public`.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM
  lost_found_role, auth_role, flash_sale_role,
  lost_found_test_role, auth_test_role, flash_sale_test_role;

GRANT USAGE ON SCHEMA public TO
  lost_found_role, auth_role, flash_sale_role,
  lost_found_test_role, auth_test_role, flash_sale_test_role;
