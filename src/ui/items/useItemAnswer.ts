import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { checkResponse } from '@/engine/items/check';
import type { Item, ItemResponse, ItemResult } from '@/engine/types';
import { playCorrect } from '@/utils/sounds';
import { ItemFeedbackContext } from './itemFeedback';

export interface ItemRendererProps<T extends Item = Item> {
  item: T;
  /** Called once per item: ~`feedbackMs` after a correct answer, or when the child taps "Mai departe" after a wrong one */
  onAnswer: (result: ItemResult) => void;
  /** Lock all interaction (e.g. between rounds) */
  disabled?: boolean;
  /** How long the green "correct" feedback shows before onAnswer fires (default 900 ms) */
  feedbackMs?: number;
}

/**
 * Shared answer flow for every renderer: measures timeMs from first render, checks the
 * response, plays the success sound, shows feedback, then reports the result.
 * Wrong answers wait for the child ("Mai departe") so the correct answer can be read in peace.
 */
export function useItemAnswer(item: Item, onAnswer: (r: ItemResult) => void, feedbackMs = 900) {
  const neutral = useContext(ItemFeedbackContext) === 'neutral';
  const startedAt = useRef<number>(performance.now());
  const answered = useRef(false);
  const reported = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAnswerRef = useRef(onAnswer);
  onAnswerRef.current = onAnswer;
  const resultRef = useRef<ItemResult | null>(null);
  const [result, setResult] = useState<ItemResult | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const report = useCallback((r: ItemResult) => {
    if (reported.current) return;
    reported.current = true;
    onAnswerRef.current(r);
  }, []);

  const submit = useCallback(
    (response: ItemResponse) => {
      if (answered.current) return;
      answered.current = true;
      const correct = checkResponse(item, response);
      const r: ItemResult = {
        itemId: item.id,
        correct,
        response,
        timeMs: Math.max(0, Math.round(performance.now() - startedAt.current)),
      };
      resultRef.current = r;
      if (neutral) {
        // exam: no verdict on screen, the paper simply moves on
        report(r);
        return;
      }
      setResult(r);
      if (correct) {
        playCorrect();
        timer.current = setTimeout(() => report(r), feedbackMs);
      }
    },
    [item, feedbackMs, report, neutral],
  );

  /** Wrong answers: the child taps "Mai departe" */
  const proceed = useCallback(() => {
    if (resultRef.current) report(resultRef.current);
  }, [report]);

  return { result, submit, proceed };
}
