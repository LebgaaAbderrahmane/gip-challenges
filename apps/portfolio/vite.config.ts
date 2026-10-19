// Imported from vitest/config (not vite) so the `test` key below type-checks.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

/**
 * Dev only: never let the browser cache the vanilla demo files.
 *
 * The demos are copied into public/ by scripts/sync-demos.mjs. Vite serves
 * public/ with `Cache-Control: no-cache`, which still allows the browser to
 * store a response and revalidate it — and a stale copy of a file that
 * survived several edits made a fix look as though it had done nothing.
 * Debugging that is far more expensive than the bytes this costs in dev.
 *
 * Applies to dev only; production caching is left to the host.
 */
function noStoreForDemos(): Plugin {
  return {
    name: 'gip:no-store-demos',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if ((req.url ?? '').startsWith('/demos/')) {
          res.setHeader('Cache-Control', 'no-store, must-revalidate');
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), noStoreForDemos()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The calculator's key resolution lives in the demo, because the demo
      // has no build step and must therefore use a relative import. Aliasing it
      // here lets the portfolio use the very same file, so the two can never
      // disagree about what a key means — which was the root of the embedded
      // demo dropping keys the standalone one accepted.
      '@gip/keymap': fileURLToPath(new URL('../calculator/keymap.js', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});