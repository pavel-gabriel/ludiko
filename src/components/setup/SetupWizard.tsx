import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import CloseButton from '@/components/ui/CloseButton';
import AnimalNamePicker from '@/components/ui/AnimalNamePicker';
import { useProfileStore } from '@/store/profileStore';
import { identityAvatar, randomIdentity } from '@/utils/animalNames';
import OptionCard from './OptionCard';
import StepDots from './StepDots';
import PracticeStep from './PracticeStep';
import ReadyStep from './ReadyStep';
import { MODE_EMOJI, MODE_TONE } from './modes';
import HowToPlay from '@/ui/guide/HowToPlay';
import {
  defaultChoices,
  firstBlockedStep,
  isCustomSelection,
  loadChoices,
  modesFor,
  practiceIssue,
  saveChoices,
  stepsFor,
  toRoomSettings,
  whoIssue,
  withMode,
  type SetupChoices,
  type SetupContext,
  type SetupResult,
  type SetupStep,
} from './setupModel';

interface SetupWizardProps {
  context: SetupContext;
  /** Label of the final button, e.g. "Joacă" or "Creează" */
  startLabel: string;
  /** Called once with the finished choices; the wizard shows a busy state until it settles */
  onStart: (result: SetupResult) => Promise<void> | void;
}

/**
 * Game setup as a short wizard, one decision per screen:
 * "Ce jucăm?" -> "Ce exersăm?" (not for memory) -> "Cine ești?" -> "Gata?". Used by single player, new rooms and the duel.
 * Remembers the last choices of each screen (localStorage, optional).
 */
