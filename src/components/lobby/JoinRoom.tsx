import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { useRoomStore } from '@/store/roomStore';
import { joinRoomByCode } from '@/services/roomManager';
import { ensureAnonymousAuth } from '@/services/authService';
import EmojiPicker, { EMOJI_OPTIONS } from '@/components/ui/EmojiPicker';

export default function JoinRoom() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setRoom, setCurrentPlayer } = useRoomStore();

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(EMOJI_OPTIONS[Math.floor(Math.random() * EMOJI_OPTIONS.length)]);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!name.trim() || !code.trim() || loading) return;
    setLoading(true);
    setError('');

    try {
      /* Anonymous sign-in before any RTDB write (no PII, GDPR safe) */
      await ensureAnonymousAuth();
      const result = await joinRoomByCode(code.toUpperCase(), name.trim(), avatar);
      if (!result) {
        setError(t('join.invalidCode'));
        return;
      }
      setRoom(result.room);
      setCurrentPlayer(result.player);
      navigate('/lobby');
    } catch {
      setError(t('join.invalidCode'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="card w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">{t('join.title')}</h2>

        <label className="block mb-2">
          <span className="text-sm font-semibold">{t('join.yourName')}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('join.namePlaceholder')}
            className="mt-1 w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none focus:border-ludiko-purple"
            maxLength={20}
          />
        </label>

        {/* Avatar picker */}
        <div className="mb-4">
          <span className="text-sm font-semibold">{t('create.avatar')}</span>
          <EmojiPicker selected={avatar} onChange={setAvatar} />
        </div>

        <label className="block mb-4">
          <span className="text-sm font-semibold">{t('join.roomCode')}</span>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError('');
            }}
            placeholder={t('join.codePlaceholder')}
            className="mt-1 w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none focus:border-ludiko-purple uppercase tracking-widest text-center text-xl font-bold"
            maxLength={6}
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </label>

        <div className="flex gap-3">
          <Button variant="orange" size="md" onClick={() => navigate('/')}>
            {t('join.back')}
          </Button>
          <Button
            variant="blue"
            size="md"
            className="flex-1"
            onClick={handleJoin}
            disabled={!name.trim() || code.length < 6 || loading}
          >
            {t('join.join')}
          </Button>
        </div>
      </div>
    </div>
  );
}
