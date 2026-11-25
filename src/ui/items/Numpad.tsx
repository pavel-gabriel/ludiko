import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface NumpadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  maxLength?: number;
}

const keyClass =
  'min-h-[56px] rounded-xl border-2 border-ludiko-blue bg-white text-2xl font-extrabold text-ludiko-text shadow-sm active:scale-95 active:bg-ludiko-blue/20 disabled:cursor-not-allowed disabled:opacity-40';

/**
 * On-screen calculator-style numpad (no OS keyboard). Also accepts a physical keyboard:
 * digits, Backspace and Enter.
 */
export default function Numpad({ value, onChange, onSubmit, disabled, maxLength = 6 }: NumpadProps) {
  const { t } = useTranslation();
  const latest = useRef({ value, onChange, onSubmit, disabled, maxLength });
  latest.current = { value, onChange, onSubmit, disabled, maxLength };

  const press = (d: string) => {
    const cur = latest.current;
    if (cur.disabled || cur.value.length >= cur.maxLength) return;
    cur.onChange(cur.value === '0' ? d : cur.value + d);
  };
  const erase = () => {
    const cur = latest.current;
    if (!cur.disabled) cur.onChange(cur.value.slice(0, -1));
  };
  const submit = () => {
    const cur = latest.current;
    if (!cur.disabled && cur.value !== '') cur.onSubmit();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') erase();
      else if (e.key === 'Enter' && target?.tagName !== 'BUTTON') submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto grid max-w-xs grid-cols-3 gap-2">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button key={d} type="button" disabled={disabled} onClick={() => press(d)} className={keyClass}>
          {d}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled || value === ''}
        onClick={erase}
        className={keyClass}
        aria-label={t('items.delete')}
      >
        <span aria-hidden="true">⌫</span>
      </button>
      <button type="button" disabled={disabled} onClick={() => press('0')} className={keyClass}>
        0
      </button>
      <button
        type="button"
        disabled={disabled || value === ''}
        onClick={submit}
        className="min-h-[56px] rounded-xl bg-ludiko-green text-xl font-extrabold text-ludiko-text shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t('items.done')}
      </button>
    </div>
  );
}
