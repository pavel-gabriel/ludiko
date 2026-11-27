# Ludiko - Educational Math Games for Kids

## Quick Reference
- **Stack**: React 19 + TypeScript + Vite 6 + Tailwind 3 + Firebase (Auth, RTDB, Firestore)
- **Build**: `npm run build` (tsc + vite build) | **Test**: `npm test` (vitest)
- **Deploy**: GitHub Pages via `.github/workflows/deploy.yml` (push to main)
- **Path alias**: `@/` = `src/` (configured in vite.config.ts + tsconfig.json)
- **Base URL**: `/ludiko/` (GitHub Pages subpath)

## Product Direction (v2)
- **Read `docs/PLAN.md` first** — Ludiko is becoming a free tutor that checks a child's level, finds gaps
  (skill graph across grades, tagged with RO programa competences) and fixes them through play; offline-first PWA.
- Evidence/market: `docs/MARKET_RESEARCH.md`. Track roadmap progress via the checkboxes in `docs/PLAN.md` §13.
- **Content & IP rules are mandatory: `docs/LEGAL_CONTENT_POLICY.md`.** Never copy textbook/workbook/exam
  text or images; only own, CC0/CC BY/CC BY-SA, public-domain or official-text material (no NC/ND, no GPL in
  the bundle). Every third-party asset/library goes in `content/credits.json`; `provenance` on content records;
  enforced by `tests/contentPolicy.test.ts` (runs before deploy).
- Current code below is v1; games will be rebuilt as modes over a shared item model.

## Working Rules: Agent Orchestration
- **Default to orchestration:** split work into independent parts and run them as **parallel sub-agents**
  (isolated worktrees) whenever possible; the main session plans, writes shared contracts first, merges,
  resolves conflicts, verifies in the browser and reports.
- **Pick the most efficient model per task (consumption vs. ROI):**
  - `haiku` — small, well-specified, mechanical tasks (config, simple services, CI scripts, data entry).
  - `sonnet` — default for features, UI, generators, tests, content drafting.
  - `opus` — only where reasoning quality pays off (core algorithms, architecture, tricky integrations).
  - Effort: `low`/`medium` by default; `high` only for child-facing UX or complex logic.
- Before parallel work, commit a **shared contract** (types/interfaces/data shapes) so agents don't collide.
- Agents' worktrees may start from `main`: every agent prompt must begin with merging the working branch.
- Each agent: own i18n namespace, lazy routes, no new deps unless approved, follow the content/IP policy,
  run `npm test`, `npm run build`, `npm run check:size`, commit locally, never push.

## Architecture

### Routes (src/app/AppRoutes.tsx)
`/` HomePage | `/create` CreateRoom | `/join` JoinRoom | `/lobby` LobbyPage | `/game` GameRouter

### Game Types (src/components/games/)
- **MathRace/** — Math questions, Race to Finish or Timed Sprint modes. Also serves the
  numeric games via `generateNumericQuestion()` + `Question.kind`: **Equations**
  (`equations`, find the missing number e.g. `a + 7 = 15` for + − × ÷, rendered by
  `EquationExpression.tsx`), **Counting**, **Number Sequence**
- **ShapeMatch/** — Tap the correct shape, Race to Finish only
- **MemoryGame/** — Card flip matching pairs

### Game Flow
1. Host creates room → RTDB `rooms/{id}` with code, players, settings
2. Others join by 6-char code → `joinRoomByCode` queries RTDB `orderByChild('code')`
3. Host clicks Start → status='playing' → all navigate to `/game`
4. GameRouter picks component by `room.settings.gameType` (pickers group types into
   Math / Other via `GAME_TYPES[].category` + `GameTypePicker`; `usesOperations()` gates the +−×÷ setting)
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
- Content is lazy (docs/ENGINE.md "Content packs"): skill index always loaded; items/explanations/generators per
  subject × grade band in `src/engine/content/packs/<id>.ts` — await `ensureContentForSkills` / `<ContentGate>` before
  generating items; a new generator module must be imported by the pack(s) that use it
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
