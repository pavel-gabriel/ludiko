import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// F4: Nunito is self-hosted (OFL-1.1, content/credits.json). No request may go to Google Fonts.

const ROOT = join(__dirname, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe('self-hosted Nunito (F4)', () => {
  it('index.html, vite.config.ts and src/ never reference Google Fonts servers', () => {
    const sources = [
      join(ROOT, 'index.html'),
      join(ROOT, 'vite.config.ts'),
      ...files(join(ROOT, 'src')).filter((f) => /\.(tsx?|css|html|json)$/.test(f)),
    ];
    const offenders = sources.filter((f) => /fonts\.(googleapis|gstatic)\.com/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it('index.html has no stylesheet link to a third-party host', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    expect(html).not.toMatch(/<link[^>]+href="https?:\/\//);
  });

  it('the Nunito weights used by the UI are imported from the app origin', () => {
    const main = readFileSync(join(ROOT, 'src', 'main.tsx'), 'utf8');
    for (const weight of [400, 600, 700, 800]) {
      expect(main).toContain(`@fontsource/nunito/latin-${weight}.css`);
      expect(main).toContain(`@fontsource/nunito/latin-ext-${weight}.css`);
    }
  });

  it('the runtime caching for Google Fonts is gone from the service worker config', () => {
    const config = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
    expect(config).not.toContain('ludiko-font-styles');
    expect(config).not.toContain('ludiko-font-files');
  });

  it('credits list Nunito under OFL-1.1 with its source and version', () => {
    const credits = JSON.parse(readFileSync(join(ROOT, 'content', 'credits.json'), 'utf8')) as Array<Record<string, unknown>>;
    const nunito = credits.find((c) => c.id === 'font-nunito');
    expect(nunito).toBeDefined();
    expect(nunito).toMatchObject({ kind: 'font', licence: 'OFL-1.1', version: '5.3.0', source: 'open-licence' });
    expect(String(nunito?.url)).toContain('fontsource.org/fonts/nunito');
  });
});
