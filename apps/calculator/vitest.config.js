import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
  // The keymap is shared with the portfolio so both resolve keys identically.
  // Vite normally refuses to serve files outside the project root; the
  // monorepo root is allowed explicitly.
  server: {
    fs: {
      allow: ['..', '../..', '../../..'],
    },
  },
});