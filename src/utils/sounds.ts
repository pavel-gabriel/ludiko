import { useSettingsStore } from '@/store/settingsStore';

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function isEnabled(): boolean {
  return useSettingsStore.getState().soundEnabled;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.3) {
  if (!isEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = vol;
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export function playCorrect() {
  if (!isEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  playTone(523, 0.12, 'sine', 0.25);
  setTimeout(() => playTone(659, 0.12, 'sine', 0.25), 80);
  setTimeout(() => playTone(784, 0.18, 'sine', 0.25), 160);
}

export function playWrong() {
  playTone(220, 0.25, 'square', 0.15);
}

export function playCountdownBeep() {
  playTone(440, 0.1, 'sine', 0.2);
}

export function playGo() {
  playTone(880, 0.3, 'sine', 0.25);
}

export function playFinish() {
  if (!isEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  playTone(523, 0.15, 'sine', 0.25);
  setTimeout(() => playTone(659, 0.15, 'sine', 0.25), 120);
  setTimeout(() => playTone(784, 0.15, 'sine', 0.25), 240);
  setTimeout(() => playTone(1047, 0.3, 'sine', 0.3), 360);
}
