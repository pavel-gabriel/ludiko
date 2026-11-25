import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MAX_COMMENT_LENGTH,
  REPORT_REASONS,
  submitReport,
  type ReportReason,
  type SubmitResult,
} from '@/services/reportService';

interface ReportButtonProps {
  itemId: string;
  skillId?: string;
}

type Phase = 'form' | 'sending' | 'done';

const FOCUSABLE = 'button:not([disabled]), textarea:not([disabled])';

/** Small, unobtrusive "report a mistake" flag for item screens. */
export default function ReportButton({ itemId, skillId }: ReportButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState('');
  const [result, setResult] = useState<SubmitResult | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  /* Focus the first reason when opened; return focus to the trigger when closed. */
  useEffect(() => {
    if (open) {
      dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const openDialog = () => {
    setReason(null);
    setComment('');
    setResult(null);
    setPhase('form');
    setOpen(true);
  };

  const handleSend = async () => {
    if (!reason || phase === 'sending') return;
    setPhase('sending');
    const outcome = await submitReport({
      itemId,
      skillId,
      reason,
      comment: comment.trim() || undefined,
    });
    setResult(outcome);
    if (outcome === 'sent' || outcome === 'queued') {
      setPhase('done');
    } else {
      setPhase('form');
    }
  };

  /* Esc closes; Tab cycles inside the dialog (simple focus trap). */
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const sending = phase === 'sending';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDialog}
        aria-label={t('report.button')}
        title={t('report.button')}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5 2v20h2v-8h6l1 2h7V4h-6l-1-2H5z" />
        </svg>
        <span aria-hidden="true">{t('report.button')}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !sending) close();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onKeyDown={handleKeyDown}
            className="card w-full max-w-md"
          >
            {phase === 'done' ? (
              <div className="text-center">
                <h2 id={titleId} className="text-2xl font-bold mb-2">
                  {t('report.thanksTitle')}
                </h2>
                <p className="text-gray-600 mb-6" role="status">
                  {result === 'queued' ? t('report.thanksQueued') : t('report.thanksSent')}
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="bg-ludiko-blue hover:bg-sky-300 font-bold text-ludiko-text px-6 py-3 rounded-xl text-lg"
                >
                  {t('report.close')}
                </button>
              </div>
            ) : (
              <>
                <h2 id={titleId} className="text-xl font-bold mb-4">
                  {t('report.dialogTitle')}
                </h2>

                <div className="grid grid-cols-1 gap-2 mb-4" role="group" aria-label={t('report.dialogTitle')}>
                  {REPORT_REASONS.map((r) => {
                    const selected = reason === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setReason(r)}
                        disabled={sending}
                        className={`min-h-[52px] w-full rounded-xl px-4 py-3 text-left text-lg font-bold text-ludiko-text transition-all active:scale-95 disabled:opacity-50 ${
                          selected
                            ? 'bg-ludiko-yellow ring-4 ring-yellow-400'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {t(`report.reasons.${r}`)}
                      </button>
                    );
                  })}
                </div>

                <label htmlFor={`${titleId}-comment`} className="block text-sm font-semibold text-gray-600 mb-1">
                  {t('report.commentLabel')}
                </label>
                <textarea
                  id={`${titleId}-comment`}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={MAX_COMMENT_LENGTH}
                  rows={3}
                  placeholder={t('report.commentPlaceholder')}
                  disabled={sending}
                  className="input-field w-full mb-1"
                />
                <p className="text-xs text-gray-400 text-right mb-4" aria-live="polite">
                  {t('report.commentCount', { n: comment.length, max: MAX_COMMENT_LENGTH })}
                </p>

                {result === 'failed' || result === 'invalid' ? (
                  <p className="text-red-500 text-sm mb-3" role="alert">
                    {t('report.failed')}
                  </p>
                ) : null}

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={close}
                    disabled={sending}
                    className="bg-gray-100 hover:bg-gray-200 font-bold text-ludiko-text px-4 py-2 rounded-xl"
                  >
                    {t('report.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!reason || sending}
                    className="bg-ludiko-green hover:bg-green-300 font-bold text-ludiko-text px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? t('report.sending') : t('report.send')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
