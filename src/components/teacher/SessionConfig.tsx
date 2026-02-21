import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import {
  createSession,
  getSession,
  updateSession,
  generateStudentCodes,
  getTeacherTemplates,
  saveTemplate,
} from '@/services/teacherService';
import { DEFAULT_GAME_SETTINGS, GAME_TYPES } from '@/utils/constants';
import type {
  GameType,
  Difficulty,
  Operation,
  ClassroomMode,
  ShapeMode,
  SessionTemplate,
  CustomQuestion,
} from '@/utils/types';

export default function SessionConfig() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { uid } = useAuthStore();
  const isNew = sessionId === 'new';

  const [title, setTitle] = useState('');
  const [gameType, setGameType] = useState<GameType>(DEFAULT_GAME_SETTINGS.gameType);
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_GAME_SETTINGS.difficulty);
  const [operations, setOperations] = useState<Operation[]>(DEFAULT_GAME_SETTINGS.operations);
  const [rounds, setRounds] = useState(DEFAULT_GAME_SETTINGS.rounds);
  const [timePerRound, setTimePerRound] = useState(DEFAULT_GAME_SETTINGS.timePerRound);
  const [shapeMode, setShapeMode] = useState<ShapeMode>('image');
  const [classroomMode, setClassroomMode] = useState<ClassroomMode>('selfPaced');
  const [globalTimer, setGlobalTimer] = useState(300);
  const [studentCount, setStudentCount] = useState(10);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [templateName, setTemplateName] = useState('');

  /* Load existing session if editing */
  useEffect(() => {
    if (!uid) { navigate('/teacher/login'); return; }
    if (!isNew && sessionId) {
      getSession(sessionId).then((s) => {
        if (!s) { navigate('/teacher'); return; }
        setTitle(s.title);
        setGameType(s.settings.gameType);
        setDifficulty(s.settings.difficulty);
        setOperations(s.settings.operations);
        setRounds(s.settings.rounds);
        setTimePerRound(s.settings.timePerRound);
        if (s.settings.shapeMode) setShapeMode(s.settings.shapeMode);
        setClassroomMode(s.classroomMode);
        setGlobalTimer(s.globalTimer);
        setStudentCount(s.studentCodes.length);
      });
    }
    getTeacherTemplates(uid).then(setTemplates);
  }, [uid, sessionId]);

  const showMathOptions = gameType === 'mathRace';
  const isShapeMatch = gameType === 'shapeMatch';
  const isMemory = gameType === 'memoryGame';

  const toggleOperation = (op: Operation) => {
    setOperations((prev) =>
      prev.includes(op) ? prev.filter((o) => o !== op) : [...prev, op],
    );
  };

  const applyTemplate = (tmpl: SessionTemplate) => {
    setGameType(tmpl.settings.gameType);
    setDifficulty(tmpl.settings.difficulty);
    setOperations(tmpl.settings.operations);
    setRounds(tmpl.settings.rounds);
    setTimePerRound(tmpl.settings.timePerRound);
    if (tmpl.settings.shapeMode) setShapeMode(tmpl.settings.shapeMode);
    setClassroomMode(tmpl.classroomMode);
    setGlobalTimer(tmpl.globalTimer);
    if (tmpl.customQuestions) setCustomQuestions(tmpl.customQuestions);
  };

  /* Add a new custom question */
  const addCustomQuestion = () => {
    setCustomQuestions((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 8),
        text: '',
        options: ['', '', '', ''],
        correctIndex: 0,
      },
    ]);
  };

  const updateCustomQuestion = (index: number, field: string, value: string | number) => {
    setCustomQuestions((prev) => prev.map((q, i) => {
      if (i !== index) return q;
      if (field === 'text') return { ...q, text: value as string };
      if (field === 'correctIndex') return { ...q, correctIndex: value as number };
      return q;
    }));
  };

  const updateCustomOption = (qIndex: number, oIndex: number, value: string) => {
    setCustomQuestions((prev) => prev.map((q, i) => {
      if (i !== qIndex) return q;
      const options = [...q.options];
      options[oIndex] = value;
      return { ...q, options };
    }));
  };

  const removeCustomQuestion = (index: number) => {
    setCustomQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveTemplate = async () => {
    if (!uid || !templateName.trim()) return;
    const settings = {
      gameType,
      gameMode: 'raceToFinish' as const,
      difficulty,
      operations: showMathOptions ? operations : ['+' as Operation],
      rounds,
      timePerRound,
      ...(isShapeMatch && { shapeMode }),
    };
    await saveTemplate(uid, templateName.trim(), settings, classroomMode, globalTimer, customQuestions.length > 0 ? customQuestions : undefined);
    setTemplateName('');
    /* Refresh templates */
    getTeacherTemplates(uid).then(setTemplates);
  };

  const handleSave = async () => {
    if (!uid || !title.trim() || loading) return;
    setLoading(true);
    try {
      const settings = {
        gameType,
        gameMode: 'raceToFinish' as const,
        difficulty,
        operations: showMathOptions ? operations : ['+' as Operation],
        rounds,
        timePerRound,
        ...(isShapeMatch && { shapeMode }),
      };
      const codes = generateStudentCodes(studentCount);

      if (isNew) {
        const id = await createSession(uid, title.trim(), settings, classroomMode, globalTimer, codes);
        navigate(`/teacher/session/${id}`);
      } else if (sessionId) {
        await updateSession(sessionId, {
          title: title.trim(),
          settings,
          classroomMode,
          globalTimer,
        });
        navigate('/teacher');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="card w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-4 text-center">
          {isNew ? t('teacher.newSession') : t('teacher.editSession')}
        </h2>

        {/* Template selector */}
        {templates.length > 0 && (
          <div className="mb-4">
            <span className="text-sm font-semibold">{t('teacher.loadTemplate')}</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => applyTemplate(tmpl)}
                  className="px-3 py-1 rounded-xl bg-gray-100 hover:bg-ludiko-blue/20 text-sm font-bold transition-colors"
                >
                  {tmpl.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Session title */}
        <label className="block mb-3">
          <span className="text-sm font-semibold">{t('teacher.sessionTitle')}</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('teacher.sessionTitlePlaceholder')}
            className="mt-1 w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none focus:border-ludiko-purple"
            maxLength={60}
          />
        </label>

        {/* Game type */}
        <label className="block mb-3">
          <span className="text-sm font-semibold">{t('create.gameType')}</span>
          <div className="flex gap-2 mt-1">
            {GAME_TYPES.map(({ type, emoji, labelKey }) => (
              <button
                key={type}
                onClick={() => setGameType(type)}
                aria-pressed={gameType === type}
                className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors ${
                  gameType === type
                    ? 'bg-ludiko-purple text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {emoji} {t(labelKey)}
              </button>
            ))}
          </div>
        </label>

        {/* Classroom mode */}
        <label className="block mb-3">
          <span className="text-sm font-semibold">{t('teacher.classroomMode')}</span>
          <div className="flex gap-2 mt-1">
            {(['selfPaced', 'teacherControlled'] as ClassroomMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setClassroomMode(mode)}
                aria-pressed={classroomMode === mode}
                className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors ${
                  classroomMode === mode
                    ? 'bg-ludiko-blue text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {t(`teacher.mode.${mode}`)}
              </button>
            ))}
          </div>
        </label>

        {/* Shape mode (Shape Match only) */}
        {isShapeMatch && (
          <label className="block mb-3">
            <span className="text-sm font-semibold">{t('create.shapeMode')}</span>
            <div className="flex gap-2 mt-1">
              {(['image', 'word'] as ShapeMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setShapeMode(mode)}
                  aria-pressed={shapeMode === mode}
                  className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors ${
                    shapeMode === mode
                      ? 'bg-ludiko-green text-ludiko-text'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {t(`create.shapeMode${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
                </button>
              ))}
            </div>
          </label>
        )}

        {/* Difficulty */}
        <label className="block mb-3">
          <span className="text-sm font-semibold">{t('create.difficulty')}</span>
          <div className="flex gap-2 mt-1">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                aria-pressed={difficulty === d}
                className={`flex-1 py-2 rounded-xl font-bold transition-colors ${
                  difficulty === d
                    ? 'bg-ludiko-purple text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {t(`create.${d}`)}
              </button>
            ))}
          </div>
        </label>

        {/* Operations (math only) */}
        {showMathOptions && (
          <label className="block mb-3">
            <span className="text-sm font-semibold">{t('create.operations')}</span>
            <div className="flex gap-2 mt-1">
              {(['+', '-', '×', '÷'] as Operation[]).map((op) => (
                <button
                  key={op}
                  onClick={() => toggleOperation(op)}
                  aria-pressed={operations.includes(op)}
                  className={`flex-1 py-2 rounded-xl font-bold text-xl transition-colors ${
                    operations.includes(op)
                      ? 'bg-ludiko-green text-ludiko-text'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>
          </label>
        )}

        {/* Rounds + Time + Students + Global Timer */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="text-sm font-semibold">
              {isMemory ? t('create.pairs') : t('create.rounds')}
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={rounds}
              onChange={(e) => {
                const v = parseInt(e.target.value.replace(/\D/g, ''), 10);
                setRounds(isNaN(v) ? 0 : v);
              }}
              className="mt-1 w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">{t('create.timePerRound')}</span>
            <input
              type="text"
              inputMode="numeric"
              value={timePerRound}
              onChange={(e) => {
                const v = parseInt(e.target.value.replace(/\D/g, ''), 10);
                setTimePerRound(isNaN(v) ? 0 : v);
              }}
              className="mt-1 w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">{t('teacher.studentCount')}</span>
            <input
              type="text"
              inputMode="numeric"
              value={studentCount}
              onChange={(e) => {
                const v = parseInt(e.target.value.replace(/\D/g, ''), 10);
                setStudentCount(isNaN(v) ? 0 : Math.min(v, 30));
              }}
              className="mt-1 w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">{t('teacher.globalTimer')}</span>
            <input
              type="text"
              inputMode="numeric"
              value={globalTimer}
              onChange={(e) => {
                const v = parseInt(e.target.value.replace(/\D/g, ''), 10);
                setGlobalTimer(isNaN(v) ? 0 : v);
              }}
              className="mt-1 w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none"
            />
          </label>
        </div>

        {/* Custom questions section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">{t('teacher.customQuestions')}</span>
            <button
              onClick={addCustomQuestion}
              className="text-xs bg-ludiko-blue/20 hover:bg-ludiko-blue/40 px-3 py-1 rounded-lg font-bold text-ludiko-purple transition-colors"
            >
              + {t('teacher.addQuestion')}
            </button>
          </div>
          {customQuestions.length === 0 && (
            <p className="text-xs text-gray-400">{t('teacher.noCustomQuestions')}</p>
          )}
          {customQuestions.map((q, qi) => (
            <div key={q.id} className="bg-gray-50 rounded-xl p-3 mb-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-gray-400">Q{qi + 1}</span>
                <input
                  type="text"
                  value={q.text}
                  onChange={(e) => updateCustomQuestion(qi, 'text', e.target.value)}
                  placeholder={t('teacher.questionText')}
                  className="flex-1 px-3 py-1 rounded-lg border border-gray-200 text-sm"
                />
                <button
                  onClick={() => removeCustomQuestion(qi)}
                  className="text-red-400 hover:text-red-600 font-bold"
                >
                  &times;
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-1">
                    <input
                      type="radio"
                      name={`correct-${q.id}`}
                      checked={q.correctIndex === oi}
                      onChange={() => updateCustomQuestion(qi, 'correctIndex', oi)}
                      className="accent-ludiko-green"
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateCustomOption(qi, oi, e.target.value)}
                      placeholder={`${t('teacher.option')} ${oi + 1}`}
                      className="flex-1 px-2 py-1 rounded-lg border border-gray-200 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Save as template */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder={t('teacher.templateNamePlaceholder')}
            className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:outline-none focus:border-ludiko-purple"
            maxLength={40}
          />
          <Button
            variant="purple"
            size="sm"
            onClick={handleSaveTemplate}
            disabled={!templateName.trim()}
          >
            {t('teacher.saveTemplate')}
          </Button>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="orange" size="md" onClick={() => navigate('/teacher')}>
            {t('teacher.back')}
          </Button>
          <Button
            variant="green"
            size="md"
            className="flex-1"
            onClick={handleSave}
            disabled={!title.trim() || loading}
          >
            {isNew ? t('teacher.createSession') : t('teacher.saveSession')}
          </Button>
        </div>
      </div>
    </div>
  );
}
