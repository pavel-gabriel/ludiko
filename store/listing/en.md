# Ludiko: store listing kit (English)

Original text written for Ludiko. Never copy text from textbooks or other apps (`docs/LEGAL_CONTENT_POLICY.md`).
Check everything marked **[to confirm]** before publishing.

## Basics

| Field | Value |
|---|---|
| Name (max 30 chars) | **Ludiko** |
| App Store subtitle (max 30) | Learn maths through play |
| Play short title (max 30) | Ludiko: maths through play |
| Category | Play: **Education**. App Store: **Education** (secondary: Games / Educational) |
| Languages | Romanian (primary), English |
| Price | Free, no ads, no in-app purchases |
| Privacy policy URL | `https://www.ludiko.ro/privacy` |
| Terms URL | `https://www.ludiko.ro/terms` |
| Website / support | `https://www.ludiko.ro/` ; support e-mail **[to confirm: the address in `RIGHTS_CONTACT`, `src/utils/constants.ts`]** |
| Target age | 6-11 (Romanian grades 0-IV), with content for grades V-VIII |
| Status | **Beta**: content is generated and checked automatically, not yet reviewed by teachers |

## Short description (max 80 chars, Play)

Math through play: find gaps, fix them. Free, no ads, works offline.

(68 characters.)

## Full description (max 4000 chars)

Ludiko is a free maths tutor for children, built around the Romanian school curriculum. It starts from a simple idea: before practising, find out what the child already knows and where the gaps are.

HOW IT WORKS
• A short check, shaped like a game, shows what your child knows and what is missing from earlier grades.
• Ludiko builds a skill map and offers a small daily mission that takes a few minutes.
• Gaps are fixed through play: picture exercises, memory pairs, calculation races, number sequences and equations.
• Stars and stickers are earned for learning, not for time spent in the app.

FOR PARENTS AND TEACHERS
• An adults' area shows the level per subject and what still needs practice. No grades, no comparing children.
• Several children on one device, each with their own profile.
• Parents can optionally create an account to keep progress across devices.
• Teachers can create classes, send assignments and see a progress summary.

WHAT IS INSIDE
• Maths following the Romanian curriculum for grades 0-IV, growing towards grades V-VIII.
• Choice, true/false, matching, fill-in, ordering and other exercise types.
• Play alone, with friends (room code, on different phones) or two on the same phone.
• Read aloud: lessons can be read out loud by the device.

SIMPLE AND HONEST
• 100% free. No ads, ever.
• Works offline: after the first open you do not need internet to learn.
• We do not ask for a real name, e-mail or birth date for the child. Profiles stay on the device.
• No tracking, no behavioural analytics, no purchases.
• Dyslexia-friendly font and sounds that can be turned off.
• Romanian and English interface.

CURRENT STATUS
Ludiko is in beta. Content is written and checked automatically and every exercise has a "Report a mistake" button. It has not yet been reviewed by teachers, so you may find errors. Tell us and we will fix them.

Ludiko is not affiliated with the Romanian Ministry of Education and does not replace school. It is a help for practising at home.

## What's new (first release)

First store release: level check, skill map, daily mission, maths games, parent and teacher areas.

## Keywords (App Store, max 100 chars, comma separated)

maths,math,kids,grade 1,grade 2,grade 3,grade 4,educational game,multiplication,addition,offline

## Tags (Play)

Education, Maths, Kids, Learning, Educational games

## Content rating questionnaire answers (IARC for Play, ratings for Apple)

| Question | Answer |
|---|---|
| Violence, blood, crude language, sexual content, drugs, gambling | No |
| Scary themes or imagery | No |
| Chat, messages or user-generated content visible to others | No (multiplayer rooms use animal names picked from a list, no free text) |
| Location sharing | No |
| Interaction between users | Only through a room code, with preset animal names, no messages |
| In-app purchases / ads | No / No |
| External links | Yes, only licences and the contact e-mail, behind a parental gate |
| Collects personal data | Optional and minimal (see below) |
| Expected result | PEGI 3 / IARC 3+ / USK 0 / ESRB Everyone. App Store: **4+**, Kids Category **[to confirm age band 6-8 or 9-11]** |

## Data safety form (Google Play)

Based on `docs/PRIVACY_DATA_MAP.md`. Answer exactly like this and re-check after any code change.

**Does the app collect or share user data?** Yes, but only when the user uses optional online features; without them everything stays on the device.
**Is data encrypted in transit?** Yes (HTTPS).
**Can users request deletion?** Yes, in the app (parent account: delete account; teacher account: delete teacher account; profile: delete under "Manage"; "Erase all" on the device). The contact address also accepts deletion requests.
**Data shared with third parties?** No. Google Firebase is a processor acting for us, not "sharing" in the form's sense.

| Data type (Play) | Collected? | Purpose | Optional? | Shared? |
|---|---|---|---|---|
| E-mail address | Yes, only for parent or teacher accounts | App functionality, account management | Yes | No |
| Name | No (no real name is asked; a child's nickname is content, not a name) | - | - | - |
| User IDs | Yes: random anonymous Firebase ID (multiplayer, reports, classes) | App functionality | Yes | No |
| Other user-generated content | Yes: child nickname and avatar in a parent account; the "Report a mistake" comment (max 300 chars) | App functionality, content quality | Yes | No |
| App activity (progress) | Yes, only with a parent account or in a class: skills, stars, play days | App functionality | Yes | No |
| Device or other IDs | Yes: notification subscription (opt-in) and an install id for sync | App functionality (daily reminder) | Yes | No |
| Location, contacts, photos, audio, files, calendar, financial, health | No | - | - | - |
| Advertising ID, analytics, crash reports | No | - | - | - |

Short form text: "Data is collected only on request (accounts, classes, multiplayer rooms, reminders). It is not used for ads or analytics. It is not sold or shared. It can be deleted in the app."

## Families policy (Google Play Families) and "Designed for Families"

- Target audience includes children (6-12), so the app falls under the Families programme. Select "Children" and "Adults/parents" age groups, not only 13+.
- No ads and no ad or analytics SDKs, which fits the certified-SDK requirement.
- The only SDKs included are Firebase Auth/Firestore/Realtime Database (functional). Do not add Firebase Analytics, Crashlytics or Cloud Messaging without a new review.
- Parental gate before external links and e-mail: `src/components/ui/ParentalGate.tsx`.
- No personal data is requested from children: no real name, e-mail or birth date. E-mail accounts are for adults only.
- The privacy policy is in the app and at `https://www.ludiko.ro/privacy`.
- Teacher Approved (Play): applied for after launch through Google's programme. Prepare the pedagogical review (volunteer reviewer programme, `docs/PLAN.md` phase 3) before applying; until then the app stays labelled beta.
- COPPA/GDPR-K: the parent gives consent when creating the sync account (`families/{uid}/consentAt`).

## Screenshots

Use the images in `public/screenshots/` (phone 1080x1920, tablet 1280x800); they are taken from Ludiko's own UI. Play needs at least 2 phone screenshots. For App Store regenerate at the required sizes (see `store/ios/README.md`). For better shots create a test profile first and regenerate with `scripts/generate-screenshots.mjs`.

## Notes for the App Store reviewer

"Ludiko is a learning app that works offline: all lessons are inside the app. No account is required, and there are no ads or purchases. External links and e-mail are behind a parental gate (a multiplication question). Daily reminders are local and optional, enabled by a parent."
