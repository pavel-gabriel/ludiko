# Owner TODO: things only you can do

> Kept up to date by Claude at the end of each work wave. Tick items as you finish them
> (`- [x]`), or tell Claude in chat and it will tick them for you.
> Last updated: 2026-11-26.

## 🔴 Needed for features that are already live

- [ ] **Deploy Firestore rules.** The GitHub Pages deploy does **not** update them. Until this is done,
      the admin dashboard, content reports, classes and push reminders don't work in production.
      ```bash
      npm install -g firebase-tools
      firebase login
      firebase deploy --only firestore:rules --project ludiko-2e197
      ```
      Repeat this every time `firestore.rules` changes. Claude will flag it in the chat.
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
- [ ] **Privacy policy & terms** page for parents (GDPR-K): what is stored locally vs. in the cloud
      (classes summary, push subscription, parent account), and how to delete it. Claude can draft
      it; it needs your review and, ideally, a lawyer's.
- [ ] Optionally use a **dedicated contact email** instead of your personal one (shown on the Credits page
      and in `LICENSE`).

## ⚪ Nice to have

- [ ] An illustrator for the mascot and island map art (Claude can only draw simple SVGs).
- [ ] Recorded Romanian narration for grade 0–I items (better than device read-aloud).
