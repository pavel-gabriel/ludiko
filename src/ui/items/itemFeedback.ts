import { createContext } from 'react';

/**
 * How an item reacts to an answer.
 * - 'full' (default): green "correct" / amber "let's look together" panel, then onAnswer.
 * - 'neutral' (exam simulations): no verdict, no right answer, no sound — onAnswer fires at once.
 */
export type ItemFeedbackMode = 'full' | 'neutral';

export const ItemFeedbackContext = createContext<ItemFeedbackMode>('full');
