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
  joinCode: string             // 6 chars, unique within the class (lookup via collection group query)
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
