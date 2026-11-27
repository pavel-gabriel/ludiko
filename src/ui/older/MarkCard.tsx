import { useTranslation } from 'react-i18next'
import { formatMark } from '@/older/marks'

/**
 * "Nota estimată: 8,50" with the standing reminder that it is an estimate. Calm tone, never red, never a
 * "fail" state: a low mark reads exactly like a high one, and the stars/next step carry the encouragement.
 */
export default function MarkCard({ mark, className = '' }: { mark: number; className?: string }) {
  const { t, i18n } = useTranslation()
  return (
    <div className={`rounded-2xl bg-ludiko-bg px-4 py-3 text-center ${className}`} data-testid="estimated-mark">
      <p className="text-xl font-extrabold text-ludiko-text">{t('older.mark.label', { mark: formatMark(mark, i18n.language) })}</p>
      <p className="text-sm font-semibold text-ludiko-text/70">{t('older.mark.disclaimer')}</p>
    </div>
  )
}
