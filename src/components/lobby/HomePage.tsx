import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import PersistentLeaderboard from '@/components/leaderboard/PersistentLeaderboard';

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  return (
    <div className="page relative">
      {/* Leaderboard trophy button — top left */}
      <button
        onClick={() => setShowLeaderboard((v) => !v)}
        className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white shadow flex items-center justify-center text-xl hover:bg-gray-50 transition-colors"
        aria-label={t('game.leaderboard')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-ludiko-yellow" style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.3))' }}>
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
      </button>

      {/* Settings gear — top right */}
      <button
        onClick={() => navigate('/settings')}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white shadow flex items-center justify-center text-xl hover:bg-gray-50 transition-colors"
        aria-label={t('home.settings')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-ludiko-text">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      <div className="text-center mb-12">
        <h1 className="text-6xl font-extrabold text-ludiko-purple mb-2">
          {t('app.title')}
        </h1>
        <p className="text-xl text-ludiko-text opacity-75">
          {t('home.tagline')}
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Button variant="pink" size="lg" onClick={() => navigate('/singleplayer')}>
          {t('home.singlePlayer')}
        </Button>
        <Button variant="blue" size="lg" onClick={() => navigate('/multiplayer')}>
          {t('home.multiplayer')}
        </Button>
        <Button variant="purple" size="lg" onClick={() => navigate('/teacher/login')}>
          {t('home.teacherMode')}
        </Button>
      </div>

      {showLeaderboard && <PersistentLeaderboard />}
    </div>
  );
}
