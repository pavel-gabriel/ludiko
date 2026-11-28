# Ludiko: security review (2026-11-28)

The owner asked for this review. It covers this repository and local emulators only; no traffic was sent to the
production Firebase project or to www.ludiko.ro. Things only the owner can do are listed in `OWNER_TODO.md`, section
"🔒 Security".

How it was tested:
- **Security rules:** `tests/rules/emulator-rules.mjs` contains 151 executable cases. They run against the
  local Firestore and RTDB emulators, using the real client SDK with mock auth tokens (anonymous, password,
  google.com, unauthenticated). Seed data is written with firebase-admin. Every collection and path has
  cases for the normal flow (must be allowed) and for attacks (must be refused). Run it with
  `npm run rules:test`. It also runs in the PR "Tests" workflow (job `rules`), so CI catches a rule
  regression. Against the old rules it reported 13 failures, the findings below. Against the new rules
  all 151 pass.
- **CSP:** checked in a production build (`vite build` + `vite preview`) with Playwright and Chrome, on 20
  routes. The build had a fake Firebase config. The browser blocked every request leaving localhost, and
  Auth answers were faked, so the app went on to the Realtime Database websocket and the long-poll
  `<script>` fallback. There were no CSP violations and no console errors.
- **Supply chain:** `npm audit` and `npm audit --omit=dev`, a lockfile check, a grep of the full git history
  (249 commits) for secrets, and a review of both workflows.

## Findings

Severity: critical / high / medium / low / info. "Old" line numbers refer to the files before this review
(commit `004096c`).

| ID | Sev | Finding | Status |
|---|---|---|---|
| S-01 | **Medium** | The push subscription `endpoint` could be any `https://` URL, and the document id was not tied to it. The reminder job would POST to whatever host an attacker registered, from GitHub Actions while holding a service-account secret. Docs could also be re-pointed or multiplied | **Fixed** |
| S-02 | **Medium** | No App Check and no rate limits. Anyone with the public web config can create unlimited anonymous users and write reports, rooms, push subscriptions, and brute-force codes. The owner pays the cost | Owner action |
| S-03 | Low | Any anonymous session could create `teachers/{uid}` (any fields, up to 1 MiB) and `sessions` documents. A session could also be handed to another uid | **Fixed** |
| S-04 | **Medium** | Classroom code strength. Student codes `ANIMAL-NN` have only 2,700 values, and every room member can read the session id, so a child can find the valid codes and join as, or write results for, a classmate. Class join codes are 31^6 with no rate limit | Open (dev + owner) |
| S-05 | Low | `contentReports.snapshot.options` items were unchecked, so one report could carry about 1 MiB or nested maps into the admin queue | **Fixed** |
| S-06 | Low | RTDB: a device could add unlimited `{uid}_N` fake players to any waiting room it knew | **Fixed** |
| S-07 | Low | RTDB: `createdAt` was not bounded, so a room could stay joinable forever and a room code could be squatted forever | **Fixed** |
| S-08 | **Medium** | `/dev/family` shipped in production and deletes **all local child profiles** on page load. Any shared link triggers it. `/dev/classroom` swapped in a fake API and a fake teacher uid | **Fixed** |
| S-09 | Medium | No Content-Security-Policy and no Referrer-Policy (GitHub Pages cannot send headers) | **Fixed** (meta tags) |
| S-10 | Low | GitHub Actions: `pages: write` + `id-token: write` were granted to every job, including the jobs holding Firebase service-account secrets. `test.yml` had no `permissions:` block | **Fixed**; rest are owner actions |
| S-11 | Medium | Dependencies: 62 audit findings (6 critical, 28 high), 5 of them in production deps | **Partly fixed** (now 23, all dev-only or need a major upgrade) |
| S-12 | Low | The push service worker would open an absolute URL from a payload outside the app scope (only the holder of the VAPID key could send one) | **Fixed** |
| S-13 | Info | Secrets: none in the repo or its history. The Firebase web config is public by design, so restrict the API key | Owner action |
| S-14 | Info | XSS / redirects / postMessage: nothing found | — |
| S-15 | Info | Recovery code, backups, room ids: entropy and validation are adequate for their use | — |
| S-16 | Info | Service worker caches only same-origin static files, never Firebase responses | — |
| S-17 | Low | Admin-SDK scripts: destructive by default when run locally without `--dry-run`. The workflow defaults to a dry run. Logs hold no personal data | Owner awareness |
| S-18 | Info | Auth hygiene: open email sign-up (by design), 6-char minimum password, raw Firebase error text shown on teacher login | Owner action |

