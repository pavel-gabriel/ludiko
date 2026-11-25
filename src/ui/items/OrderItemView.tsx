import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardContent, OrderItem } from '@/engine/types';
import ItemShell, { CardFace, MultiStepControls, cardLabel } from './ItemShell';
import { seededShuffleAvoiding } from './shuffle';
import { useItemAnswer, type ItemRendererProps } from './useItemAnswer';

/**
 * `order`: tap a card to put it in the next free place; tap a placed card, then another
 * place, to swap/move it. "Înapoi" removes the last card, "De la început" clears all.
 */
export default function OrderItemView({ item, onAnswer, disabled, feedbackMs }: ItemRendererProps<OrderItem>) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { result, submit, proceed } = useItemAnswer(item, onAnswer, feedbackMs);
  const [slots, setSlots] = useState<(string | null)[]>(() => item.cards.map(() => null));
  const [selected, setSelected] = useState<number | null>(null);
  const locked = disabled || result !== null;

  const byId = useMemo(() => new Map(item.cards.map((c) => [c.id, c])), [item.cards]);
  const shuffled = useMemo(
    () =>
      seededShuffleAvoiding(
        item.cards.map((c) => c.id),
        item.id,
        item.correctOrder,
      ),
    [item.cards, item.id, item.correctOrder],
  );
  const pool = shuffled.filter((id) => !slots.includes(id));
  const allPlaced = slots.every((s) => s !== null);
  const anyPlaced = slots.some((s) => s !== null);
  const longText = item.cards.some((c) => (c.text?.ro.length ?? 0) > 8 || (c.text?.en?.length ?? 0) > 8);

  const place = (id: string) => {
    if (locked) return;
    const i = slots.indexOf(null);
    if (i === -1) return;
    setSlots(slots.map((s, k) => (k === i ? id : s)));
    setSelected(null);
  };

  const tapSlot = (i: number) => {
    if (locked) return;
    if (selected === null) {
      if (slots[i] !== null) setSelected(i);
      return;
    }
    if (selected === i) {
      setSelected(null);
      return;
    }
    const next = [...slots];
    [next[selected], next[i]] = [next[i], next[selected]];
    setSlots(next);
    setSelected(null);
  };

  const undo = () => {
    const last = slots.map((s) => s !== null).lastIndexOf(true);
    if (last === -1) return;
    setSlots(slots.map((s, k) => (k === last ? null : s)));
    setSelected(null);
  };

  const reset = () => {
    setSlots(item.cards.map(() => null));
    setSelected(null);
  };

  const gridClass = longText ? 'grid-cols-1' : 'grid-cols-[repeat(auto-fit,minmax(76px,1fr))]';

  const correctList = (
    <ol className="flex flex-col gap-1">
      {item.correctOrder.map((id, i) => {
        const card = byId.get(id);
        return (
          <li key={id} className="flex items-center justify-center gap-2">
            <span className="text-sm font-bold text-amber-700">{i + 1}.</span>
            {card && <CardFace card={card} />}
          </li>
        );
      })}
    </ol>
  );

  return (
    <ItemShell item={item} result={result} onContinue={proceed} correctAnswer={correctList} hint={t('items.orderHint')}>
      <div className={`mb-4 grid gap-2 ${gridClass}`}>
        {slots.map((id, i) => {
          const card: CardContent | undefined = id ? byId.get(id) : undefined;
          const isSel = selected === i;
          const label = card
            ? t('items.slotFilled', { n: i + 1, card: cardLabel(card, lang) })
            : t('items.slotEmpty', { n: i + 1 });
          return (
            <button
              key={i}
              type="button"
              disabled={locked}
              aria-label={label}
              aria-pressed={card ? isSel : undefined}
              onClick={() => tapSlot(i)}
              className={`relative flex min-h-[64px] items-center justify-center rounded-2xl border-2 px-2 pb-2 pt-5 text-xl font-extrabold transition-all active:scale-95 disabled:cursor-default ${
                isSel
                  ? 'border-purple-500 bg-ludiko-purple/40 ring-2 ring-purple-500'
                  : card
                    ? 'border-ludiko-blue bg-white'
                    : 'border-dashed border-gray-300 bg-gray-50'
              }`}
            >
              <span className="absolute left-2 top-0.5 text-sm font-extrabold text-gray-600" aria-hidden="true">
                {i + 1}
              </span>
              {card && <CardFace card={card} />}
              {isSel && (
                <span className="absolute right-2 top-0.5 text-sm font-bold text-purple-700">{t('items.selected')}</span>
              )}
            </button>
          );
        })}
      </div>

      {pool.length > 0 && (
        <div role="group" aria-label={t('items.cardsLeft')} className="mb-4 flex flex-wrap justify-center gap-2 rounded-2xl bg-ludiko-yellow/50 p-3">
          {pool.map((id) => {
            const card = byId.get(id);
            if (!card) return null;
            return (
              <button
                key={id}
                type="button"
                disabled={locked}
                onClick={() => place(id)}
                className="min-h-[56px] min-w-[56px] rounded-xl border-2 border-ludiko-pink bg-white px-3 py-2 text-xl font-extrabold text-ludiko-text shadow-sm active:scale-95 disabled:opacity-50"
              >
                <CardFace card={card} />
              </button>
            );
          })}
        </div>
      )}

      <MultiStepControls
        locked={locked}
        canUndo={anyPlaced}
        canDone={allPlaced}
        onUndo={undo}
        onReset={reset}
        onDone={() => submit({ type: 'order', order: slots.filter((s): s is string => s !== null) })}
      />
    </ItemShell>
  );
}
