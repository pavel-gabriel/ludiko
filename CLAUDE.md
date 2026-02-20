# Ludiko - Educational Math Games for Kids

## Quick Reference
- **Stack**: React 19 + TypeScript + Vite 6 + Tailwind 3 + Firebase (Auth, RTDB, Firestore)
- **Build**: `npm run build` (tsc + vite build) | **Test**: `npm test` (vitest)
- **Deploy**: GitHub Pages via `.github/workflows/deploy.yml` (push to main)
- **Path alias**: `@/` = `src/` (configured in vite.config.ts + tsconfig.json)
- **Base URL**: `/ludiko/` (GitHub Pages subpath)

## Architecture

### Routes (src/app/AppRoutes.tsx)
`/` HomePage | `/create` CreateRoom | `/join` JoinRoom | `/lobby` LobbyPage | `/game` GameRouter

### Game Types (src/components/games/)
- **MathRace/** — Math questions, Race to Finish or Timed Sprint modes
- **ShapeMatch/** — Tap the correct shape, Race to Finish only
- **MemoryGame/** — Card flip matching pairs

### Game Flow
1. Host creates room → RTDB `rooms/{id}` with code, players, settings
2. Others join by 6-char code → `joinRoomByCode` queries RTDB `orderByChild('code')`
3. Host clicks Start → status='playing' → all navigate to `/game`
4. GameRouter picks component by `room.settings.gameType`
5. Each player tracks own question via `localIndex` (local state)
6. Only correct answers call `recordCorrectAnswer` (RTDB progress)
7. Game ends when host finishes all questions (Race) or timer expires (Sprint)
8. Results: "Replay" resets room to waiting, "New Game" goes to home

### State Management
- **Zustand stores** (`src/store/`): roomStore (room + currentPlayer), settingsStore (persisted prefs), gameStore
- **Firebase RTDB**: Live room state, player progress, game phase sync
- **Firebase Firestore**: Game history for persistent leaderboard
- **Local state**: localIndex, timer, countdown — all per-component

### Services (src/services/)
- `firebase.ts` — Lazy init, guarded by `firebaseEnabled` flag (works without env vars)
- `roomManager.ts` — CRUD rooms in RTDB, join by code, disconnect cleanup
- `gameSession.ts` — Init game state, listen, record answers, advance phases
- `gameEngine.ts` — Pure functions: generate math/shape/memory questions
- `authService.ts` — Anonymous Firebase Auth (guarded by firebaseEnabled)
- `historyService.ts` — Firestore game history + leaderboard computation

### i18n (src/i18n/)
- Languages: `ro.json` (Romanian, default), `en.json`
- Detection: localStorage → navigator
- Page title updates dynamically via App.tsx

### Key Patterns
- `key={localIndex}` on QuestionCard/ShapeCard forces clean remount per question
- Sounds via Web Audio oscillators (`src/utils/sounds.ts`), respects settingsStore.soundEnabled
- Firebase env vars from `.env` locally, GitHub Actions secrets in CI
- SPA routing on GitHub Pages: `public/404.html` + redirect script in `index.html`

## Firebase Config
- Project: `ludiko-2e197`
- RTDB rules: `database.rules.json` — `.read` at `/rooms` level for join queries
- Firestore rules: `firestore.rules`
- All env vars prefixed `VITE_FIREBASE_*`

## Conventions
- Components: PascalCase files, one component per file
- Styles: Tailwind utility classes, custom colors prefixed `ludiko-`
- No semicolons in some files (mixed — not enforced)
- Tests in `tests/` directory, vitest + jsdom + @testing-library/react
