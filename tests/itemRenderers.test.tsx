import { describe, it, expect, vi, beforeAll } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '../src/i18n/config';
import ItemView from '../src/ui/items/ItemView';
import type { Item, ItemBase, ItemResult } from '../src/engine/types';

const base: Omit<ItemBase, 'id' | 'type'> = {
  skillId: 'test.skill',
  difficulty: 1,
  prompt: { ro: 'Întrebare de test' },
  reviewStatus: 'beta',
  provenance: { id: 'p', kind: 'item', title: 't', author: 'Ludiko', source: 'own', licence: 'OWN' },
};

/** Minimal stand-in for @testing-library/user-event (not a dependency of this project) */
const userEvent = {
  setup: () => ({
    click: async (el: Element) => {
      fireEvent.click(el);
    },
    type: async (el: Element, text: string) => {
      fireEvent.change(el, { target: { value: text } });
    },
    keyboard: async (keys: string) => {
      const key = keys === '{Enter}' ? 'Enter' : keys;
      fireEvent.keyDown(document.body, { key });
    },
  }),
};

beforeAll(async () => {
  await i18n.changeLanguage('ro');
});

function setup(item: Item) {
  const onAnswer = vi.fn<(r: ItemResult) => void>();
  const user = userEvent.setup();
  render(<ItemView item={item} onAnswer={onAnswer} feedbackMs={0} />);
  return { onAnswer, user };
}

async function expectResult(onAnswer: ReturnType<typeof setup>['onAnswer'], correct: boolean, itemId: string) {
  await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
  const r = onAnswer.mock.calls[0][0];
  expect(r.itemId).toBe(itemId);
  expect(r.correct).toBe(correct);
  expect(r.timeMs).toBeGreaterThanOrEqual(0);
  return r;
}

