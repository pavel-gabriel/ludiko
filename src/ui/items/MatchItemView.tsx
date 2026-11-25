import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardContent, MatchItem } from '@/engine/types';
import ItemShell, { CardFace, MultiStepControls, cardLabel } from './ItemShell';
import { seededShuffle } from './shuffle';
import { useItemAnswer, type ItemRendererProps } from './useItemAnswer';

/** Pair colours; every pair also carries a number badge so colour is never the only signal */
const PAIR_STYLES = [
  'border-pink-400 bg-pink-50',
  'border-sky-500 bg-sky-50',
  'border-emerald-500 bg-emerald-50',
  'border-amber-500 bg-amber-50',
  'border-purple-500 bg-purple-50',
  'border-orange-500 bg-orange-50',
];

/**
 * `match`: tap an item on the left, then its partner on the right. Paired items get the same
 * number badge and colour. Tap a paired item to unpair it.
 */
export default function MatchItemView({ item, onAnswer, disabled, feedbackMs }: ItemRendererProps<MatchItem>) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { result, submit, proceed } = useItemAnswer(item, onAnswer, feedbackMs);
  /** Pairs in the order the child made them: [leftId, rightId][] */
  const [made, setMade] = useState<[string, string][]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const locked = disabled || result !== null;

  const rights = useMemo(() => seededShuffle(item.pairs.map((p) => p.right), item.id), [item.pairs, item.id]);
  const lefts = item.pairs.map((p) => p.left);

  const pairIndexOfLeft = (id: string) => made.findIndex(([l]) => l === id);
  const pairIndexOfRight = (id: string) => made.findIndex(([, r]) => r === id);
  const allPaired = made.length === item.pairs.length;

  const tapLeft = (id: string) => {
    if (locked) return;
    const idx = pairIndexOfLeft(id);
    if (idx !== -1) {
      setMade(made.filter((_, i) => i !== idx));
      setSelectedLeft(id);
      return;
    }
    setSelectedLeft(selectedLeft === id ? null : id);
  };

  const tapRight = (id: string) => {
    if (locked) return;
    const idx = pairIndexOfRight(id);
    if (selectedLeft === null) {
      if (idx !== -1) setMade(made.filter((_, i) => i !== idx));
      return;
    }
    setMade([...made.filter((_, i) => i !== idx), [selectedLeft, id]]);
    setSelectedLeft(null);
  };

  const undo = () => {
    setMade(made.slice(0, -1));
    setSelectedLeft(null);
  };
  const reset = () => {
    setMade([]);
    setSelectedLeft(null);
  };

  const cell = (card: CardContent, side: 'left' | 'right') => {
    const idx = side === 'left' ? pairIndexOfLeft(card.id) : pairIndexOfRight(card.id);
    const paired = idx !== -1;
    const isSel = side === 'left' && selectedLeft === card.id;
    const state = paired ? t('items.pairNumber', { n: idx + 1 }) : isSel ? t('items.selected') : t('items.unpaired');
    return (
      <button
        key={card.id}
        type="button"
        disabled={locked}
        aria-pressed={isSel || paired}
        aria-label={`${cardLabel(card, lang)} (${state})`}
        onClick={() => (side === 'left' ? tapLeft(card.id) : tapRight(card.id))}
        className={`relative flex min-h-[64px] items-center justify-center rounded-2xl border-2 px-2 pb-2 pt-5 text-lg font-extrabold text-ludiko-text transition-all active:scale-95 disabled:cursor-default ${
          paired
            ? PAIR_STYLES[idx % PAIR_STYLES.length]
            : isSel
              ? 'border-purple-500 bg-ludiko-purple/40 ring-2 ring-purple-500'
              : 'border-ludiko-blue bg-white'
        }`}
      >
        {(paired || isSel) && (
          <span className="absolute left-2 top-0.5 text-sm font-extrabold text-gray-700" aria-hidden="true">
            {paired ? `${idx + 1}` : '●'}
          </span>
        )}
        <CardFace card={card} />
      </button>
    );
  };

  const correctPairs = (
    <ul className="flex flex-col gap-2">
      {item.pairs.map((p) => (
        <li key={p.left.id} className="flex items-center justify-center gap-2 text-base">
          <CardFace card={p.left} />
          <span aria-hidden="true">↔</span>
          <CardFace card={p.right} />
        </li>
      ))}
    </ul>
  );

  return (
    <ItemShell item={item} result={result} onContinue={proceed} correctAnswer={correctPairs} hint={t('items.matchHint')}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2" role="group" aria-label={t('items.left')}>
          {lefts.map((c) => cell(c, 'left'))}
        </div>
        <div className="flex flex-col gap-2" role="group" aria-label={t('items.right')}>
          {rights.map((c) => cell(c, 'right'))}
        </div>
      </div>

      <MultiStepControls
        locked={locked}
        canUndo={made.length > 0}
        canDone={allPaired}
        onUndo={undo}
        onReset={reset}
        onDone={() => submit({ type: 'match', pairs: Object.fromEntries(made) })}
      />
    </ItemShell>
  );
}
