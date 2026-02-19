import type { Room, Player, GameSettings } from '@/utils/types';
import { ROOM_CODE_LENGTH, DEFAULT_GAME_SETTINGS, AVATARS } from '@/utils/constants';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generatePlayerId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function createRoom(hostName: string, settings?: Partial<GameSettings>): Room {
  const hostId = generatePlayerId();
  return {
    id: generatePlayerId(),
    code: generateRoomCode(),
    hostId,
    players: [
      {
        id: hostId,
        name: hostName,
        avatar: AVATARS[0],
        score: 0,
        isHost: true,
        isReady: true,
      },
    ],
    status: 'waiting',
    settings: { ...DEFAULT_GAME_SETTINGS, ...settings },
    createdAt: Date.now(),
  };
}

export function addPlayerToRoom(room: Room, playerName: string): Player {
  const avatarIndex = room.players.length % AVATARS.length;
  const player: Player = {
    id: generatePlayerId(),
    name: playerName,
    avatar: AVATARS[avatarIndex],
    score: 0,
    isHost: false,
    isReady: false,
  };
  room.players.push(player);
  return player;
}

export function removePlayerFromRoom(room: Room, playerId: string): void {
  room.players = room.players.filter((p) => p.id !== playerId);
}

// TODO: Wire up to Firestore
export async function createRoomInFirestore(_room: Room): Promise<void> {
  // await setDoc(doc(db, 'rooms', room.id), room);
}

export async function joinRoomByCode(_code: string, _playerName: string): Promise<Room | null> {
  // const q = query(collection(db, 'rooms'), where('code', '==', code));
  // const snapshot = await getDocs(q);
  // ...
  return null;
}

export async function listenToRoom(
  _roomId: string,
  _callback: (room: Room) => void,
): Promise<() => void> {
  // return onSnapshot(doc(db, 'rooms', roomId), (doc) => callback(doc.data()));
  return () => {};
}
