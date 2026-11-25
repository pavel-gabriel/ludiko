/** Offline parent tips (original wording), rotated weekly. Both languages, no network. */
export interface Tip {
  ro: string;
  en: string;
}

export const PARENT_TIPS: Tip[] = [
  {
    ro: 'Numărați banii la cumpărături: lăsați copilul să plătească și să verifice restul.',
    en: 'Count the money at the shop: let your child pay and check the change.',
  },
  {
    ro: 'Citiți ceasul împreună acasă: „Ce oră e acum? Peste o jumătate de oră ce oră va fi?”',
    en: 'Read the clock together at home: "What time is it? What time will it be in half an hour?"',
  },
  {
    ro: 'La gătit, lăsați copilul să măsoare și să numere ingredientele: două ouă, trei linguri, o jumătate de pahar.',
    en: 'While cooking, let your child measure and count the ingredients: two eggs, three spoons, half a cup.',
  },
  {
    ro: 'Numărați treptele urcând scările, din 2 în 2 sau din 5 în 5, apoi coborâți numărând invers.',
    en: 'Count the stairs as you climb, in twos or fives, then count back down.',
  },
  {
    ro: 'La plimbare căutați forme: cercuri pe roțile mașinilor, dreptunghiuri pe ferestre, triunghiuri pe acoperișuri.',
    en: 'On a walk, hunt for shapes: circles on car wheels, rectangles on windows, triangles on roofs.',
  },
  {
    ro: 'Întrebați „Cum ai aflat?” și după un răspuns corect. A explica cu voce tare întărește ce a învățat.',
    en: 'Ask "How did you work it out?" even after a right answer. Explaining aloud makes learning stick.',
  },
  {
    ro: 'Zece minute în fiecare zi fac mai mult decât o oră o dată pe săptămână. Alegeți o oră fixă și liniștită.',
    en: 'Ten minutes every day beats one hour once a week. Keep a calm, regular time.',
  },
  {
    ro: 'Lăudați efortul, nu doar rezultatul: „Ai încercat altfel și a mers!” spune mai mult decât „Ești genial!”.',
    en: 'Praise effort rather than the result: "You tried another way and it worked!" says more than "You are a genius!"',
  },
  {
    ro: 'Împărțiți o pizza sau un măr în părți egale și cereți copilului să numească fiecare parte: jumătate, sfert.',
    en: 'Split a pizza or an apple into equal parts and ask your child to name each part: half, quarter.',
  },
  {
    ro: 'Jucați „Ghicește numărul”: gândiți-vă la un număr, iar copilul întreabă „e mai mare sau mai mic?”.',
    en: 'Play "Guess the number": think of a number and let your child ask "is it bigger or smaller?"',
  },
  {
    ro: 'Când o problemă pare grea, desenați-o: bulinuțe, săgeți, o dreaptă a numerelor. Imaginea ajută gândirea.',
    en: 'When a problem feels hard, draw it: dots, arrows, a number line. A picture helps thinking.',
  },
  {
    ro: 'Cereți copilului să compare prețurile la raft: „Care costă mai mult? Cu cât?”.',
    en: 'Ask your child to compare prices on the shelf: "Which costs more? By how much?"',
  },
];

/** Deterministic weekly rotation: the same tip all week, a new one on the next. */
export function tipForWeek(now: number): Tip {
  const local = now - new Date(now).getTimezoneOffset() * 60_000;
  const week = Math.floor(local / (7 * 24 * 60 * 60 * 1000));
  return PARENT_TIPS[((week % PARENT_TIPS.length) + PARENT_TIPS.length) % PARENT_TIPS.length];
}
