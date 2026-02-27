import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Question } from '@/utils/types';
import { playCorrect, playWrong } from '@/utils/sounds';

interface InteractiveQuestionPanelProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  timeRemaining?: number;
  onAnswer: (answer: number) => void;
  colorAccent: 'blue' | 'pink';
}

export default function InteractiveQuestionPanel({
  question,
  questionNumber,
  totalQuestions,
  timeRemaining,
  onAnswer,
  colorAccent,
}: InteractiveQuestionPanelProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(false);

  const borderColor = colorAccent === 'blue' ? 'border-ludiko-blue' : 'border-ludiko-pink';

  const handleAnswer = (answer: number) => {
    if (selected !== null) return;
    const isCorrect = answer === question.correctAnswer;
    setSelected(answer);
    setCorrect(isCorrect);
    if (isCorrect) playCorrect();
    else playWrong();
    setTimeout(() => onAnswer(answer), isCorrect ? 400 : 600);
  };

  const getButtonStyle = (option: number) => {
    if (selected === null) {
      return `bg-white border-2 ${borderColor} text-ludiko-text`;
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
    <div className="flex-1 flex flex-col px-1" role="region" aria-label={`${t('game.question')} ${questionNumber}/${totalQuestions}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-semibold text-gray-500" aria-live="polite">
          {questionNumber}/{totalQuestions}
        </span>
        {timeRemaining != null && (
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              timeRemaining <= 5 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
            }`}
            aria-live="polite"
            aria-label={`${timeRemaining} seconds remaining`}
          >
            {timeRemaining}s
          </span>
        )}
      </div>

      {/* Question */}
      <div className="text-center mb-2">
        <p className="text-3xl sm:text-4xl font-extrabold text-ludiko-text">
          {question.a} {question.operation} {question.b}
        </p>
      </div>

      {/* Answer grid */}
      <div className="grid grid-cols-2 gap-2 mb-1" role="group" aria-label={t('game.question')}>
        {question.options.map((option) => (
          <button
            key={option}
            onClick={() => handleAnswer(option)}
            disabled={selected !== null}
            aria-label={`Answer: ${option}`}
            className={`py-3 sm:py-4 rounded-xl text-xl sm:text-2xl font-extrabold transition-all active:scale-95 ${getButtonStyle(option)}`}
          >
            {option}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {selected !== null && (
        <p
          className={`text-center text-sm font-bold ${
            correct ? 'text-green-500' : 'text-red-500'
          }`}
          role="alert"
          aria-live="assertive"
        >
          {correct ? t('game.correct') : t('game.wrong')}
        </p>
      )}
    </div>
  );
}
