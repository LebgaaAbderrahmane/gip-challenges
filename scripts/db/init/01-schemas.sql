-- Local development database bootstrap.
--
-- Mirrors the production topology described in plan.md §15.2: one PostgreSQL
-- instance, three isolated schemas, each owned by its own restricted role so
-- that one service cannot read or write another's tables.
--
-- Runs automatically the first time the container initialises its data
-- directory. To rebuild from scratch: pnpm db:reset

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
END
$$;

-- ---------------------------------------------------------------------------
-- Production schemas — one per service
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS lost_found  AUTHORIZATION lost_found_role;
CREATE SCHEMA IF NOT EXISTS auth        AUTHORIZATION auth_role;
CREATE SCHEMA IF NOT EXISTS flash_sale  AUTHORIZATION flash_sale_role;

-- ---------------------------------------------------------------------------
-- Test schemas
--
-- Each integration-test suite truncates its own schema between suites rather
-- than recreating the database (plan decisions P2 / P15).
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS lost_found_test AUTHORIZATION lost_found_role;
CREATE SCHEMA IF NOT EXISTS auth_test       AUTHORIZATION auth_role;
CREATE SCHEMA IF NOT EXISTS flash_sale_test AUTHORIZATION flash_sale_role;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA lost_found, lost_found_test TO lost_found_role;
GRANT USAGE ON SCHEMA auth,       auth_test       TO auth_role;
GRANT USAGE ON SCHEMA flash_sale, flash_sale_test TO flash_sale_role;

-- Migrations run as the superuser `gip` and create tables owned by it, so each
-- service role needs to be able to use the tables it was granted.
GRANT ALL PRIVILEGES ON DATABASE gip TO lost_found_role, auth_role, flash_sale_role;

-- Revoke the default `public` schema so cross-service access fails loudly
-- during development instead of silently succeeding.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO lost_found_role, auth_role, flash_sale_role;