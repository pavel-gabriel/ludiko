import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getDatabase, type Database } from 'firebase/database';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** True when all required Firebase env vars are present */
export const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _rtdb: Database | null = null;
let _auth: Auth | null = null;

if (firebaseEnabled) {
  app = initializeApp(firebaseConfig);
  _db = getFirestore(app);
  _rtdb = getDatabase(app);
  _auth = getAuth(app);
}

/** Firestore — persistent data (history, templates, scores) */
export const db = _db as Firestore;

/** Realtime Database — live room state, player positions, leaderboard sync */
export const rtdb = _rtdb as Database;

/** Firebase Auth — anonymous for kids, Google/email for teachers */
export const auth = _auth as Auth;

export default app;
