# Ludiko — Code Reference

> Complete reference of every source file. Update after each iteration.
> **Goal**: Never re-read source files — all signatures, state, and patterns are here.

## Root Config

| File | Key Info |
|---|---|
| `vite.config.ts` | base `/`, alias `@/` = `src/`, vitest jsdom |
| `tsconfig.json` | ES2020, strict, `@/*` = `./src/*` |
| `firebase.json` | Points to `firestore.rules`, `firestore.indexes.json`, `database.rules.json` |
| `firestore.rules` | gameHistory, teachers/{uid}, sessions/{id}, sessionResults/{id}, templates/{id} |
| `firestore.indexes.json` | sessions(teacherUid+createdAt), templates(teacherUid+createdAt) |
| `database.rules.json` | `.indexOn: ["code"]`, auth read/write on rooms |
| `public/CNAME` | `www.ludiko.ro` |
| `package.json` | react 19, firebase 11.3, zustand 5, react-router-dom 7, i18next 24, vitest 3, @fontsource/opendyslexic |
| `public/404.html` | SPA redirect for GitHub Pages; `pathSegmentsToKeep=0` (custom domain, no prefix) |

---

## Types — `src/utils/types.ts` (165 lines)

```ts
type Difficulty = 'easy' | 'medium' | 'hard'
type Operation = '+' | '-' | '×' | '÷'
type Language = 'ro' | 'en'
type GameType = 'mathRace' | 'shapeMatch' | 'memoryGame'
type GameMode = 'raceToFinish' | 'timedSprint'
type ShapeMode = 'image' | 'word'
type ClassroomMode = 'selfPaced' | 'teacherControlled'

interface Player { id, name, avatar, score, isHost, isReady }
interface Room { id, code, hostId, players[], status, settings, createdAt, classroomSessionId?, classroomMode?, globalTimer? }
interface GameSettings { gameType, gameMode, difficulty, operations[], rounds, timePerRound, shapeMode? }
interface Question { id, a, b, operation, correctAnswer, options[] }
interface ShapeQuestion { id, targetShape, targetLabel, options[], correctIndex }
interface ShapeOption { shape, color, label }
interface MemoryCard { id, pairId, emoji, flipped, matched }
interface TeacherProfile { uid, email, displayName, createdAt }
interface StudentCode { code, label }
interface ClassroomSession { id, teacherUid, title, settings, classroomMode, globalTimer, studentCodes[], roomId?, status, createdAt }
interface SessionTemplate { id, teacherUid, name, settings, classroomMode, globalTimer, customQuestions?, createdAt }
interface CustomQuestion { id, text, options[], correctIndex }
interface StudentSessionResult { studentCode, studentLabel, score, totalQuestions, accuracy, timeTaken, answers[] }
```

## Constants — `src/utils/constants.ts` (60 lines)

```
ROOM_CODE_LENGTH=6, MAX_PLAYERS=30, MIN_PLAYERS=1, COUNTDOWN_SECONDS=3, TIMED_SPRINT_DURATION=60
AVATARS = ['🦊','🐸','🐱','🐶','🐵','🐰','🐻','🐼']
DIFFICULTY_RANGES = { easy:{1,10}, medium:{1,50}, hard:{1,100} }
DEFAULT_GAME_SETTINGS = { mathRace, raceToFinish, easy, ['+','-'], rounds:10, timePerRound:15 }
GAME_TYPES = [{mathRace,🧮,labelKey}, {shapeMatch,🔷,labelKey}, {memoryGame,🃏,labelKey}]
SHAPES = 8 shapes with name, labelKey, color
MEMORY_EMOJIS = 48 emojis
```

## Sounds — `src/utils/sounds.ts` (72 lines)

`playCorrect()`, `playWrong()`, `playCountdownBeep()`, `playGo()`, `playFinish()`
Web Audio oscillators; respects settingsStore.soundEnabled

---

## Zustand Stores

### `src/store/settingsStore.ts` (24 lines) — persisted localStorage
State: `language`(ro), `dyslexicFont`(bool), `soundEnabled`(bool)
Actions: `setLanguage`, `toggleDyslexicFont`, `toggleSound`

