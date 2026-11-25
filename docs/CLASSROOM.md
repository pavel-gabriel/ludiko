# Classroom: teacher class view & assignments — contract

> Status: agreed design (Phase 1C). Privacy rules from `docs/PLAN.md` §11 apply: no child names,
> emails or birth dates reach the server. Progress stays local-first; a class link shares only a
> **skill-state summary**, and only after the child's device joins a teacher's class.

## 1. Concepts

- **Class:** created by a signed-in teacher (existing email auth in `src/components/teacher`).
- **Seat:** one per child, created by the teacher with a **label the teacher chooses** (e.g. initials
  "A.M." or a number) and a **join code** (existing `StudentCode` format). Ludiko never asks for the
  child's real name.
- **Link:** on the child's device, the parent or child enters the join code in the profile
  (`/profiles` → profile settings → "Clasa mea"). The device stores `classLink` in the local profile
  and from then on syncs a summary.
- **Assignment ("Tema"):** the teacher picks skills (or a whole subject level) and a due day; linked
  children see it on `/learn` as an extra bit, "Tema de la clasă".

## 2. Firestore

```
classes/{classId}
  teacherUid: string
  name: string                 // e.g. "Clasa a III-a B"
  grade: number                // 0–8
  createdAt: number

classes/{classId}/seats/{seatId}
  label: string                // teacher-chosen, ≤ 20 chars, NOT a real name requirement
  joinCode: string             // 6 chars, globally unique; the seat id equals the code (see §6)
  linked: boolean
  linkedAt?: number

classes/{classId}/progress/{seatId}       // written by the linked child device only
  subjects: { [subject: string]: {
    level?: { grade: number; semester: 1 | 2 };
    missingCount?: number;
    skills: { [skillId: string]: 'unknown' | 'gap' | 'learning' | 'practised' | 'mastered' };
  } }
  playDaysThisWeek: number
  updatedAt: number

classes/{classId}/assignments/{assignmentId}
  subject: string
  skillIds: string[]           // 1–10 skills
  title: string                // ≤ 60 chars
  dueDay: 'YYYY-MM-DD'
  createdAt: number
```

**Never in Firestore:** profile nickname, avatar, recovery code, item-level answers, or timestamps
finer than `updatedAt`.

## 3. Rules (summary)

- `classes/{classId}`: the teacher (uid == `teacherUid`) creates, reads, updates and deletes. Linked
  children cannot read the class doc beyond what the join flow needs (see below).
- `seats`: the teacher has full access. **Join:** an authenticated (anonymous) device may update one
  seat **only** to set `linked: true` and `linkedAt`, when it presents the right `joinCode`. Implement
  this either with the code as part of the doc id (`seatId = joinCode`) or by validating
  `resource.data.joinCode == request.resource.data.joinCode` plus a field allowlist. Choose the
  simpler secure option and document it.
- `progress/{seatId}`: write by any authenticated device whose request carries the seat's joinCode
  (store `joinCode` inside the progress doc and validate it against the seat via `get()`); the
  teacher may read. Field allowlist and sizes are validated.
- `assignments`: the teacher writes. A linked device reads by classId (it knows its classId from the
  join).

## 4. Client modules

- `src/classroom/classroomService.ts` (lazy, Firebase): teacher CRUD (classes, seats, assignments,
  read progress); child `joinClass(code)`, `syncProgress(profileId)` (throttled to at most once
  every 10 min, on finishing a bit or a placement), `getAssignments(classLink)`, `leaveClass()`.
- The local profile gains an optional `classLink?: { classId; seatId; joinCode; className }`.
- `learnerService` gains `getClassAssignments(profileId)`. Assigned skills appear as an extra bit
  (`kind: 'assignment'`). Mastery updates work the same as for any other bit.

## 5. Teacher UI (in `/teacher`)

- Classes list → class page with **competence heatmap**: rows are seats (labels), columns are skills
  grouped by grade, cells are state colour plus an icon (never colour alone). Summary at the top:
  "6 elevi au lacune la *Scăderea cu împrumut până la 100*".
- Group suggestion: seats sharing the same deepest gap.
- Assign: choose skills from a gap column or the skill list, set a due day, see completion
  (practised/mastered per seat).
- Seats: add (label), print join codes (a simple printable page), unlink.
- Export: CSV of the heatmap (labels only).


## 6. As built (Phase 1C implementation notes)

### Seat-join approach (decided)

The join code **is** the seat's document id (`seatId == joinCode`), and a get-only index document lets a
device that knows only the code find its class:

