#!/usr/bin/env node
/**
 * Minimal static file server for developing a vanilla demo on its own,
 * outside the portfolio. Used by `pnpm dev:calculator` / `pnpm dev:autocomplete`.
 *
 * The demo must be served over HTTP rather than opened via file:// because
 * data.js is an ES module, and browsers block module loading from file://
 * under CORS rules.
 *
 *   node scripts/serve-demo.mjs <demo-dir> <port>
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const [demo, port = '5174'] = process.argv.slice(2);

if (!demo) {
  console.error('usage: node scripts/serve-demo.mjs <demo-dir> <port>');
  process.exit(1);
}

const base = join(root, 'apps', demo);
const PORT = Number(port);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    // Strip leading slashes and block path traversal out of the demo folder.
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const relative = normalize(urlPath).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
    let filePath = join(base, relative || 'index.html');

    const info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) filePath = join(filePath, 'index.html');

    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(PORT, () => {
  console.log(`[${demo}] http://localhost:${PORT}`);
});