import { useTranslation } from 'react-i18next';
import { localize, type VisualSpec } from '@/engine/types';

/**
 * TEMPORARY fallback for <Visual spec={VisualSpec} /> (src/ui/visuals/, built by another agent).
 * Renders a plain text/emoji description of the spec. The integrator swaps in the real component
 * by changing ONLY this file: `export default function VisualSlot({ spec }) { return <Visual spec={spec} />; }`
 */
export interface VisualSlotProps {
  spec: VisualSpec;
  className?: string;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function VisualSlot({ spec, className = '' }: VisualSlotProps) {
  const { t, i18n } = useTranslation();
  const base = `inline-flex max-w-full flex-wrap items-center justify-center gap-1 rounded-xl bg-ludiko-yellow/60 px-3 py-2 text-ludiko-text ${className}`;

  switch (spec.kind) {
    case 'objects': {
      const total = Math.max(0, Math.min(spec.count, 60));
      const groups = spec.groups && spec.groups > 1 ? spec.groups : 1;
      const perGroup = Math.ceil(total / groups);
      const label = t('items.visual.objects', { count: spec.count });
      return (
        <span role="img" aria-label={`${label} ${spec.icon}`} className={`${base} text-3xl leading-tight`}>
          {Array.from({ length: groups }, (_, g) => {
            const n = Math.min(perGroup, total - g * perGroup);
            return (
              <span
                key={g}
                aria-hidden="true"
                className={`flex max-w-full flex-wrap justify-center ${groups > 1 ? 'rounded-lg border-2 border-dashed border-gray-300 px-1.5 py-0.5' : ''}`}
              >
                {Array.from({ length: Math.max(0, n) }, (_, i) => (
                  <span key={i}>{spec.icon}</span>
                ))}
              </span>
            );
          })}
        </span>
      );
    }
    case 'number-line': {
      const text = t('items.visual.numberLine', { from: spec.from, to: spec.to });
      return (
        <span role="img" aria-label={text} className={`${base} text-base font-semibold`}>
          <span aria-hidden="true">🔢 {text}</span>
        </span>
      );
    }
    case 'base10-blocks': {
      const text = t('items.visual.base10', { h: spec.hundreds ?? 0, t: spec.tens ?? 0, o: spec.ones ?? 0 });
      return (
        <span role="img" aria-label={text} className={`${base} text-base font-semibold`}>
          <span aria-hidden="true">🧱 {text}</span>
        </span>
      );
    }
    case 'clock': {
      const text = t('items.visual.clock', { time: `${pad(spec.hours)}:${pad(spec.minutes)}` });
      return (
        <span role="img" aria-label={text} className={`${base} text-base font-semibold`}>
          <span aria-hidden="true">🕒 {text}</span>
        </span>
      );
    }
    case 'money': {
      const text = t('items.visual.money', { amounts: spec.amounts.join(', ') });
      return (
        <span role="img" aria-label={text} className={`${base} text-base font-semibold`}>
          <span aria-hidden="true">🪙 {text}</span>
        </span>
      );
    }
    case 'fraction': {
      const text = t('items.visual.fraction', { n: spec.numerator, d: spec.denominator });
      return (
        <span role="img" aria-label={text} className={`${base} text-base font-semibold`}>
          <span aria-hidden="true">🍕 {text}</span>
        </span>
      );
    }
    case 'image': {
      const alt = localize(spec.media.alt, i18n.language) || t('items.visual.image');
      return (
        <span role="img" aria-label={alt} className={`${base} text-base font-semibold`}>
          <span aria-hidden="true">🖼️ {alt}</span>
        </span>
      );
    }
    default:
      return null;
  }
}
