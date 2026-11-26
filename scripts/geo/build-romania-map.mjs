/**
 * Builds the simplified map of Romania used by the Geografie content.
 *
 *   node scripts/geo/build-romania-map.mjs <dir with Natural Earth geojson files>
 *
 * Inputs (Natural Earth, PUBLIC DOMAIN, https://www.naturalearthdata.com/about/terms-of-use/):
 *   ne_10m_admin_0_countries.geojson, ne_10m_rivers_lake_centerlines.geojson, ne_10m_rivers_europe.geojson
 *   (saved in the dir as countries.geojson, rivers.geojson, rivers_eu.geojson)
 * Outputs:
 *   public/content/media/geo/romania.svg        labelled map (explanations, read-the-map questions)
 *   public/content/media/geo/romania-blank.svg  same drawing, no names (tap-on-the-map questions)
 *   content/data/geo/romania-map.json           projection + tap targets in % of the image (single source of truth)
 *
 * Coastline and borders = Natural Earth (simplified + projected by this script). The relief units, the tap
 * targets and all labels are our own work (drawn by hand as rough polygons, then clipped to the border).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = process.argv[2];
if (!SRC) throw new Error('usage: build-romania-map.mjs <natural-earth-dir>');
const load = (f) => JSON.parse(readFileSync(join(SRC, f), 'utf8'));

/* ---- projection --------------------------------------------------- */
const LON0 = 19.3, LON1 = 31.0, LAT1 = 48.65, LAT0 = 43.15;
const W = 600;
const COS = Math.cos((45.8 * Math.PI) / 180);
const SX = W / (LON1 - LON0);
const SY = SX / COS;
const H = Math.round((LAT1 - LAT0) * SY);
const px = ([lon, lat]) => [(lon - LON0) * SX, (LAT1 - lat) * SY];

/* ---- geometry helpers --------------------------------------------- */
function clipRing(ring, [x0, y0, x1, y1]) {
  const edges = [
    (p) => p[0] >= x0, (p) => p[0] <= x1, (p) => p[1] >= y0, (p) => p[1] <= y1,
  ];
  const inter = [
    (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])],
    (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])],
    (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0],
    (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1],
  ];
  let out = ring;
  for (let e = 0; e < 4; e++) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prev = input[(i + input.length - 1) % input.length];
      const ci = edges[e](cur), pi = edges[e](prev);
      if (ci) { if (!pi) out.push(inter[e](prev, cur)); out.push(cur); }
      else if (pi) out.push(inter[e](prev, cur));
    }
    if (!out.length) return [];
  }
  return out;
}

function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Simplify a closed ring: split at the point farthest from the start so the baseline is never degenerate. */
function dpRing(pts, tol) {
  const open = pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1] ? pts.slice(0, -1) : pts;
  let far = 0, fd = -1;
  open.forEach((p, i) => { const d = Math.hypot(p[0] - open[0][0], p[1] - open[0][1]); if (d > fd) { fd = d; far = i; } });
  const a = dp(open.slice(0, far + 1), tol);
  const b = dp([...open.slice(far), open[0]], tol);
  return [...a, ...b.slice(1, -1)];
}

const f1 = (n) => (Math.round(n * 10) / 10).toString();
const ptsStr = (pts) => pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L');
const ringPath = (pts) => `M${ptsStr(pts)}Z`;
const linePath = (pts) => `M${ptsStr(pts)}`;

function polysOf(geom) {
  return geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
}

/* ---- countries ---------------------------------------------------- */
const countries = load('countries.geojson').features;
const BOX = [LON0 - 0.3, LAT0 - 0.3, LON1 + 0.3, LAT1 + 0.3];
const ro = countries.find((f) => f.properties.ADMIN === 'Romania');
const roRings = polysOf(ro.geometry).map((p) => p[0]);
const roPath = roRings.map((r) => ringPath(dpRing(r.map(px), 0.55))).join('');

const neighbourPaths = [];
for (const f of countries) {
  if (f.properties.ADMIN === 'Romania') continue;
  const rings = polysOf(f.geometry)
    .map((p) => clipRing(p[0], BOX))
    .filter((r) => r.length >= 3);
  if (!rings.length) continue;
  neighbourPaths.push(rings.map((r) => ringPath(dpRing(r.map(px), 0.9))).join(''));
}

