import { useTranslation } from 'react-i18next';
import type { AgeBand } from '@/older/ageBand';
import { useReadAloud } from './useReadAloud';

/**
 * Small "Citește-mi" button. Renders nothing when no matching voice exists on this device.
 * `lang="en"` speaks `text` with an English voice and is labelled "Ascultă" (the English subject).
 * `label` names it when a screen has more than one (e.g. "Ce am de făcut?" for a how-to line).
 */
export default function ReadAloudButton({
  text,
  className = '',
  lang,
  label,
  band,
}: {
  text: string;
  className?: string;
  lang?: 'en';
  label?: string;
  band?: AgeBand;
}) {
  const { t } = useTranslation();
  const { available, speaking, speak, stop } = useReadAloud(lang, band);
  if (!available || !text.trim()) return null;
  const idleLabel = label ?? (lang === 'en' ? t('items.listen') : t('items.readAloud'));
  return (
    <button
      type="button"
      onClick={() => (speaking ? stop() : speak(text))}
      aria-pressed={speaking}
      aria-label={speaking ? t('items.stopReading') : idleLabel}
      data-speech-lang={lang ?? undefined}
      className={`inline-flex min-h-[44px] items-center gap-1 rounded-full bg-ludiko-yellow px-3 text-sm font-bold text-ludiko-text shadow active:scale-95 ${className}`}
    >
      <span aria-hidden="true">{speaking ? '⏹' : lang === 'en' ? '🔊' : '🗣️'}</span>
      <span>{speaking ? t('items.stopReading') : idleLabel}</span>
    </button>
  );
}
