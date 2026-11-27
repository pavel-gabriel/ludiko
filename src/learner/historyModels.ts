/**
 * Read models for the "Extra pentru familie" progress history (parents only). Pure functions over data that is
 * already stored on the device (ProfileProgress: skills, playDays, missions, levelHistory), never over engine
 * internals. Nothing here writes, and every number is an honest estimate from what exists:
 *  - "mastered per week" dates a skill by its last state change (`stateChangedAt`); skills the level check found
 *    already known have no such date and are not counted as weekly progress;
 *  - practice time is estimated from the day's stored missions (kept for 14 days), else a flat per-day guess.
 */
import { getAllSkills } from '@/engine/content/registry';
import type { SubjectId } from '@/engine/types';
import { toDayString } from '@/profiles/profileService';
import type { ChildProfile, ProfileProgress } from '@/profiles/types';
import type { LevelHistoryEntry, Mission } from './contract';
import { DAY_MS } from './time';

export const HISTORY_WEEKS = 12;
export const CALENDAR_WEEKS = 8;
/** Minutes assumed for a play day that has no stored mission to measure */
export const DEFAULT_DAY_MINUTES = 5;
const MONTH_DAYS = 30;

/** Local midnight of the Monday of the week containing `ts` */
export function mondayOf(ts: number): Date {
  const d = new Date(ts);
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

/** How many whole weeks before the current week `ts` falls (0 = this week, negative = future) */
function weeksAgo(ts: number, now: number): number {
  const days = Math.round((mondayOf(now).getTime() - mondayOf(ts).getTime()) / DAY_MS);
  return Math.floor(days / 7);
}

export interface SubjectHistory {
  subject: SubjectId;
  /** Level-check results, oldest first (a copy of levelHistory) */
  checks: LevelHistoryEntry[];
  /** Skills that reached mastered in each of the last HISTORY_WEEKS weeks, oldest first */
  weeklyMastered: number[];
  masteredTotal: number;
  totalSkills: number;
}

export interface CalendarDay {
  /** YYYY-MM-DD (local) */
  day: string;
  /** 0 = no play, 1 = played, 2 = played and finished part of a mission, 3 = two or more missions worked on */
  level: 0 | 1 | 2 | 3;
  /** After today: drawn as an empty slot, never as a missed day */
  future: boolean;
}

export interface MonthChange {
  /** Skills that reached mastered in the last 30 days, all subjects */
  newlyMastered: number;
  bySubject: {
    subject: SubjectId;
    newlyMastered: number;
    /** When a level check was done in the last 30 days and an earlier one exists: change in the number of gaps */
    gapDelta?: number;
    checkedThisMonth: boolean;
  }[];
  playDays: number;
  playDaysBefore: number;
  minutes: number;
}

export interface ProgressHistory {
  profileId: string;
  now: number;
  /** Monday (YYYY-MM-DD) of each of the HISTORY_WEEKS weeks, oldest first */
  weekStarts: string[];
  subjects: SubjectHistory[];
  /** Sum over subjects, per week, oldest first */
  weeklyMastered: number[];
  /** CALENDAR_WEEKS rows (oldest first) of 7 days (Monday first) */
  calendar: CalendarDay[][];
  playDaysInCalendar: number;
  practice: {
    /** Estimated minutes for each of the last CALENDAR_WEEKS weeks, oldest first */
    weeklyMinutes: number[];
    totalMinutes: number;
    daysCounted: number;
  };
  month: MonthChange;
}

/** Messages for "what changed this month"; the UI maps `key` + `vars` onto family.extras.month.* strings */
export interface MonthMessage {
  key: 'none' | 'mastered' | 'subjectMastered' | 'gapsDown' | 'checked' | 'playDays' | 'playDaysMore' | 'minutes';
  vars: Record<string, string | number>;
}

function subjectOfSkill(): Map<string, SubjectId> {
  return new Map(getAllSkills().map((s) => [s.id, s.subject] as const));
}

function allSubjects(): SubjectId[] {
  return [...new Set(getAllSkills().map((s) => s.subject))].sort();
}

function missionsOn(progress: ProfileProgress, day: string): Mission[] {
  return (progress.missions ?? []).filter((m) => m.day === day && m.steps.some((s) => s.done));
}

/** Estimated minutes spent on a play day (see the file comment) */
export function estimateDayMinutes(progress: ProfileProgress, day: string): number {
  const missions = missionsOn(progress, day);
  if (missions.length === 0) return DEFAULT_DAY_MINUTES;
  const seconds = missions.reduce((sum, m) => {
    const done = m.steps.filter((s) => s.done).length;
    return sum + (m.estimatedSeconds * done) / Math.max(1, m.steps.length);
  }, 0);
  return Math.max(1, Math.round(seconds / 60));
}

/** Plain-words messages for the last 30 days; never "worse" language, a quiet month is just a quiet month */
export function monthChangeMessages(m: MonthChange): MonthMessage[] {
  const out: MonthMessage[] = [];
  if (m.newlyMastered > 0) out.push({ key: 'mastered', vars: { count: m.newlyMastered } });
  const masteredIn = m.bySubject.filter((x) => x.newlyMastered > 0);
  for (const s of m.bySubject) {
    if (s.newlyMastered > 0 && masteredIn.length > 1) {
      out.push({ key: 'subjectMastered', vars: { subject: s.subject, count: s.newlyMastered } });
    }
    if (s.gapDelta !== undefined && s.gapDelta < 0) {
      out.push({ key: 'gapsDown', vars: { subject: s.subject, count: -s.gapDelta } });
    } else if (s.checkedThisMonth) {
      out.push({ key: 'checked', vars: { subject: s.subject } });
    }
  }
  if (m.playDays > 0) {
    out.push({ key: m.playDays > m.playDaysBefore ? 'playDaysMore' : 'playDays', vars: { count: m.playDays, before: m.playDaysBefore } });
    out.push({ key: 'minutes', vars: { count: m.minutes } });
  }
  return out.length ? out : [{ key: 'none', vars: {} }];
}

function noonOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}

