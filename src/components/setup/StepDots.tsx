import { useTranslation } from 'react-i18next';

/** "Pasul 2 din 4" with one dot per step; the current one is a wide pill */
export default function StepDots({ index, total }: { index: number; total: number }) {
  const { t } = useTranslation();
  const label = t('setup.progress', { n: index + 1, total });
  return (
    <div className="flex items-center gap-2" data-testid="step-progress">
      <ol className="flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <li
            key={i}
            data-testid="step-dot"
            data-state={i < index ? 'done' : i === index ? 'current' : 'todo'}
            className={`h-2.5 rounded-full transition-all ${
              i === index ? 'w-7 bg-ludiko-purple' : i < index ? 'w-2.5 bg-ludiko-purple/60' : 'w-2.5 bg-gray-300'
            }`}
          />
        ))}
      </ol>
      <span className="text-xs font-semibold text-gray-500">{label}</span>
    </div>
  );
}
