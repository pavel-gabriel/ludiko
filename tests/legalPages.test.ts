import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '@/i18n/config'
import PrivacyPage from '@/components/legal/PrivacyPage'
import TermsPage from '@/components/legal/TermsPage'
import { PRIVACY } from '@/legal/privacy'
import { TERMS } from '@/legal/terms'
import {
  LEGAL_UPDATED,
  LEGAL_VERSION,
  PRIVACY_PATH,
  PRIVACY_SECTION_IDS,
  TERMS_PATH,
  TERMS_SECTION_IDS,
  type LegalDocument,
  type LegalLang,
} from '@/legal/types'
import { RIGHTS_CONTACT } from '@/utils/constants'

const rules = readFileSync('firestore.rules', 'utf8')
const dataMap = readFileSync('docs/PRIVACY_DATA_MAP.md', 'utf8')
const routes = readFileSync('src/app/AppRoutes.tsx', 'utf8')
const rtdbRules = readFileSync('database.rules.json', 'utf8')
const LANGS: LegalLang[] = ['ro', 'en']

/** All text of a document, flattened */
function flat(doc: LegalDocument): string {
  const out: string[] = [doc.title, doc.summary]
  for (const s of doc.sections) {
    out.push(s.title)
    for (const b of s.blocks) out.push(b.kind === 'ul' ? b.items.join('\n') : b.text)
  }
  return out.join('\n')
}

/** Every collection name used in `match /name/{...}` in firestore.rules (top level and nested) */
function firestoreCollections(): string[] {
  const names = new Set<string>()
  for (const m of rules.matchAll(/match \/([A-Za-z][A-Za-z0-9]*)\/\{/g)) {
    if (m[1] !== 'databases') names.add(m[1])
  }
  return [...names]
}

const hasWord = (text: string, word: string) => new RegExp(`\\b${word}\\b`).test(text)

function renderAt(Page: () => React.ReactElement, language: LegalLang) {
  return i18n.changeLanguage(language).then(() =>
    render(createElement(MemoryRouter, null, createElement(Page))),
  )
}

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('ro')
})

describe('legal sources (src/legal)', () => {
  it('privacy and terms have every required section, in order, in both languages', () => {
    for (const lang of LANGS) {
      expect(PRIVACY[lang].sections.map((s) => s.id), `privacy ${lang}`).toEqual([...PRIVACY_SECTION_IDS])
      expect(TERMS[lang].sections.map((s) => s.id), `terms ${lang}`).toEqual([...TERMS_SECTION_IDS])
      for (const doc of [PRIVACY[lang], TERMS[lang]]) {
        for (const s of doc.sections) {
          expect(s.title.length, s.id).toBeGreaterThan(2)
          expect(s.blocks.length, s.id).toBeGreaterThan(0)
        }
      }
    }
  })

  it('both languages carry the same structure (same number of blocks per section)', () => {
    for (const [ro, en] of [[PRIVACY.ro, PRIVACY.en], [TERMS.ro, TERMS.en]]) {
      expect(ro.sections.map((s) => s.blocks.length)).toEqual(en.sections.map((s) => s.blocks.length))
    }
  })

  it('privacy names the contact, the rights, the supervisory authority and the version', () => {
    for (const lang of LANGS) {
      const text = flat(PRIVACY[lang])
      expect(text).toContain(RIGHTS_CONTACT)
      expect(text).toContain('ANSPDCP')
      expect(text).toContain('dataprotection.ro')
      expect(text).toContain(LEGAL_VERSION)
      expect(text).toContain(LEGAL_UPDATED)
      expect(text).toMatch(/GDPR/)
    }
    const ro = flat(PRIVACY.ro)
    for (const right of ['acces', 'rectificare', 'ștergere', 'portabilitate', 'opoziție']) expect(ro).toContain(right)
    const en = flat(PRIVACY.en).toLowerCase()
    for (const right of ['access', 'rectification', 'erasure', 'portability', 'object']) expect(en).toContain(right)
  })

  it('privacy states the child-data promises: no ads, no trackers, parental consent, no cookies', () => {
    expect(flat(PRIVACY.ro)).toMatch(/nu avem reclame/)
    expect(flat(PRIVACY.ro)).toMatch(/nu setează cookie-uri/)
    expect(flat(PRIVACY.en)).toMatch(/no ads/)
    expect(flat(PRIVACY.en)).toMatch(/does not set cookies/)
    expect(flat(PRIVACY.ro)).toMatch(/părintele sau tutorele/)
    expect(flat(PRIVACY.en)).toMatch(/parent or legal guardian/)
  })

  it('the draft status is stated in the text of both documents', () => {
    expect(flat(PRIVACY.ro)).toMatch(/ciornă/i)
    expect(flat(TERMS.ro)).toMatch(/ciornă/i)
    expect(flat(PRIVACY.en)).toMatch(/draft/i)
    expect(flat(TERMS.en)).toMatch(/draft/i)
  })

  it('terms summarise the licence and say content is beta, with no warranty', () => {
    expect(flat(TERMS.ro)).toMatch(/beta/)
    expect(flat(TERMS.ro)).toMatch(/LICENSE/)
    expect(flat(TERMS.en)).toMatch(/beta/)
    expect(flat(TERMS.en)).toMatch(/as is/)
  })
})

