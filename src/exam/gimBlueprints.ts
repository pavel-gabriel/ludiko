/**
 * Exam simulations for the gimnaziu national evaluations (docs/EXAM_PRACTICE.md §7):
 *  - EN VI  "Evaluarea Națională clasa a VI-a": Limbă și comunicare, Matematică și Științe
 *  - EN VIII "Evaluarea Națională clasa a VIII-a": Limba și literatura română, Matematică
 *
 * The STRUCTURE (sections, counts, points, durations) is an APPROXIMATION described from general
 * knowledge of the public format; it is not the structure of any real paper. Items come from Ludiko's
 * own generators and banks at run time (docs/LEGAL_CONTENT_POLICY.md §4): nothing is copied from papers.
 *
 * Papers: test 1 = Romanian (Limbă și comunicare / Limba română), test 2 = Maths (+ Științe for EN VI).
 * Every paper has several fixed tests ("variants") with fixed seeds, so "Test 2" is always the same paper.
 */
import { PAPER_TYPES } from './blueprints'
import type { ExamBlueprint, ExamId, ExamPart, ExamSection, ExamTestNo } from './types'

export type GimExamId = Extract<ExamId, 'en6' | 'en8'>

export const GIM_EXAMS: readonly GimExamId[] = ['en6', 'en8']

/** Competence groups shown in the per-competence feedback (Ludiko's grouping; labels in i18n `examGim.comp.*`) */
export type GimCompetence = 'lectura' | 'limba' | 'lexic' | 'ortografie' | 'calc' | 'alg' | 'geom' | 'bio' | 'fiz' | 'geo'

/** How many tests (variants) each paper has */
export const GIM_VARIANTS: Record<GimExamId, Record<ExamTestNo, number>> = {
  en6: { 1: 3, 2: 3 },
  en8: { 1: 4, 2: 4 },
}

const ids = (...skillIds: string[]) => ({ ids: skillIds })
/** Rotate a pool so that each variant starts at a different skill */
const rot = <T,>(pool: T[], by: number): T[] => pool.map((_, i) => pool[(i + by) % pool.length])
const part = (id: string, competence: GimCompetence, skills: string[], count: number, difficulty: ExamPart['difficulty'], points: number): ExamPart => ({
  id,
  competence,
  skills: ids(...skills),
  count,
  difficulty,
  points,
})
const sec = (id: string, ro: string, en: string, introRo: string, introEn: string, parts: ExamPart[]): ExamSection => ({
  id,
  title: { ro, en },
  intro: { ro: introRo, en: introEn },
  parts,
})

const SEEDS: Record<string, number> = {
  'en8.1': 8101, 'en8.2': 8211, 'en8.3': 8323, 'en8.4': 8437,
  'en6.1': 6113, 'en6.2': 6229, 'en6.3': 6337,
}
const seedOf = (exam: GimExamId, test: ExamTestNo, v: number) => (SEEDS[`${exam}.${v}`] ?? 1000 + v) * 10 + test

const make = (
  exam: GimExamId,
  test: ExamTestNo,
  variant: number,
  title: ExamBlueprint['title'],
  timeLimitMin: number,
  sections: ExamSection[],
): ExamBlueprint => ({
  id: `${exam}.t${test}.v${variant}`,
  exam,
  test,
  variant,
  seed: seedOf(exam, test, variant),
  title,
  timeLimitMin,
  allowedTypes: PAPER_TYPES,
  sections,
})

/* ------------------------------------------------------------------ */
/*  EN VIII · Matematică: 3 × 30 p (6×5, 6×5, 3×10), 120 min (approx.)  */
/* ------------------------------------------------------------------ */

const M8_CALC = ['mat.rat7.ops', 'mat.rat7.powers', 'mat.real8.radicals', 'mat.sqrt7.perfect', 'mat.percent6', 'mat.frac6.ops', 'mat.ratio.proportional', 'mat.int.muldiv']
const M8_ALG = ['mat.alg8.expand', 'mat.alg8.factor', 'mat.alg8.simplify', 'mat.eq8.linear', 'mat.ineq8', 'mat.eq7.system', 'mat.func8.value', 'mat.func8.graph']
const M8_GEOM = ['mat.solid8.prism', 'mat.geom7.pyth', 'mat.geom7.similar', 'mat.eq7.problems', 'mat.solid8.pyramid', 'mat.prop7.problems', 'mat.solid8.round', 'mat.geom7.quad']

