import { useTranslation } from 'react-i18next';
import type { Question } from '@/utils/types';
import { EQUATION_VARIABLE } from '@/utils/constants';

interface EquationExpressionProps {
  question: Question;
  /** Tailwind text size classes for the expression */
  className?: string;
  /** Show the "Find the value of a" hint under equations */
  showHint?: boolean;
}

/** Renders an equation question, e.g. "a + 4 = 7", with the unknown highlighted */
export default function EquationExpression({
  question,
  className = 'text-5xl',
  showHint = true,
}: EquationExpressionProps) {
  const { t } = useTranslation();

  const unknownBox = (
    <span
      className="inline-flex items-center justify-center min-w-[1.4em] px-1 rounded-xl border-4 border-dashed border-ludiko-purple bg-ludiko-purple/10 text-ludiko-purple italic"
      aria-label={t('game.unknownValue', { variable: EQUATION_VARIABLE })}
    >
      {EQUATION_VARIABLE}
    </span>
  );

  const left = question.unknown === 'a' ? unknownBox : <span>{question.a}</span>;
  const right = question.unknown === 'b' ? unknownBox : <span>{question.b}</span>;

  return (
    <div>
      <p
        className={`${className} font-extrabold text-ludiko-text inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1`}
        aria-live="polite"
      >
        {left}
        <span>{question.operation}</span>
        {right}
        <span>=</span>
        <span>{question.result}</span>
      </p>
      {showHint && (
        <p className="mt-2 text-sm font-semibold text-ludiko-purple">
          {t('game.findValue', { variable: EQUATION_VARIABLE })}
        </p>
      )}
    </div>
  );
}
