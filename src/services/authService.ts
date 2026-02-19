import { signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/services/firebase';

/**
 * Ensure the user has a Firebase Auth session.
 * For kids (Phase 1a): anonymous sign-in — no account, no PII.
 * For teachers (Phase 1c): will add Google / email sign-in here.
 *
 * Returns the Firebase User object.
 */
export async function ensureAnonymousAuth(): Promise<User> {
  /* If already signed in, return current user */
  if (auth.currentUser) return auth.currentUser;

  const credential = await signInAnonymously(auth);
  return credential.user;
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 */
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/** Get the current user's UID, or null if not signed in */
export function getCurrentUid(): string | null {
  return auth.currentUser?.uid ?? null;
}
