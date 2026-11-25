import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ShapeQuestion, ShapeMode } from '@/utils/types';
import ShapeSVG from '@/components/games/ShapeMatch/ShapeSVG';
import { playCorrect, playWrong } from '@/utils/sounds';

interface InteractiveShapePanelProps {
  question: ShapeQuestion;
  questionNumber: number;
  totalQuestions: number;
  timeRemaining?: number;
  shapeMode: ShapeMode;
  onAnswer: (correct: boolean) => void;
  colorAccent: 'blue' | 'pink';
}

export default function InteractiveShapePanel({
  question,
  questionNumber,
  totalQuestions,
  timeRemaining,
  shapeMode,
  onAnswer,
  colorAccent,
}: InteractiveShapePanelProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(false);

  const borderColor = colorAccent === 'blue' ? 'border-ludiko-blue' : 'border-ludiko-pink';
  const isWordMode = shapeMode === 'word';

  const handleTap = (index: number) => {
    if (selected !== null) return;
    const isCorrect = index === question.correctIndex;
    setSelected(index);
    setCorrect(isCorrect);
    if (isCorrect) playCorrect();
    else playWrong();
    setTimeout(() => onAnswer(isCorrect), isCorrect ? 400 : 600);
  };

  const getButtonStyle = (index: number) => {
    if (selected === null) {
      return `bg-white border-2 ${borderColor}`;
    }
    if (index === question.correctIndex) {
      return 'bg-green-100 border-2 border-green-400 ring-2 ring-green-400';
    }
    if (index === selected && !correct) {
      return 'bg-red-100 border-2 border-red-400';
    }
    return 'bg-gray-50 border-2 border-gray-200 opacity-60';
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
          >
            {timeRemaining}s
          </span>
        )}
      </div>

      {/* Prompt */}
      <div className="text-center mb-2">
        {isWordMode ? (
          <ShapeSVG
            shape={question.options[question.correctIndex].shape}
            color={question.options[question.correctIndex].color}
            size={48}
          />
        ) : (
          <p className="text-sm font-bold text-ludiko-text">
            {t('game.tapTheShape')}{' '}
            <span className="text-ludiko-purple">{t(question.targetLabel)}</span>!
          </p>
        )}
      </div>

      {/* Options grid */}
      <div className="grid grid-cols-2 gap-1.5 mb-1" role="group" aria-label={t('game.question')}>
        {question.options.map((option, i) => (
          <button
            key={`${question.id}-${i}`}
            onClick={() => handleTap(i)}
            disabled={selected !== null}
            aria-label={t(option.label)}
            className={`flex items-center justify-center p-2 rounded-xl transition-all active:scale-95 ${getButtonStyle(i)}`}
          >
            {isWordMode ? (
              <span className="text-xs font-bold">{t(option.label)}</span>
            ) : (
              <ShapeSVG shape={option.shape} color={option.color} size={40} />
            )}
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
