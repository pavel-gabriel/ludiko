import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { checkResponse } from '@/engine/items/check';
import { localize, type ItemResponse, type ItemResult, type ReadAndAnswerItem } from '@/engine/types';
import ReadAloudButton from '@/ui/speech/ReadAloudButton';
import { isEngSkillId } from '@/ui/speech/englishSpeech';
import ChoiceItemView from './ChoiceItemView';
import TrueFalseItemView from './TrueFalseItemView';
import VisualSlot from './VisualSlot';
import type { ItemRendererProps } from './useItemAnswer';

/**
 * Short passage + sub-questions, one at a time, passage always available (collapsible on phones).
 * Each sub-question gives its own gentle feedback; the item reports once, correct only if ALL were right.
 */
export default function ReadAndAnswerItemView({
  item,
  onAnswer,
  disabled,
  feedbackMs,
}: ItemRendererProps<ReadAndAnswerItem>) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const startedAt = useRef(performance.now());
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, ItemResponse>>({});
  const [open, setOpen] = useState(true);
  const reported = useRef(false);

  const total = item.questions.length;
  const question = item.questions[index];
  const passage = localize(item.passage, lang);

  const onSub = (r: ItemResult) => {
    const next = { ...answers, [r.itemId]: r.response };
    setAnswers(next);
    if (index < total - 1) {
      setIndex(index + 1);
      return;
    }
    if (reported.current) return;
    reported.current = true;
    const response: ItemResponse = { type: 'read-and-answer', answers: next };
    onAnswer({
      itemId: item.id,
      correct: checkResponse(item, response),
      response,
      timeMs: Math.max(0, Math.round(performance.now() - startedAt.current)),
    });
  };

  const common = { onAnswer: onSub, disabled, feedbackMs };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3" data-item-type={item.type}>
      <section className="rounded-2xl bg-white p-4 shadow-md" aria-label={t('items.passageLabel')}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold leading-snug text-ludiko-text">{localize(item.prompt, lang)}</h2>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="min-h-[44px] shrink-0 rounded-xl border-2 border-gray-300 bg-white px-3 text-sm font-bold text-ludiko-text active:scale-95 sm:hidden"
          >
            {open ? t('items.hidePassage') : t('items.showPassage')}
          </button>
        </div>
        <div className={open ? 'mt-3 block' : 'mt-3 hidden sm:block'}>
          {item.visual && (
            <div className="mb-3 flex justify-center">
              <VisualSlot spec={item.visual} />
            </div>
          )}
          <p
            className="whitespace-pre-line rounded-xl bg-ludiko-bg px-4 py-3 text-xl font-semibold leading-loose tracking-wide text-ludiko-text"
            data-testid="passage"
          >
            {passage}
          </p>
          <div className="mt-2 flex justify-end empty:hidden">
            <ReadAloudButton text={passage} lang={isEngSkillId(item.skillId) ? 'en' : undefined} />
          </div>
        </div>
      </section>

      <p className="text-center text-sm font-bold text-gray-500" aria-live="polite">
        {t('items.questionOf', { current: index + 1, total })}
      </p>

      {question.type === 'true-false' ? (
        <TrueFalseItemView key={question.id} item={question} {...common} />
      ) : (
        <ChoiceItemView key={question.id} item={question} {...common} />
      )}
    </div>
  );
}
