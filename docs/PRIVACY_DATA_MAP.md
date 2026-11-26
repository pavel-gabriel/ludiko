# Ludiko: privacy data map (audit)

> **DRAFT for the owner and a lawyer.** Written from the code as of 2026-11-26 (branch
> `claude/exciting-newton-xycsus`). It is the factual base of the privacy policy in `src/legal/privacy.ts`.
> "Legal basis" is a **guess** for the lawyer to confirm, not legal advice.
> Rules for the product: `docs/PLAN.md` §11. Contact/operator: see `LICENSE` and `RIGHTS_CONTACT`
> in `src/utils/constants.ts`.
>
> `tests/legalPages.test.ts` checks that every Firestore collection that appears in `firestore.rules`
> is mentioned here **and** in the policy text. When you add a collection, update both.

## 0. Summary

| Where | What | Who can read it |
|---|---|---|
| **Device only** (IndexedDB + localStorage) | child profiles and learning progress, settings, caches | whoever uses the device |
| **Firestore** (Google Firebase, project `ludiko-2e197`) | `families`, `classes`, `joinCodes`, `pushSubscriptions`, `contentReports`, `teachers`, `sessions`, `sessionResults`, `templates`, `gameHistory`, `admins` | see §2 (rules differ a lot) |
| **Realtime Database** (Google Firebase) | multiplayer rooms (`rooms/*`): names, avatars, scores | **any** app session (anonymous auth) |
| **Firebase Auth** | anonymous uid per device; email for parents, teachers, admin | Google; the owner via the Firebase console |
| **Third parties in transit** | Google Fonts, GitHub Pages, web-push services | see §3 |

What is **not** collected anywhere: advertising IDs, analytics, error-tracking, location, photos, microphone,
camera, real names (not asked), birth dates, item-by-item answers. No Google Analytics, no Firebase
Analytics/Messaging SDK, no Sentry (checked with `grep` over `src/`, `index.html`, `package.json`).

**Region:** nothing in the repo says where the Firestore / RTDB databases live (config comes from
GitHub secrets `VITE_FIREBASE_*`). The owner must check the Firebase console (see FINDING F10).

## 1. On the device (never sent anywhere by itself)

| # | Data item | Where stored | Who can read | Retention / deletion | Legal basis (guess) | Source |
|---|---|---|---|---|---|---|
| D1 | Child profile: `id`, `nickname` (free text, max 20), `avatar`, `grade`, `language`, `recoveryCode`, timestamps, optional `classLink` (classId, join code, class name) | IndexedDB `ludiko-profiles` / store `profiles` | people using the device | until the profile is deleted in `/profiles` ("Gestionează") or site data is cleared | not personal-data processing by Ludiko (data stays with the user); GDPR household exemption | `src/profiles/db.ts`, `profileService.ts`, `types.ts` |
| D2 | Learning progress: skill states, mastery numbers, attempts/correct counts, stars, stickers, play days, placement results, level history, last 14 missions | IndexedDB `ludiko-profiles` / store `progress` | same | same | same | `src/profiles/types.ts` |
| D3 | Active profile id | localStorage `ludiko-active-profile` | same | removed on deleting that profile | same | `profileService.ts` |
| D4 | Settings: language, dyslexic font, sound | localStorage `ludiko-settings` (zustand persist) | same | until cleared | strictly necessary / functional | `src/store/settingsStore.ts` |
| D5 | Language choice | localStorage `i18nextLng` (i18next detector cache) | same | until cleared | functional | `src/i18n/config.ts` |
| D6 | "Offline ready" toast shown flag | localStorage `ludiko-offline-ready-shown` | same | until cleared | functional | `src/components/ui/PwaToast.tsx` |
| D7 | "New sticker" memory | localStorage `ludiko.album.seen.<profileId>` | same | until cleared | functional | `src/ui/album/albumService.ts` |
| D8 | Parent-account session note: `uid`, **email**, lastSync, synced child ids, tombstones (deleted children: id + nickname/avatar/grade) | localStorage `ludiko.family.v1` | same | removed on sign out / account deletion | contract / consent | `src/family/familyState.ts` |
| D9 | Random per-install device id | localStorage `ludiko.family.device` | same | until cleared | legitimate interest (conflict debugging) | `familyState.ts` |
| D10 | Push reminder settings: `id` (SHA-256 of the endpoint), hour, language, active | localStorage `ludiko.push.v1` | same | removed when reminders are turned off | consent | `src/services/pushAvailability.ts` |
| D11 | Class assignment cache + last sync time | localStorage `ludiko.classAssignments.v1:<classId>`, `ludiko.classSync.v1:<profileId>` | same | removed on leaving the class | functional | `src/classroom/assignmentCache.ts` |
| D12 | Offline queue of "report a mistake" messages (max 50) | localStorage `ludiko.contentReportQueue.v1` | same | removed after sending | consent (user presses send) | `src/services/reportService.ts` |
| D13 | Firebase Auth session (anonymous or email) | IndexedDB `firebaseLocalStorageDb` (written by the Firebase SDK) | same | until sign out / site data cleared | necessary for the service | `src/services/firebase.ts`, `authService.ts` |
| D14 | PWA caches: app shell, content bundles (`ludiko-content`, 90 days), sounds, Google Fonts CSS/files | Cache Storage (Workbox) | same | `cleanupOutdatedCaches`; font files up to 1 year | functional | `vite.config.ts` |
| D15 | Profile backup file (JSON) the parent downloads | the parent's files | the parent | the parent's decision | n/a | `src/components/profiles/ProfileSettings.tsx` |
| D16 | Read-aloud ("Citește-mi") | none stored. Uses the browser's `speechSynthesis`; some browsers use online voices run by the browser vendor (lesson text only) | browser vendor | n/a | n/a | `src/ui/speech/useReadAloud.ts` |