function en8Math(v: number): ExamBlueprint {
  const by = 2 * (v - 1)
  return make('en8', 2, v, { ro: `Matematică · Testul ${v}`, en: `Maths · Test ${v}` }, 120, [
    sec('calc', 'Subiectul I · Calcule', 'Part I · Calculations', 'Calcule și recunoașterea rezultatului. Fiecare cerință are un singur răspuns.', 'Calculations and picking out results. Each task has one answer.', [
      part('calc', 'calc', rot(M8_CALC, by).slice(0, 6), 6, 2, 5),
    ]),
    sec('alg', 'Subiectul II · Algebră și funcții', 'Part II · Algebra and functions', 'Expresii, ecuații, inecuații și funcții. Scrie doar rezultatul.', 'Expressions, equations, inequalities and functions. Write only the result.', [
      part('alg', 'alg', rot(M8_ALG, by).slice(0, 6), 6, 3, 5),
    ]),
    sec('geom', 'Subiectul III · Geometrie și probleme', 'Part III · Geometry and problems', 'Probleme mai lungi: corpuri, triunghiuri, rapoarte. Ia-ți timp să te gândești.', 'Longer problems: solids, triangles, ratios. Take time to think.', [
      part('geom', 'geom', rot(M8_GEOM, v - 1).slice(0, 3), 3, 4, 10),
    ]),
  ])
}

/* ------------------------------------------------------------------ */
/*  EN VIII · Limba și literatura română, 120 min (approx.)              */
/*  2 reading texts (20 p each) + 10 language items (3 p) = 70 p;       */
/*  the writing task (redactare) needs free text and is not simulated.  */
/* ------------------------------------------------------------------ */

const R8_LITERARY = ['rom.text.analysis.8', 'rom.text.theme.7', 'rom.text.intention.7', 'rom.text.compare.8']
const R8_NONLIT = ['rom.text.nonliterary.8', 'rom.text.argument.7', 'rom.text.nonliterary.6', 'rom.text.nonliterary.8']
const R8_SYNT = ['rom.synt.roles.8', 'rom.synt.clause.8', 'rom.synt.subordinate.8', 'rom.synt.complement.7']
const R8_MORPH = ['rom.morph.review.8', 'rom.morph.pos.7', 'rom.morph.pos.6']
const R8_FIG = ['rom.fig.review.8', 'rom.verse.8', 'rom.fig.adv.7']
const R8_ORTO = ['rom.spell.review.8', 'rom.punct.phrase.8', 'rom.spell.cratima.7', 'rom.punct.dialog.7']

function en8Romanian(v: number): ExamBlueprint {
  const i = v - 1
  return make('en8', 1, v, { ro: `Limba și literatura română · Testul ${v}`, en: `Romanian language and literature · Test ${v}` }, 120, [
    sec('lit', 'Subiectul I · Text literar', 'Part I · Literary text', 'Citește textul cu atenție, apoi răspunde la cerințe. Poți reciti textul oricând.', 'Read the text carefully, then answer the tasks. You can reread the text any time.', [
      part('lit', 'lectura', [R8_LITERARY[i]], 1, 3, 20),
    ]),
    sec('nonlit', 'Subiectul II · Text nonliterar', 'Part II · Non-literary text', 'Un text informativ sau argumentativ. Citește și răspunde.', 'An informative or argumentative text. Read and answer.', [
      part('nonlit', 'lectura', [R8_NONLIT[i]], 1, 3, 20),
    ]),
    sec('lang', 'Subiectul III · Limbă și comunicare', 'Part III · Language and communication', 'Părți de vorbire, sintaxă, vocabular, figuri de stil și ortografie.', 'Parts of speech, syntax, vocabulary, figures of speech and spelling.', [
      part('synt', 'limba', rot(R8_SYNT, i).slice(0, 3), 3, 3, 3),
      part('morph', 'limba', rot(R8_MORPH, i).slice(0, 2), 2, 3, 3),
      part('fig', 'lexic', rot(R8_FIG, i).slice(0, 2), 2, 3, 3),
      part('vocab', 'lexic', ['rom.vocab.compound.7'], 1, 3, 3),
      part('orto', 'ortografie', rot(R8_ORTO, i).slice(0, 2), 2, 3, 3),
    ]),
  ])
}

