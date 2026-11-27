import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgeBand } from '@/older/ageBand';
import { useSettingsStore } from '@/store/settingsStore';
import { effectiveRate, getSynth, speakQueue } from './speechEngine';
import { pickBestVoice } from './voiceRanking';
import { useVoices } from './useVoices';

/** Default ro rate (kept for callers/tests); see speechEngine.defaultRate for per-band values */
export const READ_ALOUD_RATE = 0.95;

/** BCP-47 prefix wanted for a UI language: Romanian UI reads in ro-RO, anything else in English */
function wantedPrefix(uiLang: string): 'ro' | 'en' {
  return uiLang.toLowerCase().startsWith('ro') ? 'ro' : 'en';
}

export interface ReadAloud {
  /** True only when the browser has a voice for the current UI language. When false, show no button at all. */
  available: boolean;
  speaking: boolean;
  speak: (text: string) => void;
  stop: () => void;
}

/**
 * "Citește-mi": Web Speech API wrapper. `available` is false when speechSynthesis or a matching
 * ro-RO (en-* for the English UI) voice is missing, so callers can hide their button.
 * The voice is the parent's choice from Settings, else the best-ranked on the device. Text is normalised
 * (math, symbols) and spoken as a sentence queue. Speech stops on unmount, so it never leaks into the next item.
 * `forceLang: 'en'` speaks English whatever the UI language (English as a subject, see englishSpeech.ts).
 * `band` (optional) slows speech slightly for the youngest children.
 */
export function useReadAloud(forceLang?: 'en', band?: AgeBand): ReadAloud {
  const { i18n } = useTranslation();
  const prefix = forceLang ?? wantedPrefix(i18n.language || 'ro');
  const voices = useVoices(prefix, forceLang === 'en');
  const preferredURI = useSettingsStore((s) => (prefix === 'ro' ? s.voiceRo : s.voiceEn));
  const userRate = useSettingsStore((s) => s.voiceRate);
  const voice = voices.length ? pickBestVoice(voices, prefix, { preferGb: forceLang === 'en', preferredURI }) : null;
  const [speaking, setSpeaking] = useState(false);
  const token = useRef(0);

  const stop = useCallback(() => {
    token.current++;
    getSynth()?.cancel();
    setSpeaking(false);
  }, []);

  // Never keep talking after the item/frame is gone
  useEffect(
    () => () => {
      token.current++;
      getSynth()?.cancel();
    },
    [],
  );

  const speak = useCallback(
    (text: string) => {
      const synth = getSynth();
      if (!synth || !voice || !text.trim()) return;
      const mine = ++token.current;
      try {
        const started = speakQueue(synth, text, voice, prefix, effectiveRate(userRate, prefix, band), () => {
          if (token.current === mine) setSpeaking(false);
        });
        setSpeaking(started);
      } catch {
        setSpeaking(false);
      }
    },
    [voice, prefix, userRate, band],
  );

  return { available: voice !== null, speaking, speak, stop };
}
