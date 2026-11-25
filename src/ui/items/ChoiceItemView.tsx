import { useTranslation } from 'react-i18next';
import { localize, type ChoiceItem, type PictureChoiceItem } from '@/engine/types';
import ItemShell, { CardFace } from './ItemShell';
import { useItemAnswer, type ItemRendererProps } from './useItemAnswer';

/** `choice` and `picture-choice`: tap one option, answered immediately */
export default function ChoiceItemView({
  item,
  onAnswer,
  disabled,
  feedbackMs,
}: ItemRendererProps<ChoiceItem | PictureChoiceItem>) {
  const { t, i18n } = useTranslation();
  const { result, submit, proceed } = useItemAnswer(item, onAnswer, feedbackMs);
  const locked = disabled || result !== null;
  const selectedId = result && 'selectedId' in result.response ? result.response.selectedId : null;
  const correct = item.options.find((o) => o.id === item.correctId);

  const wide = item.options.some(
    (o) => !o.visual && (localize(o.text, i18n.language).length > 14 || item.options.length > 4),
  );

  return (
    <ItemShell
      item={item}
      result={result}
      onContinue={proceed}
      correctAnswer={correct ? <CardFace card={correct} /> : null}
    >
      <div className={`grid gap-3 ${wide ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {item.options.map((option) => {
          const isCorrect = result !== null && option.id === item.correctId;
          const isWrongPick = result !== null && !result.correct && option.id === selectedId;
          const style = isCorrect
            ? 'border-green-500 bg-green-100 text-green-900 ring-2 ring-green-500'
            : isWrongPick
              ? 'border-amber-400 bg-amber-50 text-amber-900 border-dashed'
              : result !== null
                ? 'border-gray-200 bg-gray-50 text-gray-400'
                : 'border-ludiko-blue bg-white text-ludiko-text hover:bg-ludiko-blue/10 active:bg-ludiko-blue/20';
          return (
            <button
              key={option.id}
              type="button"
              disabled={locked}
              onClick={() => submit({ type: item.type, selectedId: option.id })}
              className={`relative flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl border-2 px-3 py-3 text-xl font-extrabold transition-all active:scale-95 disabled:cursor-default ${style}`}
            >
              <CardFace card={option} />
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
