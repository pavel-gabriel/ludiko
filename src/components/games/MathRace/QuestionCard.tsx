import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Question } from '@/utils/types';
import { playCorrect, playWrong } from '@/utils/sounds';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions?: number;
  timeRemaining?: number;
  onAnswer: (answer: number) => void;
}

export default function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  timeRemaining,
  onAnswer,
}: QuestionCardProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(false);

  const handleAnswer = (answer: number) => {
    if (selected !== null) return;

    const isCorrect = answer === question.correctAnswer;
    setSelected(answer);
    setCorrect(isCorrect);

    if (isCorrect) playCorrect();
    else playWrong();

    setTimeout(() => onAnswer(answer), isCorrect ? 500 : 700);
  };

  const getButtonStyle = (option: number) => {
    if (selected === null) {
      return 'bg-white border-2 border-ludiko-blue text-ludiko-text hover:bg-ludiko-blue/10 active:bg-ludiko-blue/20';
    }
    if (option === question.correctAnswer) {
      return 'bg-green-100 border-2 border-green-400 text-green-800 ring-2 ring-green-400';
    }
    if (option === selected && !correct) {
      return 'bg-red-100 border-2 border-red-400 text-red-700';
    }
    return 'bg-gray-50 border-2 border-gray-200 text-gray-300';
  };

  return (
    <div className="w-full max-w-md mx-auto" role="region" aria-label={t('game.question')}>
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

      <div className="text-center mb-6">
        <p className="text-5xl font-extrabold text-ludiko-text" aria-live="polite">
          {question.a} {question.operation} {question.b}
        </p>
      </div>

      {selected !== null && (
        <div
          className={`text-center text-lg font-bold mb-3 ${
            correct ? 'text-green-600' : 'text-red-500'
          }`}
          aria-live="assertive"
        >
          {correct ? t('game.correct') : t('game.wrong')}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {question.options.map((option) => (
          <button
            key={option}
            onClick={() => handleAnswer(option)}
            disabled={selected !== null}
            className={`py-5 rounded-2xl text-2xl font-extrabold transition-all active:scale-95 ${getButtonStyle(option)}`}
            aria-label={String(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
