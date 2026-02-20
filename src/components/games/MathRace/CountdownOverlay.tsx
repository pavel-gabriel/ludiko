import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { playCountdownBeep, playGo } from '@/utils/sounds';

interface CountdownOverlayProps {
  count: number;
}

export default function CountdownOverlay({ count }: CountdownOverlayProps) {
  const { t } = useTranslation();
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      /* Play beep for the initial count (e.g. "3") */
      if (count > 0) playCountdownBeep();
      return;
    }
    if (count > 0) playCountdownBeep();
    else playGo();
  }, [count]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ludiko-purple/90"
      role="alert"
      aria-live="assertive"
    >
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
