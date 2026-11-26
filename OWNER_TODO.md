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
    - [ ] **F4** Google Fonts (Nunito) loaded from Google: self-host it and add it to `content/credits.json`.
    - [ ] **F5** Free-text nicknames and teacher seat labels: add the "use a nickname" hint everywhere; decide how to treat
          schools (teacher terms or data-processing agreement).
    - [ ] F6 report-comment hint and retention, F7 push-subscription expiry, F8 one "delete everything" action, F9 teacher
          account deletion.
- [ ] Optionally use a **dedicated contact email** instead of your personal one (shown on the Credits page
      and in `LICENSE`).

## ⚪ Nice to have

- [ ] An illustrator for the mascot and island map art (Claude can only draw simple SVGs).
- [ ] Recorded Romanian narration for grade 0–I items (better than device read-aloud).
