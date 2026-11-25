import { useTranslation } from 'react-i18next';
import type { TrueFalseItem } from '@/engine/types';
import ItemShell from './ItemShell';
import { useItemAnswer, type ItemRendererProps } from './useItemAnswer';

export default function TrueFalseItemView({ item, onAnswer, disabled, feedbackMs }: ItemRendererProps<TrueFalseItem>) {
  const { t } = useTranslation();
  const { result, submit, proceed } = useItemAnswer(item, onAnswer, feedbackMs);
  const locked = disabled || result !== null;
  const picked = result && result.response.type === 'true-false' ? result.response.value : null;

  const options: { value: boolean; label: string }[] = [
    { value: true, label: t('items.true') },
    { value: false, label: t('items.false') },
  ];

  return (
    <ItemShell
      item={item}
      result={result}
      onContinue={proceed}
      correctAnswer={item.correct ? t('items.true') : t('items.false')}
    >
      <div className="grid grid-cols-2 gap-3">
        {options.map((o) => {
          const isCorrect = result !== null && o.value === item.correct;
          const isWrongPick = result !== null && !result.correct && o.value === picked;
          const style = isCorrect
            ? 'border-green-500 bg-green-100 text-green-900 ring-2 ring-green-500'
            : isWrongPick
              ? 'border-amber-400 border-dashed bg-amber-50 text-amber-900'
              : result !== null
                ? 'border-gray-200 bg-gray-50 text-gray-400'
                : 'border-ludiko-blue bg-white text-ludiko-text hover:bg-ludiko-blue/10 active:bg-ludiko-blue/20';
          return (
            <button
              key={String(o.value)}
              type="button"
              disabled={locked}
              onClick={() => submit({ type: 'true-false', value: o.value })}
              className={`flex min-h-[72px] flex-col items-center justify-center rounded-2xl border-2 px-3 py-3 text-xl font-extrabold transition-all active:scale-95 disabled:cursor-default ${style}`}
            >
              <span>{o.label}</span>
              {isCorrect && (
                <span className="text-sm font-bold">
                  <span aria-hidden="true">✓ </span>
                  {t('items.correctMark')}
                </span>
              )}
              {isWrongPick && <span className="text-sm font-bold">{t('items.yourChoice')}</span>}
            </button>
          );
        })}
      </div>
    </ItemShell>
  );
}
