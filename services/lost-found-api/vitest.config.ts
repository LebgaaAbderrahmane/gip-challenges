import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The integration tests share one database, so they run in a single
    // thread rather than racing each other.
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
