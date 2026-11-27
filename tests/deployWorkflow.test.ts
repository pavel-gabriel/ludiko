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

describe('build-android task (Play Store AAB)', () => {
  it('is a manual task in the existing workflow, not a new workflow file', () => {
    expect(wf).toMatch(/options:[\s\S]*- build-android/)
    expect(wf).toContain('\n  build-android:')
    expect(wf).toMatch(/build-android:\s*\n\s*if: github\.event_name == 'workflow_dispatch' && inputs\.task == 'build-android'/)
    expect(existsSync(join(ROOT, '.github/workflows/build-android.yml'))).toBe(false)
  })
  it('pins Bubblewrap to an exact version and never uses @latest', () => {
    expect(wf).toMatch(/BUBBLEWRAP_CLI: '@bubblewrap\/cli@\d+\.\d+\.\d+'/)
    expect(wf).not.toMatch(/bubblewrap\/cli@(latest|\^|~)/)
  })
  it('only builds when all four signing secrets exist, otherwise warns and exits cleanly', () => {
    for (const s of ['ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD']) expect(wf).toContain(`secrets.${s}`)
    expect(wf).toContain('::warning::ANDROID_KEYSTORE_BASE64')
    expect(wf).toContain("steps.secrets.outputs.build == 'true'")
  })
  it('never leaves the keystore on the runner', () => {
    expect(wf).toContain('rm -f android.keystore')
  })
})

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