No cookies are set by Ludiko. Firebase Auth uses IndexedDB, not cookies.

## 2. In the cloud (Google Firebase)

Auth model: "anonymous" = `signInAnonymously` (one random uid per browser, no email), "password" = parent
or teacher with email.

### 2a. Firestore collections (names exactly as in `firestore.rules`)

| # | Collection / path | Data item | Who can read (per rules) | Retention / deletion | Legal basis (guess) | Source |
|---|---|---|---|---|---|---|
| C1 | `families/{uid}` | parent consent record: `consentAt`, `consentVersion`, created/updated | the parent (password sign-in only) | until the parent deletes the cloud account (Settings of `/learn/account`; also deletes the Auth user) | consent (art. 6(1)(a)); parental consent for under-16s (art. 8, RO Law 190/2018) | `firestore.rules`, `src/family/familyService.ts`, `docs/PARENT_SYNC.md` |
| C2 | `families/{uid}/children/{profileId}` | child **nickname** (free text), avatar, grade, language, **learning progress** (skills, stars, stickers, play days, placements, missions), `deviceId`, `deleted` flag | the parent only | until a child is deleted (tombstone is then kept with the profile fields) or the account is deleted; export as JSON available in the app | consent | same |
| C3 | Firebase Auth (not Firestore) | parent **email** + password hash, uid, created/last-login time; Google may log IP/UA | Google; owner (console) | deleted with the account (`deleteUser`) | contract / consent | `familyService.ts` |
| C4 | `pushSubscriptions/{sha256(endpoint)}` | push `endpoint` (identifies the device at Google/Apple/Mozilla push service), `keys.p256dh`, `keys.auth`, `hour`, `timezone`, `lang`, `active`, `lastPlayedDay`, `lastSentDay`, timestamps. No profile id/nickname/grade/progress | nobody via the client (read denied). The reminder sender (GitHub Action, Admin SDK) reads it | deleted when reminders are turned off, or by the sender on HTTP 404/410. **No expiry otherwise** (F7) | consent (opt-in in the parent view) | `firestore.rules`, `src/services/pushService.ts`, `scripts/send-daily-reminders.mjs`, `docs/NOTIFICATIONS.md` |
| C5 | `classes/{classId}` | class `name`, `grade`, `teacherUid` | the teacher | until the teacher deletes the class (cascade in `deleteClass`) | teacher: contract; legitimate interest | `src/classroom/classroomService.ts`, `docs/CLASSROOM.md` |
| C6 | `classes/{classId}/seats/{code}` | seat `label` chosen by the teacher (initials / number; **may be a real name if the teacher types one**, see F5), join code, `linked`, `linkedAt` | the teacher | until unlink / class deletion | teacher is probably the controller of pupil data (F5) | same |
| C7 | `classes/{classId}/progress/{code}` | the child's **skill-state summary**: per subject placement level, missing count, state per skill, `playDaysThisWeek`, `updatedAt`. No nickname/avatar/recovery code/answers | the teacher | replaced on each sync; deleted when the child leaves (best effort) or teacher unlinks / deletes class | consent via parent/teacher; the device owner joins on purpose | same, `src/classroom/progressSummary.ts` |
| C8 | `classes/{classId}/assignments/{id}` | subject, skill ids, title, due day (no personal data) | any signed-in device that knows the class id | until the teacher deletes it | n/a | same |
| C9 | `joinCodes/{code}` | `classId`, `className` (get by exact code only) | any signed-in device that knows the code | until unlink / class deletion | n/a | same |
| C10 | `contentReports/{id}` | `itemId`, `skillId`, `reason`, free-text `comment` (max 300), `createdAt`, `status`, `appVersion`. No uid stored | admin only | **no deletion policy** (F6) | consent (the user sends it); legitimate interest (content quality) | `src/services/reportService.ts` |
| C11 | `teachers/{uid}` | teacher **email**, `displayName` (from the form or the Google account), `createdAt` | the teacher; admin can list | until manual deletion by the owner. No in-app teacher-account deletion (F9) | contract (teacher account) | `src/services/teacherService.ts`, `TeacherLogin.tsx` |
| C12 | `sessions/{id}` | v1 classroom session: `teacherUid`, `title`, game settings, `studentCodes[{code,label}]` (default label "Student N", editable), status | **any signed-in device** (F3) | until the teacher deletes it | teacher: contract | `teacherService.ts` |
| C13 | `sessionResults/{sessionId}` | per student: `studentCode`, `studentLabel` (**the name the child typed when joining**), score, accuracy | **any signed-in device can read AND write** (F3) | no deletion policy | teacher: contract; child data: unclear (F3) | `TeacherLiveDashboard.tsx`, `teacherService.ts` |
| C14 | `templates/{id}` | teacher's saved session templates (settings, optional custom questions) | any signed-in device (read), teacher (write) | until the teacher deletes it | contract | `teacherService.ts` |
| C15 | `gameHistory/{id}` | **FINDING F1.** After each multiplayer game, the host's device stores: room code, game type/mode/difficulty, player count and **per player the name the child typed, avatar, score, accuracy, rank**, server timestamp | **any signed-in (anonymous) device** (shown as the public "Clasament" on the home page) | **FIXED: collection removed, rules deny all client access, one-off cleanup script** (was: kept forever, no deletion path) | none clear: contradicts the "no child personal data" promise | `src/services/historyService.ts`, `src/components/leaderboard/GameResults.tsx`, `PersistentLeaderboard.tsx` |
| C16 | `admins/{uid}` | existence of the owner's admin uid | the owner (own doc only) | owner decision | legitimate interest | `docs/ADMIN.md`, `src/services/adminService.ts` |

