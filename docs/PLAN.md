# Ludiko v2 — Vision & Plan

> Status: **agreed direction**, November 2026. Evidence and sources: [`MARKET_RESEARCH.md`](./MARKET_RESEARCH.md).
> This document supersedes the product direction in `LUDIKO_REQUIREMENTS.md` (v1). The v1 games keep running until they are rebuilt (see §12).

---

## 1. Mission

> **Ludiko is a free tutor that finds each child's gaps early, from grade 0, and fixes them through play.
> It is aligned to the Romanian school programa and runs on a cheap phone, even offline.**

The goal, in three verbs:

1. **Check the level.** A child is in grade III, but does she really have grade III knowledge, or is she at grade II in some areas?
2. **Find the gaps.** Find exactly which competences are missing, including ones from earlier grades.
3. **Close them fast.** Bring the child to where they should be for this point in the school year, anywhere: city or village, online or offline.

Games are **the engine, not the product**. Kids want to play, so every check, every explanation and every bit of practice is wrapped in play.

## 2. Positioning

**The missing piece we solve:** gaps start in primary school and pile up unnoticed until grade VIII. Families who can pay buy private tutoring (48% of parents, ~1,000 lei a month). Rural kids fall furthest behind (42.5% below 5 in math at EN VIII 2026). Nobody offers a free, individual, continuous gap-finder aligned to the Romanian programa.

**We are:** a diagnostic and remediation tutor with game mechanics.
**We are not:** a quiz builder (Wordwall/Kahoot), a test library (Digitaliada), or a textbook (manuale.edu.ro). We link to or complement these instead of duplicating them.

## 3. Users

| User | Needs | Phase |
|---|---|---|
| **Child, grades 0–IV** | Short, playful sessions; pictures and audio (may not read yet); never feel "failed" | 1 |
| **Child, grades V–VIII** | Same core; more autonomy; EN VI/VIII preparation | 2 |
| **Parent** | "What does my child know, what doesn't she know, what do I do?", in plain language, without needing to be a teacher | 1 |
| **Teacher** | Class gap heatmap by competence; who needs what; assign missions; run live class games | 1 |
| **Admin** | Content quality (error reports), aggregate analytics | 1 |

## 4. Core loop

```
 ┌──────────────┐   ┌──────────────┐   ┌───────────────┐   ┌──────────────┐
 │ 1. CHECK     │──▶│ 2. GAP MAP   │──▶│ 3. DAILY       │──▶│ 4. MASTERY   │
 │ "Verifică-te"│   │ per skill,   │   │    MISSION     │   │    CHECK     │
 │ adaptive,    │   │ incl. earlier│   │ explain → play │   │ skill moves  │
 │ 3-min bites  │   │ grades       │   │ → review       │   │ to mastered  │
 └──────────────┘   └──────────────┘   └───────────────┘   └──────┬───────┘
        ▲                                                          │
        └──────────────── spaced re-check (days/weeks later) ◀─────┘
                         reports → child · parent · teacher
```

1. **Check (placement):** a short adaptive diagnostic per subject, split into 3-minute game "bites" so a 6-year-old can manage it. Starts at the child's declared grade and walks down the prerequisite graph when something is missing (§6).
2. **Gap map:** every skill gets a state: `unknown → gap → learning → practised → mastered`. The child sees it as an adventure map; the parent and teacher see it as a list.
3. **Daily mission (≈10 min):** at most 1 new gap to work on, practice on 1–2 "learning" skills, and 1–2 spaced reviews. A wrong answer triggers a **micro-explanation** (3–4 illustrated frames) before the next try.
4. **Mastery check:** when the evidence is high enough, a short game-style check confirms mastery. Mastered skills come back as spaced reviews; if one slips, it returns to `learning`.

**Level statement**, the headline output for parents and teachers:
> "Matematică: nivel **clasa a II-a, semestrul 2**. Clasa reală: a III-a. Lipsesc 4 competențe — estimat 3 săptămâni de misiuni."
> ("Math: level **grade II, semester 2**. Actual grade: III. 4 competences missing — about 3 weeks of missions.")

## 5. Content model

The content is the real product. It lives as **versioned JSON in the repo** (`content/`), is validated by a schema in CI, and is shipped as static bundles cached for offline use.

### 5.1 Hierarchy

