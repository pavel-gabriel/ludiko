import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localize, type SortItem } from '@/engine/types';
import ItemShell, { CardFace, MultiStepControls, cardLabel } from './ItemShell';
import { seededShuffle } from './shuffle';
import { useItemAnswer, type ItemRendererProps } from './useItemAnswer';

/**
 * `sort`: tap a card to pick it up, then tap the group it belongs to.
 * Tap a card inside a group to take it out again.
 */
export default function SortItemView({ item, onAnswer, disabled, feedbackMs }: ItemRendererProps<SortItem>) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { result, submit, proceed } = useItemAnswer(item, onAnswer, feedbackMs);
  const [placement, setPlacement] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const locked = disabled || result !== null;

  const shuffled = useMemo(() => seededShuffle(item.cards, item.id), [item.cards, item.id]);
  const pool = shuffled.filter((c) => !(c.id in placement));
  const allPlaced = pool.length === 0;
  const anyPlaced = history.length > 0;

  const placeIn = (categoryId: string) => {
    if (locked || selected === null) return;
    setPlacement({ ...placement, [selected]: categoryId });
    setHistory([...history, selected]);
    setSelected(null);
  };

  const takeOut = (cardId: string) => {
    if (locked) return;
    const next = { ...placement };
    delete next[cardId];
    setPlacement(next);
    setHistory(history.filter((h) => h !== cardId));
    setSelected(null);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (last) takeOut(last);
  };

  const reset = () => {
    setPlacement({});
    setHistory([]);
    setSelected(null);
  };

  const correctGroups = (
    <ul className="flex flex-col gap-2 text-left">
      {item.categories.map((cat) => (
        <li key={cat.id}>
          <span className="text-base">{localize(cat.label, lang)}: </span>
          <span className="text-base font-bold">
            {item.cards
              .filter((c) => c.categoryId === cat.id)
              .map((c) => cardLabel(c, lang))
              .join(', ')}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <ItemShell item={item} result={result} onContinue={proceed} correctAnswer={correctGroups} hint={t('items.sortHint')}>
      {pool.length > 0 && (
        <div role="group" aria-label={t('items.cardsLeft')} className="mb-4 flex flex-wrap justify-center gap-2 rounded-2xl bg-ludiko-yellow/50 p-3">
          {pool.map((c) => {
            const isSel = selected === c.id;
            return (
              <button
                key={c.id}
                type="button"
                disabled={locked}
                aria-pressed={isSel}
                onClick={() => setSelected(isSel ? null : c.id)}
                className={`min-h-[56px] min-w-[56px] rounded-xl border-2 px-3 py-2 text-xl font-extrabold text-ludiko-text shadow-sm transition-all active:scale-95 disabled:opacity-50 ${
                  isSel ? 'border-purple-500 bg-ludiko-purple/40 ring-2 ring-purple-500' : 'border-ludiko-pink bg-white'
                }`}
              >
                <CardFace card={c} />
                {isSel && <span className="block text-xs font-bold text-purple-700">{t('items.selected')}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className={`mb-4 grid gap-3 ${item.categories.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {item.categories.map((cat) => {
          const inside = item.cards.filter((c) => placement[c.id] === cat.id);
          const label = localize(cat.label, lang);
          return (
            <div key={cat.id} role="group" aria-label={label} className="flex flex-col rounded-2xl border-2 border-ludiko-blue bg-white p-2">
              <button
                type="button"
                disabled={locked}
                onClick={() => placeIn(cat.id)}
                className={`min-h-[48px] rounded-xl px-2 text-lg font-extrabold text-ludiko-text transition-all active:scale-95 ${
                  selected !== null && !locked
                    ? 'border-2 border-dashed border-purple-500 bg-ludiko-purple/30'
                    : 'bg-ludiko-blue/30'
                }`}
              >
                {selected !== null && !locked && <span aria-hidden="true">⤵ </span>}
                {label}
              </button>
              <div className="mt-2 flex min-h-[56px] flex-wrap content-start justify-center gap-2">
                {inside.length === 0 && <span className="self-center text-sm text-gray-400">{t('items.groupEmpty')}</span>}
                {inside.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={locked}
                    aria-label={t('items.moveBack', { card: cardLabel(c, lang), group: label })}
                    onClick={() => takeOut(c.id)}
                    className="min-h-[48px] rounded-xl border-2 border-ludiko-pink bg-ludiko-pink/20 px-2 py-1 text-lg font-extrabold active:scale-95 disabled:opacity-70"
                  >
                    <CardFace card={c} />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <MultiStepControls
        locked={locked}
        canUndo={anyPlaced}
        canDone={allPlaced}
        onUndo={undo}
        onReset={reset}
        onDone={() => submit({ type: 'sort', placement })}
      />
    </ItemShell>
  );
}
