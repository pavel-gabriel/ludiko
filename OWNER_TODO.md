# Owner TODO: things only you can do

> Kept up to date by Claude at the end of each work wave. Tick items as you finish them
> (`- [x]`), or tell Claude in chat and it will tick them for you.
> Last updated: 2026-11-28 (security review: section "🔒 Security", details in `docs/SECURITY.md`).

## ⚙️ Automate Firebase (do this once, then the rule deploys below happen by themselves)

The **"Deploy to GitHub Pages"** workflow now also: deploys the Firestore + Realtime Database **rules automatically**
whenever a rules file changes on `main`; sends the **daily reminders** every hour; and runs the **privacy cleanups**
on demand. It only needs one more secret.

- [ ] **Create a deploy service account** (Google Cloud console → project `ludiko-2e197` → IAM & Admin →
      Service accounts → *Create*), name e.g. `ludiko-deployer`, with these roles:
      **Firebase Rules Admin**, **Firebase Realtime Database Admin**, **Cloud Datastore User**, **Service Usage Consumer**.
      (If a deploy later fails with a permission error, give it **Firebase Admin** instead.)
      Then *Keys → Add key → JSON*, copy the whole file into a GitHub secret named
      **`FIREBASE_DEPLOY_SERVICE_ACCOUNT`** (repo → Settings → Secrets and variables → Actions), and delete the local file.
- [ ] **Deploy the pending rules now:** GitHub → Actions → **Deploy to GitHub Pages** → *Run workflow* →
      task **`deploy-rules`**, first with *dry run* ticked (validates), then again with it unticked.
      This replaces the three manual `firebase deploy` items below.
- [ ] **Reminders check:** *Run workflow* → task **`send-reminders`**, dry run → the log says how many subscriptions it
      found (or which secret is missing). After that it runs hourly by itself.
- [ ] **One-time cleanups** (each: dry run first, then real): tasks **`delete-game-history`**, **`cleanup-reports`**,
      **`cleanup-rooms`**.
- From now on: any change to `firestore.rules` / `database.rules.json` merged to `main` is deployed automatically
  (if the secret is missing the job just warns and skips).

## 🔒 Security (from the security review, `docs/SECURITY.md`)

Already fixed in code: rules tightening (push endpoints, teacher profiles, report size, RTDB rooms), the CSP and
referrer meta tags, the `/dev/family` wipe link, push-SW scope, workflow permissions, non-breaking dependency
updates. Rules changes deploy automatically when merged to `main` (job `firebase-rules`). Check that it ran, then
turn reminders on and off once on a real phone (Chrome + Firefox if possible).

