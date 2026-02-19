import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db, firebaseEnabled } from '@/services/firebase';
import type { GameType, GameMode, Difficulty } from '@/utils/types';

/** A saved game result stored in Firestore /gameHistory */
export interface GameHistoryEntry {
  /** Room code for reference */
  roomCode: string;
  /** Which game was played */
  gameType: GameType;
  /** Which mode was used */
  gameMode: GameMode;
  /** Difficulty setting */
  difficulty: Difficulty;
  /** Number of players */
  playerCount: number;
  /** Per-player results sorted by rank */
  results: PlayerResult[];
  /** Firestore server timestamp */
  createdAt: ReturnType<typeof serverTimestamp>;
}

export interface PlayerResult {
  name: string;
  avatar: string;
  score: number;
  totalQuestions: number;
  accuracy: number;
  rank: number;
}

/**
 * Save a completed game to Firestore history.
 * Called when a game finishes (from GameResults component).
 */
export async function saveGameHistory(entry: GameHistoryEntry): Promise<string> {
  if (!firebaseEnabled) return '';
  const docRef = await addDoc(collection(db, 'gameHistory'), entry);
  return docRef.id;
}

/** Leaderboard entry for display */
export interface LeaderboardEntry {
  name: string;
  avatar: string;
  wins: number;
  totalGames: number;
  avgAccuracy: number;
}

/**
 * Fetch recent game history (up to the last 50 games).
 * Used to compute the persistent leaderboard.
 */
export async function fetchRecentHistory(
  maxResults = 50,
): Promise<GameHistoryEntry[]> {
  if (!firebaseEnabled) return [];
  const q = query(
    collection(db, 'gameHistory'),
    orderBy('createdAt', 'desc'),
    limit(maxResults),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as GameHistoryEntry);
}

/**
 * Compute a leaderboard from game history entries.
 * Aggregates wins, total games, and average accuracy per player name.
 */
export function computeLeaderboard(entries: GameHistoryEntry[]): LeaderboardEntry[] {
  const stats: Record<string, {
    name: string;
    avatar: string;
    wins: number;
    totalGames: number;
    totalAccuracy: number;
  }> = {};

  for (const entry of entries) {
    for (const result of entry.results) {
      const key = result.name;
      if (!stats[key]) {
        stats[key] = {
          name: result.name,
          avatar: result.avatar,
          wins: 0,
          totalGames: 0,
          totalAccuracy: 0,
        };
      }
      stats[key].totalGames += 1;
      stats[key].totalAccuracy += result.accuracy;
      if (result.rank === 1) {
        stats[key].wins += 1;
      }
      /* Use latest avatar */
      stats[key].avatar = result.avatar;
    }
  }

  return Object.values(stats)
    .map((s) => ({
      name: s.name,
      avatar: s.avatar,
      wins: s.wins,
      totalGames: s.totalGames,
      avgAccuracy: s.totalGames > 0 ? Math.round(s.totalAccuracy / s.totalGames) : 0,
    }))
    .sort((a, b) => b.wins - a.wins || b.avgAccuracy - a.avgAccuracy);
}
