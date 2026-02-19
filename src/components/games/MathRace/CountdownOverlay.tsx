import { useTranslation } from 'react-i18next';

interface CountdownOverlayProps {
  /** Current countdown number (3, 2, 1, 0) — 0 means "Go!" */
  count: number;
}

/**
 * Full-screen overlay that shows 3… 2… 1… Go! before the game starts.
 * Large, animated numbers centered on screen.
 */
export default function CountdownOverlay({ count }: CountdownOverlayProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ludiko-purple/90">
      <div className="text-center animate-pulse">
        {count > 0 ? (
          <span className="text-9xl font-extrabold text-white drop-shadow-lg">
            {count}
          </span>
        ) : (
          <span className="text-7xl font-extrabold text-ludiko-yellow drop-shadow-lg">
            {t('game.go')}
          </span>
        )}
      </div>
    </div>
  );
}
