import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import CloseButton from '@/components/ui/CloseButton';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import { createSession, getSession, updateSession } from '@/services/teacherService';
import { startClassroomSession } from '@/services/classroomStart';
import type { Grade } from '@/engine/types';
import type { ClassroomMode, ClassroomSession } from '@/utils/types';
import OptionCard from '@/components/setup/OptionCard';
import StepDots from '@/components/setup/StepDots';
import PracticeStep from '@/components/setup/PracticeStep';
import AdvancedSettings from '@/components/setup/AdvancedSettings';
import { Row } from '@/components/setup/ReadyStep';
import { MODE_EMOJI, MODE_TONE } from '@/components/setup/modes';
import { PLAY_PRESETS } from '@/components/play/presets';
import { resolveSkillNames } from '@/components/play/skillNames';
import { GAME_TYPES } from '@/utils/constants';
import {
  isCustomSelection,
  isMemory,
  modesFor,
  practiceIssue,
  withMode,
  type SetupChoices,
} from '@/components/setup/setupModel';
import {
  MAX_LABEL,
  MAX_STUDENTS,
  MAX_TITLE,
  classIssue,
  draftFromSession,
  draftToSession,
  firstBlockedTeacherStep,
  newDraft,
  repeatDraft,
  resizeCodes,
  teacherStepsFor,
  type SessionDraft,
  type TeacherStep,
} from './sessionDraft';

