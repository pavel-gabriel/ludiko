# Learning engine (Phase 1A)

Pure, deterministic TypeScript in `src/engine/{mastery,diagnostic,planner}` — no UI, no clock,
no randomness (callers pass `now`). Implements docs/PLAN.md §4 (core loop, level statement) and §6.
Tests: `tests/engine.*.test.ts` (incl. an end-to-end learner simulation; route + next island in
`tests/engine.route.test.ts`).

## Session flow (how the UI calls it)

```
first time (or start of semester):
  st = createPlacement(skills, { grade, semester, subject })      // skills = getAllSkills()
  loop  p = nextProbe(st); if p.done → break
        results = play p.itemsWanted items of p.skillId           // boolean[]
        st = recordProbe(st, p.skillId, results)                  // persist st (plain JSON) → resumable bites
  result = placementResult(st)
  levelStatement(result, 'ro' | 'en')                             // parents/teachers only
  progress.skills = { ...progressFromPlacement(result, now), ...existingRecordsWithAttempts }

every day:
  mission = planMission(skills, progress.skills, { now, minutes: 10 })
  for step of mission.steps:
    new      → show the skill's explanation frames, then step.itemCount items
    practice / review → step.itemCount items
    each answer:  progress.skills[id] = updateMastery(progress.skills[id], { correct, itemType, now, optionCount })
    check    → play skill.masteryCheck.items items, then
               progress.skills[id] = applyMasteryCheck(rec, results, skill.masteryCheck, { itemType, now }).record
  save progress
```

## Mastery — `mastery/` (BKT + state machine + spaced review)

Standard Bayesian Knowledge Tracing per skill. `guessFor(itemType, optionCount?)`: true-false 0.5,
choice-like 0.25 (or 1/options), typed number-input / fill-gap 0.05, order/sort/match 0.1,
read-and-answer 0.2. Slip 0.1, transit 0.1, prior 0.2; p clamped to [0.01, 0.99].

| From | To | When |
|---|---|---|
| unknown | learning / gap | first answer correct / wrong |
| gap | learning | a correct answer |
| learning | practised | p ≥ 0.7 and ≥ 3 attempts |
| practised | learning | p < 0.5 |
| practised | mastered | **passed mastery check** (`applyMasteryCheck`), or p ≥ 0.95 with ≥ 15 attempts |
| mastered | learning | p < 0.6 (slipped; one error is tolerated) |

Ready for a check (`isReadyForCheck`): practised, p ≥ 0.85, ≥ 5 attempts.

Spaced review ladder: 1 → 3 → 7 → 14 → 30 → 60 days. A correct answer while the review is due
(12 h tolerance) moves one step up; extra correct answers before it is due change nothing; a wrong
answer moves 2 steps down. Passing a check moves one step up. All numbers live in
`DEFAULT_MASTERY_CONFIG` (override per call).

## Placement — `diagnostic/`

* **Scope**: subject skills with (grade, semester) ≤ declared; the target is the highest level with
  content (a grade III child is placed against II/2 while content ends there).
* **Anchors (6–10)**: greedy set cover over "skill + all its prerequisites" — end-of-chain skills
  cover the most — then topped up with the hubs (most transitive dependants) of the target grade.
  Small graphs: every skill. Probed highest level first.
* **Probe**: 3 items; pass = ≥ 2/3 (`passRatio`). Direct confidence 0.5 + 0.45·|2·ratio − 1|
  (3/3 → 0.95, 2/3 → 0.65).
* **Inference**: pass ⇒ every prerequisite is likely mastered with confidence `conf · 0.9^distance`;
  fail ⇒ every dependant is a gap. Direct evidence beats inference; between inferences, fail wins ties.
  An inferred pass below 0.5 stays `unknown`.
* **Walk down** (`nextProbe`): after a fail, probe the midpoint of the longest *unresolved*
  prerequisite chain below it (binary search on the chain); a fail there becomes the new failure.
  Then remaining anchors (skipped if inferred gap or inferred mastered ≥ 0.8), then a sweep of any
  still-unknown skill. Budget: `maxProbes` = 12 skills (~36 items, several 3-minute bites).
  On the real 18-skill graph: perfect child 4 probes; a child missing only `mat.add.carry.20` 9.
* **Result**: per-skill `{ state: mastered | gap | unknown, confidence, observed }`;
  `gaps` foundations first (prerequisite depth, then level); `frontier` = gaps whose prerequisites are
  all mastered (teach next). **Level** = the highest (grade, semester) such that every in-scope skill
  at or below it is (likely) mastered (`null` if even the first semester is incomplete).
  `missingCount` = number of gaps; `estimatedWeeks` = ⌈missing · 3.5 missions ÷ 5 missions/week⌉
  (deliberately conservative; recalibrate from real gap-closure data, PLAN §14).
* `levelStatement(result, lang)` → "Matematică: nivel clasa a II-a, semestrul 2. Clasa reală: a III-a.
  Lipsesc 4 competențe — estimat 3 săptămâni de misiuni." (en too). Parents/teachers only.
