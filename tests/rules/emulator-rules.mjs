// Executable security-rules tests against the LOCAL Firebase emulators (never production).
// Drives firestore.rules and database.rules.json with the real client SDK (mock auth tokens) and seeds data with
// firebase-admin (which bypasses rules). Not collected by vitest (no `.test.` in the name).
//
//   npm run rules:test            # starts the emulators, runs this file, stops them
//   node tests/rules/emulator-rules.mjs   # when emulators already run on 127.0.0.1:8080 / :9000
//
// Each case proves either a legit flow still works (ok) or an attack is refused (deny). See docs/SECURITY.md.

import { createHash } from 'node:crypto'
import { initializeApp, deleteApp, setLogLevel as setAppLogLevel } from 'firebase/app'
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs,
  query, where, writeBatch, setLogLevel,
} from 'firebase/firestore'
import { getDatabase, connectDatabaseEmulator, ref, get, set, update, remove } from 'firebase/database'
import { initializeApp as adminInit } from 'firebase-admin/app'
import { getFirestore as adminFirestore } from 'firebase-admin/firestore'
import { getDatabase as adminDatabase } from 'firebase-admin/database'

const PROJECT = 'demo-ludiko'
const HOST = '127.0.0.1'
const FS_PORT = 8080
const DB_PORT = 9000
const DB_URL = `http://${HOST}:${DB_PORT}?ns=${PROJECT}-default-rtdb`

process.env.FIRESTORE_EMULATOR_HOST ??= `${HOST}:${FS_PORT}`
process.env.FIREBASE_DATABASE_EMULATOR_HOST ??= `${HOST}:${DB_PORT}`
process.env.NO_PROXY = [process.env.NO_PROXY, 'localhost', '127.0.0.1'].filter(Boolean).join(',')
process.env.no_proxy = process.env.NO_PROXY
process.env.METADATA_SERVER_DETECTION ??= 'none' // emulator only: no GCE metadata lookups
process.env.GOOGLE_CLOUD_PROJECT ??= PROJECT
setLogLevel('silent')
setAppLogLevel('silent')

const admin = adminInit({ projectId: PROJECT, databaseURL: DB_URL }, 'admin')
const afs = adminFirestore(admin)
const adb = adminDatabase(admin)

/* ------------------------------------------------------------------ contexts */
const apps = []
let appSeq = 0
/** A client signed in as `uid` with `provider` ('anonymous' | 'password' | 'google.com'), or unauthenticated (uid null) */
function as(uid, provider = 'anonymous') {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-api-key', databaseURL: DB_URL }, `c${appSeq++}`)
  apps.push(app)
  const fs = getFirestore(app)
  const db = getDatabase(app)
  const token = uid ? { sub: uid, user_id: uid, firebase: { sign_in_provider: provider } } : undefined
  connectFirestoreEmulator(fs, HOST, FS_PORT, token ? { mockUserToken: token } : undefined)
  connectDatabaseEmulator(db, HOST, DB_PORT, token ? { mockUserToken: token } : undefined)
  return { fs, db }
}

/* ------------------------------------------------------------------ tiny runner */
let passed = 0
const failures = []
let section = ''
const withTimeout = (p, ms = 8000) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])

