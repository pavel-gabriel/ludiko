/**
 * The teacher's session wizard: pure model (no React, no Firebase).
 *
 * Same building blocks as the game setup wizard (`components/setup`): the game part of a session is a
 * `SetupChoices` and becomes room settings through `toRoomSettings`; the teacher adds the class part
 * (title, classroom mode, global timer, student codes).
 *
 *   Step 1 "Ce jucăm?"      Cursă / Sprint / Memorie (memory = picture pairs, no skills)
 *   Step 2 "Ce exersăm?"    presets for the class grade +-1, "Alege singur", "Jocul clasic" (not for memory)
 *   Step 3 "Clasa"          title, classroom mode, global timer, student codes and labels
 *   Step 4 "Gata?"          summary + Save / Start
 */
import type { Grade } from '@/engine/types';
import { generateStudentCodes } from '@/services/teacherService';
import type { ClassroomMode, ClassroomSession, GameSettings, StudentCode } from '@/utils/types';
import { DEFAULT_GAME_SETTINGS } from '@/utils/constants';
import {
  CLASSIC_TYPES,
  defaultChoices,
  practiceIssue,
  toRoomSettings,
  type SetupChoices,
  type SetupMode,
} from '@/components/setup/setupModel';

export type TeacherStep = 'mode' | 'practice' | 'class' | 'ready';

/** Memory is "finding pairs" with pictures: no "Ce exersăm?" step */
export function teacherStepsFor(mode: SetupMode): readonly TeacherStep[] {
  return mode === 'memory' ? ['mode', 'class', 'ready'] : ['mode', 'practice', 'class', 'ready'];
}

export const MAX_STUDENTS = 30;
export const DEFAULT_STUDENTS = 10;
export const DEFAULT_GLOBAL_TIMER = 300;
export const MAX_TITLE = 60;
export const MAX_LABEL = 30;

export interface SessionDraft {
  title: string;
  choices: SetupChoices;
  classroomMode: ClassroomMode;
  /** Seconds, 0 = no limit */
  globalTimer: number;
  studentCodes: StudentCode[];
}

export interface SessionPayload {
  title: string;
  settings: GameSettings;
  classroomMode: ClassroomMode;
  globalTimer: number;
  studentCodes: StudentCode[];
}

/* the teacher never plays: the animal identities of SetupChoices are unused here */
const NO_ONE = { animal: 0, adjective: 0 };

export function newDraft(): SessionDraft {
  return {
    title: '',
    choices: defaultChoices(NO_ONE, NO_ONE),
    classroomMode: 'selfPaced',
    globalTimer: DEFAULT_GLOBAL_TIMER,
    studentCodes: generateStudentCodes(DEFAULT_STUDENTS),
  };
}

/* ------------------------------------------------------------------ */
/*  Validation                                                        */
/* ------------------------------------------------------------------ */

export type ClassIssue = 'title' | 'students' | null;

/** Step 3 is done with a title and at least one student code */
export function classIssue(d: Pick<SessionDraft, 'title' | 'studentCodes'>): ClassIssue {
  if (!d.title.trim()) return 'title';
  if (d.studentCodes.length < 1 || d.studentCodes.length > MAX_STUDENTS) return 'students';
  return null;
}

/** First step that blocks saving, or null */
export function firstBlockedTeacherStep(d: SessionDraft): TeacherStep | null {
  if (practiceIssue(d.choices)) return 'practice';
  if (classIssue(d)) return 'class';
  return null;
}

/* ------------------------------------------------------------------ */
/*  Draft <-> session                                                 */
/* ------------------------------------------------------------------ */

/** What gets saved: the room settings (same as the game wizard) plus the class part */
export function draftToSession(d: SessionDraft): SessionPayload {
  return {
    title: d.title.trim(),
    settings: toRoomSettings('room', d.choices),
    classroomMode: d.classroomMode,
    globalTimer: Math.max(0, Math.floor(d.globalTimer) || 0),
    studentCodes: d.studentCodes.map((c) => ({ code: c.code, label: c.label.trim() || c.code })),
  };
}

/** The wizard choices a saved session's settings stand for (old v1 sessions too) */
export function choicesFromSettings(s: GameSettings): SetupChoices {
  const base = defaultChoices(NO_ONE, NO_ONE);
  const mode: SetupMode = s.gameType === 'memoryGame' ? 'memory' : s.gameMode === 'timedSprint' ? 'sprint' : 'race';
  const skillIds = mode === 'memory' ? [] : [...(s.skillIds ?? [])];
  return ({
    ...base,
    mode,
    skillIds,
    classic: mode !== 'memory' && skillIds.length === 0,
    classicType: CLASSIC_TYPES.includes(s.gameType) ? s.gameType : DEFAULT_GAME_SETTINGS.gameType,
    operations: s.operations?.length ? [...s.operations] : base.operations,
    shapeMode: s.shapeMode ?? base.shapeMode,
    difficulty: s.difficulty ?? base.difficulty,
    rounds: s.rounds ?? base.rounds,
    timePerRound: s.timePerRound ?? base.timePerRound,
  });
}

export function draftFromSession(s: ClassroomSession): SessionDraft {
  return {
    title: s.title,
    choices: choicesFromSettings(s.settings),
    classroomMode: s.classroomMode,
    globalTimer: s.globalTimer,
    studentCodes: s.studentCodes.map((c) => ({ ...c })),
  };
}

/** "Repetă sesiunea": same title, settings and labels, but a fresh set of codes (the old ones were handed out) */
export function repeatDraft(s: ClassroomSession): SessionDraft {
  const d = draftFromSession(s);
  return { ...d, studentCodes: regenerateCodes(d.studentCodes) };
}

/* ------------------------------------------------------------------ */
/*  Student codes                                                     */
/* ------------------------------------------------------------------ */

/** New codes, same labels (and the same number of students) */
export function regenerateCodes(codes: StudentCode[]): StudentCode[] {
  const fresh = generateStudentCodes(codes.length);
  return fresh.map((c, i) => ({ code: c.code, label: codes[i].label }));
}

/** Exactly `count` students: the first ones stay as they are, extra ones get new unique codes ("Student N") */
export function resizeCodes(codes: StudentCode[], count: number): StudentCode[] {
  const n = Math.max(0, Math.min(MAX_STUDENTS, Math.floor(count) || 0));
  if (n <= codes.length) return codes.slice(0, n);
  const used = new Set(codes.map((c) => c.code));
  const out = [...codes];
  for (const c of generateStudentCodes(MAX_STUDENTS + codes.length)) {
    if (out.length >= n) break;
    if (used.has(c.code)) continue;
    used.add(c.code);
    out.push({ code: c.code, label: `Student ${out.length + 1}` });
  }
  return out;
}

/** Grade of the class: presets show the grade +-1 */
export type ClassGrade = Grade | null;