### 2b. Realtime Database (`database.rules.json`)

| # | Path | Data item | Who can read | Retention / deletion | Legal basis (guess) | Source |
|---|---|---|---|---|---|---|
| R1 | `rooms/{roomId}` | multiplayer room: join `code`, host/player ids (random), **player name typed by the child (max 20)**, avatar, score, ready flag, game settings, generated questions, progress, finish times, `createdAt` | **any signed-in device** may list/read all rooms (`.read` on `/rooms`) and **write** any room (F2) | deleted when the host leaves (LobbyPage), or on host disconnect (`onDisconnect().remove()`). Rooms orphaned in other ways have **no expiry** | contract (service the user asked for); names: unclear (F2) | `src/services/roomManager.ts`, `gameSession.ts`, `database.rules.json` |

### 2c. Firebase Auth

| # | Data item | Notes | Source |
|---|---|---|---|
| A1 | Anonymous uid (random) | created on first multiplayer join, report, push opt-in, class join. Not linked to a name. Anonymous accounts are not auto-deleted | `authService.ensureAnonymousAuth` |
| A2 | Parent / teacher / admin email + password hash; teacher may use **Google sign-in** (name, email, Google profile id) | teacher accounts: no in-app deletion (F9) | `authService.ts`, `TeacherLogin.tsx` |

## 3. Third parties and infrastructure

