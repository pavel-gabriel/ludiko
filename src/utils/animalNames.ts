/**
 * Animal names for multiplayer / duel / single-player rooms (docs/PRIVACY_DATA_MAP.md F2).
 *
 * Children do not type a name in a room: they pick a playful "animal name" ("Vulpea Veselă",
 * "Happy Fox") from this own curated list. The animal is also the avatar, so name and picture always
 * agree. The names are made of an animal and an adjective written for this project (no third-party list).
 *
 * Pure data + pure functions: no React, no Firebase. The picked identity is two indexes; the text is
 * produced only when a room is created or joined, in the language of the moment.
 */

export type AnimalGender = 'm' | 'f';

export interface AnimalEntry {
  /** Avatar emoji: the same set the avatar picker offers */
  emoji: string;
  /** Romanian noun with the definite article, and its grammatical gender (adjective agreement) */
  ro: string;
  gender: AnimalGender;
  en: string;
}

export interface AdjectiveEntry {
  roM: string;
  roF: string;
  en: string;
}

/** Same 16 emojis as `EMOJI_OPTIONS` in EmojiPicker (a test keeps them in step) */
export const ANIMALS: readonly AnimalEntry[] = [
  { emoji: '🦊', ro: 'Vulpea', gender: 'f', en: 'Fox' },
  { emoji: '🐸', ro: 'Broscuța', gender: 'f', en: 'Frog' },
  { emoji: '🐱', ro: 'Pisicuța', gender: 'f', en: 'Kitten' },
  { emoji: '🐶', ro: 'Cățelușul', gender: 'm', en: 'Puppy' },
  { emoji: '🐰', ro: 'Iepurașul', gender: 'm', en: 'Bunny' },
  { emoji: '🦁', ro: 'Leul', gender: 'm', en: 'Lion' },
  { emoji: '🐼', ro: 'Panda', gender: 'f', en: 'Panda' },
  { emoji: '🐨', ro: 'Koala', gender: 'f', en: 'Koala' },
  { emoji: '🦄', ro: 'Unicornul', gender: 'm', en: 'Unicorn' },
  { emoji: '🐙', ro: 'Caracatița', gender: 'f', en: 'Octopus' },
  { emoji: '🦋', ro: 'Fluturele', gender: 'm', en: 'Butterfly' },
  { emoji: '🐝', ro: 'Albinuța', gender: 'f', en: 'Bee' },
  { emoji: '🐯', ro: 'Tigrul', gender: 'm', en: 'Tiger' },
  { emoji: '🐮', ro: 'Vițelul', gender: 'm', en: 'Calf' },
  { emoji: '🐷', ro: 'Porcușorul', gender: 'm', en: 'Piglet' },
  { emoji: '🐵', ro: 'Maimuța', gender: 'f', en: 'Monkey' },
];

export const ADJECTIVES: readonly AdjectiveEntry[] = [
  { roM: 'Vesel', roF: 'Veselă', en: 'Happy' },
  { roM: 'Curajos', roF: 'Curajoasă', en: 'Brave' },
  { roM: 'Isteț', roF: 'Isteață', en: 'Clever' },
  { roM: 'Blând', roF: 'Blândă', en: 'Gentle' },
  { roM: 'Zâmbitor', roF: 'Zâmbitoare', en: 'Smiling' },
  { roM: 'Săritor', roF: 'Săritoare', en: 'Bouncy' },
  { roM: 'Harnic', roF: 'Harnică', en: 'Busy' },
  { roM: 'Jucăuș', roF: 'Jucăușă', en: 'Playful' },
  { roM: 'Cuminte', roF: 'Cuminte', en: 'Calm' },
  { roM: 'Norocos', roF: 'Norocoasă', en: 'Lucky' },
  { roM: 'Iute', roF: 'Iute', en: 'Speedy' },
  { roM: 'Strălucitor', roF: 'Strălucitoare', en: 'Shiny' },
  { roM: 'Prietenos', roF: 'Prietenoasă', en: 'Friendly' },
  { roM: 'Curios', roF: 'Curioasă', en: 'Curious' },
  { roM: 'Voios', roF: 'Voioasă', en: 'Cheerful' },
  { roM: 'Răbdător', roF: 'Răbdătoare', en: 'Patient' },
];

/** A picked identity: an animal (also the avatar) and an adjective */
export interface AnimalIdentity {
  animal: number;
  adjective: number;
}

/** Player names in a room never exceed this (the RTDB rules enforce the same limit) */
export const PLAYER_NAME_MAX = 30;

const wrap = (i: number, n: number) => ((i % n) + n) % n;

/** The display name of an identity, in "ro" or "en" (anything else falls back to "en") */
export function identityName(id: AnimalIdentity, lang: string): string {
  const a = ANIMALS[wrap(id.animal, ANIMALS.length)];
  const adj = ADJECTIVES[wrap(id.adjective, ADJECTIVES.length)];
  if (lang.toLowerCase().startsWith('ro')) {
    return `${a.ro} ${a.gender === 'f' ? adj.roF : adj.roM}`;
  }
  return `${adj.en} ${a.en}`;
}

/** The avatar emoji of an identity */
export function identityAvatar(id: AnimalIdentity): string {
  return ANIMALS[wrap(id.animal, ANIMALS.length)].emoji;
}

/** The identity whose animal is `emoji` (adjective kept); the first animal when unknown */
export function identityWithAvatar(id: AnimalIdentity, emoji: string): AnimalIdentity {
  const animal = ANIMALS.findIndex((a) => a.emoji === emoji);
  return { animal: animal < 0 ? 0 : animal, adjective: id.adjective };
}

/**
 * A random identity. `takenAvatars` are animals already used in the room (or by the other duel player);
 * they are avoided while any animal is still free. `rand` is injectable for tests.
 */
export function randomIdentity(takenAvatars: readonly string[] = [], rand: () => number = Math.random): AnimalIdentity {
  const free = ANIMALS.map((a, i) => ({ a, i })).filter(({ a }) => !takenAvatars.includes(a.emoji));
  const pool = free.length > 0 ? free : ANIMALS.map((a, i) => ({ a, i }));
  const animal = pool[Math.floor(rand() * pool.length)].i;
  const adjective = Math.floor(rand() * ADJECTIVES.length);
  return { animal, adjective };
}

/** A different random identity from `current` (shuffle button): new adjective, and a new animal when possible */
export function shuffleIdentity(
  current: AnimalIdentity,
  takenAvatars: readonly string[] = [],
  rand: () => number = Math.random,
): AnimalIdentity {
  for (let i = 0; i < 8; i++) {
    const next = randomIdentity(takenAvatars, rand);
    if (next.animal !== current.animal || next.adjective !== current.adjective) return next;
  }
  return { animal: current.animal, adjective: wrap(current.adjective + 1, ADJECTIVES.length) };
}
