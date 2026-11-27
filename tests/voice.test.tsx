import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { act, render, renderHook, screen, fireEvent } from '@testing-library/react';
import '@/i18n/config';
import i18n from '@/i18n/config';
import { normaliseRo, normaliseEn, splitSentences, prepareSpeech, roNumber } from '@/ui/speech/speechText';
import { pickBestVoice, rankVoices } from '@/ui/speech/voiceRanking';
import { defaultRate, effectiveRate } from '@/ui/speech/speechEngine';
import { useSettingsStore } from '@/store/settingsStore';
import { useReadAloud } from '@/ui/speech/useReadAloud';
import VoiceSettings from '@/ui/speech/VoiceSettings';

const v = (name: string, lang = 'ro-RO', localService = true, extra: Partial<SpeechSynthesisVoice> = {}) =>
  ({ name, lang, localService, voiceURI: name, default: false, ...extra }) as SpeechSynthesisVoice;

describe('voice ranking', () => {
  it('prefers natural/neural/online voices when online', () => {
    const voices = [v('Romanian compact'), v('Microsoft Alina Online (Natural) - Romanian', 'ro-RO', false), v('Google română', 'ro-RO', false)];
    expect(rankVoices(voices, 'ro')[0].name).toContain('Alina');
    expect(pickBestVoice(voices, 'ro')?.name).toContain('Alina');
  });
  it('prefers local voices when offline', () => {
    const voices = [v('Microsoft Alina Online (Natural) - Romanian', 'ro-RO', false), v('Romanian compact'), v('Google română', 'ro-RO', false)];
    expect(pickBestVoice(voices, 'ro', { online: false })?.name).toBe('Romanian compact');
  });
  it('ranks Apple Ioana enhanced above the plain voice and accepts ro_RO', () => {
    const voices = [v('Ioana', 'ro_RO'), v('Ioana (Enhanced)', 'ro_RO')];
    expect(pickBestVoice(voices, 'ro')?.name).toBe('Ioana (Enhanced)');
  });
  it('falls back to any ro voice and to null', () => {
    expect(pickBestVoice([v('Weird', 'ro')], 'ro')?.name).toBe('Weird');
    expect(pickBestVoice([v('Samantha', 'en-US')], 'ro')).toBeNull();
    expect(pickBestVoice([], 'en')).toBeNull();
  });
  it('honours the parent choice when installed, otherwise the best', () => {
    const voices = [v('Alina Natural', 'ro-RO', false), v('Plain')];
    expect(pickBestVoice(voices, 'ro', { preferredURI: 'Plain' })?.name).toBe('Plain');
    expect(pickBestVoice(voices, 'ro', { preferredURI: 'Gone' })?.name).toBe('Alina Natural');
  });
  it('English subject prefers en-GB', () => {
    const voices = [v('US', 'en-US'), v('GB', 'en-GB')];
    expect(pickBestVoice(voices, 'en', { preferGb: true })?.name).toBe('GB');
    expect(pickBestVoice(voices, 'en')?.name).toBe('US');
  });
});

describe('rates', () => {
  it('ro 0.95, small kids slower, user value clamped', () => {
    expect(defaultRate('ro')).toBe(0.95);
    expect(defaultRate('ro', 'small')).toBeLessThan(0.95);
    expect(effectiveRate(null, 'ro', 'middle')).toBe(0.95);
    expect(effectiveRate(2, 'ro')).toBe(1.1);
    expect(effectiveRate(0.1, 'ro')).toBe(0.8);
    expect(effectiveRate(1, 'ro', 'small')).toBe(1);
  });
});

describe('splitSentences', () => {
  it('splits on sentence ends but keeps decimals', () => {
    expect(splitSentences('Ana a cumpărat 3,5 kilograme de mere. Câte kilograme de mere a cumpărat Ana? Foarte multe, nu-i așa!')).toEqual([
      'Ana a cumpărat 3,5 kilograme de mere.',
      'Câte kilograme de mere a cumpărat Ana? Foarte multe, nu-i așa!',
    ]);
  });
  it('breaks long sentences at commas and never exceeds the limit', () => {
    const long = Array.from({ length: 30 }, (_, i) => `cuvântul numărul ${i}`).join(', ') + '.';
    const parts = splitSentences(long);
    expect(parts.length).toBeGreaterThan(3);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(160);
    expect(parts.join(' ').replace(/\s+/g, ' ')).toBe(long);
  });
  it('merges tiny fragments and handles empty input', () => {
    expect(splitSentences('Da. Nu. Poate.')).toEqual(['Da. Nu. Poate.']);
    expect(splitSentences('   ')).toEqual([]);
  });
});