describe('data map vs firestore.rules vs policy text', () => {
  it('finds the collections in firestore.rules (guards the parser)', () => {
    const found = firestoreCollections()
    for (const c of ['gameHistory', 'pushSubscriptions', 'families', 'children', 'classes', 'contentReports', 'teachers']) {
      expect(found).toContain(c)
    }
    expect(found.length).toBeGreaterThanOrEqual(14)
  })

  it('docs/PRIVACY_DATA_MAP.md mentions every Firestore collection', () => {
    const missing = firestoreCollections().filter((c) => !hasWord(dataMap, c))
    expect(missing).toEqual([])
  })

  it('the privacy policy text (both languages) mentions every Firestore collection', () => {
    for (const lang of LANGS) {
      const text = flat(PRIVACY[lang])
      const missing = firestoreCollections().filter((c) => !hasWord(text, c))
      expect(missing, lang).toEqual([])
    }
  })

  it('the Realtime Database rooms are documented in both places', () => {
    expect(rtdbRules).toContain('"rooms"')
    expect(hasWord(dataMap, 'rooms')).toBe(true)
    for (const lang of LANGS) expect(hasWord(flat(PRIVACY[lang]), 'rooms')).toBe(true)
  })

  it('the data map lists its findings and the localStorage keys it audited', () => {
    for (const key of ['ludiko-settings', 'ludiko.push.v1', 'ludiko.family.v1', 'ludiko-profiles', 'FINDINGS']) {
      expect(dataMap).toContain(key)
    }
  })
})

describe('pages', () => {
  it.each([
    ['privacy', PrivacyPage, PRIVACY, PRIVACY_SECTION_IDS],
    ['terms', TermsPage, TERMS, TERMS_SECTION_IDS],
  ] as const)('/%s renders every section in Romanian and in English', async (_name, Page, texts, ids) => {
    for (const lang of LANGS) {
      await renderAt(Page, lang)
      expect(screen.getByTestId('legal-title')).toHaveTextContent(texts[lang].title)
      for (const id of ids) {
        const section = screen.getByTestId(`legal-section-${id}`)
        const title = texts[lang].sections.find((s) => s.id === id)!.title
        expect(section).toHaveTextContent(title)
      }
      expect(screen.getByTestId('legal-version')).toHaveTextContent(LEGAL_VERSION)
      cleanup()
    }
  })

  it('shows the draft banner in both languages', async () => {
    await renderAt(PrivacyPage, 'ro')
    expect(screen.getByTestId('legal-draft-banner')).toHaveTextContent('Ciornă — în curs de verificare juridică')
    cleanup()
    await renderAt(TermsPage, 'en')
    expect(screen.getByTestId('legal-draft-banner')).toHaveTextContent(/Draft/)
  })

  it('has an in-page language switch', async () => {
    await renderAt(PrivacyPage, 'ro')
    expect(screen.getByTestId('legal-title')).toHaveTextContent('Politica de confidențialitate')
    fireEvent.click(screen.getByTestId('legal-lang-en'))
    expect(screen.getByTestId('legal-title')).toHaveTextContent('Privacy policy')
    expect(screen.getByTestId('legal-draft-banner')).toHaveTextContent(/Draft/)
    fireEvent.click(screen.getByTestId('legal-lang-ro'))
    expect(screen.getByTestId('legal-title')).toHaveTextContent('Politica de confidențialitate')
  })

  it('links the contact address and every internal link points at a real route', async () => {
    for (const Page of [PrivacyPage, TermsPage]) {
      await renderAt(Page, 'ro')
      const mailto = document.querySelector(`a[href="mailto:${RIGHTS_CONTACT}"]`)
      expect(mailto).not.toBeNull()
      const anchors = Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')!)
      for (const href of anchors) {
        if (href.startsWith('#legal-')) {
          expect(document.getElementById(href.slice(1)), href).not.toBeNull()
        } else if (href.startsWith('/')) {
          expect(routes, href).toContain(`path="${href}"`)
        }
      }
      cleanup()
    }
  })
})

describe('links to the legal pages', () => {
  it('the routes exist and are lazy', () => {
    expect(routes).toContain(`path="${PRIVACY_PATH}"`)
    expect(routes).toContain(`path="${TERMS_PATH}"`)
    expect(routes).toMatch(/const PrivacyPage = lazy\(/)
    expect(routes).toMatch(/const TermsPage = lazy\(/)
  })

  it.each([
    'src/components/family/FamilyAccountCard.tsx',
    'src/components/lobby/SettingsPage.tsx',
    'src/components/lobby/CreditsPage.tsx',
    'src/ui/learn/ParentView.tsx',
    'src/ui/learn/RemindersCard.tsx',
    'src/components/profiles/ClassLinkSection.tsx',
  ])('%s links to /privacy', (file) => {
    const src = readFileSync(file, 'utf8')
    expect(src).toMatch(/<LegalLink to="privacy"/)
  })

  it('the "coming soon" privacy placeholders are gone from both languages', () => {
    for (const file of ['src/i18n/ro.json', 'src/i18n/en.json']) {
      const text = readFileSync(file, 'utf8')
      expect(text).not.toMatch(/confiden[țt]ialitate \(în curând\)/i)
      expect(text).not.toMatch(/privacy policy \(coming soon\)/i)
    }
  })

  it('LegalLink renders a real anchor to the page, inside and outside a router', async () => {
    const { default: LegalLink } = await import('@/components/legal/LegalLink')
    const { unmount } = render(createElement(LegalLink, { to: 'privacy' }, 'x'))
    expect(screen.getByTestId('legal-link-privacy')).toHaveAttribute('href', PRIVACY_PATH)
    unmount()
    render(createElement(MemoryRouter, null, createElement(LegalLink, { to: 'terms' }, 'y')))
    expect(screen.getByTestId('legal-link-terms')).toHaveAttribute('href', TERMS_PATH)
  })
})
