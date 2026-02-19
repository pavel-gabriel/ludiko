# 🎮 Ludiko — Finalized Requirements Document

> **Version:** 1.0 — Finalized after structured requirements interview
> **Last updated:** February 2026

---

## 1. PROJECT OVERVIEW

**Ludiko** is an interactive, multiplayer educational game platform for children aged 3–10 (kindergarten, preschool, and primary school grades 1–4).

### Platform Phases
- **Phase 1 (now):** Web app accessible via URL, hosted on GitHub Pages + Firebase
- **Phase 2 (later):** Native iOS and Android apps (React Native)

### Use Cases
1. **Fun contests** — 1 to N players race against each other on the same game in real time. Visual race mechanic where characters advance toward a finish line based on correct answers.
2. **Classroom tests** — A teacher sets up a session; up to 30 students join from their own device and complete the same assignment simultaneously.
3. **Gamification** — Points, streaks, achievements to keep children engaged.

### Inspiration Reference
- https://game.afifedu.com — Reference for contest race view mechanics (split-screen race with numpad input, characters advancing on correct answers)

---

## 2. TARGET USERS

| User Type | Description |
|-----------|-------------|
| **Child Player** | Age 3–10, plays on tablet/phone/laptop; UI must be simple, colorful, large buttons, pastel theme |
| **Host / Parent** | Sets up a casual contest for 1–N children at home or in a small group |
| **Teacher** | Creates classroom sessions for up to 30 students; configures questions and time limits; has an account |
| **Student** | Joins a teacher's session via a 6-digit code from their own device; no account required |
| **Admin (Owner)** | Views aggregate platform analytics via private dashboard |

---

## 3. BRANDING & VISUAL DESIGN

| Attribute | Decision |
|-----------|----------|
| **App name** | Ludiko |
| **Visual style** | Pastel & friendly — soft colors, rounded shapes/corners, gentle feel |
| **Color palette** | Soft purples, mint greens, warm yellows, light blues, gentle pinks |
| **Typography** | Large, readable fonts; OpenDyslexic available as toggle |
| **Iconography** | Cartoon-style, friendly icons; no text labels for youngest users where possible |
| **Animations** | Correct answer = celebration; wrong answer = friendly "try again" (no harsh red X) |
| **Sound** | Optional (toggle), with visual fallbacks for every sound cue |

---

## 4. GAME LIBRARY

### Phase 1a — Core Games
1. **Math Race** — Basic arithmetic (+, −, ×, ÷) with configurable operations and number ranges. Visual race mechanic.

### Phase 1b — Expansion Games
2. **Shape Match** — Tap the correct shape; great for youngest users (3–5)
3. **Card Flip Memory Game** — Classic memory matching; no reading required

### Phase 1b+ — Additional Games (later)
- Color Identification
- Color Mixing ("Red + Yellow = ?")
- Counting Objects on Screen
- Number Comparison (greater/less than)
- Number Sequences / Fill in the Blank
- Find the Odd One Out
- Sort Shapes by Number of Sides
- Pattern Repetition

### Phase 2 — Stretch Goals
- Fractions
- Parentheses / Order of Operations
- Letter & Language Games (match letter to image, spell the word)
- Trace / Complete the Shape (drag-based)

---

## 5. GAME MODES

### Contest Modes
- **Race to Finish (Phase 1a):** All players get the same set of questions; winner is whoever answers all correctly first. Visual race on screen — characters advance toward finish line on correct answers.
- **Timed Sprint (Phase 1b):** All players answer as many as possible in a fixed time window; most correct answers wins.
- **Survival (later):** Wrong answers eliminate you; last player standing wins.
- **Team Mode (later):** Players split into teams; team score aggregated.

### Classroom / Test Mode (Phase 1c)
- **Self-paced mode:** Students go at their own pace. Teacher can set a global timer for the entire session. When time runs out, the test ends for everyone.
- **Teacher-controlled mode:** Teacher clicks "next question" and it appears on all students' screens simultaneously.
- Teacher sees a live dashboard of each student's progress.
- Results shown per student at the end; exportable (PDF or CSV).

---

## 6. HOST / TEACHER CONFIGURATION

The host or teacher can configure:

- **Player count:** 1–30
- **Age/difficulty level:** Beginner / Intermediate / Advanced
- **Game type(s):** Select from available game library
- **Operations to include** (for math): Checkboxes for +, −, ×, ÷
- **Number range:** e.g., 1–10, 1–100, 1–1000
- **Question count:** e.g., 10, 20, 50
- **Time limit:** Per-question timer, total session timer, or no timer
- **Mode:** Contest / Classroom Test
- **Classroom sub-mode:** Self-paced (with optional global timer) / Teacher-controlled
- **Randomization:** Shuffle questions per player (anti-cheat)
- **Shapes / colors to include** (for non-math games)