/* ---- rivers (Natural Earth) --------------------------------------- */
const rivA = load('rivers.geojson').features;
const rivB = load('rivers_eu.geojson').features;
const lines = (f) => (f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates]);
function riverLines(names) {
  const all = [...rivA, ...rivB].filter((f) => names.includes(f.properties.name));
  return all.flatMap(lines);
}
const RIVER_BOX = [LON0 - 0.1, LAT0 - 0.1, LON1 + 0.1, LAT1 + 0.1];
function clipLine(line) {
  // keep it simple: drop vertices outside the box (rivers here only exit at the edges)
  const pts = line.filter(([x, y]) => x >= RIVER_BOX[0] && x <= RIVER_BOX[2] && y >= RIVER_BOX[1] && y <= RIVER_BOX[3]);
  return pts.length >= 2 ? pts : null;
}
const RIVERS = {
  danube: { names: ['Danube'], w: 3.4 },
  danubeArms: { names: ['Bratul Chillia', 'Bratul Sfintu Gheorghe', 'Bratul Sulina', 'Borcea'], w: 1.8 },
  mures: { names: ['Mures', 'Mureș'], w: 2.2 },
  olt: { names: ['Olt'], w: 2.2 },
  siret: { names: ['Siret'], w: 2.2 },
  prut: { names: ['Prut'], w: 2.2 },
  jiu: { names: ['Jiu'], w: 2 },
  arges: { names: ['Argeș', 'Arges'], w: 1.8 },
  somes: { names: ['Someșul Mare', 'Somesul Mare', 'Someșul Cald'], w: 1.8 },
};
const riverPaths = {};
const riverPts = {};
for (const [id, r] of Object.entries(RIVERS)) {
  const ls = riverLines(r.names).map(clipLine).filter(Boolean);
  if (!ls.length) console.warn('river not found', id);
  riverPts[id] = ls;
  riverPaths[id] = ls.map((l) => linePath(dp(l.map(px), 0.5))).join('');
}
/* Someș below Dej (confluence of the Mare and Cald branches) is missing in Natural Earth:
   a short own-drawn continuation to the Tisa area, drawn by hand. */
const somesTail = [[23.87, 47.17], [23.55, 47.4], [23.2, 47.6], [22.9, 47.78], [22.65, 47.95]];
riverPaths.somesTail = linePath(somesTail.map(px));

/* ---- relief units: our own rough polygons (lon, lat), clipped to the border ---- */
const strip = (pts, w) => ({ pts, w }); // w = stroke width in degrees of longitude
const ORIENTALI = strip([[24.1, 47.8], [24.65, 47.55], [25.25, 47.15], [25.9, 46.9], [25.85, 46.5], [26.15, 46.2], [26.5, 45.9], [26.3, 45.6], [25.8, 45.5], [25.55, 45.42]], 0.62);
const MERIDIONALI = strip([[25.7, 45.45], [25.0, 45.55], [24.6, 45.6], [23.9, 45.55], [23.5, 45.38], [22.9, 45.33], [22.55, 45.12], [22.3, 44.8]], 0.62);
const SUBCARPATI = strip([[25.95, 47.75], [26.45, 47.25], [26.7, 46.7], [26.85, 46.3], [27.0, 45.9], [26.9, 45.5], [26.4, 45.22], [25.5, 45.1], [24.7, 45.03], [23.9, 45.0], [23.2, 44.95], [22.6, 44.85]], 0.4);

const POLY = {
  occidentali: [[21.9, 45.0], [22.4, 44.95], [22.9, 45.45], [22.75, 45.85], [23.2, 46.0], [23.6, 46.45], [23.45, 46.95], [22.9, 47.15], [22.3, 46.95], [22.0, 46.5], [22.0, 46.0], [21.85, 45.6]],
  transilvaniei: [[23.3, 47.15], [24.3, 47.3], [25.0, 47.05], [25.4, 46.5], [25.3, 46.0], [24.5, 45.85], [23.5, 45.95], [23.15, 46.4]],
  moldovei: [[25.6, 47.9], [26.0, 48.5], [28.3, 48.3], [28.4, 46.0], [27.4, 45.85], [26.7, 46.2], [26.3, 46.8], [25.8, 47.3]],
  camp_romana: [[22.2, 43.9], [22.3, 45.0], [23.5, 45.0], [24.6, 45.2], [25.6, 45.3], [26.5, 45.5], [27.1, 45.7], [28.1, 45.6], [28.1, 45.1], [27.95, 44.7], [27.95, 43.9]],
  dobrogea: [[27.8, 43.5], [29.9, 43.5], [29.9, 44.7], [29.05, 44.85], [28.7, 45.2], [28.1, 45.15], [27.95, 44.7]],
  delta: [[28.7, 45.6], [30.1, 45.6], [30.1, 44.55], [29.05, 44.65], [28.75, 45.05]],
  camp_vest: [[19.8, 44.7], [19.8, 48.5], [23.3, 48.3], [23.0, 47.2], [22.2, 46.6], [22.0, 45.9], [21.9, 45.4], [22.2, 44.7]],
};
const polyPath = (pts) => ringPath(pts.map(px));
const stripPath = (s) => linePath(s.pts.map(px));
const stripW = (s) => f1(s.w * SX);

