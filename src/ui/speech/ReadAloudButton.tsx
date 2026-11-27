import { useTranslation } from 'react-i18next';
import { useReadAloud } from './useReadAloud';

/**
 * Small "Citește-mi" button. Renders nothing when no matching voice exists on this device.
 * `lang="en"` speaks `text` with an English voice and is labelled "Ascultă" (the English subject).
 */
export default function ReadAloudButton({ text, className = '', lang }: { text: string; className?: string; lang?: 'en' }) {
  const { t } = useTranslation();
  const { available, speaking, speak, stop } = useReadAloud(lang);
  if (!available || !text.trim()) return null;
  const idleLabel = lang === 'en' ? t('items.listen') : t('items.readAloud');
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
