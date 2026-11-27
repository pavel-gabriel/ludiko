import { lazy, Suspense, useEffect } from 'react';
import { useProfileStore } from '@/store/profileStore';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/* Lazy: the check-progress card reads the content registry, which must stay out of the initial bundle */
const LevelCheckCta = lazy(() => import('@/ui/learn/LevelCheckCta'));

type Tone = 'pink' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';
const TONE: Record<Tone, string> = {
  pink: 'bg-ludiko-pink',
  blue: 'bg-ludiko-blue',
  green: 'bg-ludiko-green',
  yellow: 'bg-ludiko-yellow',
  purple: 'bg-ludiko-purple',
  orange: 'bg-ludiko-orange',
};

/** A "Joacă" card: big icon tile, a title and a one-line hint */
function PlayCard({ emoji, tone, title, sub, onClick, testId }: { emoji: string; tone: Tone; title: string; sub: string; onClick: () => void; testId: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl bg-white px-3 py-2.5 text-left shadow transition-all hover:shadow-md active:scale-[0.97]"
    >
      <span aria-hidden="true" className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl ${TONE[tone]}`}>
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-extrabold leading-tight text-ludiko-text">{title}</span>
        <span className="block text-xs leading-snug text-gray-500">{sub}</span>
      </span>
      <span aria-hidden="true" className="text-xl font-bold text-gray-300">›</span>
    </button>
  );
}

/** A small "Pentru adulți" button */
function AdultButton({ emoji, label, onClick, testId }: { emoji: string; label: string; onClick: () => void; testId: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 rounded-xl bg-white/70 px-1 py-2 text-xs font-bold text-ludiko-text shadow-sm transition-all hover:bg-white active:scale-95"
    >
      <span aria-hidden="true" className="text-xl">{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeProfile = useProfileStore((s) => s.activeProfile);
  const profilesLoaded = useProfileStore((s) => s.loaded);
  const profileCount = useProfileStore((s) => s.profiles.length);
  const loadProfiles = useProfileStore((s) => s.load);
  useEffect(() => {
    if (!profilesLoaded) void loadProfiles();
  }, [profilesLoaded, loadProfiles]);

  return (
    <div className="page">
      <div className="flex w-full max-w-sm flex-col items-center">
        <div className="mb-4 text-center">
          <h1 className="text-5xl font-extrabold text-ludiko-purple">{t('app.title')}</h1>
          <p className="mt-1 text-lg text-ludiko-text opacity-75">{t('home.tagline')}</p>
        </div>

        <button
          onClick={() => navigate('/profiles')}
          className="mb-5 flex min-h-[3rem] items-center gap-2 rounded-full bg-white px-5 py-2 text-lg font-bold shadow-md transition-all hover:bg-gray-50 active:scale-95"
        >
          {activeProfile ? (
            <>
              <span className="text-3xl" aria-hidden="true">{activeProfile.avatar}</span>
              <span className="max-w-[10rem] truncate">{activeProfile.nickname}</span>
            </>
          ) : (
            <>
              <span className="text-3xl" aria-hidden="true">👤</span>
              <span>{t('profiles.switchPlayer')}</span>
            </>
          )}
        </button>

        {/* First visit: no profile yet. Making one is the way to "let's see what you know" */}
        {profilesLoaded && profileCount === 0 && !activeProfile && (
          <section className="mb-4 w-full rounded-3xl bg-ludiko-yellow p-4 text-center shadow-md ring-4 ring-ludiko-orange" data-testid="landing-welcome">
            <h2 className="text-2xl font-extrabold text-ludiko-text">
              <span aria-hidden="true">👋 </span>
              {t('guide.welcome.title')}
            </h2>
            <p className="mt-1 text-base font-semibold text-ludiko-text/80">{t('guide.welcome.body')}</p>
            <button
              type="button"
              onClick={() => navigate('/profiles')}
              data-testid="landing-welcome-go"
              className="mt-3 min-h-[60px] w-full rounded-2xl bg-ludiko-green px-4 text-xl font-extrabold text-ludiko-text shadow-md active:scale-95"
            >
              {t('guide.welcome.cta')} <span aria-hidden="true">→</span>
            </button>
          </section>
        )}

        {/* A profile with subjects still to check: "Hai să vedem ce știi!" comes first */}
        {activeProfile && (
          <Suspense fallback={null}>
            <LevelCheckCta profile={activeProfile} />
          </Suspense>
        )}

        {/* The main thing: learn with Ludiko */}
        <button
          type="button"
          onClick={() => navigate('/learn')}
          data-testid="learn-entry"
          className="flex w-full items-center gap-3 rounded-3xl bg-ludiko-green px-4 py-4 text-left shadow-lg ring-4 ring-ludiko-yellow transition-all hover:bg-green-300 active:scale-[0.97]"
        >
          <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-4xl">🧭</span>
          <span className="min-w-0 flex-1">
            <span className="block text-2xl font-extrabold leading-tight text-ludiko-text">{t('learn.title')}</span>
            <span className="block text-sm leading-snug text-ludiko-text opacity-80">{t('home.learnSub')}</span>
          </span>
        </button>

        {/* Play */}
        <section className="mt-6 w-full" aria-labelledby="home-play">
          <h2 id="home-play" className="mb-2 px-1 text-sm font-extrabold uppercase tracking-wide text-ludiko-text opacity-60">
            {t('home.play')}
          </h2>
          <div className="flex flex-col gap-3">
            <PlayCard testId="play-solo" emoji="🎮" tone="pink" title={t('home.soloTitle')} sub={t('home.soloSub')} onClick={() => navigate('/singleplayer')} />
            <PlayCard testId="play-friends" emoji="👫" tone="blue" title={t('home.friendsTitle')} sub={t('home.friendsSub')} onClick={() => navigate('/multiplayer')} />
            <PlayCard testId="play-duel" emoji="📱" tone="orange" title={t('home.duoTitle')} sub={t('home.duoSub')} onClick={() => navigate('/interactive')} />
          </div>
        </section>

        {/* Adults */}
        <section className="mt-6 w-full" aria-labelledby="home-adults">
          <h2 id="home-adults" className="mb-2 px-1 text-xs font-extrabold uppercase tracking-wide text-ludiko-text opacity-50">
            {t('home.adults')}
          </h2>
          <div className="grid grid-cols-3 gap-2">
            <AdultButton testId="adult-teacher" emoji="🎓" label={t('home.teacher')} onClick={() => navigate('/teacher/login')} />
            <AdultButton testId="adult-parents" emoji="👨‍👩‍👧" label={t('home.parents')} onClick={() => navigate('/learn/parent')} />
            <AdultButton testId="adult-settings" emoji="⚙️" label={t('home.settings')} onClick={() => navigate('/settings')} />
          </div>
        </section>
      </div>
    </div>
  );
}