| # | Party | What they receive | Retention / control | Legal basis (guess) | Source |
|---|---|---|---|---|---|
| T1 | **Google (Firebase / Google Cloud)**: processor for Auth, Firestore, RTDB | everything in §2; connection metadata (IP) | Google's terms (DPA); region **unknown** (F10) | art. 28 processor; SCCs / DPF for any transfer | `src/services/firebase.ts` |
| T2 | **GitHub Pages** (hosting, domain `www.ludiko.ro`, `public/CNAME`) | every visitor's IP address, user agent and requested URL in GitHub's logs. GitHub is its own controller for these | GitHub privacy statement | legitimate interest of hosting | `.github/workflows/deploy.yml` |
| T3 | **Google Fonts** (`fonts.googleapis.com`, `fonts.gstatic.com`): Nunito | the visitor's IP, user agent, referrer at first load, before any consent (F4) | Google; cached in the service worker (up to 1 year for files) | none good; legitimate interest is contested in EU case law | `index.html`, `vite.config.ts` |
| T4 | **Push services** (Google FCM, Mozilla autopush, Apple Web Push) chosen by the browser | the encrypted notification + the owner's `VAPID_SUBJECT` contact (mailto) + the endpoint | the push service's own terms | consent (opt-in) | `docs/NOTIFICATIONS.md`, `scripts/send-daily-reminders.mjs` |
| T5 | **GitHub Actions** (daily reminders) | runs the sender with a service-account key (role Cloud Datastore User); logs contain counts, endpoint hosts and HTTP status only | GitHub log retention | art. 28 (processor for the owner) | `.github/workflows/daily-reminders.yml`, `scripts/send-daily-reminders.mjs` |
| T6 | Fonts bundled from npm (`@fontsource/opendyslexic`) | none (served from the app origin) | n/a | n/a | `src/main.tsx` |

Not used: advertising networks, analytics, tag managers, social widgets, error trackers, CDNs for scripts,
`sessionStorage`, geolocation, camera or microphone (`grep` of `src/`).

## 4. FINDINGS (existing code that conflicts with the "no child personal data" promise)

Nothing below was changed in this branch (scope: privacy documents only). Each needs an owner decision.
Priority: **H** high, **M** medium, **L** low.

### F1 (H): multiplayer names and a public leaderboard live in Firestore forever — FIXED
- **FIXED (owner decision: remove the cloud leaderboard).** `saveGameHistory`, `historyService.ts`, `PersistentLeaderboard.tsx` and the home-page trophy button are gone; `GameResults.tsx` no longer writes anything (the in-game podium and `LiveLeaderboard` use room state only). `firestore.rules`: `gameHistory` is `allow read, write: if false`. Existing documents: owner runs `scripts/privacy/delete-game-history.mjs` once (`--dry-run` first). Tests: `tests/privacyF1F8.test.ts`.
- `GameResults.tsx` makes the host's device call `saveGameHistory`, writing the name each child typed (max 20,
  free text, so it may be a real name), avatar and score into `gameHistory`. `PersistentLeaderboard.tsx`
  (trophy button on the home page) shows them to every visitor.
- Rules: `allow read, create: if request.auth != null` with **no field validation**, so any anonymous client
  can read all of it and write arbitrary documents (abuse, cost, defacement of the leaderboard).
- No uid is stored, so an erasure request ("delete my child's name") cannot be matched to entries except by text search.
- The home-page claims ("Profilele rămân pe acest dispozitiv", "Nu păstrăm nume reale") are not true for this path.
- **Suggested fix (best first):** (a) remove the cloud leaderboard and `saveGameHistory`; keep results local;
  (b) or keep a leaderboard with avatar + score only (no name) and a Firestore TTL policy on a `expireAt` field (e.g. 30 days);
  (c) tighten rules to a strict field allowlist + size limits either way; (d) one-off: delete the existing `gameHistory` documents.

### F2 (H): Realtime Database rooms are world-readable and world-writable to any anonymous session
- `database.rules.json`: `.read: auth != null` on `/rooms` (needed for the code query, but it lets anyone download
  every room with player names and avatars) and `.write: auth != null` per room, player and progress (anyone can edit or delete any room).
- No expiry for rooms that are not removed by `onDisconnect`.
- **Suggested fix:** do not read at `/rooms` level. Use a small index `roomCodes/{code} -> roomId` readable by exact key
  (like `joinCodes` in `docs/CLASSROOM.md` §6), per-room read only for members, players write only their own node,
  host-only writes for status/game; use the profile nickname or a random animal name instead of free text; clean up
  stale rooms (scheduled job or `createdAt` check).

