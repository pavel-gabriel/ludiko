# Read-aloud voice: current design and research on an optional neural Romanian TTS

Status: the on-device improvements below are implemented. The neural-TTS section is research only; nothing from it is in the bundle.

No network access was available while writing this, so everything in section 3 comes from memory of the projects as of early 2026. **Each claim marked UNVERIFIED must be checked against the upstream model card or licence file before any decision.**

## 1. What ships now (Web Speech API, zero bytes added)

- **Voice choice.** `src/ui/speech/voiceRanking.ts` scores the device's voices for ro (and en). Natural, Neural, Premium, Enhanced and WaveNet names get +60. "Online" gets +40 and "Google" +30. Known Romanian names (Alina, Emil, Ioana, Andrei) get +35. Compact, eSpeak and Festival voices get a penalty. When the device is offline, local voices get a large bonus and remote ones a large penalty. When online, remote voices are not penalised. Ties keep the browser's order. If nothing matches, any `ro*` voice is used. If there is no ro voice, the button stays hidden, as before.
- **Late voices.** `useVoices` listens to `voiceschanged`, to `online` and `offline`, and retries after 400 ms and 1.5 s, because some Chrome builds never fire the event.
- **Prosody.** `speechText.ts` normalises the text and `splitSentences` splits it into short utterances that are queued (about 140 characters at most). This avoids the run-on delivery and Chrome's roughly 15 s cut-off on long utterances. The default rate is 0.95 for ro, with 0.90 for the small age band, and 0.90 for English, with 0.85 for the small band. Pitch is 1.
- **Normaliser.** It strips emoji, « », ★ and similar symbols, and turns `→` into a pause. A blank box in an expression (`3 + ? = 5`) is read as "un număr". It reads `+` plus, `−` minus, `×` and `·` ori, a spaced `:` or `12:3` as "împărțit la" (clock times such as `10:30` are kept), `=` egal, and `%`, `<`, `>`, `≤`, `≥`, `²`. `3,5` becomes "trei virgulă cinci". `3/4` becomes "trei pătrimi" (denominators 2 to 10) and otherwise "N supra M". Numbers above 99 stay as digits because voices read them well.
- **Settings.** `VoiceSettings` (lazy, in Settings) has a voice picker for ro and en, a "Ascultă exemplu" button, a speed slider from 0.8 to 1.1 with an automatic reset, and a parent tip for installing a better voice. The section is hidden when the device has no ro or en voice. Choices are stored in `settingsStore` (`voiceRo`, `voiceEn`, `voiceRate`, persisted). Strings are under the `voice.*` namespace in ro and en.

Known limits: voice quality still depends on the device. The browser cannot install voices for the user, hence the tip. Some iOS voices need to be downloaded first. Quality could not be judged on a real phone from this environment.

## 2. Selection criteria for any downloadable voice

1. The code licence must be MIT, BSD, ISC or Apache-2.0 (policy: `docs/LEGAL_CONTENT_POLICY.md`). GPL, AGPL and LGPL must not end up in the bundle or the shipped assets.
2. The voice model and its training data must be CC0, CC BY or CC BY-SA, or public domain. NC and ND are not allowed. Attribution goes in `content/credits.json`.
3. The download must be on demand only and stay out of the 250 KB gzip bundle budget. It must be cached for offline use (Cache Storage, or IndexedDB through the service worker), and it must be clearly opt-in because of data cost.
4. It must run acceptably on a cheap Android phone, using WASM with CPU only (WebGPU cannot be assumed).

## 3. Candidates

