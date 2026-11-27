/**
 * Vite plugin: content packs (docs/ENGINE.md "Content packs", docs/PLAN.md §10).
 *
 * 1. Virtual modules `virtual:ludiko-pack/<packId>` (e.g. `mat-p`): the static items and explanations of
 *    one subject × grade band, split by record (an item goes to its skill's pack; an explanation to the
 *    pack of every skill or item that references it), so a grade I child never downloads grade VIII banks.
 *    Imported only by src/engine/content/packs/<packId>.ts, which also pulls that pack's generators.
 * 2. `packOnlyChunks`: after bundling, the JS chunks reachable only through a pack (pack modules,
 *    generators, datasets). vite.config.ts drops them from the workbox precache (`manifestTransforms`);
 *    they are runtime-cached (CacheFirst) and prefetched for the active profile instead.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { packIdOf } from '../src/engine/content/packIds';

const PREFIX = 'virtual:ludiko-pack/';
const RESOLVED = '\0' + PREFIX;
/** Pack entry modules: one per pack, src/engine/content/packs/<packId>.ts */
const PACK_ENTRY = /[\\/]src[\\/]engine[\\/]content[\\/]packs[\\/][^\\/]+\.ts$/;

interface Rec {
  id: string;
  skillId?: string;
  explanationId?: string;
  subject?: string;
  grade?: number;
  explanations?: string[];
}

interface Packs {
  byPack: Map<string, { items: unknown[]; explanations: unknown[] }>;
  files: string[];
}

function walk(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const p = path.join(dir, name);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') ? [p] : [];
    });
}

function readArrays(dir: string, files: string[]): Rec[] {
  return walk(dir).flatMap((f) => {
    files.push(f);
    const data = JSON.parse(readFileSync(f, 'utf8'));
    return Array.isArray(data) ? (data as Rec[]) : [];
  });
}

/** Split content/{items,explanations} into packs (same record order as the files, sorted by path) */
export function buildPacks(contentDir: string, warn: (msg: string) => void = () => {}): Packs {
  const files: string[] = [];
  const skills = readArrays(path.join(contentDir, 'skills'), files);
  const items = readArrays(path.join(contentDir, 'items'), files);
  const explanations = readArrays(path.join(contentDir, 'explanations'), files);

  const byPack: Packs['byPack'] = new Map();
  const pack = (id: string) => {
    let p = byPack.get(id);
    if (!p) byPack.set(id, (p = { items: [], explanations: [] }));
    return p;
  };
  const skillPack = new Map<string, string>();
  for (const s of skills) {
    const id = packIdOf(String(s.subject), Number(s.grade));
    skillPack.set(s.id, id);
    pack(id);
  }

  /* explanation id -> packs that need it */
  const expPacks = new Map<string, Set<string>>();
  const need = (expId: string | undefined, packId: string) => {
    if (!expId) return;
    let set = expPacks.get(expId);
    if (!set) expPacks.set(expId, (set = new Set()));
    set.add(packId);
  };
  for (const s of skills) {
    const p = skillPack.get(s.id)!;
    for (const e of s.explanations ?? []) need(e, p);
    need(s.id, p); // an explanation may be looked up by the skill id itself
  }
  for (const it of items) {
    const p = it.skillId ? skillPack.get(it.skillId) : undefined;
    if (!p) {
      warn(`content pack: item ${it.id} has unknown skill ${it.skillId}; left out`);
      continue;
    }
    pack(p).items.push(it);
    need(it.explanationId, p);
  }
  for (const e of explanations) {
    const targets = expPacks.get(e.id);
    if (!targets) {
      // Not referenced by any skill or item: nothing can look it up (tests/contentPacks.test.ts)
      warn(`content pack: explanation ${e.id} is not referenced by any skill or item; left out`);
      continue;
    }
    for (const p of targets) pack(p).explanations.push(e);
  }
  return { byPack, files };
}

export function contentPacksPlugin(opts: { contentDir: string }): Plugin & { packOnlyChunks: Set<string> } {
  let cache: Packs | null = null;
  const packOnlyChunks = new Set<string>();
  const load = (warn?: (m: string) => void) => (cache ??= buildPacks(opts.contentDir, warn));

  return {
    name: 'ludiko-content-packs',
    packOnlyChunks,
    resolveId(id) {
      if (id.startsWith(PREFIX)) return RESOLVED + id.slice(PREFIX.length);
      return null;
    },
    load(id) {
      if (!id.startsWith(RESOLVED)) return null;
      const packId = id.slice(RESOLVED.length);
      const { byPack, files } = load((m) => this.warn(m));
      for (const f of files) this.addWatchFile(f);
      const data = byPack.get(packId);
      if (!data) this.error(`Unknown content pack "${packId}"`);
      // JSON.parse of a string literal is faster to parse than an object literal of the same size
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(data))});`;
    },
    handleHotUpdate(ctx) {
      if (ctx.file.startsWith(path.resolve(opts.contentDir))) cache = null;
    },
    watchChange(id) {
      if (id.startsWith(path.resolve(opts.contentDir))) cache = null;
    },
    generateBundle(_options, bundle) {
      /* Chunks reachable from the app without passing through a pack entry stay precached */
      packOnlyChunks.clear();
      const chunks = Object.values(bundle).filter((c) => c.type === 'chunk');
      const byFile = new Map(chunks.map((c) => [c.fileName, c]));
      const isPackEntry = (c: (typeof chunks)[number]) =>
        c.type === 'chunk' && c.isDynamicEntry && !!c.facadeModuleId && PACK_ENTRY.test(c.facadeModuleId);
      const reached = new Set<string>();
      const queue = chunks.filter((c) => c.type === 'chunk' && c.isEntry).map((c) => c.fileName);
      while (queue.length) {
        const f = queue.shift()!;
        if (reached.has(f)) continue;
        const c = byFile.get(f);
        if (!c || c.type !== 'chunk' || isPackEntry(c)) continue;
        reached.add(f);
        queue.push(...c.imports, ...c.dynamicImports);
      }
      for (const c of chunks) if (!reached.has(c.fileName)) packOnlyChunks.add(c.fileName);
    },
  };
}