export default function SetupWizard({ context, startLabel, onStart }: SetupWizardProps) {
  const { t } = useTranslation();
  const activeProfile = useProfileStore((s) => s.activeProfile);
  const profilesLoaded = useProfileStore((s) => s.loaded);
  const loadProfiles = useProfileStore((s) => s.load);
  useEffect(() => {
    /* a reload on /singleplayer etc. starts without the profile list */
    if (!profilesLoaded) void loadProfiles().catch(() => {});
  }, [profilesLoaded, loadProfiles]);
  const grade = activeProfile?.grade ?? null;

  const [choices, setChoices] = useState<SetupChoices>(() => {
    const first = randomIdentity();
    const loaded = loadChoices(context, defaultChoices(first, randomIdentity([identityAvatar(first)])));
    /* in a duel the two animals differ, also when one of them comes from the remembered choices */
    return context === 'duel' && identityAvatar(loaded.identity) === identityAvatar(loaded.identity2)
      ? { ...loaded, identity2: randomIdentity([identityAvatar(loaded.identity)]) }
      : loaded;
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [showAllPresets, setShowAllPresets] = useState(false);
  /* custom skills (not a preset) reopen the picker */
  const [picking, setPicking] = useState(() => isCustomSelection(choices));
  const [advanced, setAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  /* memory (pictures) skips "Ce exersăm?" */
  const steps = stepsFor(choices.mode)
  const step: SetupStep = steps[stepIndex];
  const update = (patch: Partial<SetupChoices>) => setChoices((c) => ({ ...c, ...patch }));

  useEffect(() => saveChoices(context, choices), [context, choices]);
  useEffect(() => {
    if (stepIndex > 0) headingRef.current?.focus();
  }, [stepIndex]);

  const setMode = (mode: SetupChoices['mode']) => setChoices((c) => withMode(context, c, mode));

  /* Why "Înainte" is off on this step */
  const blocked =
    step === 'practice' ? practiceIssue(choices) !== null : step === 'who' ? whoIssue(context, choices) !== null : false;
  const canStart = firstBlockedStep(context, choices) === null && !loading;
  const last = stepIndex === steps.length - 1;

  const go = (s: SetupStep) => setStepIndex(steps.indexOf(s));
  const next = () => {
    if (!blocked && !last) setStepIndex((i) => i + 1);
  };
  const back = () => setStepIndex((i) => Math.max(0, i - 1));

  const start = async () => {
    const stop = firstBlockedStep(context, choices);
    if (loading) return;
    if (stop) {
      go(stop);
      return;
    }
    setLoading(true);
    setStartFailed(false);
    try {
      await onStart({ settings: toRoomSettings(context, choices), identity: choices.identity, identity2: choices.identity2 });
    } catch (err) {
      /* rooms live in Firebase: without a connection (or without the online setup) the game cannot start, say so */
      console.error('start failed', err);
      setStartFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const avatar1 = identityAvatar(choices.identity);
  const avatar2 = identityAvatar(choices.identity2);

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pt-4" role="main">
      <CloseButton />

      <header className="pr-10">
        <p className="text-xs font-bold uppercase tracking-wide text-purple-600">{t(`setup.contexts.${context}`)}</p>
        <div className="mt-1.5">
          <StepDots index={stepIndex} total={steps.length} />
        </div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mt-4 text-3xl font-extrabold leading-tight text-ludiko-text focus:outline-none"
        >
          {t(step === 'who' && context === 'duel' ? 'setup.step.whoDuel' : `setup.step.${step}`)}
        </h2>
      </header>

      <div className="mt-4 flex-1 pb-6">
        {step === 'mode' && (
          <div className="space-y-3" role="group" aria-label={t('setup.step.mode')}>
            {modesFor(context).map((m) => (
              <OptionCard
                key={m}
                emoji={MODE_EMOJI[m]}
                title={t(`setup.mode.${m}.title`)}
                sub={t(`setup.mode.${m}.sub`)}
                tone={MODE_TONE[m]}
                selected={choices.mode === m}
                onClick={() => setMode(m)}
              />
            ))}
            <HowToPlay topic={choices.mode} duel={context === 'duel'} />
          </div>
        )}

        {step === 'practice' && (
          <PracticeStep
            choices={choices}
            onChange={update}
            grade={grade}
            showAll={showAllPresets}
            onShowAll={setShowAllPresets}
            picking={picking}
            onPicking={setPicking}
          />
        )}

        {step === 'who' && (
          <div className="space-y-4">
            {context === 'duel' ? (
              <>
                <div className="rounded-2xl bg-white p-3 shadow" role="group" aria-label={t('interactive.player1')}>
                  <h3 className="mb-2 text-sm font-bold text-purple-600">{t('interactive.player1')}</h3>
                  <AnimalNamePicker
                    value={choices.identity}
                    onChange={(identity) => update({ identity })}
                    exclude={[avatar2]}
                    accent="blue"
                    label={t('rooms.yourName')}
                    className=""
                  />
                </div>
                <div className="rounded-2xl bg-white p-3 shadow" role="group" aria-label={t('interactive.player2')}>
                  <h3 className="mb-2 text-sm font-bold text-pink-600">{t('interactive.player2')}</h3>
                  <AnimalNamePicker
                    value={choices.identity2}
                    onChange={(identity2) => update({ identity2 })}
                    exclude={[avatar1]}
                    accent="pink"
                    label={t('rooms.yourName')}
                    className=""
                  />
                </div>
                {whoIssue(context, choices) && (
                  <p className="text-center text-sm font-semibold text-red-600" role="alert" aria-live="polite">
                    {t('interactive.differentAvatars')}
                  </p>
                )}
              </>
            ) : (
              <div className="rounded-2xl bg-white p-3 shadow">
                <AnimalNamePicker value={choices.identity} onChange={(identity) => update({ identity })} className="" />
              </div>
            )}
          </div>
        )}

        {step === 'ready' && (
          <ReadyStep
            context={context}
            choices={choices}
            onChange={update}
            onGoTo={go}
            advanced={advanced}
            onAdvanced={setAdvanced}
          />
        )}
      </div>

      {startFailed && (
        <p role="alert" className="mb-2 rounded-2xl bg-ludiko-orange/60 p-3 text-center text-sm font-bold" data-testid="start-failed">
          {t('setup.startFailed')}
        </p>
      )}

      {/* Back / Next (always at the bottom, where thumbs are) */}
      <footer className="sticky bottom-0 -mx-4 flex gap-3 border-t border-black/5 bg-ludiko-bg/95 px-4 py-3 backdrop-blur">
        {stepIndex > 0 && (
          <Button variant="yellow" size="lg" onClick={back} className="shrink-0 !px-5">
            <span aria-hidden="true">←</span> <span>{t('setup.back')}</span>
          </Button>
        )}
        {last ? (
          <Button variant="green" size="lg" onClick={start} disabled={!canStart} className="flex-1" data-testid="setup-start">
            {startLabel}
          </Button>
        ) : (
          <Button variant="green" size="lg" onClick={next} disabled={blocked} className="flex-1" data-testid="setup-next">
            {t('setup.next')} <span aria-hidden="true">→</span>
          </Button>
        )}
      </footer>
    </div>
  );
}
