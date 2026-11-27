import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSkill } from '@/engine/content/registry';
import { localize } from '@/engine/types';
import Button from '@/components/ui/Button';
import {
  groupOpenReports,
  listReports,
  setReportStatus,
  type ContentReport,
  type ReportGroup,
  type ReportSnapshot,
  type ReportStatus,
} from '@/services/reportService';
import ItemView from '@/ui/items/ItemView';
import { buildReportSnapshot } from '@/services/reportSnapshot';
import { reconstructItem, reconstructSnapshot } from './reconstructItem';

const MAX_COMMENTS_SHOWN = 3;

/** The question as the child saw it, with the correct option marked. */
function ItemDetails({ g }: { g: ReportGroup }) {
  const { t } = useTranslation();
  const rebuilt = useMemo(
    () => (g.snapshot ? undefined : reconstructSnapshot(g.itemId, g.skillId)),
    [g.snapshot, g.itemId, g.skillId],
  );
  const snap: ReportSnapshot | undefined = g.snapshot ?? rebuilt;
  const [tryOpen, setTryOpen] = useState(false);
  const [tryRound, setTryRound] = useState(0);
  const [tryResult, setTryResult] = useState<boolean | null>(null);
  // The exact reported question (never a new one). If a snapshot exists, the rebuilt item must match it
  // (generated items can differ when the session fixed a difficulty); otherwise no "try it" button.
  const exact = useMemo(() => {
    const item = reconstructItem(g.itemId, g.skillId ?? g.snapshot?.skillId);
    if (!item) return undefined;
    if (g.snapshot && buildReportSnapshot(item, 'practice', '/')?.prompt !== g.snapshot.prompt) return undefined;
    return item;
  }, [g.itemId, g.skillId, g.snapshot]);
  const skillId = snap?.skillId ?? g.skillId;
  const skill = skillId ? getSkill(skillId) : undefined;

  if (!snap) {
    return <p className="text-xs text-gray-500 italic mb-2">{t('report.admin.noDetails')}</p>;
  }

  const gradeLabel =
    snap.grade === 0 ? t('report.admin.gradeZero') : t('report.admin.grade', { n: snap.grade });
  const meta = [
    skill ? localize(skill.title, 'ro') : snap.skillId,
    t(`report.admin.subjects.${snap.subject}`),
    gradeLabel,
    ...(g.snapshot ? [t(`report.admin.contexts.${snap.context}`)] : []),
  ].join(' · ');

  return (
    <div className="bg-white rounded-lg px-3 py-2 mb-2 text-sm" data-testid="report-item-details">
      <p className="text-xs text-gray-600 mb-1">
        {meta}
        {!g.snapshot && (
          <span className="ml-2 px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 font-bold">
            {t('report.admin.reconstructed')}
          </span>
        )}
      </p>
      <p className="font-semibold break-words mb-1" aria-label={t('report.admin.question')}>
        {snap.prompt}
      </p>
      {snap.options && snap.options.length > 0 && (
        <ul className="list-disc pl-5 mb-1">
          {snap.options.map((o, i) => (
            <li key={i} className={`break-words ${o === snap.correct ? 'font-bold text-green-700' : ''}`}>
              {o}
              {o === snap.correct && <span className="ml-1 text-xs">({t('report.admin.correctMark')})</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-600 break-words">
        <span className="font-semibold">{t('report.admin.correctLabel')}:</span> {snap.correct}
      </p>
      {exact && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => {
              setTryOpen((o) => !o);
              setTryResult(null);
              setTryRound((r) => r + 1);
            }}
            aria-expanded={tryOpen}
            className="text-xs font-semibold text-blue-600 underline min-h-[32px]"
          >
            {tryOpen ? t('report.admin.hideExercise') : t('report.admin.openExercise')}
          </button>
          {tryOpen && (
            <div className="mt-2 rounded-xl bg-gray-50 p-2" data-testid="report-exact-item">
              <ItemView key={`${exact.id}-${tryRound}`} item={exact} onAnswer={(r) => setTryResult(r.correct)} />
              {tryResult !== null && (
                <p className="mt-1 text-xs font-bold">
                  {tryResult ? t('report.admin.tryCorrect') : t('report.admin.tryWrong')}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Admin queue: open content reports grouped by item, with resolve / dismiss. */
export default function ContentReportsSection() {
  const { t } = useTranslation();
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const open = await listReports('open');
      setReports(open);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => groupOpenReports(reports), [reports]);

  const resolveGroup = async (reportIds: string[], itemId: string, status: ReportStatus) => {
    setBusyItem(itemId);
    setActionError(false);
    try {
      await Promise.all(reportIds.map((id) => setReportStatus(id, status)));
      await load();
    } catch {
      setActionError(true);
    } finally {
      setBusyItem(null);
    }
  };

  return (
    <section aria-label={t('report.admin.section')} className="mt-6">
      <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
        {t('report.admin.section')}
      </h2>

      {loading && (
        <p className="text-gray-400 text-sm" aria-live="polite">
          {t('admin.loading')}
        </p>
      )}

      {loadError && (
        <p className="text-red-400 text-sm" role="alert">
          {t('report.admin.loadError')}
        </p>
      )}

      {actionError && (
        <p className="text-red-400 text-sm mb-3" role="alert">
          {t('report.admin.actionError')}
        </p>
      )}

      {!loading && !loadError && groups.length === 0 && (
        <p className="text-gray-400 text-sm">{t('report.admin.empty')}</p>
      )}

      {groups.length > 0 && (
        <ul className="space-y-3" aria-label={t('report.admin.section')}>
          {groups.map((g) => (
            <li key={g.itemId} className="bg-gray-50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <code className="font-bold text-sm break-all">{g.itemId}</code>
                <span className="text-xs px-2 py-0.5 rounded-lg bg-white font-bold text-gray-700">
                  {t('report.admin.count', { n: g.count })}
                </span>
                {g.hidden && (
                  <span className="text-xs px-2 py-0.5 rounded-lg bg-red-100 text-red-700 font-bold">
                    {t('report.admin.hidden')}
                  </span>
                )}
              </div>

              <ItemDetails g={g} />

              <p className="text-xs text-gray-600 mb-1">
                <span className="font-semibold">{t('report.admin.reasonsLabel')}:</span>{' '}
                {Object.entries(g.reasons)
                  .map(([reason, n]) => `${t(`report.reasons.${reason}`)} × ${n}`)
                  .join(', ')}
              </p>

              {g.comments.length > 0 && (
                <div className="text-xs text-gray-600 mb-2">
                  <span className="font-semibold">{t('report.admin.commentsLabel')}:</span>
                  <ul className="list-disc pl-5">
                    {g.comments.slice(0, MAX_COMMENTS_SHOWN).map((c, i) => (
                      <li key={i} className="break-words">{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  variant="green"
                  size="sm"
                  disabled={busyItem === g.itemId}
                  onClick={() => resolveGroup(g.reportIds, g.itemId, 'resolved')}
                >
                  {t('report.admin.resolve')}
                </Button>
                <Button
                  variant="yellow"
                  size="sm"
                  disabled={busyItem === g.itemId}
                  onClick={() => resolveGroup(g.reportIds, g.itemId, 'dismissed')}
                >
                  {t('report.admin.dismiss')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
