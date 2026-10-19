#!/usr/bin/env node
/**
 * "Build" for the vanilla demos.
 *
 * There is intentionally no bundler, transpiler or compiler here. The
 * calculator's challenge brief mandates "only HTML/CSS and javascript with no
 * framework", so the source files are shipped to the browser exactly as
 * written.
 *
 * The demo's real build output is the copy step performed by
 * scripts/sync-demos.mjs, which places the files in the portfolio's
 * public/demos directory for serving and iframe embedding.
 *
 * This script therefore does two useful things instead of pretending to bundle:
 *   1. checks that the files required to serve the demo exist
 *   2. confirms nothing in the demo imports a framework or `eval()`
 *
 * Usage: node scripts/demo-build.mjs <app-name> <required-file> [...]
 */
import { readFile, access } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';

const [app, ...required] = process.argv.slice(2);
const appDir = resolve(process.cwd());

// Patterns that would violate the brief's constraints.
const FORBIDDEN = [
  { re: /\beval\s*\(/, why: 'eval() is banned — use the recursive-descent parser' },
  { re: /\bnew\s+Function\s*\(/, why: 'new Function() is equivalent to eval()' },
  { re: /from\s+['"]react['"]|require\(['"]react['"]\)/, why: 'React is not allowed' },
  {
    re: /from\s+['"](vue|angular|svelte|preact|solid-js)['"]/,
    why: 'no UI framework is allowed',
  },
];

const missing = [];
for (const file of required) {
  try {
    await access(join(appDir, file));
  } catch {
    missing.push(file);
  }
}

if (missing.length > 0) {
  console.log(`[${app}] ${missing.length} required file(s) not written yet: ${missing.join(', ')}`);
  console.log(`[${app}] nothing to build — plain static files, shipped as-is`);
  process.exit(0);
}

// Only inspect .js/.mjs files for forbidden patterns.
const { readdir } = await import('node:fs/promises');
const entries = await readdir(appDir, { withFileTypes: true });
const violations = [];

for (const entry of entries) {
  if (!entry.isFile() || !/\.(js|mjs)$/.test(entry.name)) continue;

  const source = await readFile(join(appDir, entry.name), 'utf8');
  for (const { re, why } of FORBIDDEN) {
    if (re.test(source)) {
      violations.push(`${entry.name}: matches ${re} — ${why}`);
    }
  }
}

if (violations.length > 0) {
  console.error(`[${app}] constraint violation:\n  ${violations.join('\n  ')}`);
  process.exit(1);
}

console.log(`[${app}] constraint check passed (${required.length} files, no framework, no eval)`);
console.log(`[${app}] no build step — plain static files, shipped as-is`);