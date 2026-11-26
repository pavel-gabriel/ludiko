# National-exam practice (EN II and EN IV)

Phase 1D feature: **/learn/exam**. A child in grades II–IV can take a full-length practice paper in the
shape of the *Evaluare Națională* at the end of grade II or grade IV, built from skills Ludiko already
has. It is **a training simulation, not an official grade**.

Content rule (mandatory, see [`LEGAL_CONTENT_POLICY.md`](./LEGAL_CONTENT_POLICY.md) §4): real papers are
**format reference only**. Only structural facts are used here (how many papers, how long, which kinds of
task). No item, text, number, image or sequence of questions is copied or paraphrased from any paper.

## 1. The format we imitate, with sources

> Verification note: the official pages (edu.ro and the methodology PDF) could not be opened from the
> build session (network allow-list), so the facts below come from press coverage of the official
> calendars and papers, read through search-result summaries. Everything marked *to verify* should be
> checked against the current ministerial methodology (*Metodologia de organizare și desfășurare a
> evaluărilor naționale la finalul claselor a II-a, a IV-a și a VI-a*) before it is quoted to parents.

| Fact | EN II (end of grade II) | EN IV (end of grade IV) |
|---|---|---|
| Papers | 2: *Comunicare în limba română* and *Matematică și explorarea mediului* | 2: *Limba română* (reading text based) and *Matematică și științe ale naturii* (one integrated paper) |
| Working time | 45 minutes per paper (raised from 30 minutes in 2025) | 60 minutes per paper |
| Size | Maths paper of about 18 requirements (2026) | Maths and sciences paper of about 20 requirements (2025, 2026) |
| Kinds of task | One-answer-to-circle items plus short calculations and tasks over tables or pictures; Romanian paper has reading and writing tasks | Same mix; the Romanian paper is built round a reading text |
| Results | Held in the pupil's educational portfolio (calificative per the methodology, *to verify*) | Scores are indicative and stay in the portfolio; at a parent's written request they can be converted to calificative |

Sources (structure only):

- EN II, 45 minutes since 2025: <https://www.edupedu.ro/elevii-de-clasa-a-ii-a-vor-avea-la-dispozitie-45-de-minute-pentru-a-rezolva-subiectele-la-testele-de-la-evaluarea-nationala-2025-cu-15-minute-mai-mult-fata-de-timpul-alocat-in-anii-trecuti-structur/>
- EN II 2026 (papers, 45 minutes, about 18 maths requirements): <https://www.edupedu.ro/evaluare-nationala-2026-elevii-de-clasa-a-ii-a-dau-marti-12-mai-proba-la-limba-si-comunicare-testele-dureaza-45-de-minute-si-intra-in-portofoliul-educational-al-elevului/> and <https://www.digi24.ro/stiri/actualitate/educatie/evaluarea-nationala-2026-clasa-a-ii-a-elevii-sustin-astazi-proba-la-matematica-si-explorarea-mediului-cum-sunt-structurate-cerintele-3768291>
- EN IV 2026 (two papers, 60 minutes each): <https://www.edupedu.ro/evaluarea-nationala-2026-elevii-de-clasa-a-iv-a-dau-marti-18-mai-proba-la-limba-si-comunicare-fiecare-test-dureaza-60-de-minute-iar-rezultatele-vor-fi-incluse-in-portofoliul-educational-al-elevu/>
- EN IV maths and sciences (integrated paper, about 20 requirements; indicative scores, calificative on request): <https://www.edupedu.ro/astazi-evaluarea-nationala-la-clasa-a-iv-a-continua-cu-proba-la-matematica-si-stiinte-ale-naturii-la-solicitarea-scrisa-a-elevului-sau-a-parintelui-punctajele-obtinute-se-pot-echivala-in-calificati/> and <https://www.edupedu.ro/subiectele-la-matematica-si-stiinte-ale-naturii-evaluare-nationala-clasa-a-iv-a-2025-cele-20-de-cerinte-pe-care-le-au-avut-de-rezolvat-elevii/>
- Official calendars and methodology (to read when network allows): <https://edu.ro/EN_II_IV_VI> and <https://isj.vs.edu.ro/download/Metodologie-EN-2-4-6-2025-2026.pdf>

Not reproduced by Ludiko: writing and reading-aloud tasks (no free-text or voice input yet), and anything
that needs content Ludiko does not have. The Romanian papers therefore cover the receptive part
(vocabulary, sentences, reading comprehension).

## 2. How Ludiko builds a paper

Code: `src/exam/` (pure TypeScript, no React).

- **Blueprints** (`blueprints.ts`) are data: per paper a time limit, the allowed item types, and
  *sections* made of *parts*. A part names the skills it draws from (existing ids such as
  `mat.add.carry.100`), a count, a target difficulty and the programa competence code. Two papers per exam:
  1 = Romanian, 2 = Maths (+ explorarea mediului / științe).
