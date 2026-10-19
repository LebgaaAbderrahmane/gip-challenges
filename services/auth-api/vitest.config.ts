import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
    // Argon2id with a 64 MiB cost is deliberately slow, so the timeouts are
    // generous.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