| Option | Code licence | Romanian voice model licence | Size | Verdict |
|---|---|---|---|---|
| **Piper** (`ro_RO` "mihai", medium, VITS exported to ONNX) | The original `rhasspy/piper` is MIT (UNVERIFIED for the current state of the repo). The maintained successor `piper1-gpl` is GPL-3, which is not allowed. | Per-voice model cards in `rhasspy/piper-voices`. The dataset origin and licence of the ro voice must be read on its card (UNVERIFIED). Many Piper voices are CC0 or CC BY, but some have unclear or restrictive terms. | About 60 MB for a medium voice. A low-quality variant, if one exists for ro, would be about 15 to 25 MB (UNVERIFIED). | **Conditional.** Possible only if the voice card confirms a permissive licence. |
| **sherpa-onnx WASM** (runs Piper/VITS models in the browser) | Apache-2.0 (UNVERIFIED). | Same as Piper. | The runtime is a few MB of WASM plus the model. | **Conditional.** It is the most practical runtime. See the phonemizer problem below. |
| **onnxruntime-web** with our own Piper port | MIT (UNVERIFIED). | Same as Piper. | The WASM runtime is about 10 MB or more. | Heavier to build ourselves than sherpa-onnx. |
| **Meta MMS-TTS `ron`** (`facebook/mms-tts-ron`) | The code is MIT or Apache. | **CC BY-NC 4.0**, as far as we know. | About 140 MB as a checkpoint. | **Not allowed** (NC). |
| **Coqui TTS** | MPL-2.0 (a file-level copyleft, which needs a legal check). | There is no official Romanian model that we know of. XTTS uses the CPML, a non-commercial licence. | Large. | **Not allowed** or unsuitable. |
| **Cloud TTS** (Azure, Google, ElevenLabs) | Not applicable. | Terms and quotas restrict redistribution, and a key and network are needed. | None. | Rejected: breaks the offline-first design, costs money and sends children's content to a third party. |

**Phonemizer risk (important).** Piper-style models normally need espeak-ng to turn text into phonemes. espeak-ng is GPL-3.0 (UNVERIFIED but widely known). Loading its data or code in the bundle would break our "no GPL in the bundle" rule. Options: (a) check whether the sherpa-onnx WASM build keeps espeak-ng as separate downloadable data, and get a legal opinion on whether that counts as bundling; (b) write our own Romanian grapheme-to-phoneme step (Romanian spelling is close to phonetic, so this is feasible and would be our own MIT code), and use a model that was trained on phonemes we can produce; (c) skip neural TTS. Until (a) or (b) is settled, this path is blocked.

**Speed on a cheap phone (UNVERIFIED, from general experience).** A medium VITS model in WASM on a budget Android phone is expected to run at about 0.3 to 1.0 of real time. Short sentences of about 100 characters would take roughly 1 to 3 s to synthesise, which is acceptable if we queue sentence by sentence and prefetch the next one while the current one plays. Low-end devices with 2 GB of RAM may fail to load a 60 MB model next to the app, so it needs a capability check and a fall back to the Web Speech voice.

**Offline caching.** The service worker already precaches the app (about 5 MB). The voice file should not be added to the precache. It should be fetched only after the parent taps "Descarcă vocea" and stored in Cache Storage under its own key. Show the size and ask for Wi-Fi.

## 4. Recommendation

1. **Do not add neural TTS now.** The Web Speech improvements already give most of the gain, for zero bytes. Many parents will get Google, Microsoft or Apple voices that are far smoother than the old default.
2. **Test on real devices first** (see below). If the best Android and iOS voices are still judged too rough, only then open a spike.
3. **If a spike is opened**, the order is: (i) read the ro_RO Piper voice card and the dataset licence, and record the result here; (ii) settle the espeak-ng GPL question (option a or b above); (iii) prototype a lazy, opt-in download with sherpa-onnx WASM behind a feature flag, with the Web Speech voice kept as the fallback. All third-party code and the model must be listed in `content/credits.json` with their licences before they are shipped.
4. **Never use** MMS-TTS (NC) or XTTS (CPML), and never cloud TTS.

## 5. Needs the owner

- Listen on a real Android phone (Chrome, with Google Speech Services and the Romanian data installed), on an iPhone (Ioana Enhanced) and on Windows with Edge (Alina or Emil online natural). Report whether the sentence queue sounds smooth and whether the speeds feel right for the small band.
- Decide if a spike on downloadable neural TTS is worth the effort once those results are in.