/* ---- tap targets (anchors in lon/lat -> % of the image) ---------------- */
const pct = ([lon, lat]) => {
  const [x, y] = px([lon, lat]);
  return [Math.round((x / W) * 1000) / 10, Math.round((y / H) * 1000) / 10];
};
const nearestOnRiver = (id, hint) => {
  let best = null, bd = 1e9;
  for (const l of riverPts[id]) for (const p of l) {
    const d = Math.hypot((p[0] - hint[0]) * COS, p[1] - hint[1]);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
};

const T = (id, kind, ro, en, lonlat, r = 7.5) => ({ id, kind, ro, en, lonlat, r });
const targetsDef = [
  T('carpati-orientali', 'relief', 'Carpații Orientali', 'Eastern Carpathians', [25.85, 46.45]),
  T('carpati-meridionali', 'relief', 'Carpații Meridionali', 'Southern Carpathians', [24.55, 45.58]),
  T('carpati-occidentali', 'relief', 'Carpații Occidentali', 'Western Carpathians', [22.75, 46.4]),
  T('podisul-transilvaniei', 'relief', 'Podișul Transilvaniei', 'Transylvanian Plateau', [24.3, 46.45]),
  T('podisul-moldovei', 'relief', 'Podișul Moldovei', 'Moldavian Plateau', [27.3, 47.2]),
  T('podisul-dobrogei', 'relief', 'Podișul Dobrogei', 'Dobruja Plateau', [28.3, 44.45]),
  T('campia-de-vest', 'relief', 'Câmpia de Vest', 'Western Plain', [21.3, 46.3]),
  T('campia-romana', 'relief', 'Câmpia Română', 'Romanian Plain', [24.9, 44.35]),
  T('delta-dunarii', 'relief', 'Delta Dunării', 'Danube Delta', [29.2, 45.05]),
  T('marea-neagra', 'sea', 'Marea Neagră', 'Black Sea', [30.0, 44.3]),
  T('bucuresti', 'city', 'București', 'Bucharest', [26.1, 44.43], 7),
  T('cluj-napoca', 'city', 'Cluj-Napoca', 'Cluj-Napoca', [23.59, 46.77], 7),
  T('iasi', 'city', 'Iași', 'Iași', [27.59, 47.16], 7),
  T('timisoara', 'city', 'Timișoara', 'Timișoara', [21.23, 45.75], 7),
  T('constanta', 'city', 'Constanța', 'Constanța', [28.65, 44.18], 7),
  T('brasov', 'city', 'Brașov', 'Brașov', [25.6, 45.65], 7),
];
const riverTargets = [
  ['dunarea', 'Dunărea', 'The Danube', 'danube', [24.5, 43.75]],
  ['muresul', 'Mureș', 'The Mureș', 'mures', [23.9, 46.25]],
  ['oltul', 'Oltul', 'The Olt', 'olt', [24.3, 45.3]],
  ['siretul', 'Siretul', 'The Siret', 'siret', [26.9, 46.4]],
  ['prutul', 'Prutul', 'The Prut', 'prut', [27.6, 46.9]],
];
const targets = [
  ...targetsDef.map((t) => {
    const [x, y] = pct(t.lonlat);
    return { id: t.id, kind: t.kind, ro: t.ro, en: t.en, x, y, r: t.r };
  }),
  ...riverTargets.map(([id, ro, en, riv, hint]) => {
    const p = nearestOnRiver(riv, hint);
    const [x, y] = pct(p);
    return { id, kind: 'river', ro, en, x, y, r: 7 };
  }),
];

/* ---- labels ------------------------------------------------------- */
const lab = (text, lonlat, cls, extra = '') => {
  const [x, y] = px(lonlat);
  return `<text x="${f1(x)}" y="${f1(y)}" class="${cls}"${extra}>${text}</text>`;
};
const lab2 = (lines, lonlat, cls, dy = 15) => {
  const [x, y] = px(lonlat);
  return `<text x="${f1(x)}" y="${f1(y)}" class="${cls}">${lines
    .map((l, i) => `<tspan x="${f1(x)}" dy="${i ? dy : 0}">${l}</tspan>`)
    .join('')}</text>`;
};
const labels = [
  lab2(['Carpații', 'Orientali'], [25.95, 47.0], 'rl'),
  lab2(['Carpații', 'Meridionali'], [24.35, 45.78], 'rl'),
  lab2(['Carpații', 'Occidentali'], [22.6, 46.28], 'rl'),
  lab2(['Podișul', 'Transilvaniei'], [24.35, 46.7], 'pl'),
  lab2(['Podișul', 'Moldovei'], [26.95, 47.75], 'pl'),
  lab2(['Podișul', 'Dobrogei'], [28.3, 44.75], 'pl'),
  lab2(['Câmpia', 'de Vest'], [21.15, 46.9], 'cl'),
  lab2(['Câmpia', 'Română'], [25.0, 44.3], 'cl'),
  lab2(['Delta', 'Dunării'], [29.3, 45.55], 'dl'),
  lab('Subcarpați', [27.0, 45.75], 'sl'),
  lab2(['Marea', 'Neagră'], [30.1, 43.65], 'sea'),
  lab('UCRAINA', [24.4, 48.45], 'nb'),
  lab2(['REPUBLICA', 'MOLDOVA'], [29.55, 47.55], 'nb'),
  lab('BULGARIA', [25.4, 43.55], 'nb'),
  lab('SERBIA', [20.5, 44.55], 'nb'),
  lab('UNGARIA', [20.2, 47.95], 'nb'),
  lab('Dunărea', [23.3, 43.78], 'rv'),
  lab('Mureș', [21.3, 46.4], 'rv'),
  lab('Olt', [24.45, 44.75], 'rv'),
  lab('Siret', [27.3, 46.1], 'rv'),
  lab('Prut', [27.95, 46.6], 'rv'),
  lab('Jiu', [23.5, 44.3], 'rv'),
  lab('Argeș', [25.1, 44.7], 'rv'),
  lab('Someș', [22.95, 47.55], 'rv'),
];
const cities = [
  ['București', [26.1, 44.43], 'e'],
  ['Cluj-Napoca', [23.59, 46.77], 'w'],
  ['Iași', [27.59, 47.16], 'e'],
  ['Timișoara', [21.23, 45.75], 'e'],
  ['Constanța', [28.65, 44.18], 'e'],
  ['Brașov', [25.6, 45.65], 'e'],
];
const cityMarks = cities
  .map(([n, ll, side], i) => {
    const [x, y] = px(ll);
    return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${i === 0 ? 5.5 : 4}" class="city"${i === 0 ? ' fill="#222"' : ''}/>`;
  })
  .join('');
const cityLabels = cities
  .map(([n, ll, side]) => {
    const [x, y] = px(ll);
    const dx = side === 'e' ? 8 : -8;
    return `<text x="${f1(x + dx)}" y="${f1(y + 5)}" class="cy" text-anchor="${side === 'e' ? 'start' : 'end'}">${n}</text>`;
  })
  .join('');

/* ---- assemble the SVG --------------------------------------------- */
const css = `
.nb{font:italic 700 13px sans-serif;fill:#555;text-anchor:middle;letter-spacing:1px}
.rl,.pl,.cl,.dl,.sl{font:800 14px sans-serif;text-anchor:middle;paint-order:stroke;stroke:#fff;stroke-width:3.5px;stroke-linejoin:round}
.rl{fill:#3b2417}.pl{fill:#4a3510}.cl{fill:#4d4415}.dl{fill:#0b4f4a}.sl{fill:#4a3510;font-size:12px}
.sea{font:italic 800 15px sans-serif;fill:#0d4a7a;text-anchor:middle}
.rv{font:italic 700 12px sans-serif;fill:#0b4f9c;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}
.cy{font:800 14px sans-serif;fill:#111;paint-order:stroke;stroke:#fff;stroke-width:3.5px;stroke-linejoin:round}
.city{fill:#fff;stroke:#111;stroke-width:2.5}
.river{fill:none;stroke:#1f78c8;stroke-linecap:round;stroke-linejoin:round}`
  .replace(/\n/g, '');

const defs = `<defs>
<clipPath id="ro"><path d="${roPath}"/></clipPath>
<pattern id="pm" width="14" height="12" patternUnits="userSpaceOnUse"><rect width="14" height="12" fill="#8a5a3c"/><path d="M1 10L7 2L13 10Z" fill="#5c3720"/></pattern>
<pattern id="pd" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#dcb667"/><circle cx="2.5" cy="2.5" r="1.4" fill="#9a7425"/><circle cx="7" cy="7" r="1.4" fill="#9a7425"/></pattern>
<pattern id="pp" width="12" height="8" patternUnits="userSpaceOnUse"><rect width="12" height="8" fill="#ecd9a4"/><path d="M0 6H5M7 2H12" stroke="#a98a3e" stroke-width="1.3"/></pattern>
<pattern id="pc" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#f4efc2"/><circle cx="6" cy="6" r="0.8" fill="#c9bd6a"/></pattern>
<pattern id="pw" width="12" height="8" patternUnits="userSpaceOnUse"><rect width="12" height="8" fill="#cfe8e2"/><path d="M0 5Q3 2 6 5T12 5" fill="none" stroke="#5aa79b" stroke-width="1.2"/></pattern>
</defs>`;

function svg(withLabels) {
  const alt = withLabels
    ? 'Harta simplă a României: relieful, râurile principale, Marea Neagră, țările vecine și câteva orașe'
    : 'Harta simplă a României, fără nume: relieful, râurile și Marea Neagră';
  const reliefRo = [
    `<path d="${polyPath(POLY.camp_romana)}" fill="url(#pc)"/>`,
    `<path d="${polyPath(POLY.camp_vest)}" fill="url(#pc)"/>`,
    `<path d="${polyPath(POLY.dobrogea)}" fill="url(#pp)"/>`,
    `<path d="${polyPath(POLY.moldovei)}" fill="url(#pp)"/>`,
    `<path d="${polyPath(POLY.transilvaniei)}" fill="url(#pp)"/>`,
    `<path d="${stripPath(SUBCARPATI)}" fill="none" stroke="url(#pd)" stroke-width="${stripW(SUBCARPATI)}" stroke-linejoin="round" stroke-linecap="round"/>`,
    `<path d="${polyPath(POLY.delta)}" fill="url(#pw)"/>`,
    `<path d="${polyPath(POLY.occidentali)}" fill="url(#pm)"/>`,
    `<path d="${stripPath(ORIENTALI)}" fill="none" stroke="url(#pm)" stroke-width="${stripW(ORIENTALI)}" stroke-linejoin="round" stroke-linecap="round"/>`,
    `<path d="${stripPath(MERIDIONALI)}" fill="none" stroke="url(#pm)" stroke-width="${stripW(MERIDIONALI)}" stroke-linejoin="round" stroke-linecap="round"/>`,
  ].join('');
  const rivers = Object.entries(RIVERS)
    .map(([id, r]) => `<path class="river" d="${riverPaths[id]}" stroke-width="${r.w}"/>`)
    .join('') + `<path class="river" d="${riverPaths.somesTail}" stroke-width="1.8"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${alt}">
<style>${css}</style>
${defs}
<rect width="${W}" height="${H}" fill="#bfe0f5"/>
<g fill="#e9e7e1" stroke="#b8b4a8" stroke-width="1.2" stroke-linejoin="round">${neighbourPaths.map((d) => `<path d="${d}"/>`).join('')}</g>
<path d="${roPath}" fill="#f4efc2"/>
<g clip-path="url(#ro)">${reliefRo}</g>
<path d="${roPath}" fill="none" stroke="#2b2b2b" stroke-width="2.2" stroke-linejoin="round" stroke-dasharray="7 3"/>
<g>${rivers}</g>
${cityMarks}
${withLabels ? `<g>${labels.join('')}${cityLabels}</g>` : ''}
</svg>
`;
}

const outDir = join(ROOT, 'public/content/media/geo');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'romania.svg'), svg(true));
writeFileSync(join(outDir, 'romania-blank.svg'), svg(false));

mkdirSync(join(ROOT, 'content/data/geo'), { recursive: true });
writeFileSync(
  join(ROOT, 'content/data/geo/romania-map.json'),
  JSON.stringify(
    {
      _note: 'Generated by scripts/geo/build-romania-map.mjs. x/y/r are % of the image width/height (r = % of the width). Tap targets for hotspot items; keep in sync with public/content/media/geo/romania*.svg.',
      image: { labelled: 'content/media/geo/romania.svg', blank: 'content/media/geo/romania-blank.svg', viewBox: [W, H] },
      targets,
    },
    null,
    1,
  ) + '\n',
);
console.log('viewBox', W, H, 'targets', targets.length);
