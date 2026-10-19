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
import { cp, mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const demos = ['calculator', 'autocomplete'];
const outRoot = join(root, 'apps', 'portfolio', 'public', 'demos');

const SOURCE_FILES = /\.(html|css|js|mjs|json|svg|png|ico|webmanifest)$/;

async function sync() {
  await rm(outRoot, { recursive: true, force: true });
  await mkdir(outRoot, { recursive: true });

  for (const demo of demos) {
    const src = join(root, 'apps', demo);
    const dest = join(outRoot, demo);

    if (!existsSync(src)) {
      console.warn(`[sync-demos] skipped ${demo} — ${src} does not exist yet`);
      continue;
    }

    // Copy only the demo itself; never tests, package.json or tooling.
    const entries = await readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !SOURCE_FILES.test(entry.name)) continue;
      if (entry.name === 'package.json') continue;
      await cp(join(src, entry.name), join(dest, entry.name));
    }
    console.log(`[sync-demos] ${demo} -> public/demos/${demo}`);
  }
}

await sync();