import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import i18n from '../src/i18n/config';
import ItemView from '../src/ui/items/ItemView';
import ReadAloudButton from '../src/ui/speech/ReadAloudButton';
import { useReadAloud } from '../src/ui/speech/useReadAloud';
import type { Item, ItemBase, ItemResult } from '../src/engine/types';

const base: Omit<ItemBase, 'id' | 'type'> = {
  skillId: 'test.skill',
  difficulty: 1,
  prompt: { ro: 'Întrebare de test' },
  reviewStatus: 'beta',
  provenance: { id: 'p', kind: 'item', title: 't', author: 'Ludiko', source: 'own', licence: 'OWN' },
};

beforeAll(async () => {
  await i18n.changeLanguage('ro');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup(item: Item) {
  const onAnswer = vi.fn<(r: ItemResult) => void>();
  render(<ItemView item={item} onAnswer={onAnswer} feedbackMs={0} />);
  return onAnswer;
}

const choiceQ = (id: string, correctId: string): Item => ({
  ...base,
  id,
  type: 'choice',
  prompt: { ro: `Întrebarea ${id}` },
  options: [
    { id: 'a', text: { ro: 'Opțiunea A' } },
    { id: 'b', text: { ro: 'Opțiunea B' } },
  ],
  correctId,
});

const readItem = (): Item => ({
  ...base,
  id: 'r1',
  type: 'read-and-answer',
  passage: { ro: 'Ana are o pisică.' },
  questions: [
    choiceQ('q1', 'a') as never,
    { ...base, id: 'q2', type: 'true-false', prompt: { ro: 'Ana are un câine.' }, correct: false },
  ],
});

describe('ReadAndAnswerItemView', () => {
  it('keeps the passage visible and reports correct only when all sub-questions are right', async () => {
    const onAnswer = setup(readItem());
    expect(screen.getByTestId('passage')).toHaveTextContent('Ana are o pisică.');
    fireEvent.click(screen.getByRole('button', { name: 'Opțiunea A' }));
    await screen.findByText('Ana are un câine.');
    expect(screen.getByTestId('passage')).toBeInTheDocument();
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Fals' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
    const r = onAnswer.mock.calls[0][0];
    expect(r.correct).toBe(true);
    expect(r.response).toEqual({
      type: 'read-and-answer',
      answers: {
        q1: { type: 'choice', selectedId: 'a' },
        q2: { type: 'true-false', value: false },
      },
    });
  });

  it('one wrong sub-answer makes the item wrong, after gentle feedback and "Mai departe"', async () => {
    const onAnswer = setup(readItem());
    fireEvent.click(screen.getByRole('button', { name: 'Opțiunea B' }));
    expect(screen.getByText('Hai să vedem împreună')).toBeInTheDocument();
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Mai departe' }));
    await screen.findByText('Ana are un câine.');
    fireEvent.click(screen.getByRole('button', { name: 'Fals' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
    expect(onAnswer.mock.calls[0][0].correct).toBe(false);
  });
});

describe('ListenAndAnswerItemView', () => {
  const item = (): Item => ({
    ...base,
    id: 'l1',
    type: 'listen-and-answer',
    audio: { kind: 'audio', src: 'content/media/x.mp3', alt: { ro: 'sunet' } },
    options: [
      { id: 'a', text: { ro: 'pisică' } },
      { id: 'b', text: { ro: 'câine' } },
    ],
    correctId: 'a',
  });

  it('plays the audio, allows replay, and answers correctly', async () => {
    const play = vi.fn(() => Promise.resolve());
    const ctor = vi.fn(function (this: Record<string, unknown>) {
      this.play = play;
      this.pause = vi.fn();
    });
    vi.stubGlobal('Audio', ctor);
    const onAnswer = setup(item());
    fireEvent.click(screen.getByRole('button', { name: 'Ascultă' }));
    expect(play).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Ascultă din nou' }));
    expect(play).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'pisică' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
    expect(onAnswer.mock.calls[0][0]).toMatchObject({
      correct: true,
      response: { type: 'listen-and-answer', selectedId: 'a' },
    });
  });

  it('wrong option is reported wrong after "Mai departe"', async () => {
    const onAnswer = setup(item());
    fireEvent.click(screen.getByRole('button', { name: 'câine' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mai departe' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
    expect(onAnswer.mock.calls[0][0].correct).toBe(false);
  });

  it('shows a friendly message when the sound fails', () => {
    vi.stubGlobal(
      'Audio',
      vi.fn(function (this: Record<string, unknown>) {
        this.play = () => Promise.reject(new Error('nope'));
        this.pause = vi.fn();
      }),
    );
    setup(item());
    fireEvent.click(screen.getByRole('button', { name: 'Ascultă' }));
    return screen.findByText(/nu a putut fi redat/);
  });
});

describe('HotspotItemView', () => {
  const item = (): Item => ({
    ...base,
    id: 'h1',
    type: 'hotspot',
    image: { kind: 'image', src: 'content/media/dev-map.svg', alt: { ro: 'Hartă' } },
    regions: [
      { id: 'hill', x: 25, y: 40, r: 12, label: { ro: 'Dealul' } },
      { id: 'house', x: 70, y: 55, r: 12 },
      { id: 'river', x: 50, y: 85, r: 10 },
    ],
    correctId: 'house',
  });

  it('labels regions (label or "Zona N") and answers on click', async () => {
    const onAnswer = setup(item());
    expect(screen.getByRole('button', { name: 'Dealul' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zona 3' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zona 2' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
    expect(onAnswer.mock.calls[0][0]).toMatchObject({
      correct: true,
      response: { type: 'hotspot', selectedId: 'house' },
    });
  });

  it('wrong region waits for "Mai departe"', async () => {
    const onAnswer = setup(item());
    fireEvent.click(screen.getByRole('button', { name: 'Dealul' }));
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Mai departe' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
    expect(onAnswer.mock.calls[0][0].correct).toBe(false);
  });

  it('is operable by keyboard: arrows move focus, Enter answers', async () => {
    const onAnswer = setup(item());
    const first = screen.getByRole('button', { name: 'Dealul' });
    first.focus();
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    const second = screen.getByRole('button', { name: 'Zona 2' });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Zona 3' }));
    fireEvent.keyDown(second, { key: 'Enter' });
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
    expect(onAnswer.mock.calls[0][0].correct).toBe(true);
  });
});

/* ---------------- useReadAloud ---------------- */

function mockSpeech(voices: { lang: string; name: string }[]) {
  const spoken: { text: string; rate: number; lang: string }[] = [];
  const listeners: Record<string, () => void> = {};
  const synth = {
    getVoices: () => voices,
    speak: vi.fn((u: { text: string; rate: number; lang: string }) => spoken.push(u)),
    cancel: vi.fn(),
    addEventListener: (n: string, cb: () => void) => (listeners[n] = cb),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('speechSynthesis', synth);
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      voice: unknown;
      rate = 1;
      lang = '';
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    },
  );
  return { synth, spoken, listeners };
}

describe('useReadAloud', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'speechSynthesis');
  });

  it('is unavailable (and the button hidden) without speechSynthesis', () => {
    Reflect.deleteProperty(window, 'speechSynthesis');
    const { result } = renderHook(() => useReadAloud());
    expect(result.current.available).toBe(false);
    const { container } = render(<ReadAloudButton text="Salut" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is unavailable when no ro voice exists', () => {
    mockSpeech([{ lang: 'en-US', name: 'English' }]);
    const { result } = renderHook(() => useReadAloud());
    expect(result.current.available).toBe(false);
    const { container } = render(<ReadAloudButton text="Salut" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('speaks with the ro-RO voice at rate 0.9 and stops on unmount', () => {
    const { synth, spoken } = mockSpeech([
      { lang: 'en-US', name: 'English' },
      { lang: 'ro_RO', name: 'Romanian' },
    ]);
    const { result, unmount } = renderHook(() => useReadAloud());
    expect(result.current.available).toBe(true);
    act(() => result.current.speak('Bună ziua'));
    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toMatchObject({ text: 'Bună ziua', rate: 0.9, lang: 'ro_RO' });
    expect(result.current.speaking).toBe(true);
    synth.cancel.mockClear();
    unmount();
    expect(synth.cancel).toHaveBeenCalled();
  });

  it('picks up voices that load late', () => {
    const voices: { lang: string; name: string }[] = [];
    const { listeners } = mockSpeech(voices);
    const { result } = renderHook(() => useReadAloud());
    expect(result.current.available).toBe(false);
    voices.push({ lang: 'ro-RO', name: 'Romanian' });
    act(() => listeners.voiceschanged());
    expect(result.current.available).toBe(true);
  });

  it('uses an en voice for the English UI and shows the button on item prompts', async () => {
    mockSpeech([{ lang: 'en-GB', name: 'English' }]);
    await i18n.changeLanguage('en');
    try {
      const { result } = renderHook(() => useReadAloud());
      expect(result.current.available).toBe(true);
      setup(choiceQ('c1', 'a'));
      expect(screen.getByRole('button', { name: 'Read it to me' })).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage('ro');
    }
  });
});
