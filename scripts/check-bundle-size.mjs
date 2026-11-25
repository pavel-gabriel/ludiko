// Performance budget (docs/PLAN.md §10): the JS needed for first paint of the home route
// (entry chunk + its static imports + modulepreloads from index.html) must be < 250 KB gzipped.
// Usage: node scripts/check-bundle-size.mjs [distDir] [budgetKB]
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const dist = path.resolve(process.argv[2] ?? 'dist');
const budgetKB = Number(process.argv[3] ?? 250);
const html = readFileSync(path.join(dist, 'index.html'), 'utf8');

/** Resolve a URL found in index.html or a chunk to a file inside dist/ */
const toFile = (url) => path.join(dist, url.replace(/^\.?\//, ''));

const entries = [...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)].map((m) => m[1]);
const preloads = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
if (entries.length === 0) {
  console.error('No module entry script found in dist/index.html');
  process.exit(1);
}

const seen = new Set();
const queue = [...entries, ...preloads];
// Static imports only: `import ... from "./x.js"` / `export ... from "./x.js"`; dynamic import() is lazy.
const staticImport = /(?:^|[;}\s])(?:import|export)\s*(?:[^'"()]*?from\s*)?["'](\.[^"']+\.js)["']/g;

while (queue.length) {
  const url = queue.shift();
  const file = toFile(url);
  if (seen.has(file) || !existsSync(file)) continue;
  seen.add(file);
  const code = readFileSync(file, 'utf8');
  for (const m of code.matchAll(staticImport)) {
    queue.push(path.relative(dist, path.resolve(path.dirname(file), m[1])));
  }
}

const rows = [...seen].map((file) => {
  const buf = readFileSync(file);
  return { file: path.relative(dist, file), raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length };
});
rows.sort((a, b) => b.gzip - a.gzip);

const kb = (n) => (n / 1024).toFixed(1).padStart(8) + ' KB';
console.log('Initial JS for index.html (entry + static imports + modulepreloads)\n');
console.log('file'.padEnd(46) + 'raw'.padStart(11) + 'gzip'.padStart(11));
for (const r of rows) console.log(r.file.padEnd(46) + kb(r.raw) + kb(r.gzip));
const total = rows.reduce((s, r) => s + r.gzip, 0);
console.log('-'.repeat(68));
console.log('TOTAL'.padEnd(46) + kb(rows.reduce((s, r) => s + r.raw, 0)) + kb(total));
console.log(`Budget: ${budgetKB} KB gzipped`);

if (total / 1024 > budgetKB) {
  console.error(`\nFAIL: initial JS is ${(total / 1024).toFixed(1)} KB gzipped (> ${budgetKB} KB)`);
  process.exit(1);
}
console.log(`\nOK: ${(total / 1024).toFixed(1)} KB gzipped (<= ${budgetKB} KB)`);
