import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './i18n/config';
import '@fontsource/opendyslexic/400.css';
import '@fontsource/opendyslexic/700.css';
// Nunito, self-hosted (F4): only the weights the UI uses (400, 600, 700, 800; font-medium falls back to 400
// as before) and the latin + latin-ext subsets (Romanian diacritics ș ț ă â î).
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-ext-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-ext-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-ext-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-ext-800.css';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
