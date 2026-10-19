/**
 * The migration runner, shared by every service.
 *
 * Migrations are plain SQL files applied in order and recorded in a
 * migrations table, so running them twice is safe. The service owns its
 * schema and nothing else.
 *
 * WHY THERE IS A LOCK
 * -------------------
 * "CREATE TABLE IF NOT EXISTS" is not safe against a race. Two processes that
 * both find the table missing will both try to create it, and the loser fails
 * with "duplicate key value violates unique constraint pg_type_typname_nsp_index"
 * — the internal index behind a table's composite type.
 *
 * That is not hypothetical. The integration tests each run their own
 * migration, and Vitest runs test FILES in parallel, so the two files raced
 * and the loser failed. It passed locally by luck and failed in CI, where the
 * timing differed.
 *
 * A PostgreSQL advisory lock fixes it properly: the second process waits for
 * the first to finish, and then finds the schema already migrated.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

/**
 * The advisory lock key.
 *
 * Any number works, as long as it is the same everywhere. It is namespaced
 * per project so it cannot collide with another application's lock.
 */
const MIGRATION_LOCK_KEY = 8_412_773;

/**
 * Applies the migrations in a directory.
 *
 * @param options.migrationsDir the directory holding the .sql files
 * @param options.schema the schema this service owns
 */
export async function migrate(options: {
  connectionString: string;
  schema: string;
  migrationsDir: string;
}): Promise<void> {
  const client = new pg.Client({ connectionString: options.connectionString });
  await client.connect();

  try {
    /*
     * The schema is NOT created here.
     *
     * Creating a schema needs the CREATE privilege on the DATABASE, which
     * would let a service create schemas anywhere — and it is not needed,
     * because the setup script already created this service's schema with the
     * owner connection. The service role owns its schema, so it can create the
     * tables inside it, which is all a migration needs.
     */
    const exists = await client.query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`,
      [options.schema],
    );

    if (exists.rowCount === 0) {
      throw new Error(
        `The schema "${options.schema}" does not exist. Create it with the owner connection: ` +
          `DATABASE_URL=<owner url> pnpm db:setup:neon`,
      );
    }

    // One migration at a time, per database. See the note above.
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);

    try {
      // The search path decides where unqualified CREATE statements land.
      await client.query(`SET search_path TO ${options.schema}, public`);

      await client.query(`
        CREATE TABLE IF NOT EXISTS ${options.schema}.migrations (
          name       TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);

      const files = (await readdir(options.migrationsDir))
        .filter((file) => file.endsWith('.sql'))
        .sort();

      const applied = new Set(
        (
          await client.query(`SELECT name FROM ${options.schema}.migrations`)
        ).rows.map((row: { name: string }) => row.name),
      );

      for (const file of files) {
        if (applied.has(file)) continue;

        const sql = await readFile(join(options.migrationsDir, file), 'utf8');

        // The migration and its record are applied together, so a failure
        // cannot leave a half-applied migration marked as done.
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            `INSERT INTO ${options.schema}.migrations (name) VALUES ($1)`,
            [file],
          );
          await client.query('COMMIT');
          console.log(`[migrate] applied ${file}`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }

      console.log(
        `[migrate] ${options.schema} is up to date (${files.length} migration(s))`,
      );
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    }
  } finally {
    await client.end();
  }
}