const GRADES: Grade[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const GRADE_KEY = 'ludiko.teacher.classGrade';

function loadGrade(): Grade | null {
  try {
    const v = Number(localStorage.getItem(GRADE_KEY));
    return localStorage.getItem(GRADE_KEY) !== null && GRADES.includes(v as Grade) ? (v as Grade) : null;
  } catch {
    return null;
  }
}

function saveGrade(g: Grade | null): void {
  try {
    if (g === null) localStorage.removeItem(GRADE_KEY);
    else localStorage.setItem(GRADE_KEY, String(g));
  } catch {
    /* private mode / blocked storage: the wizard works without it */
  }
}

const numberOnly = (text: string): number => {
  const v = parseInt(text.replace(/\D/g, ''), 10);
  return isNaN(v) ? 0 : v;
};

/**
 * The teacher's session wizard (/teacher/session/new, /teacher/session/:id/edit, and
 * /teacher/session/new?from=:id to repeat a past session): "Ce jucăm?" -> "Ce exersăm?" (not for memory)
 * -> "Clasa" -> "Gata?", built from the same blocks as the game setup wizard.
 */
export default function SessionConfig() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [params] = useSearchParams();
  const fromId = params.get('from');
  const { uid, loading: authLoading } = useAuthStore();
  const { setRoom, setCurrentPlayer } = useRoomStore();
  const isNew = !sessionId;

  const [draft, setDraft] = useState<SessionDraft>(newDraft);
  /* status of the session being edited (only a draft can be started) */
  const [status, setStatus] = useState<ClassroomSession['status'] | null>(null);
  const [grade, setGradeState] = useState<Grade | null>(loadGrade);
  const [stepIndex, setStepIndex] = useState(0);
  const [showAllPresets, setShowAllPresets] = useState(false);
  const [picking, setPicking] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState<'save' | 'start' | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(!sessionId && !fromId);
  const [countText, setCountText] = useState(String(draft.studentCodes.length));
  const headingRef = useRef<HTMLHeadingElement>(null);

  const { choices } = draft;
  const steps = teacherStepsFor(choices.mode);
  const step: TeacherStep = steps[Math.min(stepIndex, steps.length - 1)];
  const last = stepIndex === steps.length - 1;
  const memory = isMemory(choices);

  const setGrade = (g: Grade | null) => {
    setGradeState(g);
    saveGrade(g);
  };
  const updateChoices = (patch: Partial<SetupChoices>) => setDraft((d) => ({ ...d, choices: { ...d.choices, ...patch } }));
  const update = (patch: Partial<SessionDraft>) => setDraft((d) => ({ ...d, ...patch }));

  /* Load the session being edited, or the one being repeated */
  useEffect(() => {
    if (authLoading) return;
    if (!uid) { navigate('/teacher/login'); return; }
    const id = sessionId ?? fromId;
    if (!id) return;
    getSession(id).then((s) => {
      if (!s) { navigate('/teacher'); return; }
      const d = sessionId ? draftFromSession(s) : repeatDraft(s);
      setDraft(d);
      setCountText(String(d.studentCodes.length));
      setPicking(isCustomSelection(d.choices));
      if (sessionId) setStatus(s.status);
      setLoaded(true);
    });
  }, [uid, sessionId, fromId, authLoading]);

  useEffect(() => {
    if (stepIndex > 0) headingRef.current?.focus();
  }, [stepIndex]);

  /* What stops "Înainte" on this step */
  const blocked = step === 'practice' ? practiceIssue(choices) !== null : step === 'class' ? classIssue(draft) !== null : false;
  const blockedStep = firstBlockedTeacherStep(draft);
  const canStart = isNew || status === 'draft';

  const go = (s: TeacherStep) => setStepIndex(Math.max(0, steps.indexOf(s)));
  const next = () => {
    if (!blocked && !last) setStepIndex((i) => i + 1);
  };
  const back = () => setStepIndex((i) => Math.max(0, i - 1));

  const setCount = (text: string) => {
    const clean = text.replace(/\D/g, '');
    setCountText(clean);
    const n = numberOnly(clean);
    if (n >= 1) setDraft((d) => ({ ...d, studentCodes: resizeCodes(d.studentCodes, Math.min(n, MAX_STUDENTS)) }));
  };

  /** Saves (creates or updates) and, with `thenStart`, opens the room and goes to the live dashboard */
  const save = async (thenStart: boolean) => {
    if (!uid || busy) return;
    if (blockedStep) { go(blockedStep); return; }
    setBusy(thenStart ? 'start' : 'save');
    setError('');
    try {
      const payload = draftToSession(draft);
      let id = sessionId ?? '';
      if (isNew) {
        id = await createSession(uid, payload.title, payload.settings, payload.classroomMode, payload.globalTimer, payload.studentCodes);
      } else {
        await updateSession(id, payload);
      }
      if (thenStart) {
        const session: ClassroomSession = { id, teacherUid: uid, ...payload, status: 'draft', createdAt: Date.now() };
        const room = await startClassroomSession(session, t('teacher.teacher'));
        setRoom(room);
        setCurrentPlayer(room.players[0]);
        navigate(`/teacher/live/${id}`);
      } else {
        navigate(isNew ? `/teacher/session/${id}` : '/teacher');
      }
    } catch (err: unknown) {
      setError((err as Error).message || t('teacher.saveError'));
    } finally {
      setBusy(null);
    }
  };

  if (!loaded) {
    return (
      <div className="page">
        <p className="text-gray-400">{t('teacher.loading')}</p>
      </div>
    );
  }

  /* What we practise, in words */
  let practice: string;
  if (choices.skillIds.length > 0) {
    const preset = PLAY_PRESETS.find((p) => p.skillIds.length === choices.skillIds.length && p.skillIds.every((id) => choices.skillIds.includes(id)));
    practice = preset ? t(preset.labelKey) : resolveSkillNames(choices.skillIds, i18n.language);
  } else {
    const game = GAME_TYPES.find((g) => g.type === choices.classicType);
    practice = game ? `${t('setup.practice.classic')}: ${t(game.labelKey)}` : t('setup.practice.classic');
  }

  const stepTitle = step === 'class' ? t('teacher.wizard.classStep') : t(`setup.step.${step}`);
  const issue = classIssue(draft);

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pt-4" role="main">
      <CloseButton onClick={() => navigate('/teacher')} />

      <header className="pr-10">
        <p className="text-xs font-bold uppercase tracking-wide text-purple-600">
          {isNew ? t('teacher.newSession') : t('teacher.editSession')}
        </p>
        <div className="mt-1.5">
          <StepDots index={stepIndex} total={steps.length} />
        </div>
        <h2 ref={headingRef} tabIndex={-1} className="mt-4 text-3xl font-extrabold leading-tight text-ludiko-text focus:outline-none">
          {stepTitle}
        </h2>
      </header>

      <div className="mt-4 flex-1 pb-6">
        {error && (
          <div className="mb-4 rounded-xl bg-red-100 px-4 py-2 text-sm text-red-700" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        {step === 'mode' && (
          <div className="space-y-3" role="group" aria-label={t('setup.step.mode')}>
            {modesFor('room').map((m) => (
              <OptionCard
                key={m}
                emoji={MODE_EMOJI[m]}
                title={t(`setup.mode.${m}.title`)}
                sub={t(`setup.mode.${m}.sub`)}
                tone={MODE_TONE[m]}
                selected={choices.mode === m}
                onClick={() => setDraft((d) => ({ ...d, choices: withMode('room', d.choices, m) }))}
              />
            ))}
          </div>
        )}

        {step === 'practice' && (
          <div className="space-y-4">
            {/* The class grade: presets show this grade +-1 */}
            <div role="group" aria-label={t('teacher.wizard.classGrade')}>
              <span className="text-sm font-semibold">{t('teacher.wizard.classGrade')}</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={grade === g}
                    onClick={() => setGrade(grade === g ? null : g)}
                    className={`min-h-[2.75rem] min-w-[2.75rem] rounded-xl px-3 text-base font-bold transition-colors ${
                      grade === g ? 'bg-ludiko-purple text-ludiko-text' : 'bg-white shadow hover:bg-gray-100'
                    }`}
                  >
                    {t(`profiles.gradeShort.${g}`)}
                  </button>
                ))}
              </div>
            </div>
            <PracticeStep
              choices={choices}
              onChange={updateChoices}
              grade={grade}
              showAll={showAllPresets}
              onShowAll={setShowAllPresets}
              picking={picking}
              onPicking={setPicking}
            />
          </div>
        )}

        {step === 'class' && (
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold">{t('teacher.sessionTitle')}</span>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder={t('teacher.sessionTitlePlaceholder')}
                maxLength={MAX_TITLE}
                className="mt-1 min-h-[3rem] w-full rounded-xl border-2 border-ludiko-blue bg-white px-4 py-2 text-lg focus:outline-none focus:border-ludiko-purple"
              />
            </label>

            <div role="group" aria-label={t('teacher.classroomMode')}>
              <span className="text-sm font-semibold">{t('teacher.classroomMode')}</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(['selfPaced', 'teacherControlled'] as ClassroomMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => update({ classroomMode: m })}
                    aria-pressed={draft.classroomMode === m}
                    className={`min-h-[3rem] rounded-xl px-2 py-2 text-sm font-bold transition-colors ${
                      draft.classroomMode === m ? 'bg-ludiko-purple text-ludiko-text' : 'bg-white shadow hover:bg-gray-100'
                    }`}
                  >
                    {t(`teacher.mode.${m}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-semibold">{t('teacher.globalTimer')}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.globalTimer}
                  onChange={(e) => update({ globalTimer: numberOnly(e.target.value) })}
                  className="mt-1 min-h-[3rem] w-full rounded-xl border-2 border-ludiko-blue bg-white px-4 py-2 text-lg focus:outline-none focus:border-ludiko-purple"
                />
                <span className="mt-0.5 block text-xs text-gray-500">{t('teacher.wizard.noLimit')}</span>
              </label>
              <label className="block">
                <span className="text-sm font-semibold">{t('teacher.studentCount')}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={countText}
                  onChange={(e) => setCount(e.target.value)}
                  onBlur={() => setCountText(String(draft.studentCodes.length))}
                  className="mt-1 min-h-[3rem] w-full rounded-xl border-2 border-ludiko-blue bg-white px-4 py-2 text-lg focus:outline-none focus:border-ludiko-purple"
                />
                <span className="mt-0.5 block text-xs text-gray-500">{t('teacher.wizard.maxStudents', { max: MAX_STUDENTS })}</span>
              </label>
            </div>

            {/* Student codes and the labels only the teacher sees */}
            <div className="rounded-2xl bg-white p-3 shadow">
              <h3 className="text-sm font-bold">{t('teacher.studentCodes')} ({draft.studentCodes.length})</h3>
              <p className="mt-1 text-xs text-gray-600">{t('teacher.wizard.labelHint')}</p>
              <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">
                {draft.studentCodes.map((sc, i) => (
                  <li key={sc.code} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 font-mono text-sm font-bold">{sc.code}</span>
                    <input
                      type="text"
                      value={sc.label}
                      maxLength={MAX_LABEL}
                      aria-label={t('teacher.wizard.labelFor', { code: sc.code })}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          studentCodes: d.studentCodes.map((c, j) => (j === i ? { ...c, label: e.target.value } : c)),
                        }))
                      }
                      className="min-h-[2.75rem] min-w-0 flex-1 rounded-xl border-2 border-gray-200 px-3 py-1 text-sm focus:outline-none focus:border-ludiko-purple"
                    />
                  </li>
                ))}
              </ul>
            </div>

            {issue && (
              <p role="alert" className="text-sm font-semibold text-red-600">
                {t(issue === 'title' ? 'teacher.wizard.titleNeeded' : 'teacher.wizard.studentsNeeded')}
              </p>
            )}
          </div>
        )}

        {step === 'ready' && (
          <div className="space-y-4">
            <ul className="divide-y divide-gray-100 rounded-2xl bg-white px-4 shadow" aria-label={t('setup.step.ready')}>
              <Row label={t('setup.summary.game')} onEdit={() => go('mode')}>
                <span aria-hidden="true">{MODE_EMOJI[choices.mode]} </span>
                {t(`setup.mode.${choices.mode}.title`)}
              </Row>
              {!memory && (
                <Row label={t('setup.summary.practice')} onEdit={() => go('practice')}>
                  <span className="line-clamp-2">{practice}</span>
                </Row>
              )}
              <Row label={t('teacher.wizard.classStep')} onEdit={() => go('class')}>
                <span className="block truncate">{draft.title.trim() || '—'}</span>
                <span className="block text-sm font-semibold text-gray-600">
                  {t(`teacher.mode.${draft.classroomMode}`)} &middot; {draft.studentCodes.length} {t('teacher.students')}
                  {' '}&middot; {draft.globalTimer > 0 ? `${draft.globalTimer}s` : t('teacher.wizard.noTimer')}
                </span>
              </Row>
            </ul>

            <AdvancedSettings context="room" choices={choices} onChange={updateChoices} open={advanced} onToggle={setAdvanced} />
          </div>
        )}
      </div>

      {/* Back / Next (Save / Start on the last step), always at the bottom where thumbs are */}
      <footer className="sticky bottom-0 -mx-4 space-y-2 border-t border-black/5 bg-ludiko-bg/95 px-4 py-3 backdrop-blur">
        {last && canStart && (
          <Button variant="green" size="lg" className="w-full" onClick={() => save(true)} disabled={blockedStep !== null || busy !== null} data-testid="teacher-start">
            {busy === 'start' ? t('teacher.starting') : t('teacher.startSession')}
          </Button>
        )}
        <div className="flex gap-3">
          {stepIndex > 0 && (
            <Button variant="yellow" size="lg" onClick={back} className="shrink-0 !px-5">
              <span aria-hidden="true">←</span> <span>{t('setup.back')}</span>
            </Button>
          )}
          {last ? (
            <Button
              variant={canStart ? 'blue' : 'green'}
              size="lg"
              className="flex-1"
              onClick={() => save(false)}
              disabled={blockedStep !== null || busy !== null}
              data-testid="teacher-save"
            >
              {t('teacher.saveSession')}
            </Button>
          ) : (
            <Button variant="green" size="lg" onClick={next} disabled={blocked} className="flex-1" data-testid="setup-next">
              {t('setup.next')} <span aria-hidden="true">→</span>
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
