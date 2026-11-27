/**
 * Voice quality ranking. Browsers expose very different voices; natural/neural/online ones sound far smoother
 * than the compact offline engines. We score by name and locality and always fall back to any matching voice.
 */

export type VoicePrefix = 'ro' | 'en';

export interface RankOptions {
  /** English subject: prefer en-GB, then en-US */
  preferGb?: boolean;
  /** navigator.onLine; offline means remote (network) voices cannot work, so local ones win */
  online?: boolean;
}

const normLang = (v: { lang: string }) => v.lang.toLowerCase().replace('_', '-');

/** Higher is better */
export function voiceScore(v: SpeechSynthesisVoice, prefix: VoicePrefix, opts: RankOptions = {}): number {
  const name = v.name.toLowerCase();
  const lang = normLang(v);
  const online = opts.online ?? true;
  let score = 0;
  if (/natural|neural|premium|enhanced|wavenet|studio/.test(name)) score += 60;
  if (/online/.test(name)) score += 40;
  if (/google/.test(name)) score += 30;
  if (prefix === 'ro' && /\b(alina|emil|ioana|andrei)\b/.test(name)) score += 35;
  if (/compact|espeak|festival/.test(name)) score -= 30;
  if (v.localService === false || /online|google/.test(name)) {
    // remote voice: great online, unusable offline
    if (!online) score -= 200;
  } else if (!online) score += 100;
  if (prefix === 'ro') {
    if (lang === 'ro-ro') score += 5;
  } else if (opts.preferGb) {
    if (lang === 'en-gb') score += 8;
    else if (lang === 'en-us') score += 4;
  } else if (lang === 'en-us') score += 4;
  if (v.default) score += 1;
  return score;
}

/** Voices of a language, best first (stable for ties) */
export function rankVoices(voices: readonly SpeechSynthesisVoice[], prefix: VoicePrefix, opts: RankOptions = {}): SpeechSynthesisVoice[] {
  return voices
    .filter((v) => normLang(v).startsWith(prefix))
    .map((v, i) => ({ v, i, s: voiceScore(v, prefix, opts) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.v);
}

/** The chosen voice (by `voiceURI`, if still installed and matching) or the best-ranked one, or null */
export function pickBestVoice(
  voices: readonly SpeechSynthesisVoice[],
  prefix: VoicePrefix,
  opts: RankOptions & { preferredURI?: string | null } = {},
): SpeechSynthesisVoice | null {
  const ranked = rankVoices(voices, prefix, opts);
  if (opts.preferredURI) {
    const chosen = ranked.find((v) => (v.voiceURI || v.name) === opts.preferredURI);
    if (chosen) return chosen;
  }
  return ranked[0] ?? null;
}
