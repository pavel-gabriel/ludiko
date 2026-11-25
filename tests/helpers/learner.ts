import { applyMasteryCheck, updateMastery, DAY_MS, type MasteryRecord } from '../../src/engine/mastery';
import { placementResult, progressFromPlacement } from '../../src/engine/diagnostic';
import { planMission, type Mission } from '../../src/engine/planner';
import type { Skill } from '../../src/engine/types';
import { rng as makeRng, runPlacement } from './engineSim';

/**
 * Simulated learner: a skill is answered correctly with p=1−slip when known, else with p=guess.
 * Practising a skill whose prerequisites are all known teaches it with p=pLearn per item.
 */
export interface LearnerOpts {
  seed: number;
  known: Set<string>;
  slip?: number;
  guess?: number;
  pLearn?: number;
}

export interface SimReport {
  gapsAfterPlacement: number;
  gapHistory: number[];
  masteredHistory: number[];
  missions: Mission[];
  progress: Record<string, MasteryRecord>;
  known: Set<string>;
}

export function simulate(skills: Skill[], opts: LearnerOpts, sessions: number, start = Date.UTC(2026, 8, 15, 15)): SimReport {
  const rand = makeRng(opts.seed);
  const slip = opts.slip ?? 0.08;
  const guess = opts.guess ?? 0.05;
  const pLearn = opts.pLearn ?? 0.2;
  const known = new Set(opts.known);
  const byId = new Map(skills.map((s) => [s.id, s]));
  const answer = (id: string): boolean => {
    const correct = known.has(id) ? rand() > slip : rand() < guess;
    if (!known.has(id) && byId.get(id)!.prerequisites.every((p) => known.has(p)) && rand() < pLearn) known.add(id);
    return correct;
  };

  const placement = placementResult(runPlacement(skills, (id) => answer(id), { grade: 2, semester: 2 }));
  let now = start;
  const progress: Record<string, MasteryRecord> = progressFromPlacement(placement, now);
  const count = (st: string) => Object.values(progress).filter((r) => r.state === st).length;
  const gapHistory = [count('gap')];
  const masteredHistory = [count('mastered')];
  const missions: Mission[] = [];

  for (let day = 0; day < sessions; day++) {
    now += DAY_MS;
    const mission = planMission(skills, progress, { now });
    missions.push(mission);
    for (const step of mission.steps) {
      const skill = byId.get(step.skillId)!;
      if (step.kind === 'check') {
        const results = Array.from({ length: step.itemCount }, () => answer(step.skillId));
        progress[step.skillId] = applyMasteryCheck(progress[step.skillId], results, skill.masteryCheck, {
          itemType: 'number-input',
          now,
        }).record;
      } else {
        for (let i = 0; i < step.itemCount; i++) {
          progress[step.skillId] = updateMastery(progress[step.skillId], { correct: answer(step.skillId), itemType: 'number-input', now });
        }
      }
    }
    gapHistory.push(count('gap'));
    masteredHistory.push(count('mastered'));
  }
  return { gapsAfterPlacement: placement.gaps.length, gapHistory, masteredHistory, missions, progress, known };
}