### S-01 (Medium): push endpoint used as a request target (fixed)
- **Evidence (old code):**
  - `firestore.rules:196`: `d.endpoint.matches('^https://.+')`.
  - `firestore.rules:217`: `update` lets any signed-in user change any field except `lastSentDay`.
  - `scripts/send-daily-reminders.mjs:110`: only `startsWith('https://')` was checked before
    `webpush.sendNotification`.
- **Repro:**
  1. Sign in anonymously with the public config.
  2. `setDoc(pushSubscriptions/<any 64 hex>, {endpoint:'https://victim.example/x', keys:{…}, hour:18, …})`.
  3. At the next hourly run, the GitHub runner POSTs to `victim.example`. Thousands of such docs also slow
     the 10-minute job until it times out, so real reminders stop.
- **Fix:**
  - `firestore.rules`: the endpoint must belong to a browser push service. The allowed hosts are
    `*.googleapis.com` (FCM), `*.push.services.mozilla.com`, `*.push.apple.com` and
    `*.notify.windows.com`.
  - `firestore.rules`: the document id must equal `hashing.sha256(endpoint)`. This means one doc per
    endpoint, and the endpoint can never be re-pointed.
  - The sender applies the same allowlist: `scripts/reminders/logic.mjs` `isAllowedPushEndpoint`, with
    tests in `tests/reminders.test.ts`.
  - Emulator cases cover the 4 real push hosts, a lookalike host, an id mismatch and a re-point attempt.

### S-02 (Medium): no App Check / abuse limits (owner action)
- **Evidence:** `src/services/firebase.ts` (no `initializeAppCheck`). The rules allow these writes to any
  anonymous user: `contentReports` create, `pushSubscriptions` create, `rooms/*` create, and `get` on
  `joinCodes` / `sessionCodes` / `roomCodes`.
- **Impact:** a script can:
  - create anonymous users without limit;
  - fill the admin report queue with spam (each report is now at most a few KB);
  - store large `game` payloads in rooms it hosts;
  - brute-force codes (S-04).

  All Firestore reads and writes are billed to the project.
- **Fix:** see `OWNER_TODO.md`:
  - App Check with reCAPTCHA Enterprise, enforced on Firestore and RTDB;
  - API-key referrer restrictions;
  - an Auth sign-up quota;
  - budget alerts.

  Enabling App Check needs these extra CSP entries: `https://www.google.com/recaptcha/` and
  `https://www.gstatic.com/recaptcha/` in `script-src` and `frame-src`. Also update the privacy policy,
  because reCAPTCHA sends device signals to Google and this is a children's app.

### S-03 (Low): teacher profile / session spoofing (fixed)
- **Evidence (old code):**
  - `firestore.rules:40` `allow write: if request.auth != null && request.auth.uid == uid`. This had no
    provider check and no field check.
  - `sessions` `create` had no provider check.
  - `update` allowed `teacherUid` to change.
- **Impact:** anonymous scripts could inflate the admin teacher count with documents of any size. A teacher
  could plant a session in another teacher's list.
- **Fix:**
  - `teachers` create/update now require a non-anonymous account and allow only the `TeacherProfile` fields
    (`uid` == doc id, `email` ≤ 320, `displayName` ≤ 200, `createdAt` number).
  - `sessions` create is non-anonymous only, and `teacherUid` can no longer change.
  - Delete is unchanged.
  - Password and Google teachers were checked in the emulator.

### S-04 (Medium): weak classroom codes (open)
- **Evidence:**
  - `src/services/teacherService.ts:197-212`: 30 animals × 90 numbers. In a class, animal *i* is fixed, so
    each animal has only 90 possible numbers.
  - `src/services/classroomStart.ts:17`: `room.classroomSessionId` can be read by every room member.
  - `firestore.rules` `sessionCodes` allows `get` to any signed-in user.
  - `firestore.rules` `sessionResults/{sid}_{CODE}` allows create/update by **any** signed-in user once the
    code exists, with no binding to the device that first used it.
  - Class seats: `progress/{code}` can be written by anyone who knows the code after the seat is linked.
- **Repro:**
  1. Join a classroom room.
  2. Read `classroomSessionId`.
  3. `getDoc(sessionCodes/<sid>_LION-10 … LION-99)`. That is at most 2,700 gets to list all codes.
  4. Join the room with a classmate's code, or overwrite their result document.