describe('normaliseRo', () => {
  it('reads operators', () => {
    expect(normaliseRo('3 + 4 = 7')).toBe('3 plus 4 egal 7');
    expect(normaliseRo('9 − 4')).toBe('9 minus 4');
    expect(normaliseRo('9 - 4')).toBe('9 minus 4');
    expect(normaliseRo('6 × 7')).toBe('6 ori 7');
    expect(normaliseRo('6 · 7')).toBe('6 ori 7');
    expect(normaliseRo('12 : 3')).toBe('12 împărțit la 3');
    expect(normaliseRo('12:3')).toBe('12 împărțit la 3');
  });
  it('keeps clock times and hyphenated words', () => {
    expect(normaliseRo('Ora 10:30')).toBe('Ora 10:30');
    expect(normaliseRo('Ia-o înapoi')).toBe('Ia-o înapoi');
    expect(normaliseRo('pagina 5-6')).toBe('pagina 5-6');
  });
  it('reads decimals', () => {
    expect(normaliseRo('3,5')).toBe('trei virgulă cinci');
    expect(normaliseRo('0,25 lei')).toBe('zero virgulă douăzeci și cinci lei');
    expect(normaliseRo('2,05')).toBe('doi virgulă zero cinci');
  });
  it('reads fractions', () => {
    expect(normaliseRo('3/4')).toBe('trei pătrimi');
    expect(normaliseRo('1/2 din 8')).toBe('o doime din 8');
    expect(normaliseRo('2/3')).toBe('două treimi');
    expect(normaliseRo('3/12')).toBe('trei supra doisprezece');
    expect(normaliseRo('12/03/2020')).toContain('12/03/2020');
  });
  it('strips emoji, guillemets and decorative symbols', () => {
    expect(normaliseRo('🍎 Ana are «cat» →  două 🍎🍎 ★')).toBe('Ana are cat, două');
    expect(normaliseRo('a · b')).toBe('a, b');
  });
  it('turns a blank box into "un număr" but keeps real questions', () => {
    expect(normaliseRo('3 + ? = 5')).toBe('3 plus un număr egal 5');
    expect(normaliseRo('? + 2 = 5')).toBe('un număr plus 2 egal 5');
    expect(normaliseRo('3 + □ = 5')).toBe('3 plus un număr egal 5');
    expect(normaliseRo('Cât face 2 + 2?')).toBe('Cât face 2 plus 2?');
  });
  it('reads percent, comparison and powers', () => {
    expect(normaliseRo('50%')).toBe('50 la sută');
    expect(normaliseRo('3 < 5')).toBe('3 mai mic decât 5');
    expect(normaliseRo('4²')).toBe('4 la pătrat');
  });
  it('roNumber', () => {
    expect(roNumber(21)).toBe('douăzeci și unu');
    expect(roNumber(2, true)).toBe('două');
    expect(roNumber(150)).toBe('150');
  });
});

describe('normaliseEn / prepareSpeech', () => {
  it('reads English math and strips markers', () => {
    expect(normaliseEn('2 + 3 = 5 «cat» 🐱')).toBe('2 plus 3 equals 5 cat');
  });
  it('drops chunks with nothing to say', () => {
    expect(prepareSpeech('🍎 → ★', 'ro')).toEqual([]);
    expect(prepareSpeech('Bună ziua! Cât face 2 + 2?', 'ro')).toEqual(['Bună ziua! Cât face 2 plus 2?']);
  });
});

describe('settings persistence', () => {
  beforeEach(() => localStorage.clear());
  it('stores voice choice and rate and persists them', () => {
    const { setVoice, setVoiceRate } = useSettingsStore.getState();
    setVoice('ro', 'Alina');
    setVoice('en', 'Daniel');
    setVoiceRate(0.85);
    const s = useSettingsStore.getState();
    expect([s.voiceRo, s.voiceEn, s.voiceRate]).toEqual(['Alina', 'Daniel', 0.85]);
    const saved = JSON.parse(localStorage.getItem('ludiko-settings') ?? '{}');
    expect(saved.state).toMatchObject({ voiceRo: 'Alina', voiceEn: 'Daniel', voiceRate: 0.85 });
    setVoice('ro', null);
    setVoiceRate(null);
    expect(useSettingsStore.getState().voiceRo).toBeNull();
    expect(useSettingsStore.getState().voiceRate).toBeNull();
  });
});