async function ok(name, fn) {
  try {
    await withTimeout(fn())
    passed++
  } catch (e) {
    failures.push(`[${section}] expected OK: ${name} -> ${e?.code ?? e?.message ?? e}`)
  }
}
async function deny(name, fn) {
  try {
    await withTimeout(fn())
    failures.push(`[${section}] expected DENIED but succeeded: ${name}`)
  } catch (e) {
    const msg = String(e?.code ?? e?.message ?? e)
    if (/permission|PERMISSION_DENIED|permission_denied/i.test(msg)) passed++
    else failures.push(`[${section}] expected permission-denied: ${name} -> ${msg}`)
  }
}
const run = (fn) => fn()
const now = () => Date.now()
const rnd = (n = 20) => Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')
const code6 = (alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789') =>
  Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')

/* ================================================================== FIRESTORE */
async function firestoreTests() {
  const adminUid = 'admin-' + rnd(6)
  const teacherUid = 'teacher-' + rnd(6)
  const otherTeacher = 'teacher2-' + rnd(6)
  const kid = 'kid-' + rnd(6)
  const parentUid = 'parent-' + rnd(6)
  await afs.doc(`admins/${adminUid}`).set({ createdAt: now() })
  await afs.doc(`admins/${kid}`).set({ createdAt: now() }) // an admin doc on an ANONYMOUS uid must still not grant admin

  const A = as(adminUid, 'password')
  const T = as(teacherUid, 'password')
  const G = as(otherTeacher, 'google.com')
  const K = as(kid, 'anonymous')
  const K2 = as('kid2-' + rnd(6), 'anonymous')
  const P = as(parentUid, 'password')
  const U = as(null)

  section = 'admins'
  await ok('admin reads own admins doc', () => getDoc(doc(A.fs, 'admins', adminUid)))
  await deny('teacher reads someone else admins doc', () => getDoc(doc(T.fs, 'admins', adminUid)))
  await deny('anyone creates an admins doc', () => setDoc(doc(T.fs, 'admins', teacherUid), { x: 1 }))
  await deny('list admins', () => getDocs(collection(A.fs, 'admins')))

  section = 'gameHistory'
  await deny('read gameHistory', () => getDocs(collection(K.fs, 'gameHistory')))
  await deny('write gameHistory', () => setDoc(doc(K.fs, 'gameHistory', 'x'), { a: 1 }))

  section = 'teachers'
  const profile = (uid) => ({ uid, email: 'teacher@example.com', displayName: 'Ana P.', createdAt: now() })
  await ok('password teacher creates own profile', () => setDoc(doc(T.fs, 'teachers', teacherUid), profile(teacherUid), { merge: true }))
  await ok('google teacher creates own profile', () => setDoc(doc(G.fs, 'teachers', otherTeacher), profile(otherTeacher), { merge: true }))
  await ok('teacher reads own profile', () => getDoc(doc(T.fs, 'teachers', teacherUid)))
  await deny('teacher reads other teacher profile', () => getDoc(doc(T.fs, 'teachers', otherTeacher)))
  await deny('teacher writes other teacher profile', () => setDoc(doc(T.fs, 'teachers', otherTeacher), profile(otherTeacher)))
  await deny('anonymous session creates a teacher profile (S-03)', () => setDoc(doc(K.fs, 'teachers', kid), profile(kid)))
  await deny('teacher profile with an extra field (S-03)', () => setDoc(doc(T.fs, 'teachers', teacherUid), { role: 'admin' }, { merge: true }))
  await deny('teacher profile with a 5000-char name (S-03)', () => setDoc(doc(T.fs, 'teachers', teacherUid), { displayName: 'x'.repeat(5000) }, { merge: true }))
  await deny('non-admin lists teachers', () => getDocs(collection(T.fs, 'teachers')))
  await ok('admin lists teachers', () => getDocs(collection(A.fs, 'teachers')))
  await deny('anonymous uid with an admins doc lists teachers', () => getDocs(collection(K.fs, 'teachers')))
  await ok('teacher deletes own profile', () => deleteDoc(doc(G.fs, 'teachers', otherTeacher)))

  section = 'sessions (v1)'
  const sessionId = rnd(20)
  const session = {
    teacherUid, title: 'Ora 1', settings: { gameType: 'math' }, classroomMode: 'selfPaced', globalTimer: 0,
    studentCodes: [{ code: 'LION-42', label: 'Student 1' }], status: 'draft', createdAt: now(),
  }
  await ok('teacher creates session', () => setDoc(doc(T.fs, 'sessions', sessionId), session))
  await deny('anonymous session creates a session (S-03)', () => setDoc(doc(K.fs, 'sessions', rnd(20)), { ...session, teacherUid: kid }))
  await deny('create session for another teacher', () => setDoc(doc(K.fs, 'sessions', rnd(20)), session))
  await ok('teacher reads own session', () => getDoc(doc(T.fs, 'sessions', sessionId)))
  await deny('child reads session (labels may be real names)', () => getDoc(doc(K.fs, 'sessions', sessionId)))
  await deny('other teacher updates session', () => updateDoc(doc(G.fs, 'sessions', sessionId), { title: 'x' }))
  await deny('teacher lists ALL sessions (no owner filter)', () => getDocs(collection(T.fs, 'sessions')))
  await ok('teacher lists own sessions', () => getDocs(query(collection(T.fs, 'sessions'), where('teacherUid', '==', teacherUid))))

  section = 'sessionCodes'
  const codeKey = `${sessionId}_LION-42`
  await ok('teacher publishes code', () => setDoc(doc(T.fs, 'sessionCodes', codeKey), { sessionId, teacherUid, code: 'LION-42' }))
  await ok('child gets code by exact key', () => getDoc(doc(K.fs, 'sessionCodes', codeKey)))
  await deny('unauthenticated gets code', () => getDoc(doc(U.fs, 'sessionCodes', codeKey)))
  await deny('child lists codes', () => getDocs(collection(K.fs, 'sessionCodes')))
  await deny('child publishes a code', () => setDoc(doc(K.fs, 'sessionCodes', `${sessionId}_FAKE-1`), { sessionId, teacherUid: kid, code: 'FAKE-1' }))
  await deny('other teacher publishes a code into my session', () => setDoc(doc(G.fs, 'sessionCodes', `${sessionId}_BEAR-11`), { sessionId, teacherUid: otherTeacher, code: 'BEAR-11' }))
  await deny('child deletes a code', () => deleteDoc(doc(K.fs, 'sessionCodes', codeKey)))

  section = 'sessionResults'
  const studentResult = { studentCode: 'LION-42', score: 3, totalQuestions: 5, accuracy: 60, timeTaken: 30, updatedAt: now() }
  await ok('child writes own result for an issued code', () => setDoc(doc(K.fs, 'sessionResults', codeKey), studentResult))
  await deny('child writes result for a code that was never issued', () => setDoc(doc(K.fs, 'sessionResults', `${sessionId}_WOLF-10`), { ...studentResult, studentCode: 'WOLF-10' }))
  await deny('child writes score 99999', () => setDoc(doc(K.fs, 'sessionResults', codeKey), { ...studentResult, score: 99999 }))
  await deny('child reads a result', () => getDoc(doc(K.fs, 'sessionResults', codeKey)))
  await deny('child writes the teacher results doc', () => setDoc(doc(K.fs, 'sessionResults', sessionId), { results: [], savedAt: now() }))
  await ok('teacher saves results doc', () => setDoc(doc(T.fs, 'sessionResults', sessionId), { results: [{ studentCode: 'LION-42' }], savedAt: now() }))
  await ok('teacher reads results', () => getDoc(doc(T.fs, 'sessionResults', sessionId)))
  await ok('teacher reads student result', () => getDoc(doc(T.fs, 'sessionResults', codeKey)))
  await deny('other teacher reads results', () => getDoc(doc(G.fs, 'sessionResults', sessionId)))

  section = 'contentReports'
  const report = {
    itemId: 'mat.add.10#3', skillId: 'mat.add.10', reason: 'typo', comment: 'greșeală', createdAt: now(), status: 'open',
    appVersion: '0.1.0',
    snapshot: { type: 'mcq', prompt: '2+2', options: ['3', '4'], correct: '4', skillId: 'mat.add.10', subject: 'mat', grade: 1, context: 'practice', route: '/learn' },
  }
  const reportId = rnd(16)
  await ok('child sends a report', () => setDoc(doc(K.fs, 'contentReports', reportId), report))
  await deny('unauthenticated sends a report', () => setDoc(doc(U.fs, 'contentReports', rnd(16)), report))
  await deny('report created already resolved', () => setDoc(doc(K.fs, 'contentReports', rnd(16)), { ...report, status: 'resolved' }))
  await deny('report with an unknown field', () => setDoc(doc(K.fs, 'contentReports', rnd(16)), { ...report, uid: kid }))
  await deny('report with a 2000-char comment', () => setDoc(doc(K.fs, 'contentReports', rnd(16)), { ...report, comment: 'x'.repeat(2000) }))
  await deny('report snapshot options holding a huge blob (S-05)', () =>
    setDoc(doc(K.fs, 'contentReports', rnd(16)), { ...report, snapshot: { ...report.snapshot, options: ['x'.repeat(100000)] } }))
  await deny('report snapshot options holding nested maps (S-05)', () =>
    setDoc(doc(K.fs, 'contentReports', rnd(16)), { ...report, snapshot: { ...report.snapshot, options: [{ a: 'b' }] } }))
  await deny('child reads reports', () => getDoc(doc(K.fs, 'contentReports', reportId)))
  await deny('child lists reports', () => getDocs(collection(K.fs, 'contentReports')))
  await deny('child marks a report resolved', () => updateDoc(doc(K.fs, 'contentReports', reportId), { status: 'resolved' }))
  await deny('teacher marks a report resolved', () => updateDoc(doc(T.fs, 'contentReports', reportId), { status: 'resolved' }))
  await deny('anonymous uid that has an admins doc reads reports', () => getDocs(collection(K.fs, 'contentReports')))
  await ok('admin lists reports', () => getDocs(collection(A.fs, 'contentReports')))
  await ok('admin resolves report', () => updateDoc(doc(A.fs, 'contentReports', reportId), { status: 'resolved' }))
  await deny('admin rewrites the comment', () => updateDoc(doc(A.fs, 'contentReports', reportId), { comment: 'x' }))
  await deny('admin deletes report', () => deleteDoc(doc(A.fs, 'contentReports', reportId)))

  section = 'pushSubscriptions'
  const endpoint = `https://fcm.googleapis.com/fcm/send/${rnd(40)}`
  const subId = createHash('sha256').update(endpoint).digest('hex')
  const sub = (ep = endpoint) => ({
    endpoint: ep, keys: { p256dh: 'B' + rnd(80), auth: rnd(22) }, hour: 18, timezone: 'Europe/Bucharest', lang: 'ro',
    active: true, createdAt: now(), updatedAt: now(),
  })
  await ok('device subscribes (FCM endpoint)', () => setDoc(doc(K.fs, 'pushSubscriptions', subId), sub(), { merge: true }))
  for (const ep of [
    `https://updates.push.services.mozilla.com/wpush/v2/${rnd(40)}`,
    `https://web.push.apple.com/${rnd(40)}`,
    `https://wns2-db5p.notify.windows.com/w/?token=${rnd(40)}`,
  ]) {
    await ok(`device subscribes (${new URL(ep).host})`, () =>
      setDoc(doc(K.fs, 'pushSubscriptions', createHash('sha256').update(ep).digest('hex')), sub(ep), { merge: true }))
  }
  await deny('unauthenticated subscribes', () => setDoc(doc(U.fs, 'pushSubscriptions', subId), sub()))
  await deny('subscription created with lastSentDay', () => setDoc(doc(K.fs, 'pushSubscriptions', subId), { ...sub(), lastSentDay: '2026-01-01' }))
  await deny('nobody reads subscriptions', () => getDoc(doc(K.fs, 'pushSubscriptions', subId)))
  await deny('nobody lists subscriptions', () => getDocs(collection(K.fs, 'pushSubscriptions')))
  await ok('device turns reminders off / changes hour', () => updateDoc(doc(K.fs, 'pushSubscriptions', subId), { hour: 9, updatedAt: now() }))
  await deny('client writes lastSentDay', () => updateDoc(doc(K.fs, 'pushSubscriptions', subId), { lastSentDay: '2026-11-28' }))
  await deny('endpoint pointing at an arbitrary https host (S-01 SSRF via the sender)', () => {
    const ep = `https://attacker.example/${rnd(10)}`
    return setDoc(doc(K.fs, 'pushSubscriptions', createHash('sha256').update(ep).digest('hex')), sub(ep))
  })
  await deny('lookalike host fcm.googleapis.com.evil.example (S-01)', () => {
    const ep = `https://fcm.googleapis.com.evil.example/fcm/send/x`
    return setDoc(doc(K.fs, 'pushSubscriptions', createHash('sha256').update(ep).digest('hex')), sub(ep))
  })
  await deny('document id that is not sha256(endpoint) (S-01)', () => setDoc(doc(K.fs, 'pushSubscriptions', 'a'.repeat(64)), sub()))
  await deny('another device re-points an existing subscription to a new endpoint (S-01)', () =>
    updateDoc(doc(K2.fs, 'pushSubscriptions', subId), { endpoint: `https://fcm.googleapis.com/fcm/send/${rnd(40)}` }))
  await afs.doc(`pushSubscriptions/${subId}`).update({ lastSentDay: '2026-11-27' }) // the sender (admin SDK)
  await ok('device updates a doc the sender already touched (lastSentDay unchanged)', () =>
    updateDoc(doc(K.fs, 'pushSubscriptions', subId), { lastPlayedDay: '2026-11-28', updatedAt: now() }))
  await ok('device unsubscribes', () => deleteDoc(doc(K.fs, 'pushSubscriptions', subId)))

  section = 'templates (legacy)'
  await afs.doc('templates/tpl1').set({ teacherUid, name: 'x' })
  await ok('owner lists templates', () => getDocs(query(collection(T.fs, 'templates'), where('teacherUid', '==', teacherUid))))
  await deny('other teacher reads template', () => getDoc(doc(G.fs, 'templates', 'tpl1')))
  await deny('owner creates template', () => setDoc(doc(T.fs, 'templates', 'tpl2'), { teacherUid, name: 'y' }))
  await ok('owner deletes template', () => deleteDoc(doc(T.fs, 'templates', 'tpl1')))

  section = 'classes'
  const classId = rnd(20)
  const seat = code6()
  const seat2 = code6()
  await ok('teacher creates class + seats + join codes (batch)', async () => {
    const b = writeBatch(T.fs)
    b.set(doc(T.fs, 'classes', classId), { teacherUid, name: 'a II-a B', grade: 2, createdAt: now() })
    await b.commit()
    const b2 = writeBatch(T.fs)
    for (const s of [seat, seat2]) {
      b2.set(doc(T.fs, 'classes', classId, 'seats', s), { label: 'A.P.', joinCode: s, linked: false })
      b2.set(doc(T.fs, 'joinCodes', s), { classId, className: 'a II-a B' })
    }
    await b2.commit()
  })
  await deny('anonymous session creates a class', () => setDoc(doc(K.fs, 'classes', rnd(20)), { teacherUid: kid, name: 'x', grade: 1, createdAt: now() }))
  await deny('class with extra field', () => setDoc(doc(T.fs, 'classes', rnd(20)), { teacherUid, name: 'x', grade: 1, createdAt: now(), extra: 1 }))
  await deny('child reads class doc', () => getDoc(doc(K.fs, 'classes', classId)))
  await deny('other teacher reads class doc', () => getDoc(doc(G.fs, 'classes', classId)))
  await deny('other teacher steals the class (teacherUid change)', () => updateDoc(doc(T.fs, 'classes', classId), { teacherUid: otherTeacher }))
  await deny('child lists all classes', () => getDocs(collection(K.fs, 'classes')))
  await ok('child gets joinCodes/{code}', () => getDoc(doc(K.fs, 'joinCodes', seat)))
  await deny('child lists joinCodes', () => getDocs(collection(K.fs, 'joinCodes')))
  await deny('child creates a join code for a class', () => setDoc(doc(K.fs, 'joinCodes', code6()), { classId, className: 'x' }))
  await deny('teacher overwrites a join code', () => setDoc(doc(T.fs, 'joinCodes', seat), { classId, className: 'renamed' }))
  await deny('other teacher creates a join code into my class', () => setDoc(doc(G.fs, 'joinCodes', code6()), { classId, className: 'x' }))
  await deny('child reads seats', () => getDocs(collection(K.fs, 'classes', classId, 'seats')))
  await deny('child writes progress before linking', () => setDoc(doc(K.fs, 'classes', classId, 'progress', seat), { subjects: {}, playDaysThisWeek: 1, updatedAt: now() }))
  await ok('child links the seat (false -> true)', () => updateDoc(doc(K.fs, 'classes', classId, 'seats', seat), { linked: true, linkedAt: now() }))
  await deny('second device re-links / changes linkedAt', () => updateDoc(doc(K2.fs, 'classes', classId, 'seats', seat), { linked: true, linkedAt: now() + 1 }))
  await deny('child renames the seat label', () => updateDoc(doc(K.fs, 'classes', classId, 'seats', seat2), { label: 'Hacked' }))
  await deny('child unlinks (true -> false)', () => updateDoc(doc(K.fs, 'classes', classId, 'seats', seat), { linked: false }))
  const progress = { subjects: { mat: { level: { grade: 2, semester: 1 }, missingCount: 3, skills: { 'mat.add.10': 'mastered' } } }, playDaysThisWeek: 3, updatedAt: now() }
  await ok('linked child writes progress summary', () => setDoc(doc(K.fs, 'classes', classId, 'progress', seat), progress))
  await deny('progress with nickname field', () => setDoc(doc(K.fs, 'classes', classId, 'progress', seat), { ...progress, nickname: 'Ana' }))
  await deny('progress with an unknown skill state', () => setDoc(doc(K.fs, 'classes', classId, 'progress', seat), { ...progress, subjects: { mat: { skills: { a: 'x'.repeat(500) } } } }))
  await deny('child reads progress', () => getDoc(doc(K.fs, 'classes', classId, 'progress', seat)))
  await ok('teacher reads progress', () => getDocs(collection(T.fs, 'classes', classId, 'progress')))
  await ok('teacher creates assignment', () => setDoc(doc(T.fs, 'classes', classId, 'assignments', 'a1'), { subject: 'mat', skillIds: ['mat.add.10'], title: 'Adunări', dueDay: '2026-12-01', createdAt: now() }))
  await ok('linked child reads assignments', () => getDocs(collection(K.fs, 'classes', classId, 'assignments')))
  await deny('child writes assignment', () => setDoc(doc(K.fs, 'classes', classId, 'assignments', 'a2'), { subject: 'mat', skillIds: ['x'], title: 'x', dueDay: '2026-12-01', createdAt: now() }))
  await ok('teacher unlinks a seat (delete seat + join code)', async () => {
    const b = writeBatch(T.fs)
    b.delete(doc(T.fs, 'classes', classId, 'seats', seat2))
    b.delete(doc(T.fs, 'joinCodes', seat2))
    await b.commit()
  })
  await ok('child leaves: deletes own progress', () => deleteDoc(doc(K.fs, 'classes', classId, 'progress', seat)))

  section = 'families'
  const childId = 'p_' + rnd(10)
  const child = {
    profile: { id: childId, nickname: 'Vulpița', avatar: '🦊', grade: 2, language: 'ro', createdAt: now(), updatedAt: now() },
    progress: { profileId: childId, skills: {}, stars: 3, stickers: [], playDays: [] },
    updatedAt: now(), deviceId: rnd(16),
  }
  await ok('parent creates family consent', () => setDoc(doc(P.fs, 'families', parentUid), { consentAt: now(), consentVersion: '2026-05', createdAt: now(), updatedAt: now() }))
  await ok('parent syncs a child', () => setDoc(doc(P.fs, 'families', parentUid, 'children', childId), child))
  await ok('parent reads children', () => getDocs(collection(P.fs, 'families', parentUid, 'children')))
  await deny('anonymous session with the same uid reads family', () => getDoc(doc(as(parentUid, 'anonymous').fs, 'families', parentUid)))
  await deny('google sign-in with the same uid reads family', () => getDoc(doc(as(parentUid, 'google.com').fs, 'families', parentUid)))
  await deny('other parent reads family', () => getDocs(collection(T.fs, 'families', parentUid, 'children')))
  await deny('other parent writes a child into my family', () => setDoc(doc(T.fs, 'families', parentUid, 'children', 'p_x'), { ...child, profile: { ...child.profile, id: 'p_x' }, progress: { ...child.progress, profileId: 'p_x' } }))
  await deny('child doc with recoveryCode', () => setDoc(doc(P.fs, 'families', parentUid, 'children', childId), { ...child, profile: { ...child.profile, recoveryCode: 'AAAA-BBBB-CCCC' } }))
  await deny('family createdAt rewritten', () => updateDoc(doc(P.fs, 'families', parentUid), { createdAt: 1 }))
}

/* ================================================================== REALTIME DATABASE */
async function rtdbTests() {
  const hostUid = 'host-' + rnd(6)
  const guestUid = 'guest-' + rnd(6)
  const strangerUid = 'stranger-' + rnd(6)
  const H = as(hostUid)
  const Gu = as(guestUid)
  const S = as(strangerUid)
  const U = as(null)
  const roomId = rnd(20)
  const code = code6('ABCDEFGHJKLMNPQRSTUVWXYZ23456789')
  const player = (id, isHost = false) => ({ id, name: 'Vulpea Veselă', avatar: '🦊', score: 0, isHost, isReady: false, joinedAt: now() })
  const room = {
    code, hostId: hostUid, status: 'waiting', createdAt: now(),
    settings: { gameType: 'math', gameMode: 'race', difficulty: 'easy', rounds: 10, timePerRound: 30, operations: ['+', '-'] },
    players: { [hostUid]: player(hostUid, true) },
  }

  section = 'rtdb rooms'
  await ok('host creates room', () => set(ref(H.db, `rooms/${roomId}`), room))
  await ok('host claims room code', () => set(ref(H.db, `roomCodes/${code}`), { roomId, hostId: hostUid, createdAt: now() }))
  await deny('list /rooms', () => get(ref(S.db, 'rooms')))
  await deny('list /roomCodes', () => get(ref(S.db, 'roomCodes')))
  await deny('unauthenticated reads room', () => get(ref(U.db, `rooms/${roomId}`)))
  await ok('signed-in device reads room code by key', () => get(ref(Gu.db, `roomCodes/${code}`)))
  await ok('signed-in device reads room by id', () => get(ref(Gu.db, `rooms/${roomId}`)))
  await deny('stranger creates room with someone else as host', () => set(ref(S.db, `rooms/${rnd(20)}`), room))
  await deny('stranger overwrites existing room', () => set(ref(S.db, `rooms/${roomId}`), { ...room, hostId: strangerUid, players: { [strangerUid]: player(strangerUid, true) } }))
  await deny('stranger takes over a fresh room code', () => set(ref(S.db, `roomCodes/${code}`), { roomId: rnd(20), hostId: strangerUid, createdAt: now() }))
  await ok('guest joins (own player entry)', () => set(ref(Gu.db, `rooms/${roomId}/players/${guestUid}`), player(guestUid)))
  await ok('guest adds a second local player `{uid}_2`', () => set(ref(Gu.db, `rooms/${roomId}/players/${guestUid}_2`), player(`${guestUid}_2`)))
  await deny('guest floods the room with `{uid}_N` players (S-06)', () => set(ref(Gu.db, `rooms/${roomId}/players/${guestUid}_9`), player(`${guestUid}_9`)))
  await deny('guest writes another player entry', () => set(ref(Gu.db, `rooms/${roomId}/players/${hostUid}`), player(hostUid)))
  await deny('guest makes themself host', () => set(ref(Gu.db, `rooms/${roomId}/players/${guestUid}`), player(guestUid, true)))
  await deny('guest with a 500-char name', () => set(ref(Gu.db, `rooms/${roomId}/players/${guestUid}`), { ...player(guestUid), name: 'x'.repeat(500) }))
  await deny('guest with an extra field', () => set(ref(Gu.db, `rooms/${roomId}/players/${guestUid}`), { ...player(guestUid), html: '<img>' }))
  await deny('guest changes settings', () => set(ref(Gu.db, `rooms/${roomId}/settings/rounds`), 99))
  await deny('guest starts the game (status playing)', () => set(ref(Gu.db, `rooms/${roomId}/status`), 'playing'))
  await ok('host starts the game', () => update(ref(H.db, `rooms/${roomId}`), { status: 'playing', game: { phase: 'playing', questions: [1, 2] } }))
  await ok('guest records own progress', () => set(ref(Gu.db, `rooms/${roomId}/game/progress/${guestUid}`), 3))
  await deny('guest records host progress', () => set(ref(Gu.db, `rooms/${roomId}/game/progress/${hostUid}`), 3))
  await deny('stranger (not in room) records progress', () => set(ref(S.db, `rooms/${roomId}/game/progress/${strangerUid}`), 3))
  await deny('guest progress 5000', () => set(ref(Gu.db, `rooms/${roomId}/game/progress/${guestUid}`), 5000))
  await deny('guest rewrites questions', () => set(ref(Gu.db, `rooms/${roomId}/game/questions`), [9]))
  await ok('guest finishes the game', () => set(ref(Gu.db, `rooms/${roomId}/game/phase`), 'finished'))
  await deny('stranger finishes the game', () => set(ref(S.db, `rooms/${roomId}/game/phase`), 'finished'))
  await ok('guest sends room back to waiting (replay)', () => set(ref(Gu.db, `rooms/${roomId}/status`), 'waiting'))
  await deny('stranger joins after the game started', async () => {
    await set(ref(H.db, `rooms/${roomId}/status`), 'playing')
    await set(ref(S.db, `rooms/${roomId}/players/${strangerUid}`), player(strangerUid))
  })
  await deny('host sets createdAt far in the future (room never expires, S-07)', () => set(ref(H.db, `rooms/${rnd(20)}`), { ...room, createdAt: now() + 365 * 86400000 }))
  await deny('host squats a code with future createdAt (S-07)', () => set(ref(H.db, `roomCodes/${code6('ABCDEFGHJKLMNPQRSTUVWXYZ23456789')}`), { roomId, hostId: hostUid, createdAt: now() + 365 * 86400000 }))
  await deny('room code with invalid pattern', () => set(ref(H.db, 'roomCodes/0OOOO0'), { roomId, hostId: hostUid, createdAt: now() }))

  section = 'rtdb expired'
  const oldRoom = rnd(20)
  const oldCode = code6('ABCDEFGHJKLMNPQRSTUVWXYZ23456789')
  await adb.ref(`rooms/${oldRoom}`).set({ ...room, code: oldCode, createdAt: now() - 7 * 3600000 })
  await adb.ref(`roomCodes/${oldCode}`).set({ roomId: oldRoom, hostId: hostUid, createdAt: now() - 7 * 3600000 })
  await deny('join a room older than 6 hours', () => set(ref(Gu.db, `rooms/${oldRoom}/players/${guestUid}`), player(guestUid)))
  await ok('stale room code can be taken over', () => set(ref(S.db, `roomCodes/${oldCode}`), { roomId: rnd(20), hostId: strangerUid, createdAt: now() }))
  await ok('host deletes room', () => remove(ref(H.db, `rooms/${roomId}`)))
  await ok('host removes own room code', () => remove(ref(H.db, `roomCodes/${code}`)))
}

/* ================================================================== main */
try {
  await run(firestoreTests)
  await run(rtdbTests)
} catch (e) {
  failures.push(`harness error: ${e?.stack ?? e}`)
}
await Promise.allSettled(apps.map((a) => deleteApp(a)))
console.log(`\nrules tests: ${passed} passed, ${failures.length} failed`)
for (const f of failures) console.log('  ✗ ' + f)
process.exit(failures.length ? 1 : 0)