- **Fix (needs a product decision, not done here):**
  - Longer student codes (for example 4 digits, or 6 chars from the join-code alphabet).
  - Store `uid` in the result document and require `resource.data.uid == request.auth.uid` on update.
  - Optionally 8-character class join codes.
  - App Check, which makes brute force expensive.

### S-05 (Low): oversized report snapshots (fixed)
- **Evidence (old code):** `firestore.rules:178` only checked `options.size() <= 10`.
- **Fix:** each of the 10 indices must be a string of at most 120 chars, mirroring
  `SNAPSHOT_MAX_OPTION_LENGTH`. Covered by tests in the emulator and in `tests/reportSnapshot.test.tsx`.

### S-06 / S-07 (Low): RTDB room flooding and immortal rooms (fixed)
- **Evidence (old code):**
  - `database.rules.json:70,92,98`: `$playerId.beginsWith(auth.uid + '_')`.
  - `database.rules.json:39-41,119`: `createdAt` only `isNumber()`.
- **Fix:**
  - Exactly `auth.uid + '_2'`, the duel's second local player, which is the only suffix the client uses
    (`roomManager.ts:72`).
  - `createdAt <= now + 24h`, which still tolerates wrong device clocks.

### S-08 (Medium): destructive dev fixture reachable in production (fixed)
- **Evidence (old code):**
  - `src/app/AppRoutes.tsx:105-106` routed `/dev/classroom` and `/dev/family` in every build.
  - `src/family/dev/DevFamilyPage.tsx:45` runs on mount:
    `for (const p of await listProfiles()) await deleteProfile(p.id, { fromSync: true })`.
- **Repro:** open `https://www.ludiko.ro/dev/family` on a child's tablet. Every local profile and its
  progress is deleted and replaced with "Matei" and "Ana". Without a family account the data cannot be
  recovered.
- **Fix:** both routes and their chunks exist only in the Vite dev server (`import.meta.env.DEV`). The
  production build no longer contains them. The read-only previews (`/dev/items`, `/dev/learn`,
  `/dev/mascot`, `/dev/frames`) are still published (info). Consider hiding them too (`store/ios/README.md`
  already suggests it).

### S-09 (Medium): Content-Security-Policy + Referrer-Policy (fixed)
- `index.html` now has `<meta http-equiv="Content-Security-Policy">`:
  - `default-src 'self'`.
  - Scripts: `'self'`, the sha256 of the inline SPA-redirect script, `apis.google.com` (Google sign-in),
    and `*.firebaseio.com` / `*.firebasedatabase.app` (RTDB long-poll fallback).
  - `connect-src`: `*.googleapis.com` (Auth, Firestore), RTDB `https`/`wss`, `*.firebaseapp.com`.
  - `frame-src`: `*.firebaseapp.com` / `*.web.app` / `apis.google.com` / `accounts.google.com` (Auth iframe).
  - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
  - `style-src 'unsafe-inline'`, which React `style=` attributes need.
- `<meta name="referrer" content="strict-origin-when-cross-origin">`.
- `tests/securityMeta.test.ts` recomputes the inline-script hash, so editing that script without updating
  the CSP fails CI. It also stops `unsafe-eval` and wildcards from creeping in.
- **Limits:**
  - A meta CSP cannot set `frame-ancestors`, so clickjacking protection is not possible.
  - GitHub Pages cannot send HSTS or `X-Content-Type-Options`.

  Real headers need a host that sets them (Cloudflare in front, Firebase Hosting or Cloudflare Pages). If
  `VITE_FIREBASE_AUTH_DOMAIN` is ever changed to a custom domain other than www.ludiko.ro, add it to
  `frame-src`.

### S-10 (Low): GitHub Actions least privilege (fixed + owner actions)
- **Evidence (old code):** `deploy.yml:37-38` gave `pages: write`, `id-token: write` to all jobs, including
  `reminders` and `maintenance`, which hold service-account secrets. `test.yml` had no `permissions:`.
- **Fix:**
  - The workflow default is `contents: read`. Only the `deploy` job gets `pages`/`id-token`.
  - `test.yml` has `contents: read`.
  - The `rules` job now also runs the emulator rules tests.
- **Checked and fine:**
  - No `pull_request_target`.
  - No `${{ github.event.* }}` interpolated into `run:`; `github.event.before` is passed through `env`.
  - `workflow_dispatch` `task` is a `choice` used through `env`.
  - Secrets are written to files with `umask 077` and then deleted.
  - firebase-tools and bubblewrap are pinned to exact versions.