export function buildProgressHistory(progress: ProfileProgress, now: number): ProgressHistory {
  const bySkill = subjectOfSkill();
  const subjects = allSubjects();
  const monday = mondayOf(now);
  const weekStarts = Array.from({ length: HISTORY_WEEKS }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() - 7 * (HISTORY_WEEKS - 1 - i));
    return toDayString(d.getTime());
  });

  const weekly = new Map<SubjectId, number[]>(subjects.map((s) => [s, new Array<number>(HISTORY_WEEKS).fill(0)]));
  const monthMastered = new Map<SubjectId, number>();
  const totals = new Map<SubjectId, { mastered: number; total: number }>(subjects.map((s) => [s, { mastered: 0, total: 0 }]));
  for (const skill of getAllSkills()) totals.get(skill.subject)!.total++;
  const monthStart = now - MONTH_DAYS * DAY_MS;
  for (const [id, rec] of Object.entries(progress.skills)) {
    const subject = bySkill.get(id);
    if (!subject || rec.state !== 'mastered') continue;
    totals.get(subject)!.mastered++;
    const at = rec.stateChangedAt;
    if (at === undefined || at > now) continue;
    const ago = weeksAgo(at, now);
    if (ago >= 0 && ago < HISTORY_WEEKS) weekly.get(subject)![HISTORY_WEEKS - 1 - ago]++;
    if (at > monthStart) monthMastered.set(subject, (monthMastered.get(subject) ?? 0) + 1);
  }

  // calendar: CALENDAR_WEEKS Monday-first rows ending with the current week
  const played = new Set(progress.playDays);
  const today = toDayString(now);
  let playDaysInCalendar = 0;
  const calendar: CalendarDay[][] = Array.from({ length: CALENDAR_WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(monday);
      date.setDate(date.getDate() - 7 * (CALENDAR_WEEKS - 1 - w) + d);
      const day = toDayString(date.getTime());
      const future = day > today;
      const isPlayed = !future && played.has(day);
      if (isPlayed) playDaysInCalendar++;
      const worked = isPlayed ? missionsOn(progress, day).length : 0;
      const level = (isPlayed ? (worked >= 2 ? 3 : worked === 1 ? 2 : 1) : 0) as CalendarDay['level'];
      return { day, level, future };
    }),
  );

  const weeklyMinutes = new Array<number>(CALENDAR_WEEKS).fill(0);
  let daysCounted = 0;
  calendar.forEach((row, w) =>
    row.forEach((c) => {
      if (c.level > 0) {
        weeklyMinutes[w] += estimateDayMinutes(progress, c.day);
        daysCounted++;
      }
    }),
  );

  const subjectHistories: SubjectHistory[] = subjects.map((subject) => ({
    subject,
    checks: [...(progress.levelHistory?.[subject] ?? [])],
    weeklyMastered: weekly.get(subject)!,
    masteredTotal: totals.get(subject)!.mastered,
    totalSkills: totals.get(subject)!.total,
  }));

  // last 30 days vs the 30 before
  const monthDays = progress.playDays.filter((d) => noonOf(d) > monthStart && noonOf(d) <= now + DAY_MS);
  const beforeDays = progress.playDays.filter((d) => noonOf(d) > monthStart - MONTH_DAYS * DAY_MS && noonOf(d) <= monthStart);
  const month: MonthChange = {
    newlyMastered: [...monthMastered.values()].reduce((a, b) => a + b, 0),
    bySubject: subjectHistories
      .map((s) => {
        const last = s.checks[s.checks.length - 1];
        const prev = s.checks[s.checks.length - 2];
        const checkedThisMonth = !!last && last.at > monthStart && last.at <= now;
        return {
          subject: s.subject,
          newlyMastered: monthMastered.get(s.subject) ?? 0,
          checkedThisMonth,
          ...(checkedThisMonth && prev ? { gapDelta: last.missingCount - prev.missingCount } : {}),
        };
      })
      .filter((s) => s.newlyMastered > 0 || s.checkedThisMonth),
    playDays: monthDays.length,
    playDaysBefore: beforeDays.length,
    minutes: monthDays.reduce((sum, d) => sum + estimateDayMinutes(progress, d), 0),
  };

  return {
    profileId: progress.profileId,
    now,
    weekStarts,
    subjects: subjectHistories,
    weeklyMastered: weekStarts.map((_, i) => subjectHistories.reduce((sum, s) => sum + s.weeklyMastered[i], 0)),
    calendar,
    playDaysInCalendar,
    practice: { weeklyMinutes, totalMinutes: weeklyMinutes.reduce((a, b) => a + b, 0), daysCounted },
    month,
  };
}

/* ---------------- several children ---------------- */

export interface FamilyRow {
  profileId: string;
  nickname: string;
  avatar: string;
  grade: number;
  playDaysThisWeek: number;
  masteredTotal: number;
  checksDone: number;
  stars: number;
  /** YYYY-MM-DD of the latest play day */
  lastPlayDay?: string;
}

/** One line of the family dashboard */
export function buildFamilyRow(profile: ChildProfile, progress: ProfileProgress, now: number): FamilyRow {
  const bySkill = subjectOfSkill();
  const today = toDayString(now);
  const last7 = new Set(Array.from({ length: 7 }, (_, i) => toDayString(now - i * DAY_MS)));
  return {
    profileId: profile.id,
    nickname: profile.nickname,
    avatar: profile.avatar,
    grade: profile.grade,
    playDaysThisWeek: progress.playDays.filter((d) => last7.has(d)).length,
    masteredTotal: Object.entries(progress.skills).filter(([id, r]) => r.state === 'mastered' && bySkill.has(id)).length,
    checksDone: Object.values(progress.placements ?? {}).filter((p) => p?.completedAt !== undefined).length,
    stars: progress.stars,
    lastPlayDay: [...progress.playDays].filter((d) => d <= today).sort().pop(),
  };
}
