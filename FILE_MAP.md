# Ludiko — File Map

> Auto-updated reference of every source file. Update this after each iteration.

## Root Config

| File | Purpose |
|------|---------|
| `package.json` | Dependencies: React 19, Firebase, Vite 6, Zustand, i18next, vitest. Scripts: `dev`, `build`, `test`, `preview` |
| `vite.config.ts` | React plugin, path alias `@/`=`src/`, base=`/ludiko/`, vitest with jsdom |
| `tsconfig.json` | ES2020 target, strict, path aliases, jsx=react-jsx |
| `tailwind.config.js` | Custom `ludiko-*` colors (pink/blue/green/yellow/purple/orange), Nunito + OpenDyslexic fonts |
| `postcss.config.js` | tailwindcss + autoprefixer |
| `database.rules.json` | RTDB rules: read at `/rooms`, indexed on `code`, authenticated writes |
| `index.html` | SPA root with GH Pages redirect script + Nunito font import |
| `CLAUDE.md` | Project conventions for AI assistant |
| `LUDIKO_REQUIREMENTS.md` | Full product requirements (Phases 1a–2) |

## CI/CD

| File | Purpose |
|------|---------|
| `.github/workflows/deploy.yml` | Build + deploy to GitHub Pages on push to `main` |
| `.github/workflows/test.yml` | `npm ci` + test + build on PRs to `main`/`dev` |

## Entry & Routing — `src/`

| File | Key Exports / Purpose | Lines |
|------|----------------------|-------|
| `main.tsx` | Imports i18n config, mounts `<App>` into `#root` with StrictMode | 11 |
| `App.tsx` | Sets page title + `<html lang>` from i18n, wraps in `<ErrorBoundary>` + Providers | 22 |
| `vite-env.d.ts` | TypeScript types for `VITE_FIREBASE_*` env vars | 14 |
| `app/providers.tsx` | `<BrowserRouter basename="/ludiko">` wrapper | 11 |
| `app/AppRoutes.tsx` | Routes: `/` Home, `/create`, `/join`, `/lobby`, `/game` → GameRouter | 19 |

## Services — `src/services/`

| File | Key Exports | Lines |
|------|-------------|-------|
| `firebase.ts` | `db` (Firestore), `rtdb` (RTDB), `auth`, `firebaseEnabled` flag. Lazy init, graceful fallback without env vars | 40 |
| `authService.ts` | `ensureAnonymousAuth()`, `onAuthChange()`, `getCurrentUid()`. Anonymous auth for kids; teacher auth placeholder | 33 |
| `roomManager.ts` | `buildRoom`, `buildPlayer`, `createRoomInDB`, `lookupRoomByCode`, `joinRoomByCode`, `listenToRoom`, `updateRoomStatus`, `setPlayerReady`, `replayRoom`, `deleteRoom`, `registerDisconnectCleanup`, `cleanPlayers`. All RTDB room CRUD + disconnect handlers | 226 |
| `gameSession.ts` | `RTDBGameState` interface, `initMathGameState`, `initShapeGameState`, `initMemoryGameState`, `listenToGameState`, `recordCorrectAnswer`, `advanceQuestion`, `setGamePhase`, `recordPlayerFinished`. Game state in RTDB | 150 |
| `gameEngine.ts` | `generateQuestion` (math), `checkAnswer`, `generateShapeQuestion`, `generateMemoryCards`. Pure functions, no Firebase | 159 |
| `historyService.ts` | `GameHistoryEntry`, `PlayerResult`, `LeaderboardEntry`, `saveGameHistory`, `fetchRecentHistory`, `computeLeaderboard`. Firestore game history + leaderboard aggregation | 121 |

## State — `src/store/`

| File | Key Exports | Lines |
|------|-------------|-------|
| `roomStore.ts` | `useRoomStore`: `room`, `currentPlayer`, `setRoom`, `setCurrentPlayer`, `updatePlayers`, `reset` | 21 |
| `settingsStore.ts` | `useSettingsStore`: `language`, `dyslexicFont`, `soundEnabled` with localStorage persist | 23 |
| `gameStore.ts` | `useGameStore`: `session` (currentRound, scores, status, timeRemaining), `startSession`, `nextRound`, `updateScore`, `reset`. Currently unused but kept | 51 |

