#!/usr/bin/env node
/**
 * Syntax-checks the JavaScript source files that exist.
 *
 * The workspace is built incrementally, so a source file may legitimately not
 * exist yet. This script checks each file that IS present and skips the rest,
 * reporting which were skipped so the skip is never silent.
 *
 * Usage: node scripts/check-syntax.mjs <file> [<file> ...]
 * Run from the app's own directory.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const files = process.argv.slice(2);

if (files.length === 0) {
  console.error('usage: node scripts/check-syntax.mjs <file> [...]');
  process.exit(1);
}

let checked = 0;
const skipped = [];

for (const file of files) {
  const path = resolve(process.cwd(), file);

  if (!existsSync(path)) {
    skipped.push(file);
    continue;
  }

  try {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
    checked += 1;
  } catch (error) {
    console.error(`\n✗ syntax error in ${relative(process.cwd(), path)}\n`);
    console.error(error.stderr?.toString() ?? error.message);
    process.exit(1);
  }
}

if (checked > 0) {
  console.log(`✓ ${checked} file(s) checked`);
}
if (skipped.length > 0) {
  console.log(`  skipped (not written yet): ${skipped.join(', ')}`);
}