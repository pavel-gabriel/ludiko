import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface CloseButtonProps {
  /** Override default navigate(-1) (go back) */
  onClick?: () => void;
}

/** X button for top-right corner of flow pages. Parent must be relative. 44px tap area around a 32px circle. */
export default function CloseButton({ onClick }: CloseButtonProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <button
      onClick={onClick ?? (() => navigate(-1))}
      className="absolute top-1.5 right-1.5 w-11 h-11 flex items-center justify-center group"
      aria-label={t('a11y.close')}
    >
      <span className="w-8 h-8 rounded-full bg-red-500 group-hover:bg-red-600 flex items-center justify-center transition-colors shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    </button>
  );
}