### `src/store/roomStore.ts` (22 lines)
State: `room`(Room|null), `currentPlayer`(Player|null)
Actions: `setRoom`, `setCurrentPlayer`, `updatePlayers`, `reset`

### `src/store/gameStore.ts` (52 lines)
State: `session`(GameSession|null)
Actions: `startSession`, `setQuestion`, `nextRound`, `updateScore`, `setStatus`, `setTimeRemaining`, `reset`

### `src/store/authStore.ts` (25 lines)
State: `uid`(string|null), `teacherProfile`(TeacherProfile|null), `loading`(bool, default true)
Actions: `setUid`, `setTeacherProfile`, `setLoading`, `reset`

---

## Services

### `src/services/firebase.ts` (41 lines)
Exports: `firebaseEnabled`(bool), `db`(Firestore), `rtdb`(Database), `auth`(Auth)
Config from `VITE_FIREBASE_*` env vars; lazy init if enabled

### `src/services/authService.ts` (91 lines)
- `ensureAnonymousAuth(): Promise<User|null>` — kids
- `signInWithGoogle(): Promise<User|null>` — popup
- `signInWithEmail(email, pw): Promise<User|null>`
- `registerWithEmail(email, pw, displayName): Promise<User|null>`
- `logOut(): Promise<void>`
- `isTeacher(): boolean`
- `onAuthChange(cb): Unsubscribe`
- `getCurrentUid(): string|null`
- `getCurrentUser(): User|null`

### `src/services/roomManager.ts` (236 lines)
- `generateRoomCode(): string` — 6-char alphanumeric
- `generatePlayerId(): string` — 8-char random
- `pickAvatar(playerCount): string`
- `buildRoom(hostName, settings?, avatar?): Room`
- `buildPlayer(name, playerCount, avatar?): Player`
- `createRoomInDB(room): Promise<void>`
- `lookupRoomByCode(code): Promise<Room|null>` — query by code, status='waiting'
- `joinRoomByCode(code, playerName, avatar?): Promise<{room,player}|null>`
- `listenToRoom(roomId, cb): Unsubscribe`
- `updateRoomStatus(roomId, status): Promise<void>`
- `setPlayerReady(roomId, playerIndex, ready): Promise<void>`
- `replayRoom(roomId): Promise<void>` — reset to 'waiting', zero scores
- `deleteRoom(roomId): Promise<void>`
- `removePlayer(roomId, playerId): Promise<void>` — filter out player from RTDB
- `registerDisconnectCleanup(roomId, isHost, playerIndex?): void`
- `cleanPlayers(players): Player[]`

### `src/services/gameSession.ts` (150 lines)
```ts
interface RTDBGameState {
  gameType, questions?, shapeQuestions?, memoryCards?, currentIndex,
  progress: Record<string,number>, phase: 'countdown'|'playing'|'finished',
  questionStartedAt, startedAt?, finishTimes?: Record<string,number>
}
```
- `initMathGameState(roomId, questions[], playerIds[])`
- `initShapeGameState(roomId, shapeQuestions[], playerIds[])`
- `initMemoryGameState(roomId, memoryCards[], playerIds[])`
- `listenToGameState(roomId, cb): Unsubscribe`
- `recordCorrectAnswer(roomId, playerId, newCount)`
- `advanceQuestion(roomId, nextIndex)`
- `setGamePhase(roomId, phase)` — sets `startedAt` when phase='playing'
- `recordPlayerFinished(roomId, playerId)` — stores Date.now() in finishTimes

### `src/services/gameEngine.ts` (160 lines)
- `generateQuestion(difficulty, operations[]): Question`
- `checkAnswer(question, answer): boolean`
- `generateShapeQuestion(difficulty): ShapeQuestion`
- `generateMemoryCards(pairCount): MemoryCard[]`

### `src/services/historyService.ts` (121 lines)
- `saveGameHistory(entry): Promise<string>`
- `fetchRecentHistory(max=50): Promise<GameHistoryEntry[]>`
- `computeLeaderboard(entries[]): LeaderboardEntry[]`

### `src/services/teacherService.ts` (247 lines)
Helper: `stripUndefined(obj)` — JSON parse/stringify to remove undefined

