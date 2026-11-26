# Daily "bits" & push reminders — contract

> Status: agreed design (Phase 1A+). Implemented by two parts that must match this document:
> the **client** (bits, opt-in UI, service-worker push handler, subscription storage) and the
> **sender** (scheduled GitHub Action). Privacy rules from `docs/PLAN.md` §11 and
> `docs/LEGAL_CONTENT_POLICY.md` apply.

## 1. Daily bits

A **bit** is a ~3-minute group of 4–6 items, small enough for a short attention span and a
notification tap. Today's mission (`learnerService.getTodayMission`) is split into bits:

| Bit | Name (ro / en) | Content |
|---|---|---|
| 1 | **Încălzirea** / Warm-up | due reviews + an easy practice skill |
| 2 | **Insula zilei** / Island of the day | the `new` step, else the main practice step |
| 3 | **Provocarea** / The challenge (optional) | a `check` step, else a short sprint on a practised skill |

Rules: each bit is 4–6 items; a child can stop after any bit, and each finished bit is celebrated.
A day counts as a play day after **one** bit. Bits are derived from the stored mission, so they are
stable for the day, offline too.

### Daily plan across subjects ("Biții de azi")

The learner home (`/learn`) shows ONE plan for the child's grade, not one set of bits per subject:
`learnerService.getTodayPlan(profileId, now?)` returns `{ day, bits: PlanBit[] }` (a `PlanBit` is a `Bit`
plus `subject`, `source: 'mission' | 'placement'` and `bitIndex`). **The reminder's `/learn` URL points to
this plan.**

| Bit | Subject | Content |
|---|---|---|
| 1 | Matematică | a slice of today's mission (`getTodayBits`), or a placement chunk if no placement yet |
| 2 | Limba română | same |
| 3 | rotating: stiinte, logic, ist, geo, civ | same; only subjects the child's grade has content for |

Rules:
- **Availability:** a subject's minimum grade is derived from the content registry (`src/learner/availability.ts`);
  subjects above the child's grade are never planned, never playable, and show on `/learn` as a "De la clasa a
  IV-a" teaser. Their routes redirect to `/learn?locked=<subject>` with a friendly note, and
  `placementNext` answers `{ unavailable: true }` without creating a placement.
- **Rotation:** by local day number among the available others, preferring subjects with a placement still to do,
  due reviews or gaps (a fully known subject sits out). Within a subject the bit rotates through the bits still
  to do (warm-up / island / challenge), so new material, reviews and checks all get their turn.
- **Placement chunk** (no finished placement): "Hai să vedem ce știi la Științe!", two probes (~3 items each,
  about 3 minutes), resumable; done after 2 probes or when the placement finishes. It plays at
  `/learn/check/:subject?plan=1`; mission bits play at `/learn/bit/:subject/:index?plan=1` (`?plan=1` makes
  "Încă un bit?" go to the next bit of the plan, across subjects).
- **Persistence:** the composition (which subject / which bit) is stored per day and profile on the device
  (`localStorage`, `src/learner/planStore.ts`), so re-reads are stable. Done-ness is never stored: it is derived
  from the mission steps (`completeMissionStep`) or the placement probes, so it syncs with the progress.
- All bits done = celebration on the home. The per-subject cards (check, mission, map) stay under "Toate materiile".
- "Tema de la clasă" (class assignments) stays an extra card; the exam card stays for grades II–IV only.

## 2. Push reminders: architecture

- **Standard Web Push with VAPID** (`PushManager.subscribe`). No Firebase Messaging SDK in the app bundle.
- The PWA service worker (vite-plugin-pwa, `generateSW`) loads `public/push-sw.js` via
  `workbox.importScripts`. It handles `push` (shows the notification) and `notificationclick`
  (focuses/opens `<base>learn`).
- Subscriptions are stored in **Firestore** `pushSubscriptions/{id}`.
- A **GitHub Action** runs **hourly** (`cron: '7 * * * *'`). It reads due subscriptions with the
  Firebase Admin SDK and sends with the `web-push` library. Both are CI-only and never shipped to
  browsers.
- If `VITE_VAPID_PUBLIC_KEY` is missing at build time, or the browser lacks Push/Notification
  support, the opt-in UI is hidden. On iOS, show a hint that the app must first be added to the
  Home Screen.

## 3. Firestore document `pushSubscriptions/{id}`

`id` = lowercase hex SHA-256 of `endpoint` (computed client-side with `crypto.subtle`).