```
joinCodes/{code}                { classId, className }       // get: any signed-in device; list/update: denied
classes/{classId}/seats/{code}  { label, joinCode, linked, linkedAt? }
```

Join flow on the child device (anonymous Firebase auth):

1. `getDoc(joinCodes/{code})` gives `classId` and `className` (no other class data is readable by the child).
2. `updateDoc(classes/{classId}/seats/{code}, { linked: true, linkedAt })`. The rules allow this single update
   from any signed-in device, **once** (`linked` must be `false` before, `true` after, only those two keys
   change). A second device with the same code is refused (`already-used`).
3. The profile stores `classLink = { classId, seatId, joinCode, className }`; `seatId == joinCode`.

Why this instead of a collection-group query on `joinCode`: a `list` rule that lets a device query all seats by
code cannot be written without also letting it enumerate every class's seats; `get` by id cannot be enumerated.
Codes are 6 characters from a 31-symbol alphabet, globally unique (the batch that creates a seat + index entry
fails if the code is taken, and a new one is drawn).

- **Progress write:** allowed for any signed-in device while the seat (`classes/{c}/seats/{seatId}`) exists
  with `linked == true`, plus the field allowlist/size checks. Because `seatId == joinCode`, the capability is the
  document id: no separate `joinCode` field is stored in `progress` (deviation from the first sketch in §3).
- **Unlink (teacher):** deletes the seat, its progress and its index entry and creates a **new seat with a new
  code** and the same label. The old device can no longer sync; on its next sync it sees the missing index entry and
  drops its `classLink` (`syncProgress` returns `revoked`).
- **Leave (child):** best-effort delete of the progress document (the child may erase their own summary), then the
  local `classLink` and caches are removed. The seat stays `linked` until the teacher unlinks it, so a code works for
  one device only.
- **Assignments:** readable by any signed-in device that knows the (unguessable) `classId`; written by the teacher.
  They carry no personal data.
- **Class creation** requires a non-anonymous sign-in, so a child's anonymous session cannot create classes.

### Known limitations

- Security rules cannot loop over map entries: `progress.subjects.*.skills` values are validated as a set
  (`values().hasOnly([...])`) and the map size is capped (400 per subject), keys and `assignments.skillIds`
  elements are not checked individually. A malicious holder of a join code could write junk skill ids into **their
  own** seat's summary; nothing else is reachable.
- A join code is a bearer secret: whoever holds an unused code can link their device to that seat. Single use and
  teacher unlink limit this; the teacher prints the codes (labels are initials or numbers, never required names).
- Rules are not emulated in CI (`tests/classroomRules.test.ts` only keeps the rules file in step with the client's
  limits and checks balance); client doc shapes are tested exactly (`tests/classroomService.test.ts`). Deploy the
  rules and try a join with a real project before relying on it.
- Assignments are class-wide (no `seatIds` in the contract). "Group suggestions" tell the teacher whom to pull
  together; the assignment itself goes to everybody, and pupils who already practised the skill see it as done.
- Progress is a snapshot (`setDoc`), at most once per 10 minutes, after a finished bit, assignment round or
  placement (plus a trailing sync while the app stays open, and on opening `/learn`). A tab closed within the
  throttle window delivers its last changes on the next open.

### Contract additions (nothing existing changed)

- `src/profiles/types.ts`: `ClassLink`, `ChildProfile.classLink?`; `profileService`: `setClassLink`,
  `sanitizeClassLink` (backups keep a well-formed link, drop a malformed one).
- `src/learner/contract.ts`: `AssignmentBit`, `AssignmentSkill`, `LearnerService.getClassAssignments(profileId, now?)`
  (from the locally cached copy, empty without a link). Assignments are a separate `kind: 'assignment'` card with
  its own route `/learn/class/:assignmentId`, not a member of `BitKind`: the existing `Bit`/`BitKind` types are
  unchanged.
- `src/classroom/*`: `types.ts` (docs, limits, `ClassroomApi`), `classroomService.ts` (Firebase, lazy),
  `syncGate.ts` (Firebase-free triggers: `triggerClassSync`, `refreshClassData`), `progressSummary.ts`
  (`buildClassProgress`), `heatmap.ts` (pure aggregation, CSV), `assignmentCache.ts`, `api.ts` (lazy access and
  test/fixture override), `dev/` (fixture for `/dev/classroom`).
- Routes: `/teacher/classes`, `/teacher/classes/:classId`, `/teacher/classes/:classId/codes`,
  `/learn/class/:assignmentId`, `/dev/classroom` (all lazy).
- i18n: top-level `classroom` namespace in `ro.json` and `en.json`.