```
Subject (mat, rom, stiinte, ist, geo, civ, ...)
 └─ Programa version (e.g. "MEM-2013", "MAT-V-VIII-2017")
     └─ Competence (official code, e.g. "MEM 1.2" — competență specifică)
         └─ Skill (the smallest diagnosable unit; grade + semester; prerequisites)
             ├─ Items (questions, many types; static or procedurally generated)
             └─ Explanations (3–4 illustrated frames, shown on mistakes)
```

The **skill graph** is a directed acyclic graph of prerequisites that crosses grades. It is what lets us say "she's missing *subtraction with borrowing up to 100* (grade II) and that's why *subtraction up to 1000* (grade III) fails".

### 5.2 Skill (example)

```json
{
  "id": "mat.sub.borrow.100",
  "subject": "mat",
  "grade": 2,
  "semester": 1,
  "competences": [{ "programa": "MEM-2013", "code": "1.4" }],
  "title": { "ro": "Scăderea cu trecere peste ordin, până la 100", "en": "Subtraction with borrowing up to 100" },
  "prerequisites": ["mat.sub.noborrow.100", "mat.placevalue.100"],
  "itemSources": [{ "generator": "subtraction", "params": { "max": 100, "borrow": true } }],
  "explanations": ["exp.sub.borrow.blocks"],
  "masteryCheck": { "items": 5, "minCorrect": 4 }
}
```

### 5.3 Item types

| Type | Used for | Example |
|---|---|---|
| `choice` | Everything | 4 options, text or picture |
| `picture-choice` | Non-readers, sciences | "Care animal este mamifer?" (Which animal is a mammal?) |
| `true-false` | Quick checks | |
| `number-input` | Math fluency | Numpad |
| `fill-gap` | Romanian, math equations | `a + 7 = 15` |
| `order` | History timelines, sentence order, number order | Drag the cards into order |
| `sort` | Classification | Vertebrate / invertebrate; metal / non-metal |
| `match` | Pairs | Word ↔ picture; capital ↔ country |
| `hotspot` | Maps, diagrams | "Atinge Dunărea pe hartă" (Tap the Danube on the map) |
| `read-and-answer` | **Reading comprehension** | Short illustrated text + questions |
| `listen-and-answer` | Pre-readers, grade 0–I | Audio prompt + picture options |

Every item has: `difficulty`, `media` (image/audio refs), `explanationRef`, a **`provenance`** record (source, licence, author, title, url; see [`LEGAL_CONTENT_POLICY.md`](./LEGAL_CONTENT_POLICY.md)), `reviewStatus` (`auto-checked` / `beta` / `reviewed`), and `programa` tags. Official exam papers are a **format reference only**; items are always original.

### 5.4 Explanations ("frames")

