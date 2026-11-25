import type { ReactNode } from 'react'
import AlbumView from '@/ui/album/AlbumView'
import { STICKER_SETS, setStickerId, skillStickerId, streakStickerId } from '@/ui/album/stickerSets'
import Mascot from '@/ui/learn/Mascot'
import { MASCOT_MOODS, MascotSvg } from './Mascot'

function Frame({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section data-preview={id} className="mx-auto w-full max-w-md">
      <h2 className="mb-2 rounded-lg bg-ludiko-text px-3 py-1 text-sm font-bold text-white">{title}</h2>
      <div className="rounded-3xl bg-ludiko-bg p-4 ring-1 ring-black/10">{children}</div>
    </section>
  )
}

const PARTIAL = [
  ...STICKER_SETS[0].stickers.slice(0, 7).map((x) => x.id),
  ...STICKER_SETS[1].stickers.slice(0, 3).map((x) => x.id),
  ...STICKER_SETS[3].stickers.slice(0, 2).map((x) => x.id),
  streakStickerId(3),
  skillStickerId('mat.count.20'),
]

const FULL_SET = [...STICKER_SETS[2].stickers.map((x) => x.id), setStickerId('space')]

/** /dev/mascot — every mood at three sizes plus the album, empty and partly filled, from fixtures (visual QA) */
export default function MascotPreviewPage() {
  return (
    <main className="flex flex-col gap-6 bg-ludiko-bg p-4">
      <h1 className="text-center text-xl font-extrabold text-ludiko-text">Ludi</h1>

      <Frame id="moods" title="Moods 128 / 80 / 48">
        <div className="flex flex-col gap-3">
          {MASCOT_MOODS.map((mood) => (
            <div key={mood} className="flex items-end justify-around gap-2 rounded-2xl bg-white p-2" data-mood-row={mood}>
                            <MascotSvg mood={mood} size={128} animated={false} />
              <MascotSvg mood={mood} size={80} animated={false} />
              <MascotSvg mood={mood} size={48} animated={false} />
            </div>
          ))}
        </div>
      </Frame>

      <Frame id="bubbles" title="Speech bubbles">
        <div className="flex flex-col gap-4">
          {MASCOT_MOODS.map((mood) => (
            <Mascot key={mood} mood={mood}>
              <p className="text-base font-bold text-ludiko-text">{mood}</p>
            </Mascot>
          ))}
        </div>
      </Frame>

      <Frame id="album-empty" title="Album, empty">
        <AlbumView owned={[]} />
      </Frame>

      <Frame id="album-partial" title="Album, partly filled">
        <AlbumView owned={PARTIAL} newIds={[PARTIAL[2], PARTIAL[10], PARTIAL[12]]} skillTitle={() => 'Numărăm până la 20'} />
      </Frame>

      <Frame id="album-set-complete" title="Album, one set complete">
        <AlbumView owned={FULL_SET} />
      </Frame>
    </main>
  )
}
