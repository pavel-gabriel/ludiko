import { useTranslation } from 'react-i18next';
import { useReadAloud } from './useReadAloud';

/**
 * Small "Citește-mi" button. Renders nothing when no matching voice exists on this device.
 * `label` names it when a screen has more than one (e.g. "Ce am de făcut?" for a how-to line).
 */
export default function ReadAloudButton({ text, className = '', label }: { text: string; className?: string; label?: string }) {
  const { t } = useTranslation();
  const { available, speaking, speak, stop } = useReadAloud();
  if (!available || !text.trim()) return null;
  return (
    <button
      type="button"
      onClick={() => (speaking ? stop() : speak(text))}
      aria-pressed={speaking}
      aria-label={speaking ? t('items.stopReading') : (label ?? t('items.readAloud'))}
      className={`inline-flex min-h-[44px] items-center gap-1 rounded-full bg-ludiko-yellow px-3 text-sm font-bold text-ludiko-text shadow active:scale-95 ${className}`}
    >
      <span aria-hidden="true">{speaking ? '⏹' : '🗣️'}</span>
      <span>{speaking ? t('items.stopReading') : (label ?? t('items.readAloud'))}</span>
    </button>
  );
}
