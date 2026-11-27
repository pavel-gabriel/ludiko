import { useEffect, useState } from 'react';
import { getSynth } from './speechEngine';
import { rankVoices, type VoicePrefix } from './voiceRanking';

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

/** Installed voices of a language, best first. Handles async `voiceschanged` (and Chrome never firing it). */
export function useVoices(prefix: VoicePrefix, preferGb = false): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const synth = getSynth();
    if (!synth) {
      setVoices([]);
      return;
    }
    const refresh = () => setVoices(rankVoices(synth.getVoices?.() ?? [], prefix, { preferGb, online: isOnline() }));
    refresh();
    synth.addEventListener?.('voiceschanged', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    const retries = [400, 1500].map((ms) => setTimeout(refresh, ms));
    return () => {
      synth.removeEventListener?.('voiceschanged', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
      retries.forEach(clearTimeout);
    };
  }, [prefix, preferGb]);
  return voices;
}
