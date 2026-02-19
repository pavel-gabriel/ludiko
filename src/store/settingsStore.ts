import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserPreferences, Language } from '@/utils/types';

interface SettingsState extends UserPreferences {
  setLanguage: (language: Language) => void;
  toggleDyslexicFont: () => void;
  toggleSound: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'ro',
      dyslexicFont: false,
      soundEnabled: true,
      setLanguage: (language) => set({ language }),
      toggleDyslexicFont: () => set((state) => ({ dyslexicFont: !state.dyslexicFont })),
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
    }),
    { name: 'ludiko-settings' },
  ),
);