**Stop other sites and scripts from using our Firebase (most important):**
- [ ] **Firebase App Check** (console → App Check). Register the web app with **reCAPTCHA Enterprise**
      (and later the Android TWA with **Play Integrity**). Start in *monitor* mode, watch the metrics for a week,
      then **Enforce** for Cloud Firestore and Realtime Database. This also needs a small code change
      (`initializeAppCheck` in `src/services/firebase.ts`) and two CSP additions (`https://www.google.com/recaptcha/`
      and `https://www.gstatic.com/recaptcha/` in `script-src` and `frame-src`); ask Claude when ready. Mention
      reCAPTCHA in the privacy policy (it sends device signals to Google; children's app).
- [ ] **Restrict the browser API key** (Google Cloud console → APIs & Services → Credentials → the "Browser key"
      used in `VITE_FIREBASE_API_KEY`):
      *Application restrictions* → **HTTP referrers**: `https://www.ludiko.ro/*`, `https://ludiko.ro/*`,
      `https://ludiko-2e197.firebaseapp.com/*` (plus `http://localhost:5173/*` only if you develop locally).
      *API restrictions* → only **Identity Toolkit API**, **Token Service API**, **Cloud Firestore API**
      (add others only if something breaks). Then test sign-in, a family sync and a multiplayer room on the live site.
- [ ] **Auth → Settings → Authorized domains:** keep only `www.ludiko.ro`, `ludiko.ro`, `ludiko-2e197.firebaseapp.com`
      (and `localhost` if you develop locally); remove old ones (e.g. `*.github.io`).
- [ ] **Auth → Settings:** turn on **Email enumeration protection**; set a **password policy** (min. 8 chars);
      lower the **sign-up quota** per IP (anonymous sign-ups) to what a school class needs (e.g. 100/hour).
- [ ] **Budget alerts** (Google Cloud → Billing → Budgets & alerts) at e.g. 5 € and 20 € / month, so abuse is noticed.

**GitHub:**
- [ ] **Branch protection on `main`** (Settings → Branches): require a pull request and the **Tests** checks
      (`test`, `rules`). Reason: `main` auto-deploys the site **and the security rules**.
- [ ] **2FA** on GitHub, Google (Firebase/Cloud), the domain registrar (plus registrar lock), Play Console and Apple Developer.
- [ ] **Least-privilege service accounts:** `FIREBASE_SERVICE_ACCOUNT` (reminders) = **Cloud Datastore User** only;
      give the maintenance job its own account instead of the deploy one; rotate JSON keys yearly
      (or switch to keyless *Workload Identity Federation*, ask Claude).
- [ ] Optional: enable **Dependabot** (security updates + `github-actions` version updates) and Secret scanning
      push protection (Settings → Code security).

**Product decisions (tell Claude which you want):**
- [ ] **Stronger classroom codes (S-04):** v1 student codes `LION-42` have only 2,700 values per session and a child in the
      room can find classmates' codes. Options: 4-digit codes (`LION-4271`), or 6-char codes like the class join
      codes, and bind each student result to the device that first used the code.
- [ ] Hide the remaining read-only `/dev/*` preview pages in production too (optional).
- [ ] Planned major upgrades (they clear the remaining audit findings): `firebase` 12, `i18next` 26, `vitest` 4+.

**Protect the app and brand against cloning (see "Can someone steal our app?" in `docs/SECURITY.md`):**
- [ ] The repo is **public**. To make it private and keep GitHub Pages you need a **paid GitHub plan** (Pro/Team).
      Free alternative: private source repo + public repo with only the built site, or Firebase Hosting / Cloudflare
      Pages (these also allow real security headers such as anti-clickjacking).
- [ ] `LICENSE`: write the **real legal owner** (your name or company) instead of just "Ludiko"; ask a lawyer to check.
- [ ] **Register the trademark "Ludiko"** (word and logo) at **OSIM** (classes 9, 41, maybe 42) or EUIPO (EU-wide).
- [ ] Publish the store apps only from **your own** developer accounts; keep the Android upload key and Play App
      Signing key safe; fill in `assetlinks.json` with the real fingerprint.
- [ ] Ask Claude to add a few **canary items** (unique invented details) to the content, and keep their list private.
      They prove copying.

## 📱 App stores (Play Store + App Store): everything preparable is in `store/`

Repo side is ready (PWA manifest with screenshots and maskable/monochrome icons, offline page, Android TWA kit,
iOS Capacitor guide, store listing texts in RO/EN, parental gate on all external links). What only you can do:

- [ ] **Decide the domain.** TWA verification needs `/.well-known/assetlinks.json` at the host root, so a
      `.../ludiko/` sub-path can never work. The repo already serves `www.ludiko.ro` (`public/CNAME`, `base = '/'`).
      Keep that (register/renew the domain, DNS to GitHub Pages, HTTPS enforced), or use a user-site repo
      `pavel-gabriel.github.io`. Options in `store/android/README.md` §1.
- [ ] **Allow the hidden `.well-known` folder in the Pages deploy**: `upload-pages-artifact@v3` drops dot-folders.
      Replace that step with the manual tarball in `store/android/README.md` §1 (not done in the repo on purpose: it
      changes the live deploy). Then check `https://www.ludiko.ro/.well-known/assetlinks.json` opens.
- [ ] **Confirm the ids**: Android package id `ro.ludiko.app` (permanent!) in `store/android/twa-manifest.json`
      and `public/.well-known/assetlinks.json`; same bundle id in `store/ios/capacitor.config.json`; support e-mail
      (`RIGHTS_CONTACT` in `src/utils/constants.ts`) for the store listings.
- [ ] **Google Play developer account**: US$25 one-time. New personal accounts must run a closed test with 12+
      testers for 14 days before production.
- [ ] **Apple Developer Program**: US$99 / year, plus a Mac with Xcode for the iOS build (`store/ios/README.md`).
- [ ] **Android signing key** as GitHub secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
      `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (how: `store/android/README.md` §2), then run the workflow task
      **`build-android`**. After the first Play upload copy the *App signing key* SHA-256 from Play Console into
      `public/.well-known/assetlinks.json` (it is a zeros placeholder now) and deploy.
- [ ] **Kids Category / Families**: in App Store Connect choose the Kids Category and an age band (6-8 or 9-11);
      in Play Console pick "Children" in the target audience and complete the Data safety and IARC forms with the
      answers in `store/listing/ro.md` / `en.md`. Re-check them after any change that adds data collection.
- [ ] **Native value for App Store guideline 4.2**: a Capacitor build that is only the website can be rejected.
      Plan the local-notification reminder described in `store/ios/README.md` (small code change, needs a Mac to test).
- [ ] Optional: take better store screenshots with a seeded test profile (`scripts/generate-screenshots.mjs`) and
      at Apple's sizes; the current ones come from public preview routes.

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
- [ ] **Phase 2 (grades V–VIII) content to review** (all *beta*, competence codes are guesses — check against the programa):
  - Math V–VIII (`content/skills/mat/grade5-8`, generators `fractionsOps`, `algebra`, …): wording, grade placement.
  - Romanian V–VIII: figures of speech (antithesis, inversion, metaphor), sentence-part/clause labels
    (e.g. "Pare că…" as subjective clause), parts of speech edge cases ("toți", "fiecare", "întâi"),
    paronyms/homonyms; reading texts are short (40–98 words) for VII–VIII.
  - History V–VIII: approximate/traditional dates (flagged `approx` in `content/data/ist/events-gimnaziu.json`),
    wording of WW2 / Holocaust / 1989 items.
  - Geography V–VIII: Romania extreme points/area/coastline, rounded river lengths and peak heights, county ↔
    historical region, EU list (27, 2026), Romanian spellings of world capitals.
  - Biology/Physics/Chemistry: facts, grade placement of topics, school constants (g = 10 N/kg, c(apă) = 4200).
- [ ] **Deploy rules** (task `deploy-rules`): Firestore rules now accept the subjects bio/fiz/chim — until deployed,
      progress for those subjects is not synced to parent/class accounts.
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