- 3–4 frames, **one idea and one picture per frame** (Mayer's coherence principle), with an optional narration track.
- They show a *method*, not just the answer: number line, base-10 blocks, grouping, a map zoom, a sentence diagram.
- Built from reusable SVG components (number line, blocks, clock, coins in lei, map of Romania) so they are cheap to make, scale crisply and stay small offline.

### 5.5 Math generators vs authored banks

- **Math:** procedural generators (the existing `gameEngine.ts` grows into this), so answers are verified by code and there are unlimited items.
- **Romanian, sciences, history, geography, civic education:** authored item banks (AI-drafted, auto-checked, see §9) with picture assets.

## 6. Diagnostic & mastery engine

**Placement ("Verifică-te"):**
1. Pick ~6–10 **anchor skills** for the declared grade (key competences from the programa and EN II/IV formats).
2. For each anchor, give 2–3 items in game form.
   - Pass → mark it likely-mastered, along with its prerequisites, with a confidence weight.
   - Fail → **walk down** the prerequisite graph (binary-search style) to find the deepest missing skill.
3. Stop when confidence is high or the time budget runs out (3-minute bites, resumable across days).
4. Output: the gap map and the **level statement** (§4).

**Mastery tracking:** a per-skill, per-child probability of mastery (start with a simple Bayesian Knowledge Tracing / Elo-style update; tune parameters from data later). Item difficulty is calibrated from aggregate data.

**Mission planner:** picks today's mission from the gap map, giving priority to the deepest unmet prerequisites (fix foundations first), spaced reviews that are due, and variety of game mode. Hard cap of ~10 minutes; there is always a "keep playing" option, but never pressure.

**Re-check:** every few weeks, a mini re-check catches skills that have slipped. At the start of each semester, a placement against that semester's anchors.

**Fairness and kindness rules:**
- The child never sees "failed" or "you're behind". The child sees "new islands to explore".
- The level statement is shown to parents and teachers only.
- Wrong answers say "Hai să vedem împreună" ("Let's look at it together") and lead to an explanation, never a harsh red X.

## 7. Game layer (rebuilt on the item model)

Every game mode consumes **items of any skill**. Content and mode are independent.

| Mode | Solo / Class | Notes |
|---|---|---|
| Race | both | Existing Math Race, rebuilt on items |
| Sprint | both | Timed; fluency skills only |
| Memory | both | Match items (word↔picture, operation↔result) |
| Treasure map | solo | The daily mission as an adventure path |
| Picture reveal | solo | Each correct answer uncovers part of an image |
| Duel | 2 players / same device | Rebuilt Interactive mode |
| Boss battle | class | The whole class against one boss; cooperative |
| Class goal | class | "Together we solve 500 exercises this week" |

**Rewards:** stars, a sticker album and avatar items, all **earned by learning, never sold**. A gentle streak ("zile de joacă", days of play) that never resets painfully. A mascot guide (to be designed) narrates explanations and celebrates.

Fluency modes (Race, Sprint) are offered only for skills that are already `practised`, so speed never comes before understanding.

## 8. Reports

| Audience | Format |
|---|---|
| **Child** | Adventure map with islands; stickers; "today's mission" |
| **Parent** | Plain-language weekly summary: level statement, what improved, what's next, one offline tip ("Numărați banii la cumpărături" — count the money when shopping). No charts required. |
| **Teacher** | Class heatmap by competence (official codes); "these 6 pupils miss *mat.sub.borrow.100*"; suggested groups; assign a mission to the class or a group; live class games; PDF export |

## 9. Content pipeline (no human reviewer yet)

1. **Base sources:** the official programa (competence list and contents: official text). Past EN II/IV/VI/VIII papers and textbooks are **format reference only**, never copied. Media: our own SVGs first; open-licence media only under CC0 / CC BY / CC BY-SA (never NC/ND), with attribution. **All rules: [`LEGAL_CONTENT_POLICY.md`](./LEGAL_CONTENT_POLICY.md), enforced in CI.**
2. **AI drafting:** skills, items and explanations are drafted from the programa and tagged with competence codes.
3. **Automatic checks:**
   - Schema validation in CI.
   - Math answers recomputed by code.
   - Distractors checked for duplicates and validity.
   - A second, independent AI check on non-math items.
   - Reading level checked by grade (sentence and word length).
4. **Published as `beta`**, with a **"Raportează o greșeală" (report a mistake)** button on every item. Reports go to an admin queue; any item with 2+ reports is hidden automatically until fixed.
5. **Later:** volunteer reviewers (pedagogy-faculty students doing teaching practice, teachers). Items move `beta → reviewed`.
6. **Curriculum versioning:** content is tagged by programa version, so when the programa changes (e.g. the proposed "Științe" merge for V–VII) we remap skills instead of rewriting them.

**Admin access to the report queue:** Firebase email login + `admins/{uid}` allow-list, enforced in Firestore rules. Setup steps: [`ADMIN.md`](./ADMIN.md).

## 10. Reach: anywhere, on any phone

- **Offline-first PWA:** a service worker caches the app shell and content bundles per subject and grade; progress is stored locally (IndexedDB) and synced when online.
- **Low-end budget:** target a 2 GB RAM Android phone on slow 3G. Initial JS < 250 KB gzipped (code-split per game mode); content bundles < 1 MB per subject-grade; SVG over raster.
- **Shared devices:** several child profiles on one phone (siblings, or a parent's phone).
- **Audio for pre-readers:** pre-recorded Romanian narration for grade 0–II items and explanations (on-device TTS for `ro-RO` is not reliable offline). Audio packs are downloaded separately.
- **Accessibility:** dyslexia font (exists), large tap targets, no colour-only signals, ARIA (exists), reduced motion.
- **Store-ready later:** keep the PWA wrappable (TWA for Play Store; Capacitor for iOS). Avoid web-only APIs in the core.

## 11. Accounts, privacy, business

- **Child profile:** nickname + avatar + **recovery code**. No email, no real name required. Stored locally first.
- **Parent account (optional, email):** links children, syncs across devices, receives the weekly summary; will hold subscriptions later.
- **Teacher account (email):** classes, join codes, reports.
- **Privacy:** no ads, ever. No third-party trackers. Data minimisation. Parental consent flow for sync (GDPR-K). Data export and delete.
- **Business:** the core (check → gaps → missions → reports) is **free forever**. Later: a school/teacher plan (advanced reports, LMS export), then optional family plans for *extras* (more avatar worlds, offline audio packs for older grades, printed worksheets). **Diagnosis and remediation are never paywalled.**

## 12. Architecture

Keep: React 19 + TypeScript + Vite + Tailwind + Firebase. Add a local-first layer.

```
content/                       # versioned JSON, validated in CI
  schema/                      # JSON Schemas for skills, items, explanations
  mat/ rom/ stiinte/ ist/ geo/ civ/
src/
  engine/
    content/      loader, bundle cache, programa mapping
    items/        item type definitions + validators + math generators
    diagnostic/   placement walk over the skill graph
    mastery/      per-skill knowledge tracing
    planner/      daily mission builder, spaced review scheduling
  ui/
    items/        one renderer per item type (choice, order, sort, hotspot…)
    frames/       explanation frames + reusable SVG visuals
    modes/        game modes consuming items (race, memory, treasure map…)
    map/          adventure map
  profiles/       local profiles (IndexedDB) + Firestore sync
  reports/        parent + teacher views
  classroom/      live class games (RTDB) — current room system, refactored
```

**What happens to the v1 code:**
- Rooms, RTDB sync, teacher sessions, i18n, sounds and accessibility are **kept** and refactored.
- Math Race, Equations, Counting, Sequence, Shape Match and Memory are **rebuilt as modes and skills** on the item model. Their generators become item generators.
- v1 stays live until each replacement ships.

## 13. Roadmap

Each phase ships something usable. Order follows the agreed priorities: **math + reading comprehension first**, then sciences, history, geography and civic education; grades 0–IV before V–VIII; Romania first with English UI, international later.

### Phase 0 — Foundations
- [x] Provenance schema + CI licence check + `/credits` page (content & IP policy)
- [x] Content schemas + CI validation; `content/` structure (+ seed math skill graph 0–II)
- [x] Item model + renderers: choice, picture-choice, true-false, number-input, fill-gap, order, sort, match
- [x] Local child profiles (IndexedDB), recovery code, multi-profile per device
- [x] Offline PWA (service worker, content bundle caching), performance budget in CI
- [x] Explanation frames + first SVG visual kit (number line, blocks, clock, coins)
- [x] "Raportează o greșeală" button + admin queue (⚠️ needs real admin auth before launch)
- [ ] Rebuild the existing games as modes over items (Race, Sprint, Memory, Duel)

### Phase 1A — Math 0–IV: check → gaps → missions
- [x] Math skill graph 0–IV with prerequisites, tagged to MEM/Matematică competences — 63 skills (0–II core, III–IV numbers & operations, I–IV measures); **competence codes to verify**
- [x] Generators for every math skill (numbers, place value, compare, +/−/×/÷, equations, fractions, measurement, money, time, geometry basics, word problems)
- [x] Placement diagnostic + level statement (resumable, 3-minute bites, parent-only statement)
- [x] Mastery tracking + mission planner + spaced review (see `docs/ENGINE.md`)
- [x] Adventure map + Treasure map mode + gentle streak (stickers awarded; sticker album screen to do)
- [x] Math explanations (frames) for every skill (beta, AI-drafted — teacher review pending)

### Daily bits & reminders
- [x] Daily bits (≈3-minute groups from the mission) + parent opt-in Web Push reminders (`docs/NOTIFICATIONS.md`); sender active once secrets are set

### Phase 1B — Romanian 0–IV: reading comprehension
- [x] Skill graph: sounds/letters → syllables → words → sentences → short texts → comprehension (literal → inferential) — **23 skills `rom.*`, grades 0–IV (`content/skills/rom/`); CLR-2013 / LLR-III-IV-2014 codes to verify**
- [ ] `listen-and-answer`, `read-and-answer` items; illustrated short texts — **6 generators (letters, syllables, word-picture, sentence-order, punctuation, word-relations) over curated own word/sentence lists (`content/data/rom/`), 40 original `read-and-answer` texts (beta), 23 explanations; `listen-and-answer` (needs narration audio) and text illustrations still to do**
- [ ] Pre-recorded narration pack for grades 0–II
- [ ] Placement + missions reuse the 1A engine

### Phase 1C — Parents & teachers
- [ ] Optional parent account, sync, weekly plain-language summary
- [ ] Teacher class view: competence heatmap, groups, assign missions, PDF export
- [ ] Live class modes rebuilt on items: Boss battle, Class goal, Race

### Phase 1D — Other primary subjects
- [ ] MEM / Științele naturii (III–IV): picture-choice, sort, hotspot
- [ ] Istorie (IV): timelines (`order`), people and places
- [ ] Geografie (IV): map of Romania (`hotspot`), landforms, waters
- [ ] Educație civică (III–IV)
- [ ] Logic puzzles (patterns, mini-sudoku, odd-one-out), framed as puzzles, not "brain training"
- [ ] EN II and EN IV practice in the official format (calificative)

### Phase 2 — Grades V–VIII
- [ ] Extend the skill graphs (math, Romanian) and diagnostics through grade VIII
- [ ] Sciences (Biology, Physics, Chemistry, mapped so the proposed "Științe" merge for V–VII is a remap), History, Geography
- [ ] Marks 1–10 for tests; EN VI and EN VIII simulations
- [ ] More autonomy for older kids: self-chosen missions, challenge modes

### Phase 3 — Sustainability & stores
- [ ] School/teacher plan; optional family extras (never the core)
- [ ] Play Store (TWA) and App Store (Capacitor) builds
- [ ] Volunteer reviewer programme (pedagogy faculties)

### Phase 4 — International (TODO)
- [ ] Full English content track; curriculum-agnostic skill graph mapping (other countries' standards)
- [ ] Minority-language support in Romania (e.g. Hungarian), since EN papers already exist in those languages

## 14. Success metrics

| Metric | Why |
|---|---|
| % of new children who finish placement | Is the check child-friendly? |
| **Gap closure rate**: % of `gap` skills reaching `mastered` within 3 weeks | The core promise |
| Level-statement movement (grade-equivalent gained per month) | Are kids catching up to where they should be? |
| D7 / D30 return rate | Is play motivating enough? |
| Share of usage from rural areas and low-end devices | Are we reaching who needs it most? |
| Error reports per 1,000 items shown | Content quality without reviewers |
| Weekly parent-summary open rate | Are parents engaged? |

## 15. Risks

| Risk | Mitigation |
|---|---|
| Content errors with no human reviewer | Code-verified math, auto-checks, beta label, report button with auto-hide, volunteer reviewers in Phase 3 |
| Diagnosis feels like an exam and kids get anxious | 3-minute game bites, no fail language, level visible only to adults |
| Curriculum changes | Competence + programa-version tagging; skills are remapped, not rewritten |
| Low-end devices and connectivity | Offline-first, performance budget in CI, SVG, split audio packs |
| Scope creep (all subjects at once) | Strict phase order: math + reading first |
| Privacy | Local-first, no child email, no ads or trackers, parental consent for sync |
| Engagement mechanics harming learning | Rewards only for learning, fluency modes only after understanding, gentle streaks |

## 16. Decision log

| # | Decision | Date |
|---|---|---|
| 1 | Mission: free tutor that finds and fixes gaps through play, RO programa, offline, cheap phones | 2026-11-25 |
| 2 | Grades 0–IV first (Phase 1), V–VIII next (Phase 2) | 2026-11-25 |
| 3 | Romania first, with English UI; international later (Phase 4) | 2026-11-25 |
| 4 | Free; no ads ever; later a school/teacher plan and optional family extras; core never paywalled | 2026-11-25 |
| 5 | Content: AI-drafted + automatic checks + official EN items + report button + beta label; reviewers later | 2026-11-25 |
| 6 | Images: open-licence + own SVGs now; illustrator for mascot and maps later | 2026-11-25 |
| 7 | Accounts: child nickname + avatar + recovery code; optional parent email account | 2026-11-25 |
| 8 | Keep the Ludiko brand; add a mascot guide | 2026-11-25 |
| 9 | Subject order: Math + Romanian reading → Sciences/MEM → History & Geography (IV) → Civic education | 2026-11-25 |
| 10 | PWA now, designed to be wrapped for app stores later | 2026-11-25 |
| 11 | Existing games rebuilt as modes on the new item model; v1 stays live until replaced | 2026-11-25 |
| 12 | Content & IP policy: only own, CC0/BY/BY-SA, public-domain or official-text material; no copying of textbooks/exam papers; provenance on every asset, checked in CI; lawyer review before paid plans | 2026-11-26 |