- **Owner/dev follow-ups:**
  - Actions are pinned to tags (`@v4`), not commit SHAs; add Dependabot for `github-actions`.
  - `main` auto-deploys the site **and the security rules**, so branch protection is essential.
  - `maintenance` falls back to the deploy service account, which has broad rights.

### S-11 (Medium): dependencies (partly fixed)
- **Before:**
  - Full audit: 62 findings (6 critical, 28 high).
  - Production: `react-router` (high, mostly SSR/RSC framework-mode advisories; Ludiko uses SPA mode and
    never navigates to user-controlled paths), `websocket-driver` (critical, Node-only RTDB transport),
    `@grpc/grpc-js` (high, Node-only Firestore transport), `i18next` (moderate).
- **Done:** a non-breaking `npm audit fix`. `package.json` ranges are unchanged; `react-router-dom` is now
  7.18.7. 23 findings remain:
  - `vitest`/`tinypool`: dev only, critical.
  - The Node build of `firebase` (`@grpc/grpc-js`): not in the browser bundle. Fixing it needs firebase 12.
  - `i18next` needs v26.

  These are left for planned major upgrades. Tests, build and size budget pass.
- **Lockfile:** v3, 1,257 packages. Every entry has an `integrity` hash and resolves to
  `registry.npmjs.org`.

### S-12 (Low): push notification URL (fixed)
`public/push-sw.js` `resolveInScope` fell back to the resolved URL even when it was absolute and outside the
app scope. It now falls back to the scope. Covered by a test in `tests/pushSw.test.ts`.

### S-13 (Info): secrets
- A grep of the working tree and all history (API keys, private keys, tokens, service-account JSON,
  keystores, `.env`) found nothing.
- `.gitignore` covers `.env*` and Android keystores.
- The Firebase web config (`VITE_FIREBASE_*`) ends up in the public JS bundle by design. It is not a
  secret, and the rules are the protection.
- Restrict the browser API key anyway (`OWNER_TODO.md`).

### S-14 (Info): client XSS / redirects
- **XSS:** no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` or `document.write` in `src/`.
  Nicknames, player names, seat labels, report comments and assignment titles are rendered as React text.
- **External links:** they go through `GatedLink` (parental gate, `noopener,noreferrer`). Their URLs come
  only from the static `content/credits.json`. There are no `target="_blank"` anchors.
- **postMessage:** no listeners.
- **SPA redirect:** `public/404.html` and the `index.html` script restore the path with
  `history.replaceState`, which throws on a cross-origin URL (`/?//evil.com` is harmless), so there is no
  open redirect.
- **Query parameters:** there is no `?redirect=`/`returnTo` parameter. The query parameters that exist
  select views only.

### S-15 (Info): codes and local data
- **Recovery code:** 11 random chars from a 31-symbol alphabet plus a checksum (about 54 bits). It is only
  displayed and stored on the device; there is no cloud lookup to brute-force.
- **Backups:** `parseBackup` validates them; `classLink` is sanitised and nickname re-validated.
  `profile.avatar` and `id` are not length-checked, but they stay local, are rendered as text, and the
  family-sync rules re-validate them before anything reaches the cloud.
- **Room ids:** 20 chars from `crypto.getRandomValues`, about 100 bits.
- **Room codes:** 32^6 (about 1.07e9), valid 6 hours, read by exact key only.

### S-16 (Info): service worker
- Workbox precaches only built static files. At runtime it caches same-origin `assets/*.js`, `content/` and
  `sounds/`. Firebase endpoints never match a route.
- Firestore offline persistence is not enabled.
- Parent/child data that the app keeps on purpose lives in IndexedDB/localStorage on the device.

### S-17 (Low): Admin-SDK scripts
- `scripts/privacy/*.mjs` and `scripts/send-daily-reminders.mjs`:
  - They log counts, HTTP status and endpoint host only; no endpoints, keys or names.
  - They exit cleanly when secrets are missing.
  - They take `--dry-run`, which the `workflow_dispatch` input sets by default.
  - When run by hand they **delete by default**.
- **Recommendation:** run them only through the workflow, or always add `--dry-run` first.
- **Service-account roles:**
  - Reminders: Cloud Datastore User.
  - Deploy: Firebase Rules Admin + Realtime Database Admin.
  - Do not reuse the deploy account for maintenance.

### S-18 (Info): Auth settings
- Anyone can create an email account. That is intended: parents and teachers sign up, and only
  `admins/{uid}` with a non-anonymous login is admin. The rules enforce this, and the anonymous-with-admin-doc
  case is tested.