**Profile**: `upsertTeacherProfile(profile)`, `getTeacherProfile(uid)`
**Sessions**: `createSession(uid,title,settings,mode,timer,codes): id`, `getTeacherSessions(uid)`, `getSession(id)`, `updateSession(id,updates)`, `deleteSession(id)`
**Codes**: `generateStudentCodes(count): StudentCode[]` — ANIMAL-NN format (30 animals)
**Results**: `saveSessionResults(id,results[])`, `getSessionResults(id)`
**Templates**: `saveTemplate(uid,name,settings,mode,timer,customQs?)`, `getTeacherTemplates(uid)`, `deleteTemplate(id)`
**CSV**: `exportResultsToCSV(title,results[]): string`, `downloadCSV(filename,csv)`

---

## App Shell

### `src/App.tsx` (50 lines)
- Effect 1: Update document.title + lang on i18n change
- Effect 2: `onAuthStateChanged` → restore uid + teacherProfile from Firebase
- Effect 3: Sync `dyslexic-mode` class on `<html>` from settingsStore.dyslexicFont
- Render: ErrorBoundary > Providers > AppRoutes

### `src/app/providers.tsx` (11 lines)
BrowserRouter with basename="/"

### `src/app/AppRoutes.tsx` (46 lines)
Routes: `/` HomePage, `/singleplayer` SinglePlayerPage, `/multiplayer` MultiplayerPage, `/settings` SettingsPage, `/create` CreateRoom, `/join` JoinRoom, `/lobby` LobbyPage, `/game` GameRouter
Teacher: `/teacher/login`, `/teacher`, `/teacher/session/new`, `/teacher/session/:id/edit`, `/teacher/session/:id`, `/teacher/live/:id`, `/teacher/results/:id`, `/teacher/templates`

### `src/main.tsx` (13 lines)
Entry: imports i18n, @fontsource/opendyslexic (400+700), styles, renders App into #root

### `src/i18n/config.ts` (26 lines)
i18next + LanguageDetector, fallback: 'ro', supported: ['ro','en']

---

## UI Components

### `src/components/ui/Button.tsx` (50 lines)
Props: `variant`(pink|blue|green|yellow|purple|orange), `size`(sm|md|lg), `className`, `children`, `...props`

### `src/components/ui/ErrorBoundary.tsx` (47 lines)
Class component, catches React errors, shows home button

### `src/components/ui/Confetti.tsx` (65 lines)
60 particles, random colors, auto-hide 4s, respects prefers-reduced-motion

### `src/components/ui/LanguageToggle.tsx` (24 lines)
Toggle ro/en, updates i18n + settingsStore

### `src/components/ui/SoundToggle.tsx` (22 lines)
Toggle sound on/off

### `src/components/ui/DyslexiaToggle.tsx` (27 lines)
Toggle dyslexic font class on document root

### `src/components/ui/EmojiPicker.tsx` (34 lines)
Props: `selected`, `onChange`, `exclude?`. Exports `EMOJI_OPTIONS` (16 emojis)

---

## Lobby Components

### `src/components/lobby/HomePage.tsx` (47 lines)
Gear icon (top-right) → /settings. Title + tagline. 3 buttons: Single Player, Multiplayer, Teacher Mode. PersistentLeaderboard.

### `src/components/lobby/SinglePlayerPage.tsx` (195 lines)
Simplified game config: name, avatar, game type, shape mode, difficulty, operations, rounds/time.
No mode selector — defaults to raceToFinish. "Play" button creates room with `status:'playing'` and navigates directly to `/game` (skips lobby).
Handler: `handlePlay()` — ensureAnonymousAuth → buildRoom → set status='playing' → createRoomInDB → store → navigate('/game')

### `src/components/lobby/MultiplayerPage.tsx` (27 lines)
Title + 2 buttons: Create Room → /create, Join Room → /join. Back → /

### `src/components/lobby/SettingsPage.tsx` (82 lines)
Sound toggle (switch), Language selector (RO/EN buttons), Dyslexic font toggle (switch). Back → /
Note: dyslexic-mode class managed globally in App.tsx effect, not DyslexiaToggle component.