function mockSpeech(voices: SpeechSynthesisVoice[]) {
  const spoken: { text: string; rate: number; pitch: number; voice: SpeechSynthesisVoice; onend: (() => void) | null }[] = [];
  const listeners: Record<string, () => void> = {};
  const synth = {
    getVoices: () => voices,
    speak: vi.fn((u: (typeof spoken)[number]) => spoken.push(u)),
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
      pitch = 1;
      lang = '';
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    },
  );
  return { synth, spoken, listeners };
}

describe('useReadAloud with ranking, queue and settings', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ro');
    useSettingsStore.setState({ voiceRo: null, voiceEn: null, voiceRate: null });
  });
  afterEach(() => Reflect.deleteProperty(window, 'speechSynthesis'));

  it('picks the natural voice, normalises math and queues sentences', () => {
    const { spoken } = mockSpeech([v('Romanian compact'), v('Alina Online (Natural)', 'ro-RO', false)]);
    const { result } = renderHook(() => useReadAloud());
    act(() => result.current.speak('Calculează 3 + 4. Apoi spune rezultatul.'));
    expect(spoken.map((u) => u.text)).toEqual(['Calculează 3 plus 4. Apoi spune rezultatul.']);
    expect(spoken[0].voice.name).toContain('Alina');
    expect(spoken[0].rate).toBe(0.95);
    expect(spoken[0].pitch).toBe(1);
    const long = Array.from({ length: 12 }, (_, i) => `Aceasta este propoziția numărul ${i}.`).join(' ');
    act(() => result.current.speak(long));
    expect(spoken.length).toBeGreaterThan(3);
    // speaking ends only after the last queued utterance
    expect(result.current.speaking).toBe(true);
    act(() => spoken[spoken.length - 1].onend?.());
    expect(result.current.speaking).toBe(false);
  });

  it('uses the voice and speed chosen in settings, small band slower', () => {
    const { spoken } = mockSpeech([v('Alina Natural', 'ro-RO', false), v('Plain')]);
    useSettingsStore.setState({ voiceRo: 'Plain', voiceRate: 1.05 });
    const { result } = renderHook(() => useReadAloud());
    act(() => result.current.speak('Salut'));
    expect(spoken[0]).toMatchObject({ rate: 1.05 });
    expect(spoken[0].voice.name).toBe('Plain');
    useSettingsStore.setState({ voiceRate: null });
    const small = renderHook(() => useReadAloud(undefined, 'small'));
    act(() => small.result.current.speak('Salut'));
    expect(spoken[1].rate).toBe(0.9);
  });

  it('picks up voices that arrive later via voiceschanged', () => {
    const voices: SpeechSynthesisVoice[] = [];
    const { listeners } = mockSpeech(voices);
    const { result } = renderHook(() => useReadAloud());
    expect(result.current.available).toBe(false);
    voices.push(v('Romanian'));
    act(() => listeners.voiceschanged());
    expect(result.current.available).toBe(true);
  });
});

describe('VoiceSettings', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ro');
    useSettingsStore.setState({ voiceRo: null, voiceEn: null, voiceRate: null });
  });
  afterEach(() => Reflect.deleteProperty(window, 'speechSynthesis'));

  it('renders nothing without voices', () => {
    mockSpeech([v('Samantha', 'fr-FR')]);
    const { container } = render(<VoiceSettings />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists ro voices, saves the choice, plays a sample and sets the speed', () => {
    const { spoken } = mockSpeech([v('Romanian compact'), v('Alina Natural', 'ro-RO', false)]);
    render(<VoiceSettings />);
    const select = screen.getByLabelText('Română') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['Automat (cea mai bună)', 'Alina Natural (online)', 'Romanian compact']);
    fireEvent.change(select, { target: { value: 'Romanian compact' } });
    expect(useSettingsStore.getState().voiceRo).toBe('Romanian compact');
    fireEvent.click(screen.getByRole('button', { name: /Ascultă exemplu/ }));
    expect(spoken[0].voice.name).toBe('Romanian compact');
    expect(spoken.map((u) => u.text).join(' ')).toContain('Trei plus patru');
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0.85' } });
    expect(useSettingsStore.getState().voiceRate).toBe(0.85);
    expect(screen.getByText('Sfat pentru părinți: o voce mai bună')).toBeTruthy();
  });
});
