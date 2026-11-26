# Owner TODO: things only you can do

> Kept up to date by Claude at the end of each work wave. Tick items as you finish them
> (`- [x]`), or tell Claude in chat and it will tick them for you.
> Last updated: 2026-11-26 (privacy policy draft added).

## 🔴 Needed for features that are already live

- [ ] **Deploy Firestore rules.** The GitHub Pages deploy does **not** update them. Until this is done,
      the admin dashboard, content reports, classes and push reminders don't work in production.
      ```bash
      npm install -g firebase-tools
      firebase login
      firebase deploy --only firestore:rules --project ludiko-2e197
      ```
      Repeat this every time `firestore.rules` changes. Claude will flag it in the chat.
      - [ ] **Parent accounts** (`docs/PARENT_SYNC.md`) added a `families/{uid}/**` section to the rules:
            redeploy them again, or creating an account and syncing children will fail with "permission denied".
      - [ ] Parent accounts also need Firebase console → Authentication → **Email/Password** enabled (the same
            switch as for the admin account below). Until then "Cont de părinte" cannot create or sign in.
- [ ] **Redeploy Firestore rules for the content-report snapshot.** New reports carry a `snapshot` (the question as the
      child saw it) so the admin queue shows the exact exercise. Until the rules are deployed, new reports are rejected
      and stay in the child's offline queue:
      ```bash
      firebase deploy --only firestore:rules --project ludiko-2e197
      ```
- [ ] **Redeploy BOTH rule sets for the privacy fixes F2 + F3** (`docs/PRIVACY_DATA_MAP.md`). Until you do, the new app
      cannot create or join multiplayer rooms (the old rules allowed it, the new client uses `roomCodes/*` and
      `rooms/*/players/{uid}`) and teacher sessions / student codes keep the old, open rules:
      ```bash
      firebase deploy --only firestore:rules,database --project ludiko-2e197
      ```
      - [ ] Optional, once after deploying: in the Realtime Database console delete the old `rooms` node (old-format rooms no longer work).
      - [ ] Optional: test the rules in the Firebase Emulator Suite / Rules Playground (the repo tests only check their text).
      - [ ] Optional: delete forgotten rooms now and then (the app already deletes its own and refuses rooms older than 6 hours):
            `FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" FIREBASE_DATABASE_URL=https://<your-db>.firebasedatabase.app node scripts/privacy/cleanup-rooms.mjs --dry-run`
            (drop `--dry-run` to delete rooms older than 24 h; `--max-age-hours=N` to change the age). Needs a service-account key; never commit it.
- [ ] **Admin account** (`docs/ADMIN.md`):
  - [ ] Firebase console → Authentication → enable **Email/Password**.
  - [ ] Add your admin user and copy its **UID**.
  - [ ] Firestore → create document `admins/<UID>` (any field, e.g. `role: "owner"`).
  - [ ] Sign in at `/admin` and check that the report queue loads.
- [ ] **Push reminders** (`docs/NOTIFICATIONS.md` §6):
  - [ ] Run `npx web-push generate-vapid-keys` on your computer.
  - [ ] Add these GitHub secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
        `VAPID_SUBJECT` (`mailto:` + your email) and `FIREBASE_SERVICE_ACCOUNT` (JSON key of a
        service account with **only** the "Cloud Datastore User" role).
  - [ ] Redeploy (push any commit or re-run "Deploy to GitHub Pages") so the parent reminders card appears.
  - [ ] Actions → "Daily reminders" → *Run workflow* with **dry run**, then a real run.
- [ ] **Remove the old `VITE_ADMIN_PIN` secret/env.** It is no longer used.

## 🟠 Test on real devices (can't be tested in Claude's environment)

- [ ] Install the app on an Android phone (Chrome → "Add to Home screen"), then test it **offline**.
- [ ] iPhone: Safari → Share → "Add to Home Screen", then try reminders (iOS 16.4+ only, installed app only).
- [ ] Check "Citește-mi" read-aloud on your phones: does a Romanian voice exist?
- [ ] Play a **multiplayer race on two phones** with a skill chosen in "Ce exersăm?".
- [ ] Teacher flow: create a class → add seats → print codes → join from a child profile on another
      device → check the heatmap fills in → give homework ("Dă temă") → the child sees "Tema de la clasă".
- [ ] Full child loop on a phone: profile → "Verifică-te!" → parent statement → daily bits.

## 🟡 Content review (all content is AI-drafted and marked *beta*)

- [ ] **Competence codes:** check the `competences` codes in `content/skills/**` against the official
      programa (MEM-2013, MAT-III-IV-2014, CLR-2013, LLR-III-IV-2014). All are marked "codes to verify".
- [ ] **Phase 1D facts to review** (all *beta*):
  - [ ] **Istorie IV:** check every date in `content/data/ist/history.json`. Especially: Burebista c. 82–44 î.Hr.,
        Bogdan I c. 1359, the 1862 wording ("România" became official only with the 1866 Constitution),
        Vlad Țepeș 1456–1462 only, and the legends (Negru Vodă, Dragoș and the aurochs, Bucur).
  - [ ] **Geografie IV:** map relief zones (`public/content/media/geo/romania.svg`, simplified), Retezat
        as the first national park in 1935, Crivățul description, recycling bin colours, the ~245 km
        coastline, the ~19 million population.
  - [ ] **Științe III–IV:** digestion order and wording, magnet and float/sink lists, shadow length,
        animal groups/habitats in `src/engine/items/generators/stiinteData.ts`.
  - [ ] **Educație civică:** read the Bucovina village story and the bullying story ("Fricosule!") for tone.
  - [ ] **EN II/IV practice:** check the format (`docs/EXAM_PRACTICE.md`, built from press coverage
        because edu.ro wasn't reachable) and the calificativ thresholds (Ludiko's own estimate, labelled
        as practice).