## Types & Utils — `src/utils/`

| File | Key Exports | Lines |
|------|-------------|-------|
| `types.ts` | `Difficulty`, `Operation`, `Language`, `GameType`, `GameMode`, `ShapeMode`, `Player`, `Room`, `GameSettings`, `Question`, `ShapeQuestion`, `ShapeOption`, `MemoryCard`, `GameSession`, `UserPreferences` | 86 |
| `constants.ts` | `APP_NAME`, `ROOM_CODE_LENGTH`, `MAX_PLAYERS`, `AVATARS`, `DIFFICULTY_RANGES`, `DEFAULT_GAME_SETTINGS`, `COUNTDOWN_SECONDS`, `GAME_TYPES`, `SHAPES`, `MEMORY_EMOJIS`, `TIMED_SPRINT_DURATION` | 59 |
| `sounds.ts` | `playCorrect`, `playWrong`, `playCountdownBeep`, `playGo`, `playFinish`. Web Audio API oscillators, respects `soundEnabled` | 71 |

## UI Components — `src/components/ui/`

| File | Component | Lines |
|------|-----------|-------|
| `Button.tsx` | `<Button>` — variants: pink/blue/green/yellow/purple/orange, sizes: sm/md/lg | 49 |
| `EmojiPicker.tsx` | `<EmojiPicker>` — 16 emoji avatars, `exclude` prop hides taken avatars. Exports `EMOJI_OPTIONS` | 33 |
| `ErrorBoundary.tsx` | `<ErrorBoundary>` — Class component, shows fallback UI + "Go Home" using `BASE_URL` | 47 |
| `LanguageToggle.tsx` | `<LanguageToggle>` — RO/EN switcher, syncs i18n + settingsStore | 24 |
| `DyslexiaToggle.tsx` | `<DyslexiaToggle>` — Aa button, toggles `dyslexic-mode` class on `<html>` | 27 |
| `SoundToggle.tsx` | `<SoundToggle>` — speaker emoji toggle, syncs settingsStore | 22 |
| `Confetti.tsx` | `<Confetti>` — 60 particles, 2.5s fall, respects `prefers-reduced-motion`, auto-hides 4s | 65 |

## Lobby Components — `src/components/lobby/`

| File | Component | Lines |
|------|-----------|-------|
| `HomePage.tsx` | Landing page: title, create/join buttons, settings toggles (top-right), persistent leaderboard | 43 |
| `CreateRoom.tsx` | Room creation form: name, avatar, gameType, gameMode, difficulty, operations, rounds, timePerRound, shapeMode. Builds room → navigates `/lobby` | 265 |
| `JoinRoom.tsx` | Join form: name, 6-char code, avatar picker with taken avatars excluded via `lookupRoomByCode`. Registers disconnect cleanup | 123 |
| `LobbyPage.tsx` | Waiting room: copyable room code, player list with ready status, host start gate (all must be ready), auto-navigate to `/game` on status change | 177 |

## Game Router — `src/components/games/`

| File | Purpose | Lines |
|------|---------|-------|
| `GameRouter.tsx` | Routes by `room.settings.gameType` → MathRacePage / ShapeMatchPage / MemoryGamePage | 29 |

## Math Race — `src/components/games/MathRace/`

| File | Component | Lines |
|------|-----------|-------|
| `MathRacePage.tsx` | Main game: 3-2-1 countdown, per-question timer (Race) or global timer (Sprint), `localIndex` per player, first-to-finish ends race, host-leave detection. Renders QuestionCard + RaceTrack | 320 |
| `QuestionCard.tsx` | `a ⊕ b = ?` with 4 option buttons, correct/wrong feedback with sounds + 600ms delays | 105 |
| `RaceTrack.tsx` | Horizontal race visualization: player avatars move 0–100% based on progress. Truncated names with `title` tooltip | 82 |
| `CountdownOverlay.tsx` | Full-screen 3-2-1-GO with responsive text (`text-6xl sm:text-9xl`), audio beeps | 43 |
| `index.ts` | Barrel exports | 4 |

