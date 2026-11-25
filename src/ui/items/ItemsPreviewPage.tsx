import { useState } from 'react';
import { Link } from 'react-router-dom';
import DyslexiaToggle from '@/components/ui/DyslexiaToggle';
import LanguageToggle from '@/components/ui/LanguageToggle';
import type { Item, ItemResult } from '@/engine/types';
import type { Provenance } from '@/engine/content/provenance';
import ItemView from './ItemView';

/* Dev-only playground at /dev/items. All sample content below is original (provenance own / OWN). */

const own = (id: string): Provenance => ({
  id: `dev-item-${id}`,
  kind: 'item',
  title: `Dev preview sample ${id}`,
  author: 'Ludiko',
  source: 'own',
  licence: 'OWN',
});

const base = { skillId: 'dev.preview', difficulty: 1 as const, reviewStatus: 'beta' as const };

const SAMPLES: { label: string; item: Item }[] = [
  {
    label: 'choice (+ visual)',
    item: {
      ...base,
      id: 'dev-choice',
      type: 'choice',
      provenance: own('choice'),
      prompt: { ro: 'Câte mere sunt?', en: 'How many apples are there?' },
      visual: { kind: 'objects', icon: '🍎', count: 7 },
      options: ['6', '7', '8', '9'].map((n) => ({ id: n, text: { ro: n } })),
      correctId: '7',
    },
  },
  {
    label: 'picture-choice',
    item: {
      ...base,
      id: 'dev-picture',
      type: 'picture-choice',
      provenance: own('picture'),
      prompt: { ro: 'Care grup are 5 stele?', en: 'Which group has 5 stars?' },
      options: [3, 5, 4, 7].map((n) => ({
        id: `s${n}`,
        visual: { kind: 'objects' as const, icon: '⭐', count: n },
      })),
      correctId: 's5',
    },
  },
  {
    label: 'true-false',
    item: {
      ...base,
      id: 'dev-tf',
      type: 'true-false',
      provenance: own('tf'),
      prompt: { ro: '25 este mai mic decât 19.', en: '25 is smaller than 19.' },
      correct: false,
    },
  },
  {
    label: 'number-input',
    item: {
      ...base,
      id: 'dev-number',
      type: 'number-input',
      provenance: own('number'),
      prompt: { ro: 'Cât face 6 + 7?', en: 'What is 6 + 7?' },
      correct: 13,
    },
  },
  {
    label: 'fill-gap (options)',
    item: {
      ...base,
      id: 'dev-gap-options',
      type: 'fill-gap',
      provenance: own('gap-options'),
      prompt: { ro: 'Găsește numărul lipsă.', en: 'Find the missing number.' },
      template: { ro: '{{gap}} + 7 = 15' },
      options: ['6', '8', '9', '22'],
      correct: '8',
    },
  },
  {
    label: 'fill-gap (typed, numpad)',
    item: {
      ...base,
      id: 'dev-gap-typed',
      type: 'fill-gap',
      provenance: own('gap-typed'),
      prompt: { ro: 'Găsește numărul lipsă.', en: 'Find the missing number.' },
      template: { ro: '20 − {{gap}} = 12' },
      correct: '8',
    },
  },
  {
    label: 'fill-gap (typed, text)',
    item: {
      ...base,
      id: 'dev-gap-text',
      type: 'fill-gap',
      provenance: own('gap-text'),
      prompt: { ro: 'Completează cuvântul.', en: 'Complete the word.' },
      template: { ro: 'Iarna ninge, iar vara este {{gap}}.', en: 'In winter it snows, and in summer it is {{gap}}.' },
      correct: 'cald',
    },
  },
  {
    label: 'order (numbers)',
    item: {
      ...base,
      id: 'dev-order-num',
      type: 'order',
      provenance: own('order-num'),
      prompt: { ro: 'Pune numerele în ordine crescătoare.', en: 'Put the numbers in increasing order.' },
      cards: [17, 4, 12, 9].map((n) => ({ id: `n${n}`, text: { ro: String(n) } })),
      correctOrder: ['n4', 'n9', 'n12', 'n17'],
    },
  },
  {
    label: 'order (text)',
    item: {
      ...base,
      id: 'dev-order-text',
      type: 'order',
      provenance: own('order-text'),
      prompt: { ro: 'Pune momentele zilei în ordine.', en: 'Put the parts of the day in order.' },
      cards: [
        { id: 'seara', text: { ro: 'seara', en: 'evening' } },
        { id: 'dimineata', text: { ro: 'dimineața', en: 'morning' } },
        { id: 'pranz', text: { ro: 'la prânz', en: 'at noon' } },
      ],
      correctOrder: ['dimineata', 'pranz', 'seara'],
    },
  },
  {
    label: 'sort',
    item: {
      ...base,
      id: 'dev-sort',
      type: 'sort',
      provenance: own('sort'),
      prompt: { ro: 'Pune fiecare număr în grupa lui.', en: 'Put each number in its group.' },
      categories: [
        { id: 'even', label: { ro: 'Pare', en: 'Even' } },
        { id: 'odd', label: { ro: 'Impare', en: 'Odd' } },
      ],
      cards: [
        { id: 'c2', text: { ro: '2' }, categoryId: 'even' },
        { id: 'c7', text: { ro: '7' }, categoryId: 'odd' },
        { id: 'c10', text: { ro: '10' }, categoryId: 'even' },
        { id: 'c13', text: { ro: '13' }, categoryId: 'odd' },
        { id: 'c4', text: { ro: '4' }, categoryId: 'even' },
      ],
    },
  },
  {
    label: 'match',
    item: {
      ...base,
      id: 'dev-match',
      type: 'match',
      provenance: own('match'),
      prompt: { ro: 'Potrivește operația cu rezultatul.', en: 'Match each sum with its result.' },
      pairs: [
        { left: { id: 'l1', text: { ro: '8 − 5' } }, right: { id: 'r1', text: { ro: '3' } } },
        { left: { id: 'l2', text: { ro: '2 × 4' } }, right: { id: 'r2', text: { ro: '8' } } },
        { left: { id: 'l3', text: { ro: '6 + 6' } }, right: { id: 'r3', text: { ro: '12' } } },
      ],
    },
  },
  {
    label: 'hotspot (placeholder)',
    item: {
      ...base,
      id: 'dev-hotspot',
      type: 'hotspot',
      provenance: own('hotspot'),
      prompt: { ro: 'Atinge locul potrivit pe imagine.', en: 'Tap the right place on the picture.' },
      image: { kind: 'image', src: 'none', alt: { ro: 'imagine' } },
      regions: [{ id: 'a', x: 50, y: 50, r: 10 }],
      correctId: 'a',
    },
  },
];

