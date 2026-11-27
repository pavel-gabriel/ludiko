import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import i18n from '@/i18n/config'
import { makeGateChallenge } from '@/utils/parentalGate'
import GatedLink from '@/components/ui/GatedLink'

const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? files(p) : [p]
  })
}

function pngSize(p: string): [number, number] {
  const b = readFileSync(join(ROOT, p))
  expect(b.subarray(1, 4).toString()).toBe('PNG')
  return [b.readUInt32BE(16), b.readUInt32BE(20)]
}

describe('parental gate', () => {
  it('always builds 4 distinct options containing the right product of two factors 6-9', () => {
    for (let seed = 1; seed <= 300; seed++) {
      let x = seed
      const rng = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646
      const c = makeGateChallenge(rng)
      expect(c.a).toBeGreaterThanOrEqual(6)
      expect(c.b).toBeLessThanOrEqual(9)
      expect(c.answer).toBe(c.a * c.b)
      expect(new Set(c.options).size).toBe(4)
      expect(c.options).toContain(c.answer)
      expect(c.options.every((o) => o > 0)).toBe(true)
    }
  })

  it('survives a degenerate rng', () => {
    const c = makeGateChallenge(() => 0)
    expect(new Set(c.options).size).toBe(4)
    expect(c.options).toContain(c.answer)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('GatedLink does not navigate until the adult answers correctly', async () => {
    await i18n.changeLanguage('en')
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<GatedLink href="https://example.org/licence">Licence</GatedLink>)
    fireEvent.click(screen.getByText('Licence'))
    expect(screen.getByTestId('parental-gate')).toBeTruthy()
    expect(open).not.toHaveBeenCalled()

    const [a, b] = screen.getByTestId('gate-question').textContent!.match(/\d+/g)!.map(Number)
    const buttons = screen.getAllByRole('button').filter((el) => /^\d+$/.test(el.textContent ?? ''))
    const wrong = buttons.find((el) => Number(el.textContent) !== a * b)!
    fireEvent.click(wrong)
    expect(open).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeTruthy()

    fireEvent.click(buttons.find((el) => Number(el.textContent) === a * b)!)
    expect(open).toHaveBeenCalledWith('https://example.org/licence', '_blank', 'noopener,noreferrer')
    expect(screen.queryByTestId('parental-gate')).toBeNull()
  })

  it('cancel closes the gate without opening anything', async () => {
    await i18n.changeLanguage('en')
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<GatedLink href="https://example.org/">x</GatedLink>)
    fireEvent.click(screen.getByText('x'))
    fireEvent.click(screen.getByText(i18n.t('parentalGate.cancel')))
    expect(screen.queryByTestId('parental-gate')).toBeNull()
    expect(open).not.toHaveBeenCalled()
  })

  it('no source file links out (http(s) or mailto anchors) outside GatedLink (Kids Category rule)', () => {
    const offenders = files(join(ROOT, 'src'))
      .filter((f) => /\.tsx$/.test(f) && !f.endsWith('GatedLink.tsx'))
      .filter((f) => /<a\b[^>]*href=\{?[`"']?(https?:|mailto:)/s.test(readFileSync(f, 'utf8')))
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([])
  })

  it('has ro and en strings for the gate', () => {
    for (const l of ['ro', 'en']) {
      const d = JSON.parse(read(`src/i18n/${l}.json`))
      for (const k of ['title', 'body', 'wrong', 'cancel']) expect(d.parentalGate[k], `${l}.${k}`).toBeTruthy()
    }
  })
})

describe('PWA store readiness', () => {
  const cfg = read('vite.config.ts')

  it('manifest declares the store-relevant members', () => {
    for (const needle of [
      "id: base", "scope: base", "start_url: base", "display: 'standalone'", "lang: 'ro'", "dir: 'ltr'",
      "categories: ['education', 'kids']", "purpose: 'maskable'", "purpose: 'monochrome'", 'screenshots: [',
      "form_factor: 'narrow'", "form_factor: 'wide'",
    ]) expect(cfg, needle).toContain(needle)
  })

  it('every icon and screenshot named in the manifest exists with the declared size', () => {
    const declared = [...cfg.matchAll(/src: '((?:icons|screenshots)\/[^']+\.png)', sizes: '(\d+)x(\d+)'/g)]
    expect(declared.length).toBeGreaterThanOrEqual(9)
    for (const [, src, w, h] of declared) {
      expect(existsSync(join(ROOT, 'public', src)), src).toBe(true)
      expect(pngSize(`public/${src}`), src).toEqual([Number(w), Number(h)])
    }
  })

  it('has at least 2 phone and 1 tablet screenshot and an offline fallback page', () => {
    expect(cfg.match(/form_factor: 'narrow'/g)!.length).toBeGreaterThanOrEqual(2)
    expect(cfg.match(/form_factor: 'wide'/g)!.length).toBeGreaterThanOrEqual(1)
    expect(read('public/offline.html')).toContain('Ludiko')
  })

  it('first load makes no external request (index.html, offline page)', () => {
    for (const f of ['index.html', 'public/offline.html']) {
      expect(read(f), f).not.toMatch(/(src|href)="https?:\/\//)
      expect(read(f), f).not.toMatch(/@import|url\(https?:/)
    }
  })
})

describe('Android TWA kit', () => {
  const twa = JSON.parse(read('store/android/twa-manifest.json'))
  const links = JSON.parse(read('public/.well-known/assetlinks.json'))
  const host = read('public/CNAME').trim()

  it('twa-manifest matches the deployed domain and uses a placeholder package id', () => {
    expect(twa.host).toBe(host)
    expect(twa.packageId).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/)
    expect(twa.fullScopeUrl).toBe(`https://${host}/`)
    for (const k of ['iconUrl', 'maskableIconUrl', 'monochromeIconUrl', 'webManifestUrl']) expect(twa[k]).toContain(host)
  })

  it('assetlinks.json is valid, same package id, SHA-256 shaped (placeholder until the owner has the key)', () => {
    expect(links[0].relation).toContain('delegate_permission/common.handle_all_urls')
    expect(links[0].target.package_name).toBe(twa.packageId)
    for (const fp of links[0].target.sha256_cert_fingerprints) expect(fp).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)
  })

  it('no keystore or secret is committed', () => {
    const all = files(join(ROOT, 'store')).map((f) => relative(ROOT, f))
    expect(all.filter((f) => /\.(keystore|jks|p12|aab|apk)$/.test(f))).toEqual([])
  })
})

describe('store listing kit', () => {
  for (const [lang, short] of [['ro', 80], ['en', 80]] as const) {
    it(`${lang}: required sections, privacy URL and honest claims; limits respected`, () => {
      const md = read(`store/listing/${lang}.md`)
      expect(md).toContain('https://www.ludiko.ro/privacy')
      expect(md).toMatch(/IARC/)
      expect(md).toMatch(/PRIVACY_DATA_MAP/)
      expect(md).toMatch(/Families/)
      expect(md).toMatch(/[Bb]eta/)
      const shortLine = md.split('\n').find((_, i, a) => /^## (Descriere scurtă|Short description)/.test(a[i - 2] ?? ''))!
      expect(shortLine.length).toBeLessThanOrEqual(short)
      const kw = md.split('\n').find((_, i, a) => /^## (Cuvinte-cheie|Keywords)/.test(a[i - 2] ?? ''))!
      expect(kw.length).toBeLessThanOrEqual(100)
    })
  }

  it('iOS kit pins Capacitor exactly and does not touch the root package.json', () => {
    const readme = read('store/ios/README.md')
    expect(readme).toMatch(/@capacitor\/ios@\d+\.\d+\.\d+/)
    expect(readme).not.toMatch(/@capacitor\/[a-z-]+@\^|@latest/)
    expect(read('package.json')).not.toContain('@capacitor')
    expect(JSON.parse(read('store/ios/capacitor.config.json')).server).toBeUndefined()
  })
})