/** Wrong answers wait for the child to read the correct answer and tap "Mai departe" */
async function continueAfterWrong(user: ReturnType<typeof userEvent.setup>) {
  expect(screen.getByText('Hai să vedem împreună')).toBeInTheDocument();
  expect(screen.getByText(/Răspunsul corect/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Mai departe' }));
}

describe('ItemView renderers', () => {
  it('choice: correct', async () => {
    const item: Item = {
      ...base, id: 'c1', type: 'choice',
      options: ['6', '7', '8'].map((n) => ({ id: n, text: { ro: n } })),
      correctId: '7',
    };
    const { onAnswer, user } = setup(item);
    await user.click(screen.getByRole('button', { name: '7' }));
    expect(screen.getByText(/Corect! Bravo!/)).toBeInTheDocument();
    const r = await expectResult(onAnswer, true, 'c1');
    expect(r.response).toEqual({ type: 'choice', selectedId: '7' });
  });

  it('choice: wrong shows a gentle message and the correct answer, then reports', async () => {
    const item: Item = {
      ...base, id: 'c2', type: 'choice',
      options: ['6', '7', '8'].map((n) => ({ id: n, text: { ro: n } })),
      correctId: '7',
    };
    const { onAnswer, user } = setup(item);
    await user.click(screen.getByRole('button', { name: '6' }));
    expect(onAnswer).not.toHaveBeenCalled();
    await continueAfterWrong(user);
    await expectResult(onAnswer, false, 'c2');
  });

  it('picture-choice: correct and wrong', async () => {
    const item: Item = {
      ...base, id: 'pc', type: 'picture-choice',
      options: [3, 5].map((n) => ({ id: `s${n}`, visual: { kind: 'objects' as const, icon: '⭐', count: n } })),
      correctId: 's5',
    };
    const first = setup(item);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    await first.user.click(screen.getByRole('img', { name: /5 obiecte/ }));
    await expectResult(first.onAnswer, true, 'pc');
  });

  it('true-false: correct and wrong', async () => {
    const item: Item = { ...base, id: 'tf', type: 'true-false', correct: false };
    const a = setup(item);
    await a.user.click(screen.getByRole('button', { name: /Fals/ }));
    await expectResult(a.onAnswer, true, 'tf');
  });

  it('true-false: wrong', async () => {
    const item: Item = { ...base, id: 'tf2', type: 'true-false', correct: false };
    const { onAnswer, user } = setup(item);
    await user.click(screen.getByRole('button', { name: /Adevărat/ }));
    await continueAfterWrong(user);
    await expectResult(onAnswer, false, 'tf2');
  });

  it('number-input: numpad, correct', async () => {
    const item: Item = { ...base, id: 'n1', type: 'number-input', correct: 13 };
    const { onAnswer, user } = setup(item);
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '3' }));
    expect(screen.getByLabelText('Răspunsul tău')).toHaveTextContent('13');
    await user.click(screen.getByRole('button', { name: 'Gata' }));
    const r = await expectResult(onAnswer, true, 'n1');
    expect(r.response).toEqual({ type: 'number-input', value: 13 });
  });

  it('number-input: delete key and wrong answer', async () => {
    const item: Item = { ...base, id: 'n2', type: 'number-input', correct: 13 };
    const { onAnswer, user } = setup(item);
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '4' }));
    await user.click(screen.getByRole('button', { name: 'Șterge' }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: 'Gata' }));
    await continueAfterWrong(user);
    const r = await expectResult(onAnswer, false, 'n2');
    expect(r.response).toEqual({ type: 'number-input', value: 12 });
  });

  it('number-input: accepts the physical keyboard too', async () => {
    const item: Item = { ...base, id: 'n3', type: 'number-input', correct: 8 };
    const { onAnswer, user } = setup(item);
    await user.keyboard('8');
    await user.keyboard('{Enter}');
    await expectResult(onAnswer, true, 'n3');
  });

  it('fill-gap with options', async () => {
    const item: Item = {
      ...base, id: 'f1', type: 'fill-gap',
      template: { ro: '{{gap}} + 7 = 15' }, options: ['6', '8', '9'], correct: '8',
    };
    const { onAnswer, user } = setup(item);
    await user.click(screen.getByRole('button', { name: '8' }));
    await expectResult(onAnswer, true, 'f1');
  });

  it('fill-gap typed with numpad accepts "08"', async () => {
    const item: Item = {
      ...base, id: 'f2', type: 'fill-gap', template: { ro: '20 − {{gap}} = 12' }, correct: '8',
    };
    const { onAnswer, user } = setup(item);
    await user.click(screen.getByRole('button', { name: '0' }));
    await user.click(screen.getByRole('button', { name: '8' }));
    await user.click(screen.getByRole('button', { name: 'Gata' }));
    await expectResult(onAnswer, true, 'f2');
  });

  it('fill-gap typed text: wrong, then correct case-insensitively', async () => {
    const item: Item = {
      ...base, id: 'f3', type: 'fill-gap', template: { ro: 'Vara este {{gap}}.' }, correct: 'cald',
    };
    const { onAnswer, user } = setup(item);
    await user.type(screen.getByRole('textbox', { name: 'Scrie răspunsul' }), 'rece');
    await user.click(screen.getByRole('button', { name: 'Gata' }));
    await continueAfterWrong(user);
    await expectResult(onAnswer, false, 'f3');
  });

  it('fill-gap typed text: correct ignores case and spaces', async () => {
    const item: Item = {
      ...base, id: 'f4', type: 'fill-gap', template: { ro: 'Vara este {{gap}}.' }, correct: 'cald',
    };
    const { onAnswer, user } = setup(item);
    await user.type(screen.getByRole('textbox', { name: 'Scrie răspunsul' }), ' CALD ');
    await user.click(screen.getByRole('button', { name: 'Gata' }));
    await expectResult(onAnswer, true, 'f4');
  });

  const orderItem = (id: string): Item => ({
    ...base, id, type: 'order',
    cards: [17, 4, 12].map((n) => ({ id: `n${n}`, text: { ro: String(n) } })),
    correctOrder: ['n4', 'n12', 'n17'],
  });

  it('order: tap cards in order, then Gata (correct)', async () => {
    const { onAnswer, user } = setup(orderItem('o1'));
    expect(screen.getByRole('button', { name: 'Gata' })).toBeDisabled();
    for (const n of ['4', '12', '17']) await user.click(screen.getByRole('button', { name: n }));
    await user.click(screen.getByRole('button', { name: 'Gata' }));
    const r = await expectResult(onAnswer, true, 'o1');
    expect(r.response).toEqual({ type: 'order', order: ['n4', 'n12', 'n17'] });
  });

  it('order: undo and reset work; wrong order is reported as wrong', async () => {
    const { onAnswer, user } = setup(orderItem('o2'));
    await user.click(screen.getByRole('button', { name: '17' }));
    await user.click(screen.getByRole('button', { name: /Înapoi/ }));
    expect(screen.getByRole('button', { name: '17' })).toBeInTheDocument(); // back in the pool
    await user.click(screen.getByRole('button', { name: '4' }));
    await user.click(screen.getByRole('button', { name: /De la început/ }));
    for (const n of ['17', '12', '4']) await user.click(screen.getByRole('button', { name: n }));
    await user.click(screen.getByRole('button', { name: 'Gata' }));
    await continueAfterWrong(user);
    await expectResult(onAnswer, false, 'o2');
  });

  it('order: tap a placed card then another place to swap', async () => {
    const { onAnswer, user } = setup(orderItem('o3'));
    for (const n of ['12', '4', '17']) await user.click(screen.getByRole('button', { name: n }));
    await user.click(screen.getByRole('button', { name: 'Locul 1: 12' }));
    await user.click(screen.getByRole('button', { name: 'Locul 2: 4' }));
    await user.click(screen.getByRole('button', { name: 'Gata' }));
    await expectResult(onAnswer, true, 'o3');
  });

  const sortItem = (id: string): Item => ({
    ...base, id, type: 'sort',
    categories: [
      { id: 'even', label: { ro: 'Pare' } },
      { id: 'odd', label: { ro: 'Impare' } },
    ],
    cards: [
      { id: 'c2', text: { ro: '2' }, categoryId: 'even' },
      { id: 'c7', text: { ro: '7' }, categoryId: 'odd' },
    ],
  });

  it('sort: select a card, tap its group (correct)', async () => {
    const { onAnswer, user } = setup(sortItem('s1'));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: /^Pare$/ }));
    await user.click(screen.getByRole('button', { name: '7' }));
    await user.click(screen.getByRole('button', { name: /^Impare$/ }));
    await user.click(screen.getByRole('button', { name: 'Gata' }));
    const r = await expectResult(onAnswer, true, 's1');
    expect(r.response).toEqual({ type: 'sort', placement: { c2: 'even', c7: 'odd' } });
  });

  it('sort: wrong placement; tapping a placed card takes it out', async () => {
    const { onAnswer, user } = setup(sortItem('s2'));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: /^Impare$/ }));
    await user.click(screen.getByRole('button', { name: /^2, în grupa Impare/ }));
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: /^Impare$/ }));
    await user.click(screen.getByRole('button', { name: '7' }));
    await user.click(screen.getByRole('button', { name: /^Pare$/ }));
    await user.click(screen.getByRole('button', { name: 'Gata' }));
    await continueAfterWrong(user);
    await expectResult(onAnswer, false, 's2');
  });

  const matchItem = (id: string): Item => ({
    ...base, id, type: 'match',
    pairs: [
      { left: { id: 'l1', text: { ro: '8 − 5' } }, right: { id: 'r1', text: { ro: '3' } } },
      { left: { id: 'l2', text: { ro: '2 × 4' } }, right: { id: 'r2', text: { ro: '8' } } },
    ],
  });

  it('match: tap left then right (correct)', async () => {
    const { onAnswer, user } = setup(matchItem('m1'));
    await user.click(screen.getByRole('button', { name: /^8 − 5/ }));
    await user.click(screen.getByRole('button', { name: /^3 \(/ }));
    await user.click(screen.getByRole('button', { name: /^2 × 4/ }));
    await user.click(screen.getByRole('button', { name: /^8 \(/ }));
    await user.click(screen.getByRole('button', { name: 'Gata' }));
    const r = await expectResult(onAnswer, true, 'm1');
    expect(r.response).toEqual({ type: 'match', pairs: { l1: 'r1', l2: 'r2' } });
  });

  it('match: crossed pairs are wrong; paired items are labelled by number, not colour alone', async () => {
    const { onAnswer, user } = setup(matchItem('m2'));
    await user.click(screen.getByRole('button', { name: /^8 − 5/ }));
    await user.click(screen.getByRole('button', { name: /^8 \(/ }));
    expect(screen.getByRole('button', { name: /^8 − 5 \(perechea 1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^8 \(perechea 1\)/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^2 × 4/ }));
    await user.click(screen.getByRole('button', { name: /^3 \(/ }));
    await user.click(screen.getByRole('button', { name: 'Gata' }));
    await continueAfterWrong(user);
    await expectResult(onAnswer, false, 'm2');
  });

  it('unsupported types render a placeholder and never answer', () => {
    const item: Item = {
      ...base, id: 'h1', type: 'hotspot',
      image: { kind: 'image', src: 'x.svg', alt: { ro: 'x' } },
      regions: [{ id: 'a', x: 1, y: 1, r: 1 }],
      correctId: 'a',
    };
    const { onAnswer } = setup(item);
    expect(screen.getByText(/în curând/)).toBeInTheDocument();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('disabled locks interaction', async () => {
    const onAnswer = vi.fn();
    const user = userEvent.setup();
    const item: Item = {
      ...base, id: 'd1', type: 'choice',
      options: [{ id: 'a', text: { ro: 'A' } }, { id: 'b', text: { ro: 'B' } }], correctId: 'a',
    };
    render(<ItemView item={item} onAnswer={onAnswer} disabled feedbackMs={0} />);
    await user.click(screen.getByRole('button', { name: 'A' }));
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
