import {
  signInAnonymously,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  deleteUser,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth, firebaseEnabled } from '@/services/firebase';

/* ------------------------------------------------------------------ */
/*  Anonymous auth (children — no account, no PII)                    */
/* ------------------------------------------------------------------ */

/** Ensure an anonymous Firebase Auth session for children */
export async function ensureAnonymousAuth(): Promise<User | null> {
  if (!firebaseEnabled) return null;
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

/* ------------------------------------------------------------------ */
/*  Teacher auth (Google + Email/Password)                            */
/* ------------------------------------------------------------------ */

const googleProvider = new GoogleAuthProvider();

/** Sign in with Google popup */
export async function signInWithGoogle(): Promise<User | null> {
  if (!firebaseEnabled) return null;
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/** Sign in with email and password */
export async function signInWithEmail(email: string, password: string): Promise<User | null> {
  if (!firebaseEnabled) return null;
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

/** Create a new teacher account with email, password, and display name */
export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<User | null> {
  if (!firebaseEnabled) return null;
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName });
  return result.user;
}

/**
 * Re-confirm the signed-in teacher before deleting the account (Firebase requires a recent sign-in).
 * Password accounts pass their password; Google accounts confirm in a popup. Throws on a wrong password.
 */
export async function reauthenticateTeacher(password?: string): Promise<void> {
  if (!firebaseEnabled || !auth.currentUser) throw new Error('not-signed-in');
  const user = auth.currentUser;
  const hasPassword = user.providerData.some((p) => p.providerId === 'password');
  if (hasPassword) {
    if (!user.email || !password) throw new Error('password-required');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    return;
  }
  await reauthenticateWithPopup(user, googleProvider);
}

/** True when the signed-in teacher has an email + password account (so deletion asks for the password). */
export function currentTeacherUsesPassword(): boolean {
  if (!firebaseEnabled || !auth.currentUser) return false;
  return auth.currentUser.providerData.some((p) => p.providerId === 'password');
}

/** Delete the Firebase Auth user of the signed-in teacher. Call only after the teacher's data is gone. */
export async function deleteTeacherAuthUser(): Promise<void> {
  if (!firebaseEnabled || !auth.currentUser) throw new Error('not-signed-in');
  await deleteUser(auth.currentUser);
}

/** Sign out the current user */
export async function logOut(): Promise<void> {
  if (!firebaseEnabled) return;
  await signOut(auth);
}

/** Check if the current user is a teacher (non-anonymous) */
export function isTeacher(): boolean {
  if (!firebaseEnabled || !auth.currentUser) return false;
  return !auth.currentUser.isAnonymous;
}

/* ------------------------------------------------------------------ */
/*  Shared utilities                                                  */
/* ------------------------------------------------------------------ */

/** Subscribe to auth state changes */
export function onAuthChange(callback: (user: User | null) => void) {
  if (!firebaseEnabled) return () => {};
  return onAuthStateChanged(auth, callback);
}

/** Get the current user's UID, or null if not signed in */
export function getCurrentUid(): string | null {
  if (!firebaseEnabled) return null;
  return auth.currentUser?.uid ?? null;
}

/** Get the current Firebase User */
export function getCurrentUser(): User | null {
  if (!firebaseEnabled) return null;
  return auth.currentUser;
}