### Templates (Phase 1c)
- Teachers can save configurations as reusable templates (e.g., "3rd Grade Addition Test")
- Templates stored in Firestore under teacher's account

### Custom Questions (Phase 1c)
- Teachers can add custom questions in addition to auto-generated ones
- Auto-generated questions are the default

---

## 7. IDENTITY & ACCOUNTS

### Teachers
- **Account required:** Yes
- **Auth methods:** Google Sign-In + Email/Password (Firebase Auth)
- **Data stored:** Email, display name, created templates, session history

### Children (Casual / Contest Mode)
- **No account.** Join with nickname + 6-digit room code only.
- No persistent history across sessions.
- No personal data collected.

### Children (Classroom Mode with Tracking)
- **Optional teacher-generated codes:** Teacher checks a box to generate a unique code per student (e.g., `LION-42`, `STAR-87`)
- The code ties the child to a consistent identity across sessions without an account
- Teacher knows offline which code belongs to which child
- The system only sees the code — **no personal data stored**
- ⚠️ GDPR safe: codes contain no PII; teacher manages the mapping outside the app

### Admin (Owner)
- Separate admin role for platform analytics dashboard
- Not exposed to any users

---

## 8. LEADERBOARD & HISTORY

### During Game
- **Live leaderboard** / race view: Updates in real time as players answer questions
- Visual race mechanic — player characters advance toward finish line
- Shows accuracy and position

### End of Game
- **Results screen:** Shows rankings, accuracy %, time taken
- Top 3 podium with animations (Phase 1b)

### Persistent History (Phase 1b+)
- Per student code: Games played, accuracy %, improvement over time
- Per classroom session: Per-student scores, question-by-question breakdown
- All history stored in Firestore

### Parent Access
- **Phase 1:** Teacher exports/shares results with parents (PDF/CSV)
- **Future phase:** Parent code system — parent enters child's student code to view history

---

## 9. UX & ACCESSIBILITY

### Core UX Principles
- **Mobile-first:** Primary users on tablets and phones
- **Zero-friction join:** 6-digit room code, no account for children
- **Large touch targets:** Big buttons, big fonts, easy for small hands
- **No ads, ever** in the children's UI
- **No dark patterns:** No fake timers, no manipulative UX
- **Realistic content:** No lorem ipsum — always relevant placeholder content

### Accessibility Features (all Phase 1)
- ✅ **Colorblind-friendly:** Never rely on color alone; use shapes/icons alongside colors
- ✅ **Sound with visual fallbacks:** Every sound cue has a visual equivalent
- ✅ **Dyslexia-friendly font:** OpenDyslexic available as a toggle in settings
- ✅ **Screen reader support:** Basic ARIA labels on all buttons and key interactive elements (full polish in Phase 1b)

### Languages
- **Phase 1:** Romanian (default) + English
- **Auto-detection:** App detects browser language, with manual toggle visible on every screen
- **i18n-ready:** Architecture supports adding new languages via JSON files (Hungarian, French, etc.)

---

## 10. TECH STACK

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Framework** | React 18 + Vite | Fast builds, modern standard, huge ecosystem |
| **Language** | TypeScript | Type safety, better DX, catches bugs early |
| **Styling** | Tailwind CSS 3 | Utility-first, mobile-first, no separate CSS files |
| **State** | Zustand | Simple, tiny, no boilerplate — perfect for solo dev |
| **Real-time** | Firebase Realtime Database | Built for live sync — rooms, player positions, leaderboard |
| **Database** | Firebase Firestore | Persistent data — history, templates, scores, admin stats |
| **Auth** | Firebase Auth | Google + Email/Password + Anonymous, zero backend needed |
| **i18n** | react-i18next | Industry standard, JSON translations, auto-detect |
| **Routing** | React Router v6 | Standard for React SPAs |
| **Testing** | Vitest + React Testing Library | Pairs with Vite, fast, Jest-compatible API |
| **Hosting** | GitHub Pages (frontend) + Firebase (backend) | Free tier, simple deployment |
| **CI/CD** | GitHub Actions | Auto-deploy on merge to main, tests on PR |

### Budget
- Firebase free tier for Phase 1 start
- Maximum $100/month if scaling requires Blaze plan
- Budget alerts configured in Firebase

---

