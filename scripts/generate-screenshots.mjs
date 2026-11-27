// Store screenshots of the ORIGINAL Ludiko UI (no third-party content).
// Usage: npx vite --port 5199 &  then  node scripts/generate-screenshots.mjs [baseUrl]
// Needs `playwright` resolvable (set NODE_PATH to a global install) and a Chrome (CHROME_PATH or /usr/bin/google-chrome).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.NODE_PATH ? path.join(process.env.NODE_PATH, 'playwright') : 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'screenshots');
const base = process.argv[2] || 'http://localhost:5199';
const exe = process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);

const shots = [
  { name: 'phone-home', route: '/', form: 'phone' },
  { name: 'phone-items', route: '/dev/items', form: 'phone' },
  { name: 'phone-singleplayer', route: '/singleplayer', form: 'phone' },
  { name: 'tablet-home', route: '/', form: 'tablet' },
  { name: 'tablet-items', route: '/dev/items', form: 'tablet' },
];
const forms = {
  phone: { viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 }, // 1080x1920
  tablet: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
};

const browser = await chromium.launch({ executablePath: exe });
for (const s of shots) {
  const ctx = await browser.newContext({ ...forms[s.form], locale: 'ro-RO', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(base + s.route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, `${s.name}.png`) });
  console.log('wrote', s.name);
  await ctx.close();
}
await browser.close();