* `progressFromPlacement(result, now)` seeds mastery records: likely-mastered skills get
  p = 0.6 + 0.35·confidence and an early review (1/3/7 days by confidence) — that review is the
  re-check of inferred skills; gaps get p ≈ 0.05–0.15.

## Mission planner — `planner/`

`planMission(skills, progress, { now, minutes = 10, subject?, ceiling? })` →
`{ steps: { kind, skillId, itemCount }[], totalItems, estimatedSeconds }`.

* **review**: up to 2 mastered skills whose review is due, most overdue first (3 items).
* **new**: at most 1 — **the next island on the route** (`route.ts`, below): a `gap` whose
  prerequisites are all ≥ practised (gap repair, in route order), else the first never-seen skill on
  the route whose prerequisites are all ≥ practised, within `ceiling` (6 items + 60 s explanation).
* **check**: 1 skill ready for its mastery check (`masteryCheck.items`, never shrunk).
* **practice**: 1–2 learning/practised skills (learning first, then due, then least recently seen).
* Review/practice/check never pick a skill with a prerequisite in `gap`.
* **Budget**: ⌊(minutes·60 − explanation) / 25 s⌋ items. Priority review₁ → new → check → practice₁
  → review₂ → practice₂; leftover budget tops up practice/new steps (≤ 10 items each).
* **Order shown**: review₁ (warm-up), check, new, practice₁, review₂, practice₂ — each skill once,
  so never the same skill twice in a row. Nothing to do ⇒ the earliest upcoming reviews.

## Island route — `planner/route.ts`

The child's map and the planner share ONE ordered path through a subject's skills, so islands are
conquered one after another instead of "randomly".

* `routeOrder(skills)`: Kahn's topological sort with a priority — among skills whose prerequisites are
  already on the route, the lowest (grade, semester) first, then the order the skills are authored in
  `content/skills/**` (registry order). Every prerequisite comes before its dependants; the route never
  goes back to an earlier level (content validation keeps prerequisites at or below a skill's level).
  Prerequisites outside the set are ignored; a cycle cannot loop. `routeIndex` = skillId → position.
* `newCandidates(skills, progress, { ceiling })`: gaps with ready prerequisites (route order), then
  never-seen skills with ready prerequisites within the ceiling (route order). `nextIsland` = the first.
  The planner's `new` step takes it; a due review still opens the mission (warm-up) and a check /
  practice still run, as before.
* **Why it was "random" before:** `new` was sorted by *prerequisite depth* first (then level), so a
  shallow grade I geometry skill (depth 1) came before grade 0 addition (depth 2), and grade III numbers
  before grade I subtraction — while the map showed a grade/semester grid in alphabetical order with no
  visible sequence, and placement-known skills were shown as "Cucerită" like real achievements.
* Read model (`learner/readModels.buildSkillMap`, `getSkillMap`): nodes in route order with `route`
  (position), `next` (the planner's next island, same ceiling as the mission) and `known` (mastered by
  the level check and not practised since — placement seeding never stamps `stateChangedAt`). The map
  shows numbered stops on a dotted path, the next island highlighted, known islands as "Știi deja"
  (skipped), with filter chips (Toate / De făcut / În lucru / Gata / Ascunse) and a remembered toggle for
  locked islands.

## Simulation (tests/engine.simulation.test.ts)

Grade II learner who knows only grade 0 (13 gaps after placement): with pLearn 0.2/item and 8 % slips,
all gaps close in ~13–15 daily missions; a slow learner (pLearn 0.04, 15 % slips) closes them in
~35–45. Every mission stays ≤ 10 minutes.

## English as a foreign language, primary (`eng.*.0`–`eng.*.4`)

41 skills for grades 0–IV (programa *Limba modernă 1*, tagged `LM1-CP-IV-2013`, codes to verify), British spelling.
Content: `content/skills/eng/grade0–4.json`, `content/explanations/eng/grade0–4.json` (3 frames each) and the curated
datasets `content/data/eng/primary-{vocab,lists,grammar,reading}.json` (all own work, `ai-draft`, awaiting an English teacher).
Generators (`src/engine/items/generators/engPrimary*.ts`): `eng-primary-vocab` (picture↔word, ro↔en, odd one out,
match, sort, true/false), `eng-primary-number` (1–10/20/100), `eng-primary-calendar` (days, months, seasons),
`eng-primary-time` (o'clock … quarter to, five-minute steps), `eng-primary-grammar` (gap / translate / true-false /
word order over the sentence bank, plus adjective opposites), `eng-primary-greet`, `eng-primary-read` (original 30–70
word texts + 3 questions). Prompts are Romanian with an English version; distractors come only from words already taught.

**Listening (no recorded audio).** An English word or phrase taught inside a prompt or explanation frame is written
between `«…»` (e.g. `ro: "Ascultă și alege imaginea: «cat»."`). `src/ui/speech/englishSpeech.ts` extracts the marked text;
`ItemShell` shows an extra "Ascultă" button for `eng` items of grades 0–II, `FramesPlayer` for the frames of every `eng`
skill, and the reading passage is read with an English voice. `useReadAloud('en')` / `<ReadAloudButton lang="en">` pick an
English voice (en-GB first, then en-US) regardless of the UI language; without an argument nothing changes. The button is
hidden when the device has no English voice.