### F3 (M): v1 teacher sessions: student names in Firestore, readable/writable by any signed-in device
- `sessionResults`: `allow read, write: if request.auth != null` (any anonymous user can read or overwrite any
  session's results). `TeacherLiveDashboard.tsx` saves `studentLabel: player.name` (what the child typed).
  `sessions` and `templates` are readable by every signed-in device.
- **Suggested fix:** restrict `sessionResults` read/write to the session's teacher (`get()` on `sessions`),
  validate fields; let students validate codes through an exact-key index instead of reading all sessions;
  show the teacher a warning to use codes/initials. Consider retiring v1 sessions in favour of `classes` (CLASSROOM.md).

### F4 (M): Google Fonts loaded from Google's servers
- `index.html` preconnects and loads Nunito from `fonts.googleapis.com`; the service worker caches it. Every first visit sends the
  visitor's IP to Google without consent. EU courts (e.g. LG München I, Jan 2022) have treated this as unlawful; for a children's site this should not remain.
- Also `Nunito` is **not listed in `content/credits.json`**, which `docs/LEGAL_CONTENT_POLICY.md` requires for every third-party asset.
- **Suggested fix:** self-host Nunito (OFL-1.1) like OpenDyslexic (`@fontsource/nunito`, needs the owner's OK for a dependency, or
  commit the woff2 files under `public/`), delete the three `<link>` tags and the two runtimeCaching routes in `vite.config.ts`,
  add the credits entry, then remove T3 from the policy.

### F5 (M): free-text nicknames and teacher labels; roles with schools
- Profile `nickname` (and multiplayer names) are free text. The hint "Alege o poreclă, nu numele tău real" exists for profiles
  (`profiles.nicknameHint`), not for the multiplayer name fields. With a parent account the nickname goes to `families/*/children`.
- A teacher can type pupils' real names as seat labels (C6); then the teacher or school is the **controller** and Ludiko a **processor**
  (needs teacher terms / a data-processing agreement; the draft Terms only mention it).
- **Suggested fix:** add the same hint to every name field; keep seat-label guidance in `classroom.privacyNote`; decide on a short teacher-terms
  paragraph or DPA with a lawyer.

### F6 (L): content-report free text, no retention
- `comment` (max 300) from anonymous users may contain personal data. **Fix:** a one-line hint in `ReportButton`, and delete resolved/dismissed reports after
  e.g. 12 months (manual or scheduled).

### F7 (L): push subscriptions have no expiry
- A subscription stays until the user turns reminders off or the push service answers 404/410. **Fix:** in `scripts/send-daily-reminders.mjs` also delete
  documents whose `updatedAt` is older than 12 months (the client updates it whenever a bit is finished).

### F8 (L): erasure is split across systems — FIXED
- **FIXED.** "Șterge tot" card (`src/components/privacy/EraseAllCard.tsx`, on `/learn/parent` and `/learn/account`) runs `src/privacy/eraseAll.ts` (lazy): leave class per profile, unsubscribe push + delete `pushSubscriptions` doc, delete parent cloud account, optionally wipe local profiles, sign out; shows a per-step result list and reports what could not be done offline (nothing is queued).
- Deleting the parent account (C1-C3) does **not** delete: the class progress summary (C7), the push subscription (C4), or anonymous-auth data (A1).
  `leaveClass` deletes C7 only best-effort (fails offline). The policy says so, but a single "delete everything" button would be cleaner.

### F9 (L): teacher accounts cannot be deleted in the app
- No `deleteUser` for teachers. **Fix:** manual process via the contact address (the policy says so); add an in-app button later.

### F10 (M, owner action): database region unknown, transfers
- Firestore location is fixed at creation; RTDB default is `us-central1` (`*.firebaseio.com`), EU is `europe-west1` (`*.firebasedatabase.app`).
  Check both in the Firebase console and in the `VITE_FIREBASE_DATABASE_URL` secret. Sign the Google Cloud/Firebase data-processing terms.
  Put the region into the policy section "Unde" (marked TODO there).

### F11 (L): consent record version
- `CONSENT_VERSION` (`2026-11-v1`, `src/family/types.ts`) predates the policy. When the policy is final, bump it so the stored `consentVersion` points at a
  real text, and re-ask existing accounts (`needsConsent` flow already exists).

## 5. How the policy maps to this audit

`src/legal/privacy.ts` sections: who (operator, contact), data (D*, C*, R*), why, where (T1-T5, region TODO), retention, rights, children, storage
(D1-D16, no cookies), changes, version. Anything in §4 that the owner fixes should be removed from the "data" and "retention" sections at the same time.