### `src/components/lobby/CreateRoom.tsx` (265 lines)
State: name, avatar, gameType, gameMode, difficulty, rounds, timePerRound, operations, shapeMode, loading
Handler: `handleCreate()` — ensureAnonymousAuth → buildRoom → createRoomInDB → registerDisconnectCleanup → store → navigate
UI: Full game config form (name, avatar, type, mode, difficulty, ops, rounds, time)

### `src/components/lobby/JoinRoom.tsx` (123 lines)
NOTE: Route `/join` — direct URL access handled by 404.html SPA redirect
State: name, avatar, code, error, loading, takenAvatars
Effect: code 6 chars → lookupRoomByCode → extract taken avatars
Handler: `handleJoin()` — ensureAnonymousAuth → joinRoomByCode → store → navigate

### `src/components/lobby/LobbyPage.tsx` (182 lines)
State: copied (bool)
Effect: listenToRoom → sync, redirect if deleted, navigate to game when playing
Logic: isHost, allOthersReady, canStart
Handlers: handleLeave (host=deleteRoom, others=removePlayer), handleReady, handleStart
UI: room code, players list, ready/start buttons

---

## Game Components

### `src/components/games/GameRouter.tsx` (29 lines)
Routes to MathRacePage | ShapeMatchPage | MemoryGamePage by room.settings.gameType

### MathRace

#### `MathRacePage.tsx` (323 lines)
State: gameState, countdown, showCountdown, timeRemaining, timerRef, localIndex, finishedRef
Flags: isSprint, displayTotal, SPRINT_POOL_SIZE=100
Effects: back-button exit, room listener (replay→lobby), host generates questions, subscribe game state, countdown, per-question timer (race) or global timer (sprint), finish detection
Handler: `handleAnswer(answer)` — correct → recordCorrectAnswer; always advance localIndex
Render: CountdownOverlay | GameResults (finished) | loading | waiting (sprint done) | RaceTrack+QuestionCard
**Key pattern**: `key={localIndex}` forces QuestionCard remount

#### `QuestionCard.tsx` (105 lines)
Props: question, questionNumber, totalQuestions?, timeRemaining?, onAnswer
State: selected, correct
2x2 answer grid, feedback text, sound on answer

#### `RaceTrack.tsx` (82 lines)
Props: players, progress, totalQuestions
Horizontal bars per player, position = progress/total, finish line, bounce animation

#### `CountdownOverlay.tsx` (43 lines)
Props: count. Full-screen 3-2-1-GO with sounds

### ShapeMatch

#### `ShapeMatchPage.tsx` (301 lines)
Same pattern as MathRacePage. Uses shapeQuestions, initShapeGameState, ShapeCard
Extra: shapeMode state

#### `ShapeCard.tsx` (126 lines)
Props: question, questionNumber, totalQuestions, timeRemaining?, shapeMode, onAnswer
Word mode: shows shape graphic, tap text. Image mode: shows text, tap shape SVG

#### `ShapeSVG.tsx` (95 lines)
Props: shape, color, size. Renders circle/square/triangle/star/heart/diamond/hexagon/oval SVG

### MemoryGame

#### `MemoryGamePage.tsx` (295 lines)
State: gameState, cards, flippedIndices, matchedIndices(Set), tries, checking, flipTimeoutRef
No sprint mode. Timer is total time only.
Handler: `handleFlip(index)` — flip 2 cards, check match, record pairs found

#### `MemoryBoard.tsx` (76 lines)
Props: cards, flippedIndices, matchedIndices, onFlip, disabled
Responsive grid (4-10 cols), flip animation, "?" for unflipped

---

## Leaderboard Components

### `GameResults.tsx` (217 lines)
Props: players, scores, totalQuestions, finishTimes?, gameMode?, startedAt?, onPlayAgain, onNewGame
Ranking: timedSprint → score desc then fastest. raceToFinish → same.
Shows: confetti, champion, podium (top 3, display order 2nd-1st-3rd), rest list, finish times, replay/new buttons
Helper: `formatTime(seconds)` → M:SS

