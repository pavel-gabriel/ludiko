/**
 * Structured source for the privacy policy and the terms of use (DRAFT pending lawyer review).
 * The long text lives in `privacy.ts` / `terms.ts`; the page chrome uses the i18n namespace `legal`.
 * Facts come from `docs/PRIVACY_DATA_MAP.md`: change both together.
 */
export type LegalLang = 'ro' | 'en'

export type LegalBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h'; text: string }
  | { kind: 'ul'; items: string[] }

export interface LegalSection {
  /** Stable id (anchor and test key) */
  id: string
  title: string
  blocks: LegalBlock[]
}

export interface LegalDocument {
  title: string
  /** One or two sentences under the title */
  summary: string
  sections: LegalSection[]
}

export type LegalTexts = Record<LegalLang, LegalDocument>

/** Bump on every change of either document, and `LEGAL_UPDATED` with it */
export const LEGAL_VERSION = '2026-11-draft-2'
/** ISO date of the last change */
export const LEGAL_UPDATED = '2026-11-26'

/** Section ids every language must have, in order (checked by tests/legalPages.test.ts) */
export const PRIVACY_SECTION_IDS = [
  'who',
  'data',
  'why',
  'where',
  'retention',
  'rights',
  'children',
  'storage',
  'changes',
  'version',
  'technical',
] as const

export const TERMS_SECTION_IDS = [
  'acceptance',
  'use',
  'accounts',
  'children',
  'content',
  'licence',
  'warranty',
  'conduct',
  'changes',
  'law',
  'version',
] as const

export type PrivacySectionId = (typeof PRIVACY_SECTION_IDS)[number]
export type TermsSectionId = (typeof TERMS_SECTION_IDS)[number]

/** Where the legal pages live (react-router paths); tests check these exist in AppRoutes */
export const PRIVACY_PATH = '/privacy'
export const TERMS_PATH = '/terms'

export function getLegalLang(language: string | undefined): LegalLang {
  return language && language.toLowerCase().startsWith('en') ? 'en' : 'ro'
}
