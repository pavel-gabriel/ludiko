import { create } from 'zustand';
import type { TeacherProfile } from '@/utils/types';

interface AuthState {
  /** Firebase user UID (set after sign-in) */
  uid: string | null;
  /** Teacher profile from Firestore (null = not a teacher or not loaded) */
  teacherProfile: TeacherProfile | null;
  /** True while auth state is loading */
  loading: boolean;
  setUid: (uid: string | null) => void;
  setTeacherProfile: (profile: TeacherProfile | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  uid: null,
  teacherProfile: null,
  loading: true,
  setUid: (uid) => set({ uid }),
  setTeacherProfile: (teacherProfile) => set({ teacherProfile }),
  setLoading: (loading) => set({ loading }),
  reset: () => set({ uid: null, teacherProfile: null, loading: false }),
}));
