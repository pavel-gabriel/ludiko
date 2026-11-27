import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserPreferences, Language } from '@/utils/types';

interface SettingsState extends UserPreferences {
  setLanguage: (language: Language) => void;
  toggleDyslexicFont: () => void;
  toggleSound: () => void;
  setVoice: (lang: 'ro' | 'en', voiceURI: string | null) => void;
  setVoiceRate: (rate: number | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'ro',
      dyslexicFont: false,
      soundEnabled: true,
      voiceRo: null,
      voiceEn: null,
      voiceRate: null,
      setLanguage: (language) => set({ language }),
      toggleDyslexicFont: () => set((state) => ({ dyslexicFont: !state.dyslexicFont })),
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      setVoice: (lang, voiceURI) => set(lang === 'ro' ? { voiceRo: voiceURI } : { voiceEn: voiceURI }),
      setVoiceRate: (voiceRate) => set({ voiceRate }),
    }),
    { name: 'ludiko-settings' },
  ),
);
