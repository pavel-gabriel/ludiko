# Parent account & cross-device sync — contract

> Status: agreed design. Optional feature: Ludiko keeps working fully without it (local-first).
> Privacy rules from `docs/PLAN.md` §11 apply. The parent is the account holder and gives consent.

## 1. What it does

A parent creates an account (email + password, Firebase Auth) from the parent area. Their children's
profiles and progress then sync between devices (phone, tablet, a grandparent's phone), so a lost
phone no longer means lost progress.

## 2. Consent (shown before the account is created)

Plain-language screen that lists exactly what is stored in the cloud:
- the nickname, avatar, school grade and language of each child profile you sync;
- learning progress (skill states, stars, stickers, play days, missions, placement results).

What is **never** stored: real names, birth dates, photos, the child's email, item-by-item answers,
location.

The parent ticks a checkbox. `consentAt` and `consentVersion` are saved. Links: privacy page (to be
written) and how to delete the account.

## 3. Firestore

```
families/{uid}                       // uid = parent's Firebase Auth uid (email provider only)
  consentAt: number
  consentVersion: string             // e.g. "2026-11-v1"
  createdAt: number
  updatedAt: number

families/{uid}/children/{profileId}
  profile: { id, nickname, avatar, grade, language, createdAt, updatedAt }   // NO recoveryCode, NO classLink
  progress: ProfileProgress                                                  // as stored locally
  updatedAt: number
  deviceId: string                   // random per-install id, for debugging conflicts only
  deleted?: boolean                  // tombstone so deletions propagate
```

Rules: only `request.auth.uid == uid` with a non-anonymous provider may read or write `families/{uid}/**`.
Field allowlists apply; `progress` must stay under ~900 KB (doc limit 1 MiB; missions are already
capped at 14). The rules go in a clearly delimited section of `firestore.rules`.

## 4. Sync & merge (pure, unit-tested)

Triggers: sign-in, app start (if signed in), after a bit/placement/practice session (throttled to at
most once a minute), and coming back online. Strategy: pull remote → `merge(local, remote)` →
save locally → push if changed.

Merge rules (deterministic, no data loss):
- **profile fields:** the newer `updatedAt` wins.
- **skills[skillId]:** keep the record with more evidence, compared by `(lastSeen, attempts)`
  lexicographically. Never lower `attempts` or `correct`.
- **stars:** max. **stickers:** union. **playDays:** union, sorted.
- **placements[subject]:** a completed placement beats an in-progress one; otherwise the newer `updatedAt` wins.
- **levelHistory[subject]:** union by `at`, sorted. **missions:** by (day, subject), keep the one
  with more steps done; keep the last 14.
- **deleted tombstone:** if either side is deleted and newer, delete locally too.

A child profile created on device B, while signed in to the same family, appears on device A on its next sync.

## 5. UI

- Parent area (`/learn/parent`), "Cont de părinte" card:
  - **Signed out:** create an account / sign in / forgot password.
  - **Signed in:** email, the synced children, last sync time, "Sincronizează acum", sign out,
    **delete the cloud account** (deletes `families/{uid}/**` + the Auth user, after confirmation; local data stays), and
    **export** (download JSON of everything stored).
- `/profiles`: a small cloud badge on synced profiles. On a new device after sign-in: "Am găsit 2 copii în cont" → import.
- Never show the parent's email or account UI on child screens.

## 6. Out of scope

Payments, multiple parents per family, teacher access to family data.
