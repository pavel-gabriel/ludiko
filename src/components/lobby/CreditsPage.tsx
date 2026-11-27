import { useTranslation } from 'react-i18next';
import LegalLink from '@/components/legal/LegalLink';
import CloseButton from '@/components/ui/CloseButton';
import GatedLink from '@/components/ui/GatedLink';
import type { Provenance } from '@/engine/content/provenance';
import { RIGHTS_CONTACT } from '@/utils/constants';
import credits from '../../../content/credits.json';

const KIND_ORDER = ['image', 'audio', 'text', 'font', 'library', 'data'] as const;

/**
 * Credits & licences — generated from content/credits.json.
 * Required by docs/LEGAL_CONTENT_POLICY.md §7.
 */
export default function CreditsPage() {
  const { t } = useTranslation();
  const entries = credits as Provenance[];

  const groups = KIND_ORDER.map((kind) => ({
    kind,
    items: entries.filter((e) => e.kind === kind),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="page">
      <div className="card w-full max-w-md relative">
        <CloseButton />
        <h2 className="text-2xl font-bold mb-2 text-center">{t('credits.title')}</h2>
        <p className="text-sm text-gray-500 text-center mb-6">{t('credits.intro')}</p>

        {groups.map(({ kind, items }) => (
          <section key={kind} className="mb-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              {t(`credits.kind.${kind}`)}
            </h3>
            <ul className="space-y-2">
              {items.map((c) => (
                <li key={c.id} className="text-sm leading-snug">
                  {c.url ? (
                    <GatedLink href={c.url} className="font-semibold text-ludiko-purple hover:underline">
                      {c.title}
                    </GatedLink>
                  ) : (
                    <span className="font-semibold">{c.title}</span>
                  )}
                  {c.version && <span className="text-gray-400"> {c.version}</span>}
                  <span className="text-gray-600"> — {c.author}</span>
                  <span className="block text-xs text-gray-500">
                    {c.licenceUrl ? (
                      <GatedLink href={c.licenceUrl} className="hover:underline">
                        {c.licence}
                      </GatedLink>
                    ) : (
                      c.licence
                    )}
                    {c.modified && ` · ${t('credits.modified')}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="text-xs text-gray-500 border-t border-gray-100 pt-4">
          <span className="block font-semibold mb-1">{t('credits.copyright', { year: 2026 })}</span>
          {t('credits.ownContent')}
          {RIGHTS_CONTACT && (
            <>
              {' '}
              {t('credits.rightsContact')}{' '}
              <GatedLink href={`mailto:${RIGHTS_CONTACT}`} className="text-ludiko-purple hover:underline">
                {RIGHTS_CONTACT}
              </GatedLink>
            </>
          )}
          <span className="mt-2 flex flex-wrap gap-x-4">
            <LegalLink to="privacy" className="min-h-[44px] text-ludiko-purple hover:underline">{t('legal.privacyLink')}</LegalLink>
            <LegalLink to="terms" className="min-h-[44px] text-ludiko-purple hover:underline">{t('legal.termsLink')}</LegalLink>
          </span>
        </p>
      </div>
    </div>
  );
}
