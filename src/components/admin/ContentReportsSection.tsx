import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import {
  groupOpenReports,
  listReports,
  setReportStatus,
  type ContentReport,
  type ReportStatus,
} from '@/services/reportService';

const MAX_COMMENTS_SHOWN = 3;

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