## 11. REPOSITORY STRUCTURE

```
ludiko/
├── README.md
├── .github/
│   └── workflows/
│       ├── deploy.yml          # Build & deploy to GitHub Pages on merge to main
│       └── test.yml            # Run tests on PR to dev
├── public/
│   ├── sounds/
│   └── images/
├── src/
│   ├── app/                    # App entry point, providers, root layout
│   ├── components/
│   │   ├── ui/                 # Shared UI components (Button, Modal, Input, etc.)
│   │   ├── games/              # One folder per game type
│   │   │   ├── MathRace/
│   │   │   ├── ShapeMatch/
│   │   │   └── MemoryGame/
│   │   ├── lobby/              # Room creation, join screen, lobby waiting room
│   │   ├── leaderboard/        # Live leaderboard & end-of-game results
│   │   └── teacher/            # Teacher dashboard, config panel, templates
│   ├── hooks/                  # Custom React hooks
│   ├── services/
│   │   ├── firebase.ts         # Firebase init & helpers
│   │   ├── gameEngine.ts       # Question generation logic
│   │   └── roomManager.ts      # Real-time room creation/join/sync
│   ├── store/                  # Zustand stores (game, room, user, settings)
│   ├── i18n/
│   │   ├── config.ts           # i18next configuration
│   │   ├── ro.json             # Romanian translations
│   │   └── en.json             # English translations
│   ├── styles/                 # Tailwind config, global styles, fonts
│   └── utils/                  # Helpers, constants, types
├── tests/                      # Test files mirroring src structure
└── package.json
```

---

## 12. BRANCHING STRATEGY

- **`main`** — Production branch. Always deployable. Auto-deploys to GitHub Pages on push.
- **`dev`** — Working branch. All development happens here. Merge to `main` when stable.
- No complex branching — solo developer + Claude Code.

---

## 13. DEVELOPMENT PHASES

### Phase 1a — Core Foundation (Weeks 1–4)
- [ ] Project scaffold (Vite + React + TypeScript + Tailwind)
- [ ] GitHub Pages deploy pipeline (GitHub Actions)
- [ ] Firebase integration (Realtime DB + Firestore + Auth)
- [ ] Room creation and join flow (6-digit code, lobby)
- [ ] First game: **Math Race** (configurable +/−/×/÷, number range, visual race)
- [ ] Live leaderboard / race view (real-time)
- [ ] End-of-game results screen
- [ ] i18n setup (Romanian + English with auto-detect)
- [ ] Accessibility basics (colorblind-safe, visual fallbacks, dyslexia font, basic ARIA)

### Phase 1b — Game Library Expansion (Weeks 5–8)
- [ ] Shape Match game
- [ ] Card Flip Memory game
- [ ] Timed Sprint mode
- [ ] History tracking in Firestore
- [ ] Persistent leaderboard
- [ ] Top 3 podium with animations
- [ ] Full ARIA / screen reader polish
- [ ] Admin analytics dashboard (aggregate stats, private)

### Phase 1c — Classroom / Teacher Mode (Weeks 9–12)
- [ ] Teacher account creation (Google + Email/Password)
- [ ] Session configuration panel
- [ ] Self-paced mode with global timer
- [ ] Teacher-controlled mode (next question for everyone)
- [ ] Teacher-generated student codes
- [ ] Teacher live dashboard (see all students in real time)
- [ ] Reusable templates (save/load configurations)
- [ ] Custom questions (teacher-created)
- [ ] Export results (PDF or CSV)

### Phase 2 — Mobile & Growth
- [ ] React Native project setup
- [ ] Port all game components
- [ ] Parent code system (parent views child's history via code)
- [ ] Monetization layer (if decided)
- [ ] Additional languages
- [ ] App Store + Play Store submission

---

## 14. CONSTRAINTS & RULES

- ❌ **No ads** in the children's UI, ever
- ❌ **No dark patterns** (no fake countdown timers, no manipulative UX)
- ❌ **No external analytics SDKs** tracking children (no Google Analytics on student pages)
- ❌ **No personal data collected from children** (GDPR / child privacy compliant)
- ❌ **No lorem ipsum** in final UI
- ✅ All libraries: MIT or Apache 2.0 license only
- ✅ All libraries: actively maintained (commit within 6 months), >1k GitHub stars
- ✅ Mobile-first design from day one
- ✅ Every function and non-obvious code block must have a comment
- ✅ Files should not exceed ~200 lines
- ✅ Basic tests for every utility function and game logic module

---

*Document finalized after structured requirements interview — February 2026*