## Shape Match — `src/components/games/ShapeMatch/`

| File | Component | Lines |
|------|-----------|-------|
| `ShapeMatchPage.tsx` | Same countdown/timer/progress pattern as MathRace. Renders ShapeCard + RaceTrack | 299 |
| `ShapeCard.tsx` | Prompt + 4 SVG shape buttons, correct/wrong feedback. `timeRemaining` optional for sprint | 126 |
| `ShapeSVG.tsx` | SVG renderer: circle, square, triangle, star, heart, diamond, hexagon, oval. Trig helpers | 95 |
| `index.ts` | Barrel exports | 3 |

## Memory Game — `src/components/games/MemoryGame/`

| File | Component | Lines |
|------|-----------|-------|
| `MemoryGamePage.tsx` | Card flip game: 2-card flips per turn, individual completion tracking, host waits for all. Global timer | 293 |
| `MemoryBoard.tsx` | Grid of cards: dynamic cols (4–10), responsive emoji sizing, matched ring highlight. `max-w-lg mx-auto` | 76 |
| `index.ts` | Barrel exports | 2 |

## Leaderboard — `src/components/leaderboard/`

| File | Component | Lines |
|------|-----------|-------|
| `GameResults.tsx` | End-of-game: top-3 podium (responsive `w-16 sm:w-20`), rest in list, ranks by score+finishTime, saves to Firestore, confetti + replay/newGame buttons | 195 |
| `LiveLeaderboard.tsx` | In-game sorted leaderboard with progress bars (currently unused) | 67 |
| `PersistentLeaderboard.tsx` | Home page all-time top 10 from Firestore. Key: `${name}::${avatar}` | 63 |

## Teacher — `src/components/teacher/`

| File | Purpose | Lines |
|------|---------|-------|
| `index.ts` | Placeholder for Phase 1c teacher dashboard | 3 |

## i18n — `src/i18n/`

| File | Purpose | Lines |
|------|---------|-------|
| `config.ts` | i18next init: LanguageDetector (localStorage → navigator), ro + en, fallback ro | 26 |
| `ro.json` | Romanian translations (default). Sections: app, home, create, join, lobby, game, results, shapes, settings | 107 |
| `en.json` | English translations (parallel). Sections: app, home, create, join, lobby, game, results, shapes, settings | 107 |

## Styles — `src/styles/`

| File | Purpose | Lines |
|------|---------|-------|
| `index.css` | Tailwind directives, @font-face OpenDyslexic, body defaults (Nunito), `.card`/`.page` utils, confetti keyframes | 42 |

## Tests — `tests/`

| File | Purpose | Lines |
|------|---------|-------|
| `gameEngine.test.ts` | 23 vitest tests: math question generation (options, division integers, non-negative), shape questions (4 options, correctIndex), memory cards (pairs, IDs) | ~100 |
| `setup.ts` | Vitest setup: imports `@testing-library/jest-dom` | 1 |

## Public — `public/`

| File | Purpose |
|------|---------|
| `404.html` | GitHub Pages SPA redirect: path → query string → index.html restores route |

---

## Key Architecture Patterns

- **Game flow**: Host creates room (RTDB) → Others join by 6-char code → Host starts → All navigate to `/game` → GameRouter picks component → Each player tracks `localIndex` locally → Correct answers recorded to RTDB → First finisher (Race) or timer (Sprint) ends game → Results + Firestore save
- **State split**: Zustand stores for local UI state; Firebase RTDB for real-time multiplayer sync; Firestore for persistent history
- **Disconnect handling**: Host disconnect → `onDisconnect(roomRef).remove()` (room deleted for everyone). Non-host → `onDisconnect(playerRef).remove()` (slot nullified, cleaned by `cleanPlayers`)
- **Replay**: `replayRoom()` resets scores, ready states, clears game data, sets status='waiting'
- **i18n keys**: `t('section.key')` pattern, keys in both `ro.json` + `en.json`
