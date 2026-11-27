import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Speech rate: slightly slower than normal, easier for children to follow */
export const READ_ALOUD_RATE = 0.9;

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return null;
  return window.speechSynthesis ?? null;
}

/** BCP-47 prefix wanted for a UI language: Romanian UI reads in ro-RO, anything else in English */
function wantedPrefix(uiLang: string): 'ro' | 'en' {
  return uiLang.toLowerCase().startsWith('ro') ? 'ro' : 'en';
}

function pickVoice(synth: SpeechSynthesis, prefix: 'ro' | 'en', preferGb = false): SpeechSynthesisVoice | null {
  const voices = synth.getVoices?.() ?? [];
  const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-');
  const matching = voices.filter((v) => norm(v).startsWith(prefix));
  // Forced English (English as a subject): British first, as taught in Romanian schools
  const wanted = prefix === 'ro' ? ['ro-ro'] : preferGb ? ['en-gb', 'en-us'] : ['en-us'];
  for (const w of wanted) {
    const hit = matching.find((v) => norm(v) === w);
    if (hit) return hit;
  }
  return matching[0] ?? null;
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
 * Speech stops on unmount, so it never leaks into the next item.
 * `forceLang: 'en'` speaks English whatever the UI language (English as a subject, see englishSpeech.ts).
 */
export function useReadAloud(forceLang?: 'en'): ReadAloud {
  const { i18n } = useTranslation();
  const prefix = forceLang ?? wantedPrefix(i18n.language || 'ro');
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const synth = getSynth();
    if (!synth) {
      setVoice(null);
      return;
    }
    const refresh = () => setVoice(pickVoice(synth, prefix, forceLang === 'en'));
    refresh();
    // Voices often load asynchronously
    synth.addEventListener?.('voiceschanged', refresh);
    return () => synth.removeEventListener?.('voiceschanged', refresh);
  }, [prefix, forceLang]);

  const stop = useCallback(() => {
    getSynth()?.cancel();
    setSpeaking(false);
  }, []);

  // Never keep talking after the item/frame is gone
  useEffect(
    () => () => {
      getSynth()?.cancel();
    },
    [],
  );

  const speak = useCallback(
    (text: string) => {
      const synth = getSynth();
      if (!synth || !voice || !text.trim()) return;
      try {
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.voice = voice;
        u.lang = voice.lang;
        u.rate = READ_ALOUD_RATE;
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        setSpeaking(true);
        synth.speak(u);
      } catch {
        setSpeaking(false);
      }
    },
    [voice],
  );

  return { available: voice !== null, speaking, speak, stop };
}
