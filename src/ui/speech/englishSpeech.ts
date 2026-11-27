/**
 * English speech for the `eng` subject (English as a foreign language).
 *
 * Convention (no contract change): an English word or phrase taught inside a Romanian or English prompt or
 * explanation frame is written between «…», e.g. ro: "Care imagine este «cat»?". The renderer finds those
 * markers and offers a "listen" button that speaks exactly the marked text with an English voice
 * (British preferred). Items of grades 0-II (non-readers and early readers) get the button; explanation
 * frames of every `eng` skill get it. The `useReadAloud('en')` hook does the speaking (no recorded audio).
 */

/** Highest grade (inclusive) whose `eng` items offer the listen button */
export const ENG_LISTEN_MAX_GRADE = 2;

const MARKED = /«([^»]+)»/g;

/** The text inside every «…» of `text`, joined by ". " (empty string when there are no markers) */
export function extractEnglishSpeech(text: string): string {
  return [...text.matchAll(MARKED)]
    .map((m) => m[1].trim())
    .filter(Boolean)
    .join('. ');
}

export const isEngSkillId = (skillId: string | undefined): boolean => !!skillId && skillId.startsWith('eng.');

/** Grade encoded as the last segment of a skill id ("eng.colours.0" -> 0), or null */
export function skillIdGrade(skillId: string): number | null {
  const m = /\.(\d)$/.exec(skillId);
  return m ? Number(m[1]) : null;
}

/** Text to speak in English for an item prompt, or null when no listen button should be shown */
export function itemEnglishSpeech(skillId: string | undefined, promptText: string): string | null {
  if (!skillId || !isEngSkillId(skillId)) return null;
  const grade = skillIdGrade(skillId);
  if (grade === null || grade > ENG_LISTEN_MAX_GRADE) return null;
  return extractEnglishSpeech(promptText) || null;
}

/** Text to speak in English for an explanation frame of an `eng` skill, or null */
export function frameEnglishSpeech(skillId: string | undefined, frameText: string): string | null {
  if (!isEngSkillId(skillId)) return null;
  return extractEnglishSpeech(frameText) || null;
}
