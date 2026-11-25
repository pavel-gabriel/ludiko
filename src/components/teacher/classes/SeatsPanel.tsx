import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { formatJoinCode } from '@/classroom/joinCode'
import { SEAT_LABEL_MAX, type SeatDoc } from '@/classroom/types'

export interface SeatsPanelProps {
  classId: string
  seats: SeatDoc[]
  /** Add one or more labels (one per line or comma separated); resolves when all are saved */
  onAdd: (labels: string[]) => Promise<void>
  onUnlink: (seatId: string) => Promise<void>
  onRemove: (seatId: string) => Promise<void>
}

/** Seats: add labels, see join codes (printable page), unlink a device (new code), remove */
export default function SeatsPanel({ classId, seats, onAdd, onUnlink, onRemove }: SeatsPanelProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [confirm, setConfirm] = useState<{ id: string; action: 'unlink' | 'remove' } | null>(null)

  const labels = text
    .split(/[\n,;]+/)
    .map((l) => l.trim().replace(/\s+/g, ' ').slice(0, SEAT_LABEL_MAX))
    .filter(Boolean)

  const add = async () => {
    if (!labels.length || busy) return
    setBusy(true)
    setFailed(false)
    try {
      await onAdd(labels)
      setText('')
    } catch {
      setFailed(true)
    }
    setBusy(false)
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setFailed(false)
    try {
      await fn()
    } catch {
      setFailed(true)
    }
    setConfirm(null)
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-4" data-testid="seats-panel">
      <form
        className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <label htmlFor="seat-labels" className="font-extrabold">{t('classroom.seats.addTitle')}</label>
        <p className="text-sm text-gray-600">{t('classroom.seats.addHint')}</p>
        <textarea
          id="seat-labels"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('classroom.seats.placeholder')}
          className="rounded-xl border border-gray-300 p-3 text-base"
          data-testid="seat-labels"
        />
        <button
          type="submit"
          disabled={!labels.length || busy}
          data-testid="seat-add"
          className="min-h-[48px] rounded-xl bg-ludiko-green px-4 font-extrabold shadow-sm disabled:opacity-50"
        >
          {labels.length === 0 ? t('classroom.seats.addEmpty') : t('classroom.seats.add', { count: labels.length })}
        </button>
      </form>

      {failed && <p role="alert" className="font-bold text-red-700">{t('classroom.error.generic')}</p>}

      {seats.length > 0 && (
        <Link
          to={`/teacher/classes/${classId}/codes`}
          className="flex min-h-[48px] items-center justify-center rounded-xl bg-ludiko-blue px-4 font-extrabold shadow-sm"
          data-testid="link-codes"
        >
          {t('classroom.seats.printCodes')}
        </Link>
      )}

      <ul className="flex flex-col gap-2">
        {seats.map((s) => (
          <li key={s.id} className="rounded-2xl bg-white p-3 shadow-sm" data-testid={`seat-${s.id}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-0 flex-1 truncate text-lg font-extrabold">{s.label}</span>
              <span className="font-mono text-lg font-extrabold tracking-widest" data-testid={`code-${s.id}`}>{formatJoinCode(s.joinCode)}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.linked ? 'bg-green-200 text-green-900' : 'bg-gray-200 text-gray-700'}`}>
                <span aria-hidden="true">{s.linked ? '✓ ' : '○ '}</span>
                {s.linked ? t('classroom.seats.linked') : t('classroom.seats.notLinked')}
              </span>
            </div>
            {confirm?.id === s.id ? (
              <div role="alertdialog" className="mt-2 flex flex-col gap-2 rounded-xl bg-red-50 p-3">
                <p className="text-sm font-bold">{t(confirm.action === 'unlink' ? 'classroom.seats.unlinkConfirm' : 'classroom.seats.removeConfirm', { label: s.label })}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(confirm.action === 'unlink' ? () => onUnlink(s.id) : () => onRemove(s.id))}
                    className="min-h-[44px] flex-1 rounded-xl bg-red-200 px-3 font-extrabold"
                    data-testid="seat-confirm"
                  >
                    {t('classroom.confirmYes')}
                  </button>
                  <button type="button" onClick={() => setConfirm(null)} className="min-h-[44px] rounded-xl bg-white px-3 font-bold">
                    {t('classroom.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                {s.linked && (
                  <button
                    type="button"
                    onClick={() => setConfirm({ id: s.id, action: 'unlink' })}
                    className="min-h-[44px] rounded-xl bg-orange-100 px-3 text-sm font-bold"
                    data-testid={`unlink-${s.id}`}
                  >
                    {t('classroom.seats.unlink')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setConfirm({ id: s.id, action: 'remove' })}
                  className="min-h-[44px] rounded-xl bg-gray-100 px-3 text-sm font-bold"
                >
                  {t('classroom.seats.remove')}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
