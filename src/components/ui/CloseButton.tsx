import { useNavigate } from 'react-router-dom';

interface CloseButtonProps {
  /** Override default navigate('/') */
  onClick?: () => void;
}

/** X button for top-right corner of flow pages. Parent must be relative. */
export default function CloseButton({ onClick }: CloseButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={onClick ?? (() => navigate('/'))}
      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-sm"
      aria-label="Close"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}
