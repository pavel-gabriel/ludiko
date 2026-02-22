import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import {
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
} from '@/services/authService';
import { upsertTeacherProfile, getTeacherProfile } from '@/services/teacherService';
import { useAuthStore } from '@/store/authStore';

export default function TeacherLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setUid, setTeacherProfile } = useAuthStore();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /** After auth succeeds, persist profile to Firestore (best-effort) and navigate */
  const handleSuccess = async (uid: string, name: string, userEmail: string) => {
    const profile = { uid, email: userEmail, displayName: name, createdAt: Date.now() };
    try {
      /* Try to fetch existing profile first */
      const existing = await getTeacherProfile(uid);
      if (existing) {
        setUid(uid);
        setTeacherProfile(existing);
        navigate('/teacher');
        return;
      }
      /* Create new profile */
      await upsertTeacherProfile(profile);
    } catch {
      /* Firestore write may fail (rules not yet deployed) — still allow navigation.
         The profile will be created on next successful write. */
      console.warn('Could not save teacher profile to Firestore — continuing anyway');
    }
    setUid(uid);
    setTeacherProfile(profile);
    navigate('/teacher');
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      const user = await signInWithGoogle();
      if (user) {
        await handleSuccess(user.uid, user.displayName || 'Teacher', user.email || '');
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      const msg = (err as Error).message || '';
      /* User closed the popup — not an error, just re-enable the button */
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setLoading(false);
        return;
      }
      if (msg.includes('unauthorized-domain')) {
        setError(t('teacher.unauthorizedDomain'));
      } else {
        setError(msg || t('teacher.authError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      if (mode === 'register') {
        if (!displayName.trim()) return;
        let user;
        try {
          user = await registerWithEmail(email, password, displayName.trim());
        } catch (regErr: unknown) {
          const msg = (regErr as { code?: string }).code ?? '';
          /* If account already exists (e.g. previous failed attempt), try login instead */
          if (msg === 'auth/email-already-in-use') {
            user = await signInWithEmail(email, password);
          } else {
            throw regErr;
          }
        }
        if (user) await handleSuccess(user.uid, user.displayName || displayName.trim(), email);
      } else {
        const user = await signInWithEmail(email, password);
        if (user) await handleSuccess(user.uid, user.displayName || 'Teacher', email);
      }
    } catch (err: unknown) {
      setError((err as Error).message || t('teacher.authError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="card w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-4 text-center">{t('teacher.login')}</h2>

        {error && (
          <div className="bg-red-100 text-red-700 rounded-xl px-4 py-2 mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Google sign-in */}
        <Button
          variant="blue"
          size="md"
          className="w-full mb-4"
          onClick={handleGoogle}
          disabled={loading}
        >
          {t('teacher.googleSignIn')}
        </Button>

        <div className="text-center text-gray-400 text-sm mb-4">{t('teacher.or')}</div>

        {/* Email/Password form */}
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          {mode === 'register' && (
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('teacher.namePlaceholder')}
              className="w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none focus:border-ludiko-purple"
              maxLength={40}
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('teacher.emailPlaceholder')}
            className="w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none focus:border-ludiko-purple"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('teacher.passwordPlaceholder')}
            className="w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none focus:border-ludiko-purple"
            minLength={6}
          />
          <Button
            variant="green"
            size="md"
            className="w-full"
            disabled={loading || !email || !password}
          >
            {mode === 'register' ? t('teacher.register') : t('teacher.signIn')}
          </Button>
        </form>

        <button
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="mt-4 w-full text-center text-sm text-ludiko-purple hover:underline"
        >
          {mode === 'login' ? t('teacher.switchToRegister') : t('teacher.switchToLogin')}
        </button>

        <Button
          variant="orange"
          size="md"
          className="w-full mt-4"
          onClick={() => navigate('/')}
        >
          {t('teacher.backToHome')}
        </Button>
      </div>
    </div>
  );
}
