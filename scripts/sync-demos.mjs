#!/usr/bin/env node
/**
 * Copies the two vanilla demo apps into the portfolio's public directory so
 * they can be served as static files and embedded in an <iframe>.
 *
 * Why copy rather than share a module:
 *   The challenge brief requires the calculator to be vanilla HTML/CSS/JS with
 *   no framework. Copying the files verbatim — no bundling, no transforms —
 *   keeps that guarantee auditable. The portfolio never imports from these
 *   directories; it only serves them as static assets.
 *
 * Run automatically before `dev` and `build`.
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const demos = ['calculator', 'autocomplete'];
const outRoot = join(root, 'apps', 'portfolio', 'public', 'demos');

const SOURCE_FILES = /\.(html|css|js|mjs|json|svg|png|ico|webmanifest)$/;

/**
 * Tooling that lives in the app folder but must never reach the browser.
 * Shipping these would be harmless but sloppy — a vitest.config.js served to a
 * visitor is a sign the copy filter is too loose.
 */
const EXCLUDED = new Set(['package.json', 'vitest.config.js', 'build.mjs', 'vite.config.js']);

/**
 * Sync demo files WITHOUT deleting the destination directory first.
 *
 * `rm -rf` then recreate looks tidier but silently breaks any running Vite dev
 * server: the watcher holds a reference to the old directory inode, so every
 * later request for those files falls through to the SPA fallback. The demo
 * then renders completely unstyled with no error anywhere — which is exactly
 * the bug this function previously caused.
 *
 * Writing into the existing directory keeps inodes stable. Files are only
 * rewritten when their content actually differs, so a no-op run does not wake
 * a running dev server at all.
 */
async function sync() {
  const expected = new Set();

  for (const demo of demos) {
    const src = join(root, 'apps', demo);
    const dest = join(outRoot, demo);

    if (!existsSync(src)) {
      console.warn(`[sync-demos] skipped ${demo} — ${src} does not exist yet`);
      continue;
    }

    await mkdir(dest, { recursive: true });

    // Copy only the demo itself; never tests, package.json or tooling.
    const entries = await readdir(src, { withFileTypes: true });
    let copied = 0;

    for (const entry of entries) {
      if (!entry.isFile() || !SOURCE_FILES.test(entry.name)) continue;
      if (EXCLUDED.has(entry.name)) continue;
      if (/\.(test|spec)\.[cm]?js$/.test(entry.name)) continue;

      const from = join(src, entry.name);
      const to = join(dest, entry.name);

      const [source, current] = await Promise.all([
        readFile(from),
        readFile(to).catch(() => null),
      ]);

      if (!current || !source.equals(current)) {
        await writeFile(to, source);
        copied += 1;
      }

      expected.add(to);
    }

    console.log(`[sync-demos] ${demo} -> public/demos/${demo} (${copied} updated)`);
  }

  // Prune stale outputs without removing the directory itself.
  if (existsSync(outRoot)) {
    for (const dir of await readdir(outRoot, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const dest = join(outRoot, dir.name);
      for (const file of await readdir(dest)) {
        const full = join(dest, file);
        if (!expected.has(full)) {
          await rm(full);
          console.log(`[sync-demos] removed stale ${full}`);
        }
      }
    }
  }
}

await sync();