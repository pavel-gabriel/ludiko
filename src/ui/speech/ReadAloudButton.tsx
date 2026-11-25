import { useTranslation } from 'react-i18next';
import { useReadAloud } from './useReadAloud';

/** Small "Citește-mi" button. Renders nothing when no matching voice exists on this device. */
export default function ReadAloudButton({ text, className = '' }: { text: string; className?: string }) {
  const { t } = useTranslation();
  const { available, speaking, speak, stop } = useReadAloud();
  if (!available || !text.trim()) return null;
  return (
    <button
      type="button"
      onClick={() => (speaking ? stop() : speak(text))}
      aria-pressed={speaking}
      aria-label={speaking ? t('items.stopReading') : t('items.readAloud')}
      className={`inline-flex min-h-[44px] items-center gap-1 rounded-full bg-ludiko-yellow px-3 text-sm font-bold text-ludiko-text shadow active:scale-95 ${className}`}
    >
      <span aria-hidden="true">{speaking ? '⏹' : '🗣️'}</span>
      <span>{speaking ? t('items.stopReading') : t('items.readAloud')}</span>
    </button>
  );
}