/* ------------------------------------------------------------------ */
/*  EN VI · Limbă și comunicare (Romanian part), 90 min (approx.)       */
/*  The modern-language part is NOT simulated: no English item source.  */
/* ------------------------------------------------------------------ */

const R6_LITERARY = ['rom.text.characters.6', 'rom.text.inference.6', 'rom.text.modes.5']
const R6_NONLIT = ['rom.text.nonliterary.6', 'rom.text.mainidea.5', 'rom.text.literal.5']
const R6_MORPH = ['rom.morph.verb.6', 'rom.morph.pos.6', 'rom.morph.mood.6']
const R6_LEX = ['rom.vocab.lexfamily.6', 'rom.vocab.paronym.6', 'rom.vocab.synonym.5', 'rom.vocab.homonym.5']
const R6_FIG = ['rom.fig.more.6', 'rom.fig.basic.5']
const R6_ORTO = ['rom.spell.nai.6', 'rom.spell.la.6', 'rom.punct.comma.6', 'rom.spell.ia.5']

function en6Romanian(v: number): ExamBlueprint {
  const i = v - 1
  return make('en6', 1, v, { ro: `Limbă și comunicare · Testul ${v}`, en: `Language and communication · Test ${v}` }, 90, [
    sec('lit', 'Citim un text literar', 'Reading a literary text', 'Citește textul cu atenție, apoi răspunde la întrebări.', 'Read the text carefully, then answer the questions.', [
      part('lit', 'lectura', [R6_LITERARY[i]], 1, 3, 20),
    ]),
    sec('nonlit', 'Citim un text nonliterar', 'Reading a non-literary text', 'Un text informativ. Citește și răspunde.', 'An informative text. Read and answer.', [
      part('nonlit', 'lectura', [R6_NONLIT[i]], 1, 3, 20),
    ]),
    sec('lang', 'Limba română', 'Romanian language', 'Morfologie, vocabular, figuri de stil și ortografie.', 'Morphology, vocabulary, figures of speech and spelling.', [
      part('morph', 'limba', rot(R6_MORPH, i).slice(0, 2), 2, 3, 2),
      part('lex', 'lexic', rot(R6_LEX, i).slice(0, 3), 3, 3, 2),
      part('fig', 'lexic', [rot(R6_FIG, i)[0]], 1, 3, 2),
      part('orto', 'ortografie', rot(R6_ORTO, i).slice(0, 4), 4, 3, 2),
    ]),
  ])
}

/* ------------------------------------------------------------------ */
/*  EN VI · Matematică și Științe, 90 min (approx.)                     */
/*  10 maths (4 p) + 8 sciences (3 p) = 64 p                            */
/* ------------------------------------------------------------------ */

const M6_NUM = ['mat.divis6.factor', 'mat.divis6.gcdlcm', 'mat.pow6.rules', 'mat.frac6.ops', 'mat.int.addsub', 'mat.int.muldiv', 'mat.percent6']
const M6_PROP = ['mat.ratio.basic', 'mat.ratio.proportional', 'mat.stat6']
const M6_GEOM = ['mat.angle6.pairs', 'mat.tri6.basics', 'mat.geom5.angles', 'mat.geom5.segments']
const S6_BIO = ['bio.plant.root.6', 'bio.plant.photo.6', 'bio.plant.flower.6', 'bio.animal.feed.6', 'bio.animal.breath.6', 'bio.animal.senses.6', 'bio.plant.leaf.6', 'bio.animal.move.6']
const S6_FIZ = ['fiz.measure.6', 'fiz.speed.6', 'fiz.density.6', 'fiz.temp.6', 'fiz.states.6', 'fiz.length.6', 'fiz.massvol.6', 'fiz.motion.6']
const S6_GEO = ['geo.europe.relief.6', 'geo.europe.climate.6', 'geo.europe.waters.6', 'geo.map.scale.6', 'geo.europe.capitals.6', 'geo.europe.position.6']