- **Assembly** (`assemble.ts`): `assembleTest(blueprint, { seed })`. For every part it asks the skills' own
  generators and static banks for items (`generateItems`, or the bank directly for bank-only skills), keeps
  only paper-style types (no audio prompts, no map tapping), and **rejects duplicates** by content (the same
  question with shuffled options counts as the same). Each section is then sorted **easy → hard** (stable).
- **Reproducible**: same blueprint + seed + content = same paper. The UI draws a fresh seed per attempt.
- **Optional science sections**: `EN II` *Explorarea mediului* (subject `stiinte`, grades 1–2) and `EN IV`
  *Științe ale naturii* (subject `stiinte`, grades 3–4) are resolved against the registry at run time.
  If no science skill with items exists they are **skipped silently** (`skippedSections`), and the parent
  panel says so. When the science content lands they appear without any code change.

### Shipped blueprints (counts are Ludiko's own design, not those of a real paper)

| Paper | Time | Sections (questions) |
|---|---|---|
| EN II · Test 1 Comunicare în limba română | 45 min | Propoziții și cuvinte (10: sentence order, punctuation, antonyms, synonyms), Citim texte (4: literal, sequence, main idea, inference) |
| EN II · Test 2 Matematică și explorarea mediului | 45 min | Numere (3), Adunări și scăderi (6), Probleme (3), Ceas, bani, măsuri și figuri (6), Explorarea mediului (+4, optional) |
| EN IV · Test 1 Limba română | 60 min | Cuvinte (4), Citim texte (6: warm-up, text types, characters, vocabulary in context, main idea, inference) |
| EN IV · Test 2 Matematică și științe ale naturii | 60 min | Numere mari (3), Calcule (8), Probleme (3), Măsuri și figuri (2), Științe ale naturii (+4, optional) |

A reading text with its questions counts as one item (correct only if all its questions are right).

## 3. Running a paper (what the child sees)

`/learn/exam` (picker, with a note for parents) → `/learn/exam/:exam/:test` (start, paper, results).

- Section intro screens; one question at a time; **no verdict, no right answer, no explanation** during the
  paper (`ItemFeedbackContext = 'neutral'`: the item reports at once and the paper moves on).
- A calm clock (white pill, no red, no alarm) that can be hidden at the start or any time. When time is up a
  gentle dialog offers *Mai lucrez puțin* or *Vreau să văd rezultatele*: **nobody is cut off**, and going over
  time does not change the result.
- *Pauză* stops the clock and hides the question. Leaving asks first and saves nothing.
- Entry cards: learner home and parent view, only for profiles in grade II (→ EN II) and III–IV (→ EN IV).

Results: the **child** sees a celebration only (stars, sticker, a warm line, "Exersăm împreună"). Never a
calificativ, a score or a count of mistakes ([`PLAN.md`](./PLAN.md) §6). Everything else is behind
**"Pentru părinți"** on the same screen.

## 4. Scoring: Ludiko's own practice estimate

**This is not official grading.** The thresholds are Ludiko's, chosen to be easy to explain; the official
methodology defines its own scale and Ludiko does not claim to reproduce it.

| Share of items correct | Calificativ shown to parents |
|---|---|
| 90% or more | Foarte bine |
| 70% to under 90% | Bine |
| 50% to under 70% | Suficient |
| under 50% | Insuficient |

Rules: every item is correct or not; an unanswered item counts as not correct (and is listed for practice);
the thresholds are constants in `src/exam/scoring.ts` and printed in the parent panel. The same thresholds
are applied per section. Child stars: 3 from 90%, 2 from 60%, otherwise 1 (never 0 once the child answered).

Parent panel contents: disclaimer, estimated calificativ with a plain sentence, "x din y" and percent,
per-section bars, **"Ce exersăm"** (skills with wrong or unanswered items, most first, each linking to
`/practice/:skillId`), the thresholds, and a note when a science section was left out.

## 5. Feeding mastery

During the paper every answer goes to `learnerService.recordItemResult(..., { mode: 'check' })`, which only
keeps the play-day streak (mastery of a check is applied as a whole). When the paper ends, the new
`learnerService.recordExamResults(profileId, entries)` applies every *answered* item to mastery in one
write, exactly as one practice answer each. Gaps found this way show up on the skill map and in the
planner. Stars (and possibly a sticker) are awarded like any finished session.

## 6. Tests

`tests/examAssemble.test.ts`: blueprints reference existing skills; counts per section; easy → hard;
reproducible by seed; no duplicate items over 20 seeds per blueprint; graceful skip of missing science;
scoring boundaries, sections, practice list; `recordExamResults`. `tests/examUi.test.tsx`: picker, entry
cards by grade, start → answer → results with no verdicts, pause, hidden clock, time-up, leaving.
