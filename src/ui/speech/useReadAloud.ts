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

function pickVoice(synth: SpeechSynthesis, prefix: 'ro' | 'en'): SpeechSynthesisVoice | null {
  const voices = synth.getVoices?.() ?? [];
  const match = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-').startsWith(prefix);
  const matching = voices.filter(match);
  return (
    matching.find((v) => v.lang.toLowerCase().replace('_', '-') === (prefix === 'ro' ? 'ro-ro' : 'en-us')) ??
    matching[0] ??
    null
  );
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
 */
export function useReadAloud(): ReadAloud {
  const { i18n } = useTranslation();
  const prefix = wantedPrefix(i18n.language || 'ro');
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const synth = getSynth();
    if (!synth) {
      setVoice(null);
      return;
    }
    const refresh = () => setVoice(pickVoice(synth, prefix));
    refresh();
    // Voices often load asynchronously
    synth.addEventListener?.('voiceschanged', refresh);
    return () => synth.removeEventListener?.('voiceschanged', refresh);
  }, [prefix]);

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