function en6Math(v: number): ExamBlueprint {
  const i = v - 1
  return make('en6', 2, v, { ro: `Matematică și Științe · Testul ${v}`, en: `Maths and Sciences · Test ${v}` }, 90, [
    sec('num', 'Matematică · Numere și calcule', 'Maths · Numbers and calculations', 'Divizibilitate, puteri, fracții și numere întregi.', 'Divisibility, powers, fractions and integers.', [
      part('num', 'calc', rot(M6_NUM, 2 * i).slice(0, 5), 5, 3, 4),
    ]),
    sec('mgeom', 'Matematică · Rapoarte, date și geometrie', 'Maths · Ratios, data and geometry', 'Rapoarte, proporții, date statistice, unghiuri și triunghiuri.', 'Ratios, proportions, statistics, angles and triangles.', [
      part('prop', 'alg', rot(M6_PROP, i).slice(0, 2), 2, 3, 4),
      part('geom', 'geom', rot(M6_GEOM, i).slice(0, 3), 3, 3, 4),
    ]),
    sec('science', 'Științe', 'Sciences', 'Plante, animale, fizică de bază și geografia Europei.', 'Plants, animals, basic physics and the geography of Europe.', [
      part('bio', 'bio', rot(S6_BIO, 3 * i).slice(0, 3), 3, 3, 3),
      part('fiz', 'fiz', rot(S6_FIZ, 3 * i).slice(0, 3), 3, 3, 3),
      part('geo', 'geo', rot(S6_GEO, 2 * i).slice(0, 2), 2, 3, 3),
    ]),
  ])
}

/* ------------------------------------------------------------------ */

export const GIM_BLUEPRINTS: readonly ExamBlueprint[] = [
  ...[1, 2, 3, 4].map(en8Romanian),
  ...[1, 2, 3, 4].map(en8Math),
  ...[1, 2, 3].map(en6Romanian),
  ...[1, 2, 3].map(en6Math),
]

export function isGimExam(raw: string | undefined): raw is GimExamId {
  return raw === 'en6' || raw === 'en8'
}

export function getGimBlueprint(exam: GimExamId, test: ExamTestNo, variant: number): ExamBlueprint | undefined {
  return GIM_BLUEPRINTS.find((b) => b.exam === exam && b.test === test && b.variant === variant)
}

/** Total points of a weighted paper */
export function maxPoints(bp: ExamBlueprint): number {
  return bp.sections.reduce((n, s) => n + s.parts.reduce((m, p) => m + p.count * (p.points ?? 1), 0), 0)
}

export function gimQuestionCount(bp: ExamBlueprint): number {
  return bp.sections.reduce((n, s) => n + s.parts.reduce((m, p) => m + p.count, 0), 0)
}

/**
 * Which gimnaziu exams a profile grade can practise, recommended first.
 * Grade VI: EN VI; grade VII: EN VIII (practice) and EN VI; grade VIII: EN VIII and EN VI. Grade V: none.
 */
export function gimExamsForGrade(grade: number): GimExamId[] {
  if (grade === 6) return ['en6']
  if (grade === 7) return ['en8', 'en6']
  if (grade === 8) return ['en8', 'en6']
  return []
}

/** The exam whose card is recommended for a gimnaziu grade (VI -> EN VI; VII–VIII -> EN VIII) */
export function recommendedGimExam(grade: number): GimExamId | null {
  return gimExamsForGrade(grade)[0] ?? null
}

/** EN VI has an official report only, no mark; EN VIII yields an estimated mark 1–10 */
export const hasEstimatedMark = (exam: ExamId): boolean => exam === 'en8'