- [ ] **Romanian reading texts:** read the 40 texts in `content/items/rom/texts-grade*.json`. They should be
      original, natural and right for each grade.
- [ ] **Syllable list** `content/data/rom/words.json`: spot-check the splits (pinguin is already fixed).
- [ ] **Explanations:** spot-check a few per grade in `content/explanations/**`. Try them at `/practice` by
      answering wrong on purpose.
- [ ] **Number words:** decide whether 21 000 should be "douăzeci și una de mii" (DOOM3, current) or
      "douăzeci și unu de mii".
- [ ] Find a teacher or pedagogy students to review content. Each reviewed item can then move from `beta` to `reviewed`.

## 🟢 Legal & business

- [ ] **Copyright owner:** "Ludiko" is not a legal entity yet, so legally you, the author, hold the
      copyright. If you register a company or the trademark, update the owner name in `LICENSE`.
- [ ] Consider registering the **"Ludiko" trademark** (OSIM in Romania, EUIPO for the EU).
- [ ] Before any **paid plan**: have a Romanian IP lawyer review `docs/LEGAL_CONTENT_POLICY.md`, and
      verify Law 8/1996 art. 9 / art. 33 in the official text.
- [ ] **Privacy policy & terms** (GDPR-K): a **draft is live at `/privacy` and `/terms`** (ro + en, with a
      "Ciornă — în curs de verificare juridică" banner), linked from Settings, Credits, the parent view, the
      reminders card, the class join and the parent-account consent. Sources: `src/legal/{privacy,terms}.ts`;
      the audit behind it is `docs/PRIVACY_DATA_MAP.md`.
  - [ ] **Lawyer review** of both texts (look for the `[TODO ...]` markers), then remove the draft banner
        (`legal.draftBanner`) and the "ciornă / draft" sentences in `src/legal/*.ts`.
  - [ ] Fill the `[TODO owner]` gaps: your full name and address as operator (Ludiko is not a legal entity yet),
        and the **Firestore / Realtime Database region** (Firebase console; prefer EU; see F10).
  - [ ] Bump `CONSENT_VERSION` in `src/family/types.ts` once the text is final (F11).
  - [ ] **Decide on these FINDINGS** (details and suggested fixes in `docs/PRIVACY_DATA_MAP.md` §4). They conflict
        with the "no child personal data" promise and the policy currently has to admit them:
    - [ ] **F1 (high)** Multiplayer names typed by kids go to Firestore `gameHistory` forever and show in the public
          leaderboard. Suggested: remove the cloud leaderboard, or store avatar + score only with a TTL, then delete the old documents.
    - [x] F1 is fixed in code (cloud leaderboard removed). Owner steps still open:
      - [ ] Redeploy Firestore rules (`firebase deploy --only firestore:rules`): `gameHistory` is now denied.
      - [ ] Run `scripts/privacy/delete-game-history.mjs` once (`FIREBASE_SERVICE_ACCOUNT='<json>' node scripts/privacy/delete-game-history.mjs --dry-run`, then without `--dry-run`).
    - [ ] **F2 (high)** Realtime Database `rooms` are readable and writable by any anonymous session (names visible).
          Suggested: exact-key code index + per-room rules, random names, room expiry.
    - [ ] **F3** v1 teacher sessions: `sessionResults` (student names) readable and writable by any signed-in device.
    - [x] **F4** Google Fonts (Nunito) replaced by a self-hosted copy (`@fontsource/nunito`, OFL-1.1, in `content/credits.json`).
          Done in code; takes effect with the next GitHub Pages deploy. Nothing to run.
    - [x] **F5** Nickname and teacher-label hints added (profile form, seat labels). Still open: decide how to treat
          schools (teacher terms or data-processing agreement).
    - [x] **F6** Report-comment hint added and retention script written. Run it once, then yearly:
          ```bash
          # the same service-account JSON as the FIREBASE_SERVICE_ACCOUNT GitHub secret; never commit it
          FIREBASE_SERVICE_ACCOUNT="$(cat ~/keys/ludiko-sa.json)" node scripts/privacy/cleanup-reports.mjs --dry-run
          FIREBASE_SERVICE_ACCOUNT="$(cat ~/keys/ludiko-sa.json)" node scripts/privacy/cleanup-reports.mjs
          ```
          It deletes resolved/dismissed reports older than 12 months and any report older than 24 months.
    - [x] **F7** Push subscriptions not updated for 12 months are deleted by the daily sender. Nothing to run: check the
          next "Daily reminders" run log for `expired=`.
    - [ ] F8 one "delete everything" action (not done).
    - [x] **F9** In-app "Șterge contul de profesor" on the teacher dashboard (password or Google re-confirmation). Deletes
          classes, sessions, results, templates and the profile, then the Auth user. No Firestore rules were changed.
          Test it once with a throwaway teacher account on a phone.
    - [ ] **Privacy text** (`src/legal/privacy.ts`): still says Nunito is loaded from Google Fonts and that it will be hosted
          locally, and does not mention the teacher deletion or report retention yet. Update with the lawyer review.
- [ ] Optionally use a **dedicated contact email** instead of your personal one (shown on the Credits page
      and in `LICENSE`).

## ⚪ Nice to have

- [ ] An illustrator for the mascot and island map art (Claude can only draw simple SVGs).
- [ ] Recorded Romanian narration for grade 0–I items (better than device read-aloud).
