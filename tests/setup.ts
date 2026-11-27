import '@testing-library/jest-dom';
import { loadAllContentForTests } from './helpers/loadAllContent';

// Content packs are lazy in the app (src/engine/content/packs.ts); tests get all of them up front.
loadAllContentForTests();
