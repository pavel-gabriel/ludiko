import { useTranslation } from 'react-i18next';
import type { Item, ItemResult } from '@/engine/types';
import ItemView from '@/ui/items/ItemView';

interface ItemQuestionCardProps {
  item: Item;
  questionNumber: number;
  totalQuestions: number;
  /** Seconds left for this question (race); omitted in a sprint (the clock is global) */
  timeRemaining?: number;
  /** Fires once per item, after the feedback: `correct` is what scores a point */
  onResult: (correct: boolean, result: ItemResult) => void;
  /** Short split-screen header for the duel */
  compact?: boolean;
  /** How long the green "correct" feedback shows before the next item (default 500 ms) */
  feedbackMs?: number;
}

/**
 * One item in a race / sprint / duel round: a small header (question n/total + timer) over the shared
 * `ItemView`. A correct answer moves on by itself; a wrong one waits for "Mai departe", so the child
 * can read the right answer (ItemView's own flow).
 */
export default function ItemQuestionCard({
  item,
  questionNumber,
  totalQuestions,
  timeRemaining,
  onResult,
  compact = false,
  feedbackMs = 500,
}: ItemQuestionCardProps) {
  const { t } = useTranslation();
  return (
    <div className="w-full" role="region" aria-label={`${t('game.question')} ${questionNumber}/${totalQuestions}`}>
      <div className={`flex items-center justify-between ${compact ? 'mb-1 px-1' : 'mb-2 mt-8 px-1'}`}>
        <span className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-gray-500`}>
          {compact ? `${questionNumber}/${totalQuestions}` : `${t('game.question')} ${questionNumber}/${totalQuestions}`}
        </span>
        {timeRemaining != null && (
          <span
            className={`${compact ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'} rounded-full font-bold ${
              timeRemaining <= 5 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
            }`}
            aria-live="off"
          >
            {timeRemaining}s
          </span>
        )}
      </div>
      <ItemView item={item} feedbackMs={feedbackMs} onAnswer={(result) => onResult(result.correct, result)} />
    </div>
  );
}
