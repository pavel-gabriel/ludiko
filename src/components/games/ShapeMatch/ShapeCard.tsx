import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ShapeQuestion } from '@/utils/types';
import ShapeSVG from './ShapeSVG';
import { playCorrect, playWrong } from '@/utils/sounds';

interface ShapeCardProps {
  question: ShapeQuestion;
  questionNumber: number;
  totalQuestions: number;
  timeRemaining: number;
  onAnswer: (correct: boolean) => void;
}

export default function ShapeCard({
  question,
  questionNumber,
  totalQuestions,
  timeRemaining,
  onAnswer,
}: ShapeCardProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(false);

  const handleTap = (index: number) => {
    if (selected !== null) return;

    const isCorrect = index === question.correctIndex;
    setSelected(index);
    setCorrect(isCorrect);

    if (isCorrect) playCorrect();
    else playWrong();

    setTimeout(() => onAnswer(isCorrect), isCorrect ? 500 : 700);
  };

  const getShapeStyle = (index: number) => {
    if (selected === null) {
      return 'border-gray-200 bg-white hover:border-ludiko-purple hover:scale-105';
    }
    if (index === question.correctIndex) {
      return 'border-green-400 bg-green-50 ring-2 ring-green-400';
    }
    if (index === selected && !correct) {
      return 'border-red-400 bg-red-50';
    }
    return 'border-gray-200 bg-gray-50 opacity-60';
  };

  return (
    <div className="card w-full max-w-md mx-auto" role="region" aria-label={t('game.question')}>
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

      <h3 className="text-2xl font-bold text-center mb-6">
        {t('game.tapTheShape')}{' '}
        <span className="text-ludiko-purple">{t(question.targetLabel)}</span>!
      </h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {question.options.map((option, i) => (
          <button
            key={`${question.id}-${i}`}
            onClick={() => handleTap(i)}
            disabled={selected !== null}
            aria-label={t(option.label)}
            className={`flex flex-col items-center justify-center p-4 rounded-2xl border-3 transition-all active:scale-95 ${getShapeStyle(i)}`}
          >
            <ShapeSVG shape={option.shape} color={option.color} size={72} />
            <span className="text-sm font-semibold mt-2">{t(option.label)}</span>
          </button>
        ))}
      </div>

      {selected !== null && (
        <p
          className={`text-center text-lg font-bold ${
            correct ? 'text-green-500' : 'text-red-500'
          }`}
          aria-live="assertive"
        >
          {correct ? t('game.correct') : t('game.wrong')}
        </p>
      )}
    </div>
  );
}
