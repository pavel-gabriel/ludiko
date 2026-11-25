import { getSkill } from '@/engine/content/registry';
import { MAX_SKILLS } from '@/services/itemGame';
import type { GameSettings, GameType } from '@/utils/types';

/** One-tap choices for the "Ce exersăm?" picker (skill ids from content/skills; checked by tests/playItems.test.ts) */
export interface PlayPreset {
  id: string;
  emoji: string;
  /** i18n key under `play.preset.*` */
  labelKey: string;
  skillIds: string[];
}

export const PLAY_PRESETS: PlayPreset[] = [
  { id: 'addTo20', emoji: '➕', labelKey: 'play.preset.addTo20', skillIds: ['mat.add.nocarry.20', 'mat.add.carry.20'] },
  { id: 'subTo20', emoji: '➖', labelKey: 'play.preset.subTo20', skillIds: ['mat.sub.noborrow.20', 'mat.sub.borrow.20'] },
  { id: 'mulTable', emoji: '✖️', labelKey: 'play.preset.mulTable', skillIds: ['mat.mul.table.small', 'mat.mul.table.large'] },
  { id: 'divTable', emoji: '➗', labelKey: 'play.preset.divTable', skillIds: ['mat.div.table'] },
  { id: 'clock', emoji: '🕒', labelKey: 'play.preset.clock', skillIds: ['mat.clock.hour', 'mat.clock.half'] },
  { id: 'syllables', emoji: '🔤', labelKey: 'play.preset.syllables', skillIds: ['rom.syll.count.0', 'rom.syll.split.1'] },
  { id: 'letters', emoji: '🅰️', labelKey: 'play.preset.letters', skillIds: ['rom.letters.sound.0', 'rom.letters.vowel.0'] },
  { id: 'wordPictures', emoji: '🖼️', labelKey: 'play.preset.wordPictures', skillIds: ['rom.word.picture.0', 'rom.word.read.1'] },
];

/**
 * What a chosen set of skills adds to the room's settings (nothing when empty, so v1 rooms stay
 * byte-identical and RTDB never sees `undefined`).
 */
export function skillSettings(skillIds: string[]): Partial<GameSettings> {
  const ids = skillIds.slice(0, MAX_SKILLS);
  if (ids.length === 0) return {};
  const subjects = new Set(ids.map((id) => getSkill(id)?.subject).filter((s): s is NonNullable<typeof s> => !!s));
  return { skillIds: ids, subject: subjects.size === 1 ? [...subjects][0] : 'mixed' };
}

/** With skills chosen the game type only picks the mode: memory stays memory, everything else is the item race */
export function effectiveGameType(skillIds: string[], gameType: GameType): GameType {
  if (skillIds.length === 0) return gameType;
  return gameType === 'memoryGame' ? 'memoryGame' : 'mathRace';
}
