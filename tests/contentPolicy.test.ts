import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  ALLOWED_LICENCES,
  PROVENANCE_KINDS,
  PROVENANCE_SOURCES,
  validateProvenance,
  validateProvenanceTree,
} from '../src/engine/content/provenance';

const ROOT = join(__dirname, '..');
const CONTENT = join(ROOT, 'content');

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'schema' ? [] : jsonFiles(p);
    return name.endsWith('.json') ? [p] : [];
  });
}

const ok = {
  id: 'img-1',
  kind: 'image',
  title: 'Danube Delta map',
  author: 'Jane Doe',
  source: 'open-licence',
  licence: 'CC-BY-SA-4.0',
  url: 'https://commons.wikimedia.org/wiki/File:Example.svg',
  retrieved: '2026-11-25',
};

describe('content policy (docs/LEGAL_CONTENT_POLICY.md)', () => {
  it('every entry in content/credits.json is valid and unique', () => {
    const credits = JSON.parse(readFileSync(join(CONTENT, 'credits.json'), 'utf8'));
    expect(Array.isArray(credits)).toBe(true);
    const ids = new Set<string>();
    const errors: string[] = [];
    credits.forEach((c: { id: string }, i: number) => {
      errors.push(...validateProvenance(c, `credits[${i}]`));
      if (ids.has(c.id)) errors.push(`credits[${i}]: duplicate id ${c.id}`);
      ids.add(c.id);
    });
    expect(errors).toEqual([]);
  });

  it('every provenance object under content/ is valid', () => {
    const seen = new Set<string>();
    const errors = jsonFiles(CONTENT)
      .filter((f) => !f.endsWith('credits.json'))
      .flatMap((f) =>
        validateProvenanceTree(JSON.parse(readFileSync(f, 'utf8')), relative(ROOT, f), seen),
      );
    expect(errors).toEqual([]);
  });

  it('the JSON schema allowlists match the validator', () => {
    const schema = JSON.parse(readFileSync(join(CONTENT, 'schema', 'provenance.schema.json'), 'utf8'));
    expect(schema.properties.licence.enum).toEqual([...ALLOWED_LICENCES]);
    expect(schema.properties.kind.enum).toEqual([...PROVENANCE_KINDS]);
    expect(schema.properties.source.enum).toEqual([...PROVENANCE_SOURCES]);
  });

  it('accepts a complete open-licence record', () => {
    expect(validateProvenance(ok)).toEqual([]);
  });

  it('accepts own and generated work without url', () => {
    expect(validateProvenance({ id: 'a', kind: 'item', title: 't', author: 'Ludiko', source: 'own', licence: 'OWN' })).toEqual([]);
    expect(validateProvenance({ id: 'b', kind: 'item', title: 't', author: 'Ludiko', source: 'generated', licence: 'OWN' })).toEqual([]);
  });

  it.each(['CC-BY-NC-4.0', 'CC-BY-ND-4.0', 'CC-BY-NC-SA-4.0', 'CC BY-NC 3.0'])('rejects %s', (licence) => {
    const errs = validateProvenance({ ...ok, licence });
    expect(errs.join(' ')).toMatch(/NC\/ND/);
  });

  it('rejects unknown licences and "all rights reserved"', () => {
    expect(validateProvenance({ ...ok, licence: 'All rights reserved' })).not.toEqual([]);
    expect(validateProvenance({ ...ok, licence: 'GPL-3.0' })).not.toEqual([]);
  });

  it('rejects third-party material without url or retrieval date', () => {
    const { url: _u, retrieved: _r, ...noTrace } = ok;
    const errs = validateProvenance(noTrace);
    expect(errs.some((e) => e.includes('url'))).toBe(true);
    expect(errs.some((e) => e.includes('retrieved'))).toBe(true);
  });

  it('rejects public domain without a basis', () => {
    const errs = validateProvenance({ ...ok, source: 'public-domain', licence: 'PD' });
    expect(errs.some((e) => e.includes('basis'))).toBe(true);
  });

  it('rejects mismatched source/licence (e.g. AI draft claiming CC BY)', () => {
    expect(validateProvenance({ ...ok, source: 'ai-draft', licence: 'CC-BY-4.0' })).not.toEqual([]);
    expect(validateProvenance({ ...ok, source: 'own', licence: 'MIT' })).not.toEqual([]);
  });

  it('rejects missing author/title and unknown fields', () => {
    const errs = validateProvenance({ ...ok, author: '', title: undefined, publisher: 'X' });
    expect(errs.some((e) => e.includes('"author"'))).toBe(true);
    expect(errs.some((e) => e.includes('"title"'))).toBe(true);
    expect(errs.some((e) => e.includes('"publisher"'))).toBe(true);
  });

  it('finds nested provenance and duplicate ids in content trees', () => {
    const tree = {
      items: [
        { id: 'q1', provenance: { ...ok, id: 'p1' } },
        { id: 'q2', provenance: { ...ok, id: 'p1', licence: 'CC-BY-NC-4.0' } },
      ],
    };
    const errs = validateProvenanceTree(tree, 'test.json');
    expect(errs.some((e) => e.includes('duplicate id'))).toBe(true);
    expect(errs.some((e) => e.includes('NC/ND'))).toBe(true);
  });

  it('CI-only tools (web-push, firebase-admin) are never imported by shipped code', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(m?[jt]sx?)$/.test(name)) {
          const src = readFileSync(p, 'utf8');
          if (/from\s+['"](web-push|firebase-admin)|require\(['"](web-push|firebase-admin)/.test(src)) {
            offenders.push(relative(ROOT, p));
          }
        }
      }
    };
    walk(join(ROOT, 'src'));
    walk(join(ROOT, 'public'));
    expect(offenders).toEqual([]);
  });
});