export default function ItemsPreviewPage() {
  const [round, setRound] = useState<Record<string, number>>({});
  const [results, setResults] = useState<Record<string, ItemResult>>({});

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 py-4">
      <header className="mb-4 flex items-center justify-between gap-2">
        <Link to="/" className="text-sm font-bold underline">
          ← Ludiko
        </Link>
        <h1 className="text-lg font-extrabold">Items preview</h1>
        <div className="flex gap-2">
          <LanguageToggle />
          <DyslexiaToggle />
        </div>
      </header>

      <div className="flex flex-col gap-8">
        {SAMPLES.map(({ label, item }) => {
          const r = round[item.id] ?? 0;
          const result = results[item.id];
          return (
            <div key={item.id} data-testid={`sample-${item.id}`}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
              <ItemView
                key={`${item.id}-${r}`}
                item={item}
                onAnswer={(res) => setResults((prev) => ({ ...prev, [item.id]: res }))}
              />
              {result && (
                <div className="mt-2 flex items-start justify-between gap-2 rounded-xl bg-white/70 p-2 text-xs">
                  <code className="break-all">
                    {result.correct ? 'correct' : 'wrong'} · {result.timeMs} ms · {JSON.stringify(result.response)}
                  </code>
                  <button
                    type="button"
                    className="min-h-[40px] shrink-0 rounded-lg border-2 border-gray-300 bg-white px-3 font-bold"
                    onClick={() => {
                      setRound({ ...round, [item.id]: r + 1 });
                      setResults(({ [item.id]: _removed, ...rest }) => rest);
                    }}
                  >
                    ↻
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
