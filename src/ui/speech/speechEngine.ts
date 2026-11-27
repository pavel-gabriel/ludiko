import type { AgeBand } from '@/older/ageBand';
import { prepareSpeech } from './speechText';
import type { VoicePrefix } from './voiceRanking';

export function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return null;
  return window.speechSynthesis ?? null;
}

/** Speed limits offered in Settings */
export const RATE_MIN = 0.8;
export const RATE_MAX = 1.1;

/** Default speech rate: ro 0.95 (small kids a little slower), English as a subject 0.9 */
export function defaultRate(prefix: VoicePrefix, band?: AgeBand): number {
  if (prefix === 'en') return band === 'small' ? 0.85 : 0.9;
  return band === 'small' ? 0.9 : 0.95;
}

export function effectiveRate(userRate: number | null | undefined, prefix: VoicePrefix, band?: AgeBand): number {
  if (typeof userRate === 'number' && Number.isFinite(userRate)) return Math.min(RATE_MAX, Math.max(RATE_MIN, userRate));
  return defaultRate(prefix, band);
}

/**
 * Speak `text` as a queue of short utterances (normalised, split into sentences). `onDone` fires once when the
 * last one ends or any errors. Returns false if nothing was spoken.
 */
export function speakQueue(
  synth: SpeechSynthesis,
  text: string,
  voice: SpeechSynthesisVoice,
  prefix: VoicePrefix,
  rate: number,
  onDone: () => void,
): boolean {
  const chunks = prepareSpeech(text, prefix);
  if (!chunks.length) return false;
  synth.cancel();
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    onDone();
  };
  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = rate;
    u.pitch = 1;
    u.onend = i === chunks.length - 1 ? done : null;
    u.onerror = done;
    synth.speak(u);
  });
  return true;
}
