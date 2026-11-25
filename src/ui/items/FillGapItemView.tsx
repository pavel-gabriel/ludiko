import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseNumeric } from '@/engine/items/check';
import { localize, type FillGapItem } from '@/engine/types';
import ItemShell from './ItemShell';
import Numpad from './Numpad';
import { useItemAnswer, type ItemRendererProps } from './useItemAnswer';

const GAP = '{{gap}}';

/** Sentence/equation with the gap shown inline as a box */
function Sentence({ template, gap, tone }: { template: string; gap: string; tone: string }) {
  const { t } = useTranslation();
  const parts = template.includes(GAP) ? template.split(GAP) : [template, ''];
  const box = (
    <span
      role="img"
      aria-label={gap !== '' ? gap : t('items.gap')}
      className={`mx-1 inline-flex min-h-[48px] min-w-[56px] items-center justify-center rounded-xl border-2 px-2 align-middle ${tone}`}
    >
      <span aria-hidden="true">{gap === '' ? '?' : gap}</span>
    </span>
  );
  return (
    <p className="mb-4 text-center text-3xl font-extrabold leading-relaxed text-ludiko-text">
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 ? box : null}
        </span>
      ))}
    </p>
  );
}

export default function FillGapItemView({ item, onAnswer, disabled, feedbackMs }: ItemRendererProps<FillGapItem>) {
  const { t, i18n } = useTranslation();
  const { result, submit, proceed } = useItemAnswer(item, onAnswer, feedbackMs);
  const [value, setValue] = useState('');
  const locked = disabled || result !== null;
  const template = localize(item.template, i18n.language);
  const numeric = parseNumeric(item.correct) !== null;

  const tone =
    result === null
      ? 'border-ludiko-blue border-dashed bg-white'
      : result.correct
        ? 'border-green-500 bg-green-100 text-green-900'
        : 'border-amber-400 bg-amber-50 text-amber-900';

  const send = (v: string) => submit({ type: 'fill-gap', value: v });

  return (
    <ItemShell
      item={item}
      result={result}
      onContinue={proceed}
      correctAnswer={<Sentence template={template} gap={item.correct} tone="border-green-500 bg-green-100 text-green-900" />}
    >
      <Sentence template={template} gap={value} tone={tone} />

      {item.options && item.options.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {item.options.map((o) => (
            <button
              key={o}
              type="button"
              disabled={locked}
              onClick={() => {
                setValue(o);
                send(o);
              }}
              className="min-h-[60px] rounded-2xl border-2 border-ludiko-blue bg-white px-3 py-2 text-2xl font-extrabold text-ludiko-text active:scale-95 active:bg-ludiko-blue/20 disabled:cursor-default disabled:opacity-60"
            >
              {o}
            </button>
          ))}
        </div>
      ) : numeric ? (
        <Numpad value={value} onChange={setValue} onSubmit={() => send(value)} disabled={locked} />
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!locked && value.trim() !== '') send(value);
          }}
        >
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={locked}
            aria-label={t('items.typeAnswer')}
            placeholder={t('items.typeAnswer')}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="min-h-[56px] min-w-0 flex-1 rounded-xl border-2 border-ludiko-blue px-3 text-xl font-bold text-ludiko-text"
          />
          <button
            type="submit"
            disabled={locked || value.trim() === ''}
            className="min-h-[56px] rounded-xl bg-ludiko-green px-5 text-xl font-extrabold text-ludiko-text shadow-md active:scale-95 disabled:opacity-40"
          >
            {t('items.done')}
          </button>
        </form>
      )}
    </ItemShell>
  );
}
