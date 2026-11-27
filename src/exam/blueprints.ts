/**
 * Exam blueprints as data. Format facts (number of papers, working time, kinds of tasks) come from
 * the public description of the national evaluations — see docs/EXAM_PRACTICE.md §1 for sources.
 * The counts per skill group are Ludiko's own design over its existing skills; they are NOT the
 * counts of any real paper, and no real item, text or number is reproduced.
 */
import type { ExamBlueprint, ExamId, ExamTestNo } from './types'

/** Paper-style item types only: no audio prompts, no map/picture tapping */
export const PAPER_TYPES: ExamBlueprint['allowedTypes'] = [
  'choice',
  'picture-choice',
  'true-false',
  'number-input',
  'fill-gap',
  'order',
  'sort',
  'match',
  'read-and-answer',
]

const ids = (...skillIds: string[]) => ({ ids: skillIds })

export const EN2_ROMANIAN: ExamBlueprint = {
  id: 'en2.t1',
  exam: 'en2',
  test: 1,
  title: { ro: 'Comunicare în limba română', en: 'Romanian communication' },
  timeLimitMin: 45,
  allowedTypes: PAPER_TYPES,
  sections: [
    {
      id: 'sentences',
      title: { ro: 'Propoziții și cuvinte', en: 'Sentences and words' },
      intro: {
        ro: 'Aici punem cuvintele în ordine, alegem semnul potrivit și găsim cuvinte cu sens opus sau asemănător.',
        en: 'Here we put words in order, pick the right mark and find opposite or similar words.',
      },
      parts: [
        { id: 'sent-order', competence: '4.2', skills: ids('rom.sent.order.1'), count: 2, difficulty: 2 },
        { id: 'sent-punct', competence: '4.2', skills: ids('rom.sent.punct.1'), count: 2, difficulty: 2 },
        { id: 'vocab-antonym', competence: '3.4', skills: ids('rom.vocab.antonym.2'), count: 3, difficulty: 2 },
        { id: 'vocab-synonym', competence: '3.4', skills: ids('rom.vocab.synonym.2'), count: 3, difficulty: 3 },
      ],
    },
    {
      id: 'texts',
      title: { ro: 'Citim texte', en: 'Reading texts' },
      intro: {
        ro: 'Citește fiecare text cu atenție, apoi răspunde la întrebări. Poți reciti textul cât vrei.',
        en: 'Read each text carefully, then answer the questions. You can reread the text as much as you like.',
      },
      parts: [
        { id: 'text-literal', competence: '3.3', skills: ids('rom.text.literal.2'), count: 1, difficulty: 2 },
        { id: 'text-sequence', competence: '3.3', skills: ids('rom.text.sequence.2'), count: 1, difficulty: 2 },
        { id: 'text-mainidea', competence: '3.3', skills: ids('rom.text.mainidea.2'), count: 1, difficulty: 3 },
        { id: 'text-inference', competence: '3.3', skills: ids('rom.text.inference.2'), count: 1, difficulty: 3 },
      ],
    },
  ],
}

