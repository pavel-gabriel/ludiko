import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

/** The signed-in teacher's uid; sends anyone else to the teacher login */
export function useTeacherUid(): { uid: string | null; ready: boolean } {
  const navigate = useNavigate()
  const uid = useAuthStore((s) => s.uid)
  const loading = useAuthStore((s) => s.loading)
  useEffect(() => {
    if (!loading && !uid) navigate('/teacher/login')
  }, [loading, uid, navigate])
  return { uid, ready: !loading && !!uid }
}

/** Page frame for the class screens: wider than the other teacher cards because the heatmap needs room */
export default function TeacherFrame({
  title,
  backTo,
  backLabel,
  children,
}: {
  title: string
  backTo: string
  backLabel: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-3" aria-label={t('classroom.title')}>
      <Link to={backTo} className="inline-flex min-h-[44px] items-center text-sm font-bold underline print:hidden">
        <span aria-hidden="true">← </span>
        {backLabel}
      </Link>
      <h1 className="mb-4 mt-1 break-words text-2xl font-extrabold leading-tight">{title}</h1>
      {children}
    </main>
  )
}

export function LoadingNote() {
  const { t } = useTranslation()
  return <p role="status" className="py-8 text-center font-semibold text-gray-600">{t('classroom.loading')}</p>
}

export function ErrorNote({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="rounded-2xl bg-red-50 p-4 text-center">
      <p className="font-bold text-red-800">{t('classroom.error.load')}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 min-h-[44px] rounded-xl bg-white px-4 font-bold shadow-sm">
          {t('classroom.retry')}
        </button>
      )}
    </div>
  )
}