| Field | Type | Notes |
|---|---|---|
| `endpoint` | string | from `PushSubscription.toJSON()` |
| `keys` | `{ p256dh: string; auth: string }` | from `toJSON().keys` |
| `hour` | int 8–20 | local hour chosen by the parent (default 17) |
| `timezone` | string | IANA, e.g. `Europe/Bucharest` (`Intl.DateTimeFormat().resolvedOptions().timeZone`) |
| `lang` | `'ro' \| 'en'` | notification language |
| `active` | bool | `false` = paused by the parent |
| `lastPlayedDay` | `'YYYY-MM-DD'` (local) \| absent | written by the client when a bit is finished |
| `lastSentDay` | `'YYYY-MM-DD'` (local) \| absent | written **only** by the sender |
| `createdAt` / `updatedAt` | number (epoch ms) | |

**No personal data:** no profile id, nickname, grade or progress. One subscription per device;
siblings on one phone share it (messages are generic).

**Rules (client):** create/update only when `request.auth != null` (anonymous auth), the fields are
exactly the ones above minus `lastSentDay`, and they are typed and bounded (endpoint ≤ 1024 chars,
https). Delete is allowed when authenticated. No client reads or lists. The Admin SDK bypasses rules.

## 4. Sender logic (`scripts/send-daily-reminders.mjs`)

For each `active` subscription:

1. Compute the local date and hour in `timezone`.
2. Send only if `localHour === hour`, `lastPlayedDay !== today` and `lastSentDay !== today`.
3. On success set `lastSentDay = today`. On HTTP 404/410 delete the document. Other errors are logged
   and skipped.
4. Never send outside 08:00–20:59 local time.

Payload (JSON): `{ "title": string, "body": string, "url": "/learn", "tag": "ludiko-daily" }`.
Messages are original, short and gentle, chosen by day of year. Never use guilt or loss language
("you'll lose your streak").

Examples:
- ro: *"Bitul de azi te așteaptă: 3 minute de joacă! 🏝️"*
- en: *"Today's bit is ready — 3 minutes of play! 🏝️"*

**Secrets** (GitHub repository settings): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
(`mailto:` the rights contact), `FIREBASE_SERVICE_ACCOUNT` (JSON). Build env:
`VITE_VAPID_PUBLIC_KEY` (same value as `VAPID_PUBLIC_KEY`). The workflow exits successfully
(no-op) if secrets are missing.

## 5. Consent & UX

- Opt-in lives in the **parent view** (`/learn/parent`), not in the child's screens.
- It shows a short consent text: what is stored (a device push address, the chosen hour, time zone,
  language, the last play date) and why; how to turn it off.
- Controls: on/off, hour picker (08–20), pause. Turning off unsubscribes and deletes the document.
- At most **one** reminder per day, none after the child has played that day.

## 6. Push reminders setup (owner)

One-time steps. The sender is `scripts/send-daily-reminders.mjs` (logic in `scripts/reminders/logic.mjs`),
run hourly by the `reminders` job in `.github/workflows/deploy.yml`. Until the secrets exist, the job exits 0 and does nothing.

1. **Generate VAPID keys** on your own computer (not in CI), after `npm ci`:
   ```sh
   npx web-push generate-vapid-keys
   ```
   Keep the private key out of chat, email and git. The public key is safe to share.
2. **Add GitHub repository secrets** (Settings → Secrets and variables → Actions):
   - `VAPID_PUBLIC_KEY`: the public key from step 1.
   - `VAPID_PRIVATE_KEY`: the private key from step 1.
   - `VAPID_SUBJECT`: a `mailto:` address you control (the rights contact), used by push services to reach the sender.
   - `FIREBASE_SERVICE_ACCOUNT`: the full JSON key of the service account from step 3.
3. **Public key for the app build.** `deploy.yml` passes `VITE_VAPID_PUBLIC_KEY: ${{ secrets.VAPID_PUBLIC_KEY }}`
   to the build step, so no extra secret is needed. Both values must be the same key. If it is missing, the opt-in UI is hidden.
4. **Firebase service account with least privilege.** In Google Cloud console (project `ludiko-2e197`) → IAM & Admin →
   Service Accounts → create `ludiko-reminders`. Grant only the role **Cloud Datastore User** (`roles/datastore.user`),
   which covers Firestore reads and writes and nothing else. Create a JSON key for it and paste the file content into
   the `FIREBASE_SERVICE_ACCOUNT` secret. Then delete the local file. The Admin SDK bypasses Firestore rules, so no rule change is needed.
5. **Check it works.** Run it manually (Actions → "Deploy to GitHub Pages" → Run workflow → task `send-reminders`) with `dry_run` ticked.
   The log shows the counts without sending or writing anything. Then run it without `dry_run` when you are ready.

Logs never contain endpoints, keys or child data: only counts, endpoint hosts and HTTP status codes.
