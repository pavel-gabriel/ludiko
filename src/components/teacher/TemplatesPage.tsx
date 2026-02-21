import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { getTeacherTemplates, deleteTemplate } from '@/services/teacherService';
import type { SessionTemplate } from '@/utils/types';

export default function TemplatesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { uid } = useAuthStore();
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { navigate('/teacher/login'); return; }
    getTeacherTemplates(uid).then((t) => {
      setTemplates(t);
      setLoading(false);
    });
  }, [uid]);

  const handleDelete = async (id: string) => {
    await deleteTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="page">
      <div className="card w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-4 text-center">{t('teacher.templates')}</h2>

        {loading ? (
          <p className="text-center text-gray-400 py-4">{t('teacher.loading')}</p>
        ) : templates.length === 0 ? (
          <p className="text-center text-gray-400 py-4">{t('teacher.noTemplates')}</p>
        ) : (
          <ul className="space-y-2 mb-4">
            {templates.map((tmpl) => (
              <li
                key={tmpl.id}
                className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{tmpl.name}</p>
                  <p className="text-xs text-gray-500">
                    {t(`create.gameType${tmpl.settings.gameType.charAt(0).toUpperCase() + tmpl.settings.gameType.slice(1)}`)}
                    {' · '}
                    {t(`teacher.mode.${tmpl.classroomMode}`)}
                    {tmpl.customQuestions && tmpl.customQuestions.length > 0 && (
                      <span className="ml-1">
                        · {tmpl.customQuestions.length} {t('teacher.customQs')}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(tmpl.id)}
                  className="text-red-400 hover:text-red-600 px-2 text-sm font-bold"
                  title={t('teacher.delete')}
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-gray-400 text-center mb-4">
          {t('teacher.templateHint')}
        </p>

        <Button variant="orange" size="md" className="w-full" onClick={() => navigate('/teacher')}>
          {t('teacher.back')}
        </Button>
      </div>
    </div>
  );
}
