import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Explanation, VisualSpec } from '@/engine/types'
import { localize } from '@/engine/types'
import Visual from '@/ui/visuals/Visual'
import type { VisualSize } from '@/ui/visuals/Visual'
import FramesPlayer from './FramesPlayer'
import { sampleExplanations } from './samples'

const GALLERY: { id: string; titleKey: string; specs: VisualSpec[] }[] = [
  {
    id: 'number-line',
    titleKey: 'numberLine',
    specs: [
      { kind: 'number-line', from: 0, to: 10, marks: [4] },
      { kind: 'number-line', from: 0, to: 20, marks: [13] },
      { kind: 'number-line', from: 0, to: 16, marks: [7, 10], jumps: [{ from: 7, to: 10 }, { from: 10, to: 15 }] },
      { kind: 'number-line', from: 0, to: 100, step: 10, marks: [40, 70], jumps: [{ from: 40, to: 70 }] },
      { kind: 'number-line', from: 0, to: 1, step: 0.1, marks: [0.3] },
      { kind: 'number-line', from: 10, to: 3, jumps: [{ from: 9, to: 4 }] },
    ],
  },
  {
    id: 'base10',
    titleKey: 'base10',
    specs: [
      { kind: 'base10-blocks', ones: 7 },
      { kind: 'base10-blocks', tens: 3, ones: 4 },
      { kind: 'base10-blocks', hundreds: 2, tens: 4, ones: 3 },
      { kind: 'base10-blocks', hundreds: 1, tens: 9, ones: 9 },
      { kind: 'base10-blocks', hundreds: 5, tens: 6, ones: 8 },
    ],
  },
  {
    id: 'clock',
    titleKey: 'clock',
    specs: [
      { kind: 'clock', hours: 3, minutes: 0 },
      { kind: 'clock', hours: 3, minutes: 15 },
      { kind: 'clock', hours: 8, minutes: 30 },
      { kind: 'clock', hours: 12, minutes: 45 },
      { kind: 'clock', hours: 5, minutes: 10 },
      { kind: 'clock', hours: 0, minutes: 5 },
    ],
  },
  {
    id: 'money',
    titleKey: 'money',
    specs: [
      { kind: 'money', amounts: [50, 50] },
      { kind: 'money', amounts: [10, 10, 5, 1, 1, 1] },
      { kind: 'money', amounts: [500, 100, 100] },
      { kind: 'money', amounts: [1000, 500, 100, 50, 10, 5] },
      { kind: 'money', amounts: [1, 1, 1, 1, 1, 1, 1, 1] },
    ],
  },
  {
    id: 'objects',
    titleKey: 'objects',
    specs: [
      { kind: 'objects', icon: '🍎', count: 7 },
      { kind: 'objects', icon: '⭐', count: 15 },
      { kind: 'objects', icon: '🍎', count: 12, groups: 3 },
      { kind: 'objects', icon: '🐟', count: 10, groups: 2 },
      { kind: 'objects', icon: '🍪', count: 17, groups: 4 },
    ],
  },
  {
    id: 'fraction',
    titleKey: 'fraction',
    specs: [
      { kind: 'fraction', numerator: 1, denominator: 2 },
      { kind: 'fraction', numerator: 3, denominator: 4 },
      { kind: 'fraction', numerator: 2, denominator: 5, shape: 'bar' },
      { kind: 'fraction', numerator: 5, denominator: 8, shape: 'bar' },
      { kind: 'fraction', numerator: 5, denominator: 4 },
    ],
  },
  {
    id: 'image',
    titleKey: 'image',
    specs: [
      {
        kind: 'image',
        media: { kind: 'image', src: 'missing-sample.svg', alt: { ro: 'Un loc gol pentru o imagine de probă', en: 'An empty spot for a sample picture' } },
      },
    ],
  },
]

function ExplanationDemo({ explanation }: { explanation: Explanation }) {
  const { t } = useTranslation()
  const [done, setDone] = useState(false)
  const [run, setRun] = useState(0)
  if (done) {
    return (
      <div className="rounded-3xl bg-white p-6 text-center shadow-md">
        <p className="mb-4 text-xl font-bold">{t('frames.preview.finished')}</p>
        <button
          type="button"
          className="min-h-[48px] rounded-2xl bg-ludiko-blue px-6 py-2 text-lg font-bold shadow"
          onClick={() => {
            setDone(false)
            setRun((r) => r + 1)
          }}
        >
          {t('frames.preview.again')}
        </button>
      </div>
    )
  }
  return <FramesPlayer key={run} explanation={explanation} onDone={() => setDone(true)} />
}

/** Developer-only gallery at /dev/frames: every visual kind + the sample explanations. */
export default function FramesPreviewPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'ro'
  const [size, setSize] = useState<VisualSize>('md')
  const [labels, setLabels] = useState(true)
  const [sampleId, setSampleId] = useState(sampleExplanations[0].id)
  const sample = sampleExplanations.find((s) => s.id === sampleId) ?? sampleExplanations[0]

  const chip = (active: boolean) =>
    `min-h-[40px] rounded-full px-4 py-1 text-sm font-bold shadow-sm border-2 ${
      active ? 'bg-ludiko-pink border-ludiko-text/60' : 'bg-white border-ludiko-text/20'
    }`

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-extrabold">{t('frames.preview.title')}</h1>
      <p className="mb-4 text-ludiko-text/80">{t('frames.preview.intro')}</p>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="font-bold">{t('frames.preview.size')}:</span>
        {(['sm', 'md', 'lg'] as VisualSize[]).map((s) => (
          <button key={s} type="button" className={chip(size === s)} aria-pressed={size === s} onClick={() => setSize(s)}>
            {s}
          </button>
        ))}
        <button type="button" className={chip(labels)} aria-pressed={labels} onClick={() => setLabels((v) => !v)}>
          {t('frames.preview.labels')}
        </button>
        {['ro', 'en'].map((l) => (
          <button key={l} type="button" className={chip(lang.startsWith(l))} onClick={() => i18n.changeLanguage(l)}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      <h2 className="mb-3 text-xl font-extrabold">{t('frames.preview.explanations')}</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        {sampleExplanations.map((s) => (
          <button key={s.id} type="button" className={chip(s.id === sampleId)} aria-pressed={s.id === sampleId} onClick={() => setSampleId(s.id)}>
            {localize(s.title, lang)}
          </button>
        ))}
      </div>
      <div className="mb-10">
        <ExplanationDemo key={sample.id} explanation={sample} />
      </div>

      <h2 className="mb-3 text-xl font-extrabold">{t('frames.preview.visuals')}</h2>
      {GALLERY.map((group) => (
        <section key={group.id} className="mb-8" data-testid={`gallery-${group.id}`}>
          <h3 className="mb-2 text-lg font-bold">{t(`frames.preview.${group.titleKey}`)}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {group.specs.map((spec, i) => (
              <div key={i} className="rounded-2xl bg-white p-3 shadow">
                <Visual spec={spec} size={size} showLabels={labels} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
