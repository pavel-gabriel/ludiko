/**
 * Parent/teacher-facing level statement (docs/PLAN.md §4). Never shown to the child.
 * Strings live here (not in src/i18n) so the engine stays UI-free.
 */
import type { Grade, SubjectId } from '../types';
import type { PlacementResult } from './placement';
import { formatMark, markFromScore } from '../../older/marks';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

const SUBJECT_NAMES: Record<SubjectId, { ro: string; en: string }> = {
  mat: { ro: 'Matematică', en: 'Math' },
  rom: { ro: 'Limba română', en: 'Romanian' },
  stiinte: { ro: 'Științe', en: 'Science' },
  ist: { ro: 'Istorie', en: 'History' },
  geo: { ro: 'Geografie', en: 'Geography' },
  civ: { ro: 'Educație civică', en: 'Civics' },
  logic: { ro: 'Logică', en: 'Logic' },
  bio: { ro: 'Biologie', en: 'Biology' },
  fiz: { ro: 'Fizică', en: 'Physics' },
  chim: { ro: 'Chimie', en: 'Chemistry' },
};

/** "clasa pregătitoare", "clasa I", "clasa a II-a", … "clasa a VIII-a" (en: "preparatory grade", "grade I", …) */
export function gradeName(grade: Grade, lang: string): string {
  if (isEn(lang)) return grade === 0 ? 'preparatory grade' : `grade ${ROMAN[grade]}`;
  if (grade === 0) return 'clasa pregătitoare';
  if (grade === 1) return 'clasa I';
  return `clasa a ${ROMAN[grade]}-a`;
}

/** Short form after "Clasa reală:" — "pregătitoare", "I", "a III-a" (en: "preparatory", "I", "III") */
export function gradeShortName(grade: Grade, lang: string): string {
  if (isEn(lang)) return grade === 0 ? 'preparatory' : ROMAN[grade];
  if (grade === 0) return 'pregătitoare';
  if (grade === 1) return 'I';
  return `a ${ROMAN[grade]}-a`;
}

/** Romanian numerals ≥ 20 (except …01–…19) take "de": "20 de competențe", "4 competențe". */
function roCount(n: number, one: string, many: string): string {
  const r = n % 100;
  const de = n >= 20 && (r === 0 || r >= 20) ? 'de ' : '';
  return n === 1 ? `1 ${one}` : `${n} ${de}${many}`;
}

const isEn = (lang: string) => lang.toLowerCase().startsWith('en');

/**
 * e.g. ro: "Matematică: nivel clasa a II-a, semestrul 2. Clasa reală: a III-a. Lipsesc 4 competențe — estimat 3 săptămâni de misiuni."
 *      en: "Math: level grade II, semester 2. Actual grade: III. 4 competences missing — about 3 weeks of missions."
 * Any language other than English falls back to Romanian.
 */
export function levelStatement(result: PlacementResult, lang: string): string {
  const en = isEn(lang);
  const subject = SUBJECT_NAMES[result.subject][en ? 'en' : 'ro'];
  const parts: string[] = [];
  if (result.level) {
    const g = gradeName(result.level.grade, lang);
    parts.push(en ? `${subject}: level ${g}, semester ${result.level.semester}.` : `${subject}: nivel ${g}, semestrul ${result.level.semester}.`);
  } else {
    parts.push(en ? `${subject}: level start of the preparatory grade.` : `${subject}: nivel început de clasa pregătitoare.`);
  }
  const actual = gradeShortName(result.declared.grade, lang);
  parts.push(en ? `Actual grade: ${actual}.` : `Clasa reală: ${actual}.`);
  const n = result.missingCount;
  const w = Math.max(1, result.estimatedWeeks);
  if (n === 0) {
    parts.push(en ? 'No competences missing.' : 'Nu lipsește nicio competență.');
  } else if (en) {
    parts.push(`${n} ${n === 1 ? 'competence' : 'competences'} missing — about ${w} ${w === 1 ? 'week' : 'weeks'} of missions.`);
  } else {
    parts.push(
      `${n === 1 ? 'Lipsește' : 'Lipsesc'} ${roCount(n, 'competență', 'competențe')} — estimat ${roCount(w, 'săptămână', 'săptămâni')} de misiuni.`,
    );
  }
  // grades V–VIII: the summary also carries an estimated mark (share of in-scope competences not placed as gaps)
  if (result.declared.grade >= 5) {
    const inScope = Object.keys(result.skillStates).length;
    const mark = markFromScore(inScope - result.gaps.length - result.unknown.length, inScope);
    if (mark !== null) {
      parts.push(
        en
          ? `Estimated mark: ${formatMark(mark, 'en')} (an estimate — not an official mark).`
          : `Nota estimată: ${formatMark(mark, 'ro')} (estimativă — nu e notă oficială).`,
      );
    }
  }
  if (!result.complete) parts.push(en ? "The check isn't finished yet." : 'Verificarea nu e încă completă.');
  return parts.join(' ');
}
