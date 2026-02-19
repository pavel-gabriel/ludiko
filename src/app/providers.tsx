import { BrowserRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

/** Wraps the app with all required providers (router, future context providers) */
export default function Providers({ children }: ProvidersProps) {
  return <BrowserRouter basename="/ludiko">{children}</BrowserRouter>;
}
