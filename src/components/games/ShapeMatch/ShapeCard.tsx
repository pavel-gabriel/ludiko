import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ShapeQuestion } from '@/utils/types';
import ShapeSVG from './ShapeSVG';

interface ShapeCardProps {
  question: ShapeQuestion;
  questionNumber: number;
  totalQuestions: number;
  timeRemaining: number;
  onAnswer: (correct: boolean) => void;
}

/**
 * Displays a shape question: "Tap the [target]!" and a 2x2 grid of shapes.
 * Gives visual feedback on correct/wrong answers.
 */
export default function ShapeCard({
  question,
  questionNumber,
  totalQuestions,
  timeRemaining,
  onAnswer,
}: ShapeCardProps) {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [disabled, setDisabled] = useState(false);

  const handleTap = (index: number) => {
    if (disabled) return;
    setDisabled(true);

    const isCorrect = index === question.correctIndex;
    setFeedback(isCorrect ? 'correct' : 'wrong');

    /* Brief delay before advancing */
    setTimeout(() => {
      onAnswer(isCorrect);
      setFeedback(null);
      setDisabled(false);
    }, isCorrect ? 600 : 900);
  };

  return (
    <div className="card w-full max-w-md mx-auto" role="region" aria-label={t('game.question')}>
      {/* Header: question counter + timer */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm font-semibold text-gray-500">
          {questionNumber}/{totalQuestions}
        </span>
        <span
          className={`text-sm font-bold px-3 py-1 rounded-full ${
            timeRemaining <= 5
              ? 'bg-red-100 text-red-600'
              : 'bg-ludiko-blue/20 text-ludiko-text'
          }`}
          aria-live="polite"
        >
          {timeRemaining}s
        </span>
      </div>

      {/* Prompt: "Tap the [shape]!" */}
      <h3 className="text-2xl font-bold text-center mb-6">
        {t('game.tapTheShape')}{' '}
        <span className="text-ludiko-purple">{t(question.targetLabel)}</span>!
      </h3>

      {/* 2x2 shape grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {question.options.map((option, i) => (
          <button
            key={`${question.id}-${i}`}
            onClick={() => handleTap(i)}
            disabled={disabled}
            aria-label={t(option.label)}
            className={`flex flex-col items-center justify-center p-4 rounded-2xl border-3 transition-all active:scale-95
              ${disabled ? 'opacity-70' : 'hover:scale-105'}
              ${
                feedback && i === question.correctIndex
                  ? 'border-green-400 bg-green-50'
                  : feedback === 'wrong' && disabled
                    ? 'border-gray-200 bg-gray-50'
                    : 'border-gray-200 bg-white hover:border-ludiko-purple'
              }`}
          >
            <ShapeSVG shape={option.shape} color={option.color} size={72} />
            <span className="text-sm font-semibold mt-2">{t(option.label)}</span>
          </button>
        ))}
      </div>

      {/* Feedback message */}
      {feedback && (
        <p
          className={`text-center text-lg font-bold ${
            feedback === 'correct' ? 'text-green-500' : 'text-orange-500'
          }`}
          aria-live="assertive"
        >
          {feedback === 'correct' ? t('game.correct') : t('game.tryAgain')}
        </p>
      )}
    </div>
  );
}