export const EN2_MATH: ExamBlueprint = {
  id: 'en2.t2',
  exam: 'en2',
  test: 2,
  title: { ro: 'Matematică și explorarea mediului', en: 'Maths and exploring the environment' },
  timeLimitMin: 45,
  allowedTypes: PAPER_TYPES,
  sections: [
    {
      id: 'numbers',
      title: { ro: 'Numere', en: 'Numbers' },
      intro: { ro: 'Numărăm și ne uităm la zeci și unități.', en: 'We count and look at tens and ones.' },
      parts: [
        { id: 'count', competence: '1.1', skills: ids('mat.count.100'), count: 1, difficulty: 2 },
        { id: 'placevalue', competence: '1.3', skills: ids('mat.placevalue.100'), count: 2, difficulty: 2 },
      ],
    },
    {
      id: 'calc',
      title: { ro: 'Adunări și scăderi', en: 'Adding and subtracting' },
      intro: { ro: 'Calculăm cu numere până la 100.', en: 'We calculate with numbers up to 100.' },
      parts: [
        { id: 'add-easy', competence: '2.1', skills: ids('mat.add.nocarry.100'), count: 1, difficulty: 1 },
        { id: 'sub-easy', competence: '2.1', skills: ids('mat.sub.noborrow.100'), count: 1, difficulty: 1 },
        { id: 'add-carry', competence: '2.1', skills: ids('mat.add.carry.100'), count: 2, difficulty: 3 },
        { id: 'sub-borrow', competence: '2.1', skills: ids('mat.sub.borrow.100'), count: 2, difficulty: 3 },
      ],
    },
    {
      id: 'problems',
      title: { ro: 'Probleme', en: 'Problems' },
      intro: { ro: 'Citim problema și alegem ce operație ne trebuie.', en: 'We read the problem and pick the operation we need.' },
      parts: [{ id: 'wordproblem', competence: '5.1', skills: ids('mat.wordproblem.100'), count: 3, difficulty: 3 }],
    },
    {
      id: 'measures',
      title: { ro: 'Ceas, bani, măsuri și figuri', en: 'Clock, money, measures and shapes' },
      intro: {
        ro: 'Ne uităm la ceas, numărăm banii, măsurăm și recunoaștem figuri.',
        en: 'We read the clock, count money, measure and recognise shapes.',
      },
      parts: [
        { id: 'clock', competence: '3.2', skills: ids('mat.clock.half', 'mat.clock.quarter'), count: 2, difficulty: 2 },
        { id: 'money', competence: '3.3', skills: ids('mat.money.add', 'mat.money.change'), count: 2, difficulty: 2 },
        { id: 'length-fraction', competence: '3.1', skills: ids('mat.length.m', 'mat.fraction.half'), count: 2, difficulty: 2 },
      ],
    },
    {
      id: 'environment',
      title: { ro: 'Explorarea mediului', en: 'Exploring the environment' },
      intro: { ro: 'Câteva întrebări despre lumea din jurul nostru.', en: 'A few questions about the world around us.' },
      optional: true,
      parts: [
        { id: 'science', competence: 'EM', skills: { subject: 'stiinte', grades: [1, 2] }, count: 4, difficulty: 2 },
      ],
    },
  ],
}

export const EN4_ROMANIAN: ExamBlueprint = {
  id: 'en4.t1',
  exam: 'en4',
  test: 1,
  title: { ro: 'Limba română', en: 'Romanian language' },
  timeLimitMin: 60,
  allowedTypes: PAPER_TYPES,
  sections: [
    {
      id: 'words',
      title: { ro: 'Cuvinte', en: 'Words' },
      intro: { ro: 'Cuvinte cu sens opus sau asemănător.', en: 'Words with opposite or similar meaning.' },
      parts: [
        { id: 'vocab-antonym', competence: '3.4', skills: ids('rom.vocab.antonym.2'), count: 2, difficulty: 3 },
        { id: 'vocab-synonym', competence: '3.4', skills: ids('rom.vocab.synonym.2'), count: 2, difficulty: 3 },
      ],
    },
    {
      id: 'texts',
      title: { ro: 'Citim texte', en: 'Reading texts' },
      intro: {
        ro: 'Citește fiecare text cu atenție, apoi răspunde la întrebări. Poți reciti textul cât vrei.',
        en: 'Read each text carefully, then answer the questions. You can reread the text as much as you like.',
      },
      parts: [
        { id: 'text-warmup', competence: '3.3', skills: ids('rom.text.literal.2'), count: 1, difficulty: 2 },
        { id: 'text-types', competence: '3.1', skills: ids('rom.text.types.3'), count: 1, difficulty: 3 },
        { id: 'text-characters', competence: '3.2', skills: ids('rom.text.characters.3'), count: 1, difficulty: 3 },
        { id: 'text-vocab', competence: '3.3', skills: ids('rom.vocab.context.3'), count: 1, difficulty: 3 },
        { id: 'text-mainidea', competence: '3.2', skills: ids('rom.text.mainidea.4'), count: 1, difficulty: 4 },
        { id: 'text-inference', competence: '3.3', skills: ids('rom.text.inference.4'), count: 1, difficulty: 4 },
      ],
    },
  ],
}

