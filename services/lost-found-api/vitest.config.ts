import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The test FILES must not run in parallel. Each file runs its own
    // migration against the same schema, and "CREATE TABLE IF NOT EXISTS" is
    // not safe against a race — the loser fails with a duplicate key on the
    // table's composite type. The migration runner also takes an advisory
    // lock, so this is belt and braces.
    //
    // The previous `poolOptions: { threads: { singleThread: true } }` was
    // removed in Vitest 4 and was being ignored, which is why the race
    // appeared in CI but not locally.
    fileParallelism: false,
    maxWorkers: 1,
    // Argon2id with a 64 MiB cost is deliberately slow, so the timeouts are
    // generous.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
