import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { localize, type CardContent, type Item, type ItemResult } from '@/engine/types';
import ReadAloudButton from '@/ui/speech/ReadAloudButton';
import { itemEnglishSpeech } from '@/ui/speech/englishSpeech';
import ItemTypeGuide, { useItemGuide } from '@/ui/guide/ItemTypeGuide';
import VisualSlot from './VisualSlot';

/** Text + optional visual of one card/option */
export function CardFace({ card, className = '' }: { card: CardContent; className?: string }) {
  const { i18n } = useTranslation();
  return (
    <span className={`flex flex-col items-center justify-center gap-1 ${className}`}>
      {card.visual && <VisualSlot spec={card.visual} size="sm" />}
      {card.text && <span className="break-words text-center">{localize(card.text, i18n.language)}</span>}
    </span>
  );
}

/** Plain-text label of a card (for ARIA and the "correct answer" summaries) */
export function cardLabel(card: CardContent, lang: string): string {
  return localize(card.text, lang) || card.id;
}

function AudioButton({ src }: { src: string }) {
  const { t } = useTranslation();
  const play = () => {
    try {
      void new Audio(src).play()?.catch(() => {});
    } catch {
      /* audio is optional */
    }
  };
  return (
    <button
      type="button"
      onClick={play}
      className="min-h-[48px] min-w-[48px] rounded-full bg-ludiko-blue/40 px-4 text-lg font-bold active:scale-95"
      aria-label={t('items.listen')}
    >
      <span aria-hidden="true">🔊</span>
    </button>
  );
}

interface ItemShellProps {
  item: Item;
  result: ItemResult | null;
  onContinue: () => void;
  /** Rendered inside the "Hai să vedem împreună" panel after a wrong answer */
  correctAnswer: ReactNode;
  /** Short how-to line under the prompt (for multi-step types) */
  hint?: string;
  /** Skip the small narration button (the renderer provides its own big one) */
  hideAudio?: boolean;
  children: ReactNode;
}

/** Card frame: prompt, optional visual/audio, the interaction, and the feedback panel */
export default function ItemShell({ item, result, onContinue, correctAnswer, hint, hideAudio, children }: ItemShellProps) {
  const { t, i18n } = useTranslation();
  const promptId = useId();
  const continueRef = useRef<HTMLButtonElement>(null);
  const wrong = result !== null && !result.correct;
  // English subject, grades 0-II: «…» in the prompt are spoken with an English voice (docs/ENGINE.md)
  const englishText = itemEnglishSpeech(item.skillId, localize(item.prompt, i18n.language));
  // the first few times a type is seen: a friendly "what do I do" line instead of the plain hint
  const guide = useItemGuide(item.type, item.id);

  useEffect(() => {
    if (wrong) continueRef.current?.focus();
  }, [wrong]);

  return (
    <section
      className="mx-auto w-full max-w-md rounded-2xl bg-white p-4 shadow-md sm:p-6"
      aria-labelledby={promptId}
      data-item-type={item.type}
    >
      <div className="mb-4 flex flex-col items-center gap-3 text-center">
        <div className="flex items-start justify-center gap-2">
          <h2 id={promptId} className="text-xl font-extrabold leading-snug text-ludiko-text sm:text-2xl">
            {localize(item.prompt, i18n.language)}
          </h2>
          {item.audio && !hideAudio && <AudioButton src={item.audio.src} />}
        </div>
        <ReadAloudButton text={localize(item.prompt, i18n.language)} />
        {englishText && <ReadAloudButton text={englishText} lang="en" />}
        {item.visual && <VisualSlot spec={item.visual} />}
        {guide ? <ItemTypeGuide type={item.type} /> : hint && <p className="text-sm font-semibold text-gray-500">{hint}</p>}
      </div>

      <div role="group" aria-labelledby={promptId}>
        {children}
      </div>

      <div aria-live="polite" className="mt-4 empty:mt-0">
        {result?.correct && (
          <p
            role="status"
            className="rounded-2xl border-2 border-green-500 bg-green-100 px-4 py-3 text-center text-lg font-extrabold text-green-800"
          >
            <span aria-hidden="true">✓ </span>
            {t('items.correct')}
          </p>
        )}
        {wrong && (
          <div role="status" className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
            <p className="text-center text-lg font-extrabold">
              <span aria-hidden="true">💡 </span>
              {t('items.wrongTitle')}
            </p>
            <div className="mt-2 text-center">
              <p className="text-sm font-semibold">{t('items.correctAnswerIs')}:</p>
              <div className="mt-1 text-lg font-extrabold">{correctAnswer}</div>
            </div>
            <button
              ref={continueRef}
              type="button"
              onClick={onContinue}
              className="mt-3 min-h-[52px] w-full rounded-xl bg-ludiko-blue px-6 text-lg font-bold text-ludiko-text shadow active:scale-95"
            >
              {t('items.next')}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/** Undo / Reset / Gata controls shared by the multi-step types (order, sort, match) */
export function MultiStepControls({
  locked,
  canUndo,
  canDone,
  onUndo,
  onReset,
  onDone,
}: {
  locked: boolean;
  canUndo: boolean;
  canDone: boolean;
  onUndo: () => void;
  onReset: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const tool =
    'min-h-[48px] flex-1 rounded-xl border-2 border-gray-300 bg-white px-3 text-base font-bold text-ludiko-text active:scale-95 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button type="button" onClick={onUndo} disabled={locked || !canUndo} className={tool}>
          <span aria-hidden="true">↶ </span>
          {t('items.undo')}
        </button>
        <button type="button" onClick={onReset} disabled={locked || !canUndo} className={tool}>
          <span aria-hidden="true">⟲ </span>
          {t('items.reset')}
        </button>
      </div>
      <button
        type="button"
        onClick={onDone}
        disabled={locked || !canDone}
        className="min-h-[56px] w-full rounded-xl bg-ludiko-green px-6 text-xl font-extrabold text-ludiko-text shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t('items.done')}
      </button>
    </div>
  );
}
