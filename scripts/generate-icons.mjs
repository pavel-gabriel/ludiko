// Rasterises public/icons/icon.svg into the PWA PNG icons using Playwright.
// Usage: node scripts/generate-icons.mjs   (needs `playwright` available)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'icons');
const svg = readFileSync(path.join(outDir, 'icon.svg'), 'utf8');

// Maskable icons need a full-bleed background and the artwork inside the central safe zone.
const maskableSvg = svg
  .replace(/<rect[^>]*\/>/, '<rect width="512" height="512" fill="#FFB6C1"/>')
  .replace(/<(path|circle)/g, '<$1 transform="translate(256 256) scale(0.8) translate(-256 -256)"');

const targets = [
  { file: 'icon-192.png', size: 192, src: svg },
  { file: 'icon-512.png', size: 512, src: svg },
  { file: 'icon-maskable-512.png', size: 512, src: maskableSvg },
  { file: 'apple-touch-icon.png', size: 180, src: maskableSvg },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${t.size}px;height:${t.size}px}</style>${t.src}`,
  );
  await page.screenshot({ path: path.join(outDir, t.file), omitBackground: true });
  console.log('wrote', t.file);
}
await browser.close();