export const EN4_MATH: ExamBlueprint = {
  id: 'en4.t2',
  exam: 'en4',
  test: 2,
  title: { ro: 'Matematică și științe ale naturii', en: 'Maths and natural sciences' },
  timeLimitMin: 60,
  allowedTypes: PAPER_TYPES,
  sections: [
    {
      id: 'numbers',
      title: { ro: 'Numere mari', en: 'Big numbers' },
      intro: { ro: 'Numere până la 1 000 000: clase, rotunjiri și fracții.', en: 'Numbers up to 1,000,000: classes, rounding and fractions.' },
      parts: [
        { id: 'place', competence: '1.2', skills: ids('mat.num.1m.place'), count: 1, difficulty: 2 },
        { id: 'round', competence: '1.3', skills: ids('mat.round'), count: 1, difficulty: 3 },
        { id: 'fraction', competence: '1.3', skills: ids('mat.fraction.compare'), count: 1, difficulty: 3 },
      ],
    },
    {
      id: 'calc',
      title: { ro: 'Calcule', en: 'Calculations' },
      intro: {
        ro: 'Cele patru operații, ordinea operațiilor și ecuații.',
        en: 'The four operations, order of operations and equations.',
      },
      parts: [
        { id: 'add', competence: '2.1', skills: ids('mat.add.1m'), count: 1, difficulty: 2 },
        { id: 'sub', competence: '2.1', skills: ids('mat.sub.1m'), count: 1, difficulty: 2 },
        { id: 'mul1', competence: '2.2', skills: ids('mat.mul.1digit'), count: 1, difficulty: 2 },
        { id: 'div-exact', competence: '2.2', skills: ids('mat.div.1digit.exact'), count: 1, difficulty: 3 },
        { id: 'mul2', competence: '2.2', skills: ids('mat.mul.2digit'), count: 1, difficulty: 3 },
        { id: 'div-rem', competence: '2.2', skills: ids('mat.div.1digit.rem'), count: 1, difficulty: 3 },
        { id: 'order', competence: '2.4', skills: ids('mat.order.ops'), count: 1, difficulty: 3 },
        { id: 'equation', competence: '2.3', skills: ids('mat.equation.big'), count: 1, difficulty: 3 },
      ],
    },
    {
      id: 'problems',
      title: { ro: 'Probleme', en: 'Problems' },
      intro: { ro: 'Probleme cu mai mulți pași.', en: 'Problems with several steps.' },
      parts: [
        { id: 'muldiv', competence: '6.1', skills: ids('mat.wordproblem.muldiv'), count: 1, difficulty: 3 },
        { id: 'multistep', competence: '6.1', skills: ids('mat.wordproblem.multistep'), count: 2, difficulty: 4 },
      ],
    },
    {
      id: 'measures',
      title: { ro: 'Măsuri și figuri', en: 'Measures and shapes' },
      intro: { ro: 'Unități de măsură și perimetru.', en: 'Units of measure and perimeter.' },
      parts: [
        { id: 'convert', competence: '3.1', skills: ids('mat.measure.convert'), count: 1, difficulty: 3 },
        { id: 'perimeter', competence: '1.4', skills: ids('mat.geom.perimeter'), count: 1, difficulty: 3 },
      ],
    },
    {
      id: 'nature',
      title: { ro: 'Științe ale naturii', en: 'Natural sciences' },
      intro: { ro: 'Întrebări despre plante, animale și lumea din jur.', en: 'Questions about plants, animals and the world around us.' },
      optional: true,
      parts: [{ id: 'science', competence: 'ȘN', skills: { subject: 'stiinte', grades: [3, 4] }, count: 4, difficulty: 3 }],
    },
  ],
}

export const BLUEPRINTS: readonly ExamBlueprint[] = [EN2_ROMANIAN, EN2_MATH, EN4_ROMANIAN, EN4_MATH]

export function getBlueprint(exam: ExamId, test: ExamTestNo): ExamBlueprint | undefined {
  return BLUEPRINTS.find((b) => b.exam === exam && b.test === test)
}

export function parseExamId(raw: string | undefined): ExamId | null {
  return raw === 'en2' || raw === 'en4' ? raw : null
}

/** Which exam a profile grade practises: grade II -> EN II, grades III–IV -> EN IV, otherwise none */
export function examForGrade(grade: number): ExamId | null {
  if (grade === 2) return 'en2'
  if (grade === 3 || grade === 4) return 'en4'
  return null
}

/** Questions that are always in a paper (optional science parts come on top when that content exists) */
export function requiredQuestionCount(bp: ExamBlueprint): number {
  return bp.sections.filter((s) => !s.optional).reduce((n, s) => n + s.parts.reduce((m, p) => m + p.count, 0), 0)
}
