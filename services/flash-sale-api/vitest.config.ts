import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The test FILES must not run in parallel. Each file runs its own
    // migration against the same schema, and "CREATE TABLE IF NOT EXISTS" is
    // not safe against a race. The migration runner also takes an advisory
    // lock, so this is belt and braces.
    fileParallelism: false,
    maxWorkers: 1,
    // The concurrency tests fire fifty simultaneous requests, and the
    // database is doing real work, so the timeouts are generous.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
