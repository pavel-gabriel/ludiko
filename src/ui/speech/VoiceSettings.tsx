import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/store/settingsStore';
import { RATE_MAX, RATE_MIN, defaultRate, effectiveRate, getSynth, speakQueue } from './speechEngine';
import { pickBestVoice, type VoicePrefix } from './voiceRanking';
import { useVoices } from './useVoices';

const voiceId = (v: SpeechSynthesisVoice) => v.voiceURI || v.name;

function VoicePicker({ prefix }: { prefix: VoicePrefix }) {
  const { t } = useTranslation();
  const voices = useVoices(prefix, prefix === 'en');
  const chosen = useSettingsStore((s) => (prefix === 'ro' ? s.voiceRo : s.voiceEn));
  const rate = useSettingsStore((s) => s.voiceRate);
  const setVoice = useSettingsStore((s) => s.setVoice);
  if (!voices.length) return null;
  const selectId = `voice-${prefix}`;
  const current = pickBestVoice(voices, prefix, { preferGb: prefix === 'en', preferredURI: chosen });
  const sample = () => {
    const synth = getSynth();
    if (!synth || !current) return;
    speakQueue(synth, t(prefix === 'ro' ? 'voice.sample_ro' : 'voice.sample_en'), current, prefix, effectiveRate(rate, prefix), () => {});
  };
  return (
    <div className="py-2">
      <label htmlFor={selectId} className="block text-sm font-semibold">
        {t(prefix === 'ro' ? 'voice.roVoices' : 'voice.enVoices')}
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <select
          id={selectId}
          value={chosen && voices.some((v) => voiceId(v) === chosen) ? chosen : ''}
          onChange={(e) => setVoice(prefix, e.target.value || null)}
          className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-sm"
        >
          <option value="">{t('voice.auto')}</option>
          {voices.map((v) => (
            <option key={voiceId(v)} value={voiceId(v)}>
              {v.name}
              {v.localService === false ? ` (${t('voice.remote')})` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={sample}
          className="min-h-[44px] rounded-full bg-ludiko-yellow px-3 text-sm font-bold text-ludiko-text shadow active:scale-95"
        >
          🔊 {t('voice.sample')}
        </button>
      </div>
    </div>
  );
}

/** "Voce pentru citit": voice + speed pickers and a parent tip. Renders nothing when the device has no voice. */
export default function VoiceSettings() {
  const { t } = useTranslation();
  const roVoices = useVoices('ro');
  const enVoices = useVoices('en');
  const rate = useSettingsStore((s) => s.voiceRate);
  const setVoiceRate = useSettingsStore((s) => s.setVoiceRate);
  // stop any sample when leaving Settings
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
      getSynth()?.cancel();
    },
    [],
  );
  if (!roVoices.length && !enVoices.length) return null;
  const shown = rate ?? defaultRate('ro');
  return (
    <section className="border-b border-gray-100 py-3" aria-labelledby="voice-title">
      <h3 id="voice-title" className="font-semibold">
        {t('voice.title')}
      </h3>
      <VoicePicker prefix="ro" />
      <VoicePicker prefix="en" />
      <div className="py-2">
        <label htmlFor="voice-rate" className="flex items-center justify-between text-sm font-semibold">
          <span>{t('voice.speed')}</span>
          <span className="font-normal text-gray-600">{rate == null ? t('voice.speedAuto') : rate.toFixed(2)}</span>
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id="voice-rate"
            type="range"
            min={RATE_MIN}
            max={RATE_MAX}
            step={0.05}
            value={shown}
            onChange={(e) => setVoiceRate(Number(e.target.value))}
            className="min-h-[44px] flex-1"
          />
          {rate != null && (
            <button type="button" onClick={() => setVoiceRate(null)} className="min-h-[44px] px-2 text-sm font-semibold text-ludiko-purple">
              {t('voice.speedReset')}
            </button>
          )}
        </div>
      </div>
      <details className="mt-1 text-sm">
        <summary className="min-h-[44px] cursor-pointer py-2 font-semibold text-ludiko-purple">{t('voice.tipTitle')}</summary>
        <ul className="list-disc space-y-1 pl-5 text-gray-700">
          <li>{t('voice.tipAndroid')}</li>
          <li>{t('voice.tipWindows')}</li>
          <li>{t('voice.tipIos')}</li>
        </ul>
        <p className="mt-1 text-gray-700">{t('voice.tipNote')}</p>
      </details>
    </section>
  );
}
