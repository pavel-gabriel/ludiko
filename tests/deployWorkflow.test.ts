import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const wf = readFileSync(join(ROOT, '.github/workflows/deploy.yml'), 'utf8');

describe('deploy workflow (site + Firebase upkeep)', () => {
  it('has the site, rules, reminders and maintenance jobs', () => {
    for (const job of ['build:', 'deploy:', 'firebase-rules:', 'reminders:', 'maintenance:']) expect(wf).toContain(`\n  ${job}`);
  });
  it('runs reminders hourly and never deploys the site on the schedule', () => {
    expect(wf).toMatch(/schedule:\s*\n\s*- cron: '7 \* \* \* \*'/);
    expect(wf).toMatch(/build:\s*\n\s*if: github\.event_name == 'push' \|\|/);
  });
  it('deploys rules only for rules files and only with the deploy secret', () => {
    expect(wf).toContain('firestore\\.rules|database\\.rules\\.json');
    expect(wf).toContain('secrets.FIREBASE_DEPLOY_SERVICE_ACCOUNT');
    expect(wf).toContain('deploy --only firestore:rules,database');
  });
  it('pins the Firebase CLI version', () => {
    expect(wf).toMatch(/firebase-tools@\d+\.\d+\.\d+/);
  });
  it('every maintenance task maps to an existing script', () => {
    for (const task of ['delete-game-history', 'cleanup-reports', 'cleanup-rooms']) {
      expect(wf).toContain(task);
      expect(existsSync(join(ROOT, 'scripts/privacy', `${task}.mjs`)), task).toBe(true);
    }
  });
  it('the separate daily-reminders workflow is gone (no double sends)', () => {
    expect(existsSync(join(ROOT, '.github/workflows/daily-reminders.yml'))).toBe(false);
  });
});

describe('Firebase rules sanity', () => {
  it('RTDB rules use no client-SDK-only methods (numChildren is not available in rules)', () => {
    const rtdb = readFileSync(join(ROOT, 'database.rules.json'), 'utf8');
    expect(rtdb).not.toMatch(/numChildren|\.size\(\)|\.keys\(\)|hasOnly|request\.auth/);
  });
  it('the PR workflow compiles the rules in the emulators', () => {
    const t = readFileSync(join(ROOT, '.github/workflows/test.yml'), 'utf8');
    expect(t).toContain('emulators:exec --only firestore,database');
  });
  it('all workflows use Node 22 (firebase-admin and @google-cloud/firestore require >=22)', () => {
    for (const f of ['deploy.yml', 'test.yml']) {
      const y = readFileSync(join(ROOT, '.github/workflows', f), 'utf8');
      expect(y, f).not.toContain('node-version: 20');
    }
  });
});
