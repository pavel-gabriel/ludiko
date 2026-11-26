import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import CloseButton from '@/components/ui/CloseButton';
import { useRoomStore } from '@/store/roomStore';
import { joinRoomByCode, lookupRoomByCode, registerDisconnectCleanup } from '@/services/roomManager';
import { ensureAnonymousAuth } from '@/services/authService';
import { isStudentCodeValid } from '@/services/teacherService';
import AnimalNamePicker from '@/components/ui/AnimalNamePicker';
import EmojiPicker from '@/components/ui/EmojiPicker';
import { identityAvatar, identityName, identityWithAvatar, randomIdentity } from '@/utils/animalNames';

export default function JoinRoom() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setRoom, setCurrentPlayer } = useRoomStore();

  /* A child never types a name: an animal name is picked (it is also the avatar). In a classroom room the
     only text field is the student code the teacher handed out; it is checked against the teacher's list. */
  const [identity, setIdentity] = useState(() => randomIdentity());
  const [studentCode, setStudentCode] = useState('');
  const avatar = identityAvatar(identity);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [takenAvatars, setTakenAvatars] = useState<string[]>([]);
  const [isClassroom, setIsClassroom] = useState(false);

  /* When the code reaches 6 chars, look up the room to find taken avatars and check if classroom */
  useEffect(() => {
    if (code.length < 6) {
      setTakenAvatars([]);
      setIsClassroom(false);
      return;
    }
    let cancelled = false;
    /* RTDB reads require auth — sign in anonymously before the lookup */
    ensureAnonymousAuth().then(() => lookupRoomByCode(code)).then(async (room) => {
      if (cancelled || !room) return;
      const taken = room.players.map((p) => p.avatar);
      setTakenAvatars(taken);
      /* If the current animal is taken, switch to a free one */
      setIdentity((cur) => (taken.includes(identityAvatar(cur)) ? randomIdentity(taken) : cur));
      /* Show the student-code UI when this is a classroom session
         (authoritative validation happens in handleJoin) */
      setIsClassroom(Boolean(room.classroomSessionId));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [code]);

  const handleJoin = async () => {
    if (!code.trim() || loading || (isClassroom && !studentCode.trim())) return;

    setLoading(true);
    setError('');

    try {
      /* Anonymous sign-in before any RTDB access (no PII, GDPR safe) */
      await ensureAnonymousAuth();

      /* Authoritative classroom check — the pre-flight effect is only for
         UI hints and can be skipped/raced, so validate again here */
      const targetRoom = await lookupRoomByCode(code);
      if (!targetRoom) {
        setError(t('join.invalidCode'));
        return;
      }
      let playerName = identityName(identity, i18n.language);
      if (targetRoom.classroomSessionId) {
        /* exact-key read of the teacher's code index: students cannot read the session itself */
        const wanted = studentCode.trim().toUpperCase();
        if (!(await isStudentCodeValid(targetRoom.classroomSessionId, wanted))) {
          setError(t('join.invalidStudentCode'));
          return;
        }
        playerName = wanted;
      }

      const result = await joinRoomByCode(code.toUpperCase(), playerName, avatar);
      if (!result) {
        setError(t('join.invalidCode'));
        return;
      }
      registerDisconnectCleanup(result.room.id, false, result.player.id);
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
      <div className="card w-full max-w-md relative" role="main">
        <CloseButton />
        <h2 className="text-2xl font-bold mb-6 text-center">{t('join.title')}</h2>

        {isClassroom ? (
          <>
            <label className="block mb-2">
              <span className="text-sm font-semibold">{t('join.studentCode')}</span>
              <input
                type="text"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                placeholder={t('join.studentCodePlaceholder')}
                className="mt-1 w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none focus:border-ludiko-purple uppercase"
                maxLength={20}
                autoComplete="off"
              />
              <p className="text-xs text-ludiko-purple mt-1">{t('join.classroomHint')}</p>
            </label>
            {/* Avatar picker (a classroom player is shown by the teacher's code, not by an animal name) */}
            <div className="mb-4">
              <span className="text-sm font-semibold">{t('create.avatar')}</span>
              <div className="flex flex-wrap gap-2 mt-1">
                <EmojiPicker
                  selected={avatar}
                  onChange={(emoji) => setIdentity((cur) => identityWithAvatar(cur, emoji))}
                  exclude={takenAvatars}
                />
              </div>
            </div>
          </>
        ) : (
          <AnimalNamePicker value={identity} onChange={setIdentity} exclude={takenAvatars} />
        )}

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
          {error && (
            <p className="text-red-500 text-sm mt-1" role="alert" aria-live="assertive">
              {error}
            </p>
          )}
        </label>

        <Button
          variant="blue"
          size="lg"
          className="w-full"
          onClick={handleJoin}
          disabled={code.length < 6 || loading || (isClassroom && !studentCode.trim())}
        >
          {t('join.join')}
        </Button>
      </div>
    </div>
  );
}
