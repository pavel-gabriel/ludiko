import type { Explanation } from '@/engine/types'
import type { Provenance } from '@/engine/content/provenance'

/**
 * Sample explanations used by the dev preview page and tests.
 * Original Ludiko text and drawings (docs/LEGAL_CONTENT_POLICY.md); money is generic, never real BNR designs.
 * Real content lives under content/ — these are fixtures for the frames player.
 */

const own = (id: string, title: string): Provenance => ({
  id,
  kind: 'explanation',
  title,
  author: 'Ludiko',
  source: 'own',
  licence: 'OWN',
})

export const addingCrossingTen: Explanation = {
  id: 'sample.mat.adding-crossing-ten',
  skillId: 'mat.1.adunare-trecere-peste-zece',
  title: { ro: 'Adunarea cu trecere peste zece', en: 'Adding across ten' },
  reviewStatus: 'beta',
  provenance: own('sample.mat.adding-crossing-ten', 'Adunarea cu trecere peste zece'),
  frames: [
    {
      text: {
        ro: 'Vrem să aflăm 7 + 8. Pornim de la 7 pe axa numerelor.',
        en: 'We want to find 7 + 8. We start at 7 on the number line.',
      },
      visual: { kind: 'number-line', from: 0, to: 16, marks: [7] },
    },
    {
      text: {
        ro: 'Mai întâi ajungem la 10. De la 7 la 10 sunt 3 pași.',
        en: 'First we get to 10. From 7 to 10 is 3 steps.',
      },
      visual: { kind: 'number-line', from: 0, to: 16, marks: [7, 10], jumps: [{ from: 7, to: 10 }] },
    },
    {
      text: {
        ro: 'Din 8 am folosit 3. Ne-au mai rămas 5 pași, așa că sărim încă 5 de la 10.',
        en: 'We used 3 of the 8. There are 5 steps left, so we jump 5 more from 10.',
      },
      visual: {
        kind: 'number-line',
        from: 0,
        to: 16,
        marks: [7, 10],
        jumps: [{ from: 7, to: 10 }, { from: 10, to: 15 }],
      },
    },
    {
      text: {
        ro: 'Am ajuns la 15. Deci 7 + 8 = 15. Bravo!',
        en: 'We landed on 15. So 7 + 8 = 15. Well done!',
      },
      visual: {
        kind: 'number-line',
        from: 0,
        to: 16,
        marks: [15],
        jumps: [{ from: 7, to: 10 }, { from: 10, to: 15 }],
      },
    },
  ],
}

export const placeValue: Explanation = {
  id: 'sample.mat.place-value',
  skillId: 'mat.1.sute-zeci-unitati',
  title: { ro: 'Sute, zeci și unități', en: 'Hundreds, tens and ones' },
  reviewStatus: 'beta',
  provenance: own('sample.mat.place-value', 'Sute, zeci și unități'),
  frames: [
    {
      text: {
        ro: 'Un cub mic este o unitate. Aici avem 3 unități.',
        en: 'A small cube is one unit. Here we have 3 ones.',
      },
      visual: { kind: 'base10-blocks', ones: 3 },
    },
    {
      text: {
        ro: 'Zece unități se leagă într-o bară. O bară este o zece.',
        en: 'Ten ones join into a rod. One rod is a ten.',
      },
      visual: { kind: 'base10-blocks', tens: 1 },
    },
    {
      text: {
        ro: 'Zece zeci fac o sută. O sută este o placă mare.',
        en: 'Ten tens make a hundred. A hundred is a big flat.',
      },
      visual: { kind: 'base10-blocks', hundreds: 1 },
    },
    {
      text: {
        ro: 'Numărul 243 are 2 sute, 4 zeci și 3 unități.',
        en: 'The number 243 has 2 hundreds, 4 tens and 3 ones.',
      },
      visual: { kind: 'base10-blocks', hundreds: 2, tens: 4, ones: 3 },
    },
  ],
}

export const readingClock: Explanation = {
  id: 'sample.mat.reading-clock',
  skillId: 'mat.1.ceasul',
  title: { ro: 'Cum citim ceasul', en: 'How to read the clock' },
  reviewStatus: 'beta',
  provenance: own('sample.mat.reading-clock', 'Cum citim ceasul'),
  frames: [
    {
      text: {
        ro: 'Acul scurt și gros arată ora. Acul lung și subțire arată minutele.',
        en: 'The short, thick hand shows the hour. The long, thin hand shows the minutes.',
      },
      visual: { kind: 'clock', hours: 3, minutes: 0 },
    },
    {
      text: {
        ro: 'Când acul lung arată spre 12, este o oră fixă. Acum este ora 8 fix.',
        en: "When the long hand points to 12, it is an exact hour. Now it is 8 o'clock.",
      },
      visual: { kind: 'clock', hours: 8, minutes: 0 },
    },
    {
      text: {
        ro: 'Când acul lung arată spre 6, a trecut o jumătate de oră. Acum este ora 8 și jumătate.',
        en: 'When the long hand points to 6, half an hour has passed. Now it is half past 8.',
      },
      visual: { kind: 'clock', hours: 8, minutes: 30 },
    },
  ],
}

export const countingMoney: Explanation = {
  id: 'sample.mat.counting-money',
  skillId: 'mat.1.bani-lei',
  title: { ro: 'Numărăm banii: lei și bani', en: 'Counting money: lei and bani' },
  reviewStatus: 'beta',
  provenance: own('sample.mat.counting-money', 'Numărăm banii: lei și bani'),
  frames: [
    {
      text: {
        ro: 'Un leu are 100 de bani. Două monede de 50 de bani fac 1 leu.',
        en: 'One leu has 100 bani. Two coins of 50 bani make 1 leu.',
      },
      visual: { kind: 'money', amounts: [50, 50] },
    },
    {
      text: {
        ro: 'Numărăm monedele: 50 + 10 + 10 = 70 de bani.',
        en: 'We count the coins: 50 + 10 + 10 = 70 bani.',
      },
      visual: { kind: 'money', amounts: [50, 10, 10] },
    },
    {
      text: {
        ro: 'Bancnotele arată lei. Începem cu cea mai mare: 5 + 1 + 1 = 7 lei.',
        en: 'Notes show lei. We start with the biggest: 5 + 1 + 1 = 7 lei.',
      },
      visual: { kind: 'money', amounts: [500, 100, 100] },
    },
    {
      text: {
        ro: 'Putem amesteca: 5 lei + 1 leu + 50 de bani + 10 bani = 6 lei și 60 de bani.',
        en: 'We can mix them: 5 lei + 1 leu + 50 bani + 10 bani = 6 lei and 60 bani.',
      },
      visual: { kind: 'money', amounts: [500, 100, 50, 10] },
    },
  ],
}

export const sampleExplanations: Explanation[] = [addingCrossingTen, placeValue, readingClock, countingMoney]
