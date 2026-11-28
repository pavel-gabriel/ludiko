import { Fragment, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import CloseButton from '@/components/ui/CloseButton'
import GatedLink from '@/components/ui/GatedLink'
import {
  LEGAL_UPDATED,
  LEGAL_VERSION,
  PRIVACY_PATH,
  TERMS_PATH,
  getLegalLang,
  type LegalBlock,
  type LegalDocument,
  type LegalLang,
  type LegalTexts,
} from '@/legal/types'
import { RIGHTS_CONTACT } from '@/utils/constants'

interface LegalPageProps {
  /** Which document this is, for the cross-link and the test ids */
  kind: 'privacy' | 'terms'
  texts: LegalTexts
}

/** Turns the rights-contact address inside a text into a mailto link */
function withContactLink(text: string): ReactNode {
  if (!RIGHTS_CONTACT || !text.includes(RIGHTS_CONTACT)) return text
  const parts = text.split(RIGHTS_CONTACT)
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 && (
        <GatedLink href={`mailto:${RIGHTS_CONTACT}`} className="font-semibold text-ludiko-purple underline">
          {RIGHTS_CONTACT}
        </GatedLink>
      )}
    </Fragment>
  ))
}

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === 'h') return <h3 className="mt-3 text-base font-extrabold">{block.text}</h3>
  if (block.kind === 'ul') {
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
        {block.items.map((item) => (
          <li key={item}>{withContactLink(item)}</li>
        ))}
      </ul>
    )
  }
  return <p className="text-sm leading-relaxed">{withContactLink(block.text)}</p>
}

/**
 * Shared page for /privacy and /terms: a "draft" banner, a language switch (defaults to the app language),
 * a table of contents, the sections from `src/legal/*`, and the version line. Text lives in `src/legal`,
 * page chrome in the i18n namespace `legal`.
 */
export default function LegalPage({ kind, texts }: LegalPageProps) {
  const { i18n } = useTranslation()
  const [lang, setLang] = useState<LegalLang>(getLegalLang(i18n.resolvedLanguage ?? i18n.language))
  const t = i18n.getFixedT(lang)
  const doc: LegalDocument = texts[lang]
  const other = kind === 'privacy' ? TERMS_PATH : PRIVACY_PATH

  return (
    <div className="flex min-h-screen flex-col items-center p-4" data-testid={`legal-${kind}`} lang={lang}>
      <div className="card relative w-full max-w-2xl">
        <CloseButton />

        <div
          role="note"
          className="mb-4 mr-10 rounded-xl border-2 border-ludiko-yellow bg-ludiko-yellow/30 p-3 text-sm font-bold"
          data-testid="legal-draft-banner"
        >
          {t('legal.draftBanner')}
        </div>

        <div className="mb-3 flex gap-1" role="group" aria-label={t('legal.language')}>
          {(['ro', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              data-testid={`legal-lang-${l}`}
              className={`min-h-[44px] rounded-lg px-4 text-sm font-bold ${
                lang === l ? 'bg-ludiko-purple text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <h1 className="mb-2 text-2xl font-extrabold" data-testid="legal-title">
          {doc.title}
        </h1>
        <p className="mb-4 text-sm text-gray-600">{doc.summary}</p>

        <nav aria-label={t('legal.contents')} className="mb-6 rounded-xl bg-gray-50 p-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">{t('legal.contents')}</p>
          <ol className="list-decimal space-y-0.5 pl-5 text-sm">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a href={`#legal-${s.id}`} className="inline-flex min-h-[44px] items-center text-ludiko-purple hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {doc.sections.map((s) => (
          <section key={s.id} id={`legal-${s.id}`} className="mb-6 space-y-2" data-testid={`legal-section-${s.id}`}>
            <h2 className="text-lg font-extrabold">{s.title}</h2>
            {s.blocks.map((b, i) => (
              <Block key={i} block={b} />
            ))}
          </section>
        ))}

        <footer className="border-t border-gray-100 pt-4 text-xs text-gray-500">
          <p data-testid="legal-version">
            {t('legal.version', { version: LEGAL_VERSION, date: LEGAL_UPDATED })}
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <Link to={other} className="min-h-[44px] font-semibold text-ludiko-purple hover:underline" data-testid="legal-other-link">
              {t(kind === 'privacy' ? 'legal.termsLink' : 'legal.privacyLink')}
            </Link>
            <Link to="/credits" className="min-h-[44px] font-semibold text-ludiko-purple hover:underline">
              {t('credits.title')}
            </Link>
          </p>
        </footer>
      </div>
    </div>
  )
}
