import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NumberInputItem } from '@/engine/types';
import ItemShell from './ItemShell';
import Numpad from './Numpad';
import { useItemAnswer, type ItemRendererProps } from './useItemAnswer';

export default function NumberInputItemView({
  item,
  onAnswer,
  disabled,
  feedbackMs,
}: ItemRendererProps<NumberInputItem>) {
  const { t } = useTranslation();
  const { result, submit, proceed } = useItemAnswer(item, onAnswer, feedbackMs);
  const [value, setValue] = useState('');
  const locked = disabled || result !== null;

  const tone = result === null ? 'border-ludiko-blue bg-white' : result.correct ? 'border-green-500 bg-green-100' : 'border-amber-400 bg-amber-50';

  return (
    <ItemShell item={item} result={result} onContinue={proceed} correctAnswer={String(item.correct)}>
      <output
        aria-label={t('items.yourAnswer')}
        aria-live="off"
        className={`mx-auto mb-3 flex min-h-[64px] max-w-xs items-center justify-center rounded-2xl border-2 px-4 text-4xl font-extrabold tracking-wider text-ludiko-text ${tone}`}
      >
        {value === '' ? <span className="text-gray-300" aria-hidden="true">?</span> : value}
        {result?.correct && <span className="ml-2 text-green-700" aria-hidden="true">✓</span>}
      </output>
      <Numpad
        value={value}
        onChange={setValue}
        onSubmit={() => submit({ type: 'number-input', value: Number(value) })}
        disabled={locked}
      />
    </ItemShell>
  );
}