- The minimum password length is 6.
- Email enumeration protection, a password policy and sign-up quotas are console settings
  (`OWNER_TODO.md`).

### Rules coverage (all paths)
Every rule was reviewed: who can read, list, create, update and delete each path, plus field validation,
size limits and enumeration. Each line below says what the emulator tests exercise.
- **`admins`:** own get only; never list or write.
- **`gameHistory`:** denied.
- **`teachers`:** S-03.
- **`sessions`, `sessionCodes`, `sessionResults`:** owner-only reads, exact-key gets, codes must exist,
  score bounds.
- **`contentReports`:**
  - create: allowlist, `status == 'open'`, sizes;
  - read: admin only;
  - update: admin only, `status` only;
  - delete: never.
- **`pushSubscriptions`:** S-01; `lastSentDay` can be written only by the Admin SDK.
- **`templates`:** owner read/delete only.
- **`classes`, `seats`, `progress`, `assignments`, `joinCodes`:**
  - non-anonymous teachers only;
  - the teacher cannot be changed;
  - a seat links once (false → true, nothing else changes);
  - progress needs a linked seat and has a strict shape;
  - join codes: get only, no update.
- **`families/**`:** only `sign_in_provider == 'password'` and the same uid; field allowlist; no
  `recoveryCode`.
- **RTDB `rooms`, `roomCodes`:**
  - no listing;
  - the host controls the room;
  - players write only their own entry, progress and finish time;
  - no joining after 6 hours or after the game started;
  - stale codes can be taken over.

## Can someone steal our app?

Short answer: **they can copy the code and content, but not legally, and they cannot use our backend once App
Check and the API-key restrictions are on.**

- **The repository is public** (`gh api repos/pavel-gabriel/ludiko` → `"visibility":"public"`). Anyone can
  read and clone all source code, `content/` (skills, items, explanations, generators), SVG visuals, icons,
  docs and the workflows. The deployed site exposes the same client code and content anyway: a PWA must ship
  its JS and content packs to the browser. Even with a private repo, a determined person can save the built
  site.
- **What a cloner cannot get:**
  - The Firebase project's data: rules decide who reads what.
  - The service-account keys, the VAPID private key and the Android signing key (GitHub secrets).
  - The domain `www.ludiko.ro`.
  - The store listings (`store/` holds only metadata).
  - Families' and teachers' accounts.
- **Today a clone could still point at *our* Firebase project.** The web config is in the bundle, so a copy
  hosted elsewhere would talk to our Firestore/RTDB, within the rules, and at our cost.
  - **Firebase App Check** stops this: requests without a valid attestation from our registered site
    (reCAPTCHA Enterprise for the web, Play Integrity for the Android TWA) are rejected.
  - **API-key HTTP-referrer restrictions** and **Auth authorized domains** add a second layer. Referrers can
    be spoofed by scripts, but not by a cloned website in normal browsers.
- **What protects us legally:**
  - Copyright arises automatically. `LICENSE` is proprietary ("No license is granted"; forks only as GitHub's
    ToS allows). Name the real legal owner (person or company) instead of just "Ludiko".
  - The git history and the `provenance` fields on content records timestamp authorship.
  - Content written under `docs/LEGAL_CONTENT_POLICY.md` is our own, so it is enforceable.
  - A **trademark** is not automatic. Register "Ludiko" (word, and logo) at **OSIM** (Romania; classes 9, 41,
    and possibly 42), or at EUIPO for the whole EU. That gives grounds to take down lookalike apps in stores
    and domain disputes.
- **Proving copying:**
  - Add a few **canary items**: unique invented facts, names or phrasings that exist nowhere else, kept on a
    private list with their commit dates.
  - Keep the git history.
  - Optionally fingerprint generated content, for example a fixed seed pattern in item ids.
- **Keeping the repo private:** GitHub Pages from a **private repository needs a paid plan** (GitHub Pro for
  personal accounts, or Team/Enterprise for organisations). Free alternatives:
  - Keep source private and push only the built `dist/` to a separate public Pages repo.
  - Host on Firebase Hosting or Cloudflare Pages. Both are free for this size, and both also allow real
    security headers.
- **Store listings:**
  - Publish under your own Google Play / Apple developer accounts with 2FA.
  - Keep the upload key and the Play App Signing key safe.
  - Fill in `assetlinks.json` with the real fingerprint so nobody else's APK can claim the domain.
