import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Question } from '@/utils/types';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  /** Total questions — omit in Timed Sprint mode */
  totalQuestions?: number;
  /** Time remaining — omit in Timed Sprint (shown elsewhere) */
  timeRemaining?: number;
  onAnswer: (answer: number) => void;
}

/**
 * Displays a math question with 4 large tap-friendly answer buttons.
 * Shows brief feedback (correct / try again) after each answer.
 */
export default function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  timeRemaining,
  onAnswer,
}: QuestionCardProps) {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [disabled, setDisabled] = useState(false);

  const handleAnswer = (answer: number) => {
    if (disabled) return;

    const isCorrect = answer === question.correctAnswer;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    setDisabled(true);

    /* Brief delay so the child sees the feedback, then advance */
    setTimeout(() => {
      onAnswer(answer);
      setFeedback(null);
      setDisabled(false);
    }, isCorrect ? 600 : 900);
  };

  return (
    <div className="w-full max-w-md mx-auto" role="region" aria-label={t('game.question')}>
      {/* Header: question counter + timer */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm font-semibold text-gray-500">
          {totalQuestions != null
            ? `${t('game.question')} ${questionNumber}/${totalQuestions}`
            : `#${questionNumber}`}
        </span>
        {timeRemaining != null && (
          <span
            className={`text-sm font-bold px-3 py-1 rounded-full ${
              timeRemaining <= 5
                ? 'bg-red-100 text-red-600'
                : 'bg-gray-100 text-gray-600'
            }`}
            aria-live="polite"
          >
            {timeRemaining}s
          </span>
        )}
      </div>

      {/* The math problem */}
      <div className="text-center mb-6">
        <p className="text-5xl font-extrabold text-ludiko-text" aria-live="polite">
          {question.a} {question.operation} {question.b}
        </p>
      </div>

      {/* Feedback overlay */}
      {feedback && (
        <div
          className={`text-center text-lg font-bold mb-3 ${
            feedback === 'correct' ? 'text-green-600' : 'text-orange-500'
          }`}
          aria-live="assertive"
        >
          {feedback === 'correct' ? t('game.correct') : t('game.tryAgain')}
        </div>
      )}

      {/* Answer options — 2x2 grid with large touch targets */}
      <div className="grid grid-cols-2 gap-3">
        {question.options.map((option) => (
          <button
            key={option}
            onClick={() => handleAnswer(option)}
            disabled={disabled}
            className={`py-5 rounded-2xl text-2xl font-extrabold transition-all active:scale-95 ${
              disabled && option === question.correctAnswer
                ? 'bg-ludiko-green text-green-800 ring-4 ring-green-400'
                : disabled && feedback === 'wrong'
                  ? 'bg-gray-100 text-gray-400'
                  : 'bg-white border-2 border-ludiko-blue text-ludiko-text hover:bg-ludiko-blue/10 active:bg-ludiko-blue/20'
            }`}
            aria-label={String(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