### `LiveLeaderboard.tsx` (67 lines)
Props: players, progress, totalQuestions. During-game sorted progress bars.

### `PersistentLeaderboard.tsx` (63 lines)
Home page all-time leaderboard. Fetches 50 recent, aggregates by name+avatar, top 10.

---

## Teacher Components

### `TeacherLogin.tsx` (186 lines)
State: mode(login|register), email, password, displayName, error, loading
Handlers: handleGoogle (catches popup-closed-by-user silently), handleEmailSubmit (catches email-already-in-use → auto fallback to login)
handleSuccess: fetch/upsert profile → authStore → navigate /teacher

### `TeacherDashboard.tsx` (153 lines)
State: sessions, loading. Waits for authLoading before fetch.
Handlers: handleLogout, handleDelete
UI: header+logout, new session/templates buttons, session list with status badges

### `SessionConfig.tsx` (495 lines)
State: title, gameType, difficulty, operations, rounds, timePerRound, shapeMode, classroomMode, globalTimer, studentCount, customQuestions, templates, loading, error, templateName
`isNew = !sessionId` — route `/teacher/session/new` has no `:sessionId` param → undefined → isNew=true
Waits for authLoading. Loads existing session if editing. Loads templates.
handleSaveTemplate: duplicate name check (case-insensitive), saveTemplate
handleSave: createSession (new) or updateSession (edit), with catch → error display
UI: template selector, title, game type, classroom mode, shape mode, difficulty, operations, rounds/time/students/timer, custom questions editor, save-as-template, save/back buttons

### `SessionDetail.tsx` (160 lines)
View session: settings display, student codes list (copyable), start/edit/results buttons

### `TeacherLiveDashboard.tsx` (237 lines)
Live monitoring: RTDB listener, student progress bars, global timer, next question (teacher-controlled), end session

### `SessionResults.tsx` (129 lines)
Post-game: student results list, summary stats, CSV export

### `TemplatesPage.tsx` (80 lines)
Template list: name, game type, delete button, hint text

---

## i18n Keys Structure

```
app.pageTitle, app.tagline
home.singlePlayer, home.multiplayer, home.createRoom, home.joinRoom, home.teacherMode, home.settings, home.play
create.* (gameType, difficulty, operations, rounds, timePerRound, shapeMode, etc.)
join.* (title, name, code, join, error.*)
lobby.* (title, roomCode, copied, ready, waiting, start, leave, soloHint)
game.* (question, score, timer, exitGame, getReady, finished, waitingForOthers, etc.)
results.* (title, replay, newGame, champion, accuracy, finishTime)
shapes.* (circle, square, triangle, star, heart, diamond, hexagon, oval)
leaderboard.* (title, wins, accuracy, noData)
teacher.* (login, googleSignIn, register, signIn, dashboard, newSession, templates,
  sessions, studentCodes, classroomMode, mode.*, status.*, customQuestions, saveTemplate,
  duplicateTemplateName, saveError, unauthorizedDomain, etc.)
```

---

## Tests — `tests/`

### `gameEngine.test.ts` (177 lines, 23 tests)
generateQuestion: 16 tests (options, arithmetic, ranges, operations, no dupes)
checkAnswer: 2 tests
generateShapeQuestion: 4 tests
generateMemoryCards: 6 tests (count, pairs, uniqueness)

### `teacherService.test.ts` (79 lines, 6 tests)
generateStudentCodes: 4 tests (count, unique, format, labels)
exportResultsToCSV: 2 tests (valid CSV, empty)

---

## Key Patterns

- **Host-Driven**: Host generates questions, controls phase transitions
- **Local Tracking**: `localIndex` per player, only correct answers sent to RTDB
- **Key Remount**: `key={localIndex}` on question cards
- **Auth Persistence**: `onAuthStateChanged` in App.tsx restores teacher auth on refresh
- **Firebase Guard**: All services check `firebaseEnabled` flag
- **Disconnect Cleanup**: `onDisconnect` handlers for room/player removal
- **Replay Flow**: `replayRoom()` → status='waiting' → game pages detect and navigate to /lobby
- **Remove Player**: `removePlayer()` for leave room / new game cleanup
