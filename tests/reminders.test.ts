import { describe, it, expect, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import {
  localDayAndHour,
  isDue,
  isValidTimezone,
  dayOfYear,
  pickMessage,
  DEFAULT_TIMEZONE,
} from '../scripts/reminders/logic.mjs';
import {
  runReminders,
  activeSubscriptionPages,
  mapWithConcurrency,
} from '../scripts/send-daily-reminders.mjs';

const ROOT = join(__dirname, '..');
const SENDER = join(ROOT, 'scripts', 'send-daily-reminders.mjs');

// 2026-07-01 15:30 UTC is 18:30 in Europe/Bucharest (EEST, UTC+3)
const SUMMER_EVENING = new Date('2026-07-01T15:30:00Z');

const base = { active: true, hour: 18, timezone: 'Europe/Bucharest', lang: 'ro' };

describe('localDayAndHour', () => {
  it('gives the local day and hour in Europe/Bucharest', () => {
    expect(localDayAndHour(SUMMER_EVENING, 'Europe/Bucharest')).toEqual({ day: '2026-07-01', hour: 18 });
  });

  it('rolls over to the next local day at midnight', () => {
    // 21:30 UTC = 00:30 next day in Bucharest
    expect(localDayAndHour(new Date('2026-07-01T21:30:00Z'), 'Europe/Bucharest')).toEqual({
      day: '2026-07-02',
      hour: 0,
    });
  });

  it('never reports hour 24 at midnight', () => {
    expect(localDayAndHour(new Date('2026-07-01T21:00:00Z'), 'Europe/Bucharest').hour).toBe(0);
  });

  it('handles the spring DST switch (last Sunday of March 2026, 01:00 UTC)', () => {
    // 00:30 UTC = 02:30 EET (before the jump)
    expect(localDayAndHour(new Date('2026-03-29T00:30:00Z'), 'Europe/Bucharest')).toEqual({
      day: '2026-03-29',
      hour: 2,
    });
    // 01:30 UTC = 04:30 EEST (after the jump, 03:00 local is skipped)
    expect(localDayAndHour(new Date('2026-03-29T01:30:00Z'), 'Europe/Bucharest')).toEqual({
      day: '2026-03-29',
      hour: 4,
    });
  });

  it('handles the autumn DST switch (last Sunday of October 2026, 01:00 UTC)', () => {
    // 00:30 UTC = 03:30 EEST (before the fall back)
    expect(localDayAndHour(new Date('2026-10-25T00:30:00Z'), 'Europe/Bucharest')).toEqual({
      day: '2026-10-25',
      hour: 3,
    });
    // 01:30 UTC = 03:30 EET again (the 03:00-04:00 hour repeats)
    expect(localDayAndHour(new Date('2026-10-25T01:30:00Z'), 'Europe/Bucharest')).toEqual({
      day: '2026-10-25',
      hour: 3,
    });
  });

  it('works across timezones, including the previous day in the Americas', () => {
    expect(localDayAndHour(new Date('2026-07-01T02:00:00Z'), 'America/Los_Angeles')).toEqual({
      day: '2026-06-30',
      hour: 19,
    });
    expect(localDayAndHour(new Date('2026-07-01T15:00:00Z'), 'Asia/Tokyo')).toEqual({
      day: '2026-07-02',
      hour: 0,
    });
  });

  it('falls back to Europe/Bucharest for an invalid or missing timezone', () => {
    const expected = localDayAndHour(SUMMER_EVENING, DEFAULT_TIMEZONE);
    expect(DEFAULT_TIMEZONE).toBe('Europe/Bucharest');
    expect(localDayAndHour(SUMMER_EVENING, 'Mars/Olympus_Mons')).toEqual(expected);
    expect(localDayAndHour(SUMMER_EVENING, '')).toEqual(expected);
    expect(localDayAndHour(SUMMER_EVENING, undefined as unknown as string)).toEqual(expected);
  });
});

describe('isValidTimezone', () => {
  it('accepts IANA zones and rejects everything else', () => {
    expect(isValidTimezone('Europe/Bucharest')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
    expect(isValidTimezone(42)).toBe(false);
    expect(isValidTimezone(null)).toBe(false);
  });
});

describe('isDue', () => {
  it('is due at the chosen local hour when nothing was played or sent today', () => {
    expect(isDue(base, SUMMER_EVENING)).toBe(true);
  });

  it('is not due when a bit was already played today', () => {
    expect(isDue({ ...base, lastPlayedDay: '2026-07-01' }, SUMMER_EVENING)).toBe(false);
  });

  it('is not due when a reminder was already sent today', () => {
    expect(isDue({ ...base, lastSentDay: '2026-07-01' }, SUMMER_EVENING)).toBe(false);
  });

  it('is due again when the last play or send was on an earlier day', () => {
    expect(isDue({ ...base, lastPlayedDay: '2026-06-30', lastSentDay: '2026-06-30' }, SUMMER_EVENING)).toBe(true);
  });

  it('is not due at a different local hour', () => {
    expect(isDue({ ...base, hour: 17 }, SUMMER_EVENING)).toBe(false);
    expect(isDue({ ...base, hour: 19 }, SUMMER_EVENING)).toBe(false);
  });

  it('is not due when paused (inactive)', () => {
    expect(isDue({ ...base, active: false }, SUMMER_EVENING)).toBe(false);
  });

  it('is not due outside 08-20, even if the local hour matches', () => {
    expect(isDue({ ...base, hour: 7 }, new Date('2026-07-01T04:30:00Z'))).toBe(false); // 07:30 local
    expect(isDue({ ...base, hour: 21 }, new Date('2026-07-01T18:30:00Z'))).toBe(false); // 21:30 local
    expect(isDue({ ...base, hour: 8 }, new Date('2026-07-01T05:30:00Z'))).toBe(true); // 08:30 local
    expect(isDue({ ...base, hour: 20 }, new Date('2026-07-01T17:30:00Z'))).toBe(true); // 20:30 local
  });

  it('is defensive about missing or malformed fields', () => {
    expect(isDue(null, SUMMER_EVENING)).toBe(false);
    expect(isDue(undefined, SUMMER_EVENING)).toBe(false);
    expect(isDue('active', SUMMER_EVENING)).toBe(false);
    expect(isDue({}, SUMMER_EVENING)).toBe(false);
    expect(isDue({ ...base, active: 'true' }, SUMMER_EVENING)).toBe(false);
    expect(isDue({ ...base, hour: '18' }, SUMMER_EVENING)).toBe(false);
    expect(isDue({ ...base, hour: 18.5 }, SUMMER_EVENING)).toBe(false);
    expect(isDue({ ...base, hour: undefined }, SUMMER_EVENING)).toBe(false);
    expect(isDue({ ...base, timezone: undefined }, SUMMER_EVENING)).toBe(false);
    expect(isDue({ ...base, timezone: 'Mars/Olympus_Mons' }, SUMMER_EVENING)).toBe(false);
    expect(isDue(base, new Date('not a date'))).toBe(false);
    expect(isDue(base, '2026-07-01' as unknown as Date)).toBe(false);
  });

  it('ignores malformed day strings instead of crashing', () => {
    expect(isDue({ ...base, lastPlayedDay: 20260701, lastSentDay: { day: '2026-07-01' } }, SUMMER_EVENING)).toBe(true);
  });
});

describe('dayOfYear and pickMessage', () => {
  it('counts days of the year, including leap years', () => {
    expect(dayOfYear('2026-01-01')).toBe(1);
    expect(dayOfYear('2026-12-31')).toBe(365);
    expect(dayOfYear('2028-12-31')).toBe(366);
    expect(() => dayOfYear('2026-13-01')).not.toThrow();
    expect(dayOfYear('yesterday')).toBe(0);
    expect(dayOfYear(undefined)).toBe(0);
  });

  it('is deterministic for the same language and day', () => {
    expect(pickMessage('ro', '2026-11-25')).toEqual(pickMessage('ro', '2026-11-25'));
    expect(pickMessage('en', '2026-11-25')).toEqual(pickMessage('en', '2026-11-25'));
  });

  it('returns the payload shape from the contract', () => {
    const msg = pickMessage('ro', '2026-11-25');
    expect(Object.keys(msg).sort()).toEqual(['body', 'tag', 'title', 'url']);
    expect(msg.url).toBe('/learn');
    expect(msg.tag).toBe('ludiko-daily');
    expect(msg.title).toBe('Ludiko');
    expect(msg.body.length).toBeGreaterThan(0);
  });

  it('uses Romanian for ro and English for en', () => {
    const ro = new Set<string>();
    const en = new Set<string>();
    for (let d = 1; d <= 10; d++) {
      const day = `2026-01-${String(d).padStart(2, '0')}`;
      ro.add(pickMessage('ro', day).body);
      en.add(pickMessage('en', day).body);
    }
    expect(ro.size).toBe(10);
    expect(en.size).toBe(10);
    for (const body of ro) expect(en.has(body)).toBe(false);
    // Romanian bodies are Romanian (diacritics or common words); English bodies carry no Romanian diacritics
    for (const body of ro) expect(body).toMatch(/[ăâîșț]|azi|joac|numer|Ludiko|Încălzirea|Insula|Bitul/);
    for (const body of en) expect(body).not.toMatch(/[ăâîșț]/);
  });

  it('rotates messages day by day and falls back to Romanian for unknown languages', () => {
    expect(pickMessage('ro', '2026-03-01').body).not.toBe(pickMessage('ro', '2026-03-02').body);
    expect(pickMessage('fr', '2026-03-01')).toEqual(pickMessage('ro', '2026-03-01'));
  });

  it('never uses guilt or loss language', () => {
    const banned = /streak|seria|pierzi|pierde|lose|losing|miss out|nu uita|ratezi|ai ratat/i;
    for (const lang of ['ro', 'en'] as const) {
      for (let d = 0; d < 366; d++) {
        const day = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
        expect(pickMessage(lang, day).body).not.toMatch(banned);
      }
    }
  });
});

describe('sender with missing secrets', () => {
  it('exits 0 and logs the notice when no secrets are set (real process, no Firebase)', () => {
    const result = spawnSync(process.execPath, [SENDER], { env: {}, encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('reminders disabled: missing secrets');
  });

  it('does not touch Firebase or web-push when a secret is missing (injected mocks)', async () => {
    const firebase = vi.fn();
    const webPush = vi.fn();
    const log = vi.fn();
    const complete = {
      VAPID_PUBLIC_KEY: 'pub',
      VAPID_PRIVATE_KEY: 'priv',
      VAPID_SUBJECT: 'mailto:owner@example.org',
      FIREBASE_SERVICE_ACCOUNT: '{}',
    };
    for (const name of Object.keys(complete)) {
      const env = { ...complete, [name]: '' };
      const { exitCode } = await runReminders({ env, log, deps: { firebase, webPush } });
      expect(exitCode).toBe(0);
    }
    const { exitCode } = await runReminders({ env: {}, log, deps: { firebase, webPush } });
    expect(exitCode).toBe(0);
    expect(firebase).not.toHaveBeenCalled();
    expect(webPush).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('reminders disabled: missing secrets');
  });
});

/** Minimal in-memory stand-in for the Firestore calls the sender makes. */
function fakeFirestore(rows: Array<{ id: string; data: Record<string, unknown> }>) {
  const store = new Map(rows.map((r) => [r.id, { id: r.id, data: { ...r.data } }]));
  const calls = { updates: [] as Array<{ id: string; patch: unknown }>, deletes: [] as string[] };
  const FieldPath = { documentId: () => '__name__' };

  const makeSnap = (id: string) => {
    const row = store.get(id)!;
    return {
      id,
      data: () => ({ ...row.data }),
      ref: {
        update: async (patch: Record<string, unknown>) => {
          calls.updates.push({ id, patch });
          Object.assign(store.get(id)!.data, patch);
        },
        delete: async () => {
          calls.deletes.push(id);
          store.delete(id);
        },
      },
    };
  };

  function query(filters: Array<{ field: string; value: unknown }>, limit = Infinity, after: string | null = null) {
    return {
      where: (field: string, _op: string, value: unknown) => query([...filters, { field, value }], limit, after),
      orderBy: () => query(filters, limit, after),
      limit: (n: number) => query(filters, n, after),
      startAfter: (snap: { id: string }) => query(filters, limit, snap.id),
      get: async () => {
        let ids = [...store.values()]
          .filter((r) => filters.every((f) => r.data[f.field] === f.value))
          .map((r) => r.id)
          .sort();
        if (after !== null) ids = ids.filter((id) => id > after);
        const page = ids.slice(0, limit).map(makeSnap);
        return { empty: page.length === 0, size: page.length, docs: page };
      },
    };
  }

  return {
    db: { collection: () => query([{ field: 'active', value: true }]) },
    FieldPath,
    calls,
    store,
  };
}

function webPushError(statusCode: number) {
  return Object.assign(new Error(`status ${statusCode}`), { statusCode, endpoint: 'https://push.example/secret' });
}

describe('activeSubscriptionPages and mapWithConcurrency', () => {
  it('pages through every active document exactly once', async () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, data: { active: true } }));
    rows.push({ id: 'off', data: { active: false } });
    const { db, FieldPath } = fakeFirestore(rows);
    const seen: string[] = [];
    for await (const docs of activeSubscriptionPages(db, FieldPath, 3)) {
      seen.push(...docs.map((d) => d.id));
    }
    expect(seen).toEqual(['s0', 's1', 's2', 's3', 's4', 's5', 's6']);
  });

  it('never has more than the limit in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 50 }, (_, i) => i), 20, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(20);
    expect(peak).toBeGreaterThan(1);
  });
});

describe('runReminders', () => {
  const env = {
    VAPID_PUBLIC_KEY: 'BPublicKeyForTests',
    VAPID_PRIVATE_KEY: 'PrivateKeyForTests',
    VAPID_SUBJECT: 'mailto:owner@example.org',
    FIREBASE_SERVICE_ACCOUNT: '{"project_id":"test"}',
  };
  const endpointFor = (name: string) => `https://push.example.test/${name}-SECRET-ENDPOINT`;
  const sub = (name: string, extra: Record<string, unknown> = {}) => ({
    active: true,
    endpoint: endpointFor(name),
    keys: { p256dh: `p256-${name}`, auth: `auth-${name}` },
    hour: 18,
    timezone: 'Europe/Bucharest',
    lang: 'en',
    ...extra,
  });

  function setup(sendBehaviour: (endpoint: string) => void) {
    const rows = [
      { id: 'ok', data: sub('ok') },
      { id: 'gone410', data: sub('gone410') },
      { id: 'gone404', data: sub('gone404') },
      { id: 'boom', data: sub('boom') },
      { id: 'played', data: sub('played', { lastPlayedDay: '2026-07-01' }) },
      { id: 'sentToday', data: sub('sentToday', { lastSentDay: '2026-07-01' }) },
      { id: 'badUrl', data: sub('badUrl', { endpoint: 'http://insecure.example.test/x' }) },
      { id: 'paused', data: sub('paused', { active: false }) },
    ];
    const fake = fakeFirestore(rows);
    const sendNotification = vi.fn(async (subscription: { endpoint: string }) => {
      sendBehaviour(subscription.endpoint);
    });
    const setVapidDetails = vi.fn();
    const firebase = vi.fn(async () => ({ db: fake.db, FieldPath: fake.FieldPath }));
    const webPush = vi.fn(async () => ({ sendNotification, setVapidDetails }));
    const logs: string[] = [];
    const errors: string[] = [];
    const deps = { firebase, webPush };
    const run = (argv: string[] = []) =>
      runReminders({
        env,
        argv,
        now: SUMMER_EVENING,
        log: (m: string) => logs.push(m),
        error: (m: string) => errors.push(m),
        deps,
      });
    return { fake, sendNotification, setVapidDetails, firebase, webPush, logs, errors, run };
  }

  const behaviour = (endpoint: string) => {
    if (endpoint.includes('gone410')) throw webPushError(410);
    if (endpoint.includes('gone404')) throw webPushError(404);
    if (endpoint.includes('boom')) throw webPushError(500);
  };

  it('sends to due subscriptions, cleans up 404/410, counts failures and skips malformed ones', async () => {
    const t = setup(behaviour);
    const { exitCode, summary } = await t.run();

    expect(exitCode).toBe(0);
    // 7 active docs (paused excluded by the query); 5 due; ok sent; 2 removed; boom (500) and badUrl failed
    expect(summary).toEqual({ checked: 7, due: 5, sent: 1, removed: 2, failed: 2 });
    expect(t.setVapidDetails).toHaveBeenCalledWith('mailto:owner@example.org', 'BPublicKeyForTests', 'PrivateKeyForTests');

    // Due subscriptions are sent to (ok, gone410, gone404, boom); badUrl is rejected before sending
    const sentTo = t.sendNotification.mock.calls.map((c) => c[0].endpoint);
    expect(sentTo).toHaveLength(4);
    expect(sentTo).not.toContain('http://insecure.example.test/x');
    expect(sentTo).not.toContain(endpointFor('played'));

    const [subscription, payload, options] = t.sendNotification.mock.calls[0] as unknown as [
      { endpoint: string; keys: { p256dh: string; auth: string } },
      string,
      { TTL: number; urgency: string },
    ];
    expect(options).toEqual({ TTL: 6 * 60 * 60, urgency: 'normal' });
    expect(JSON.parse(payload)).toEqual({
      title: 'Ludiko',
      body: expect.any(String),
      url: '/learn',
      tag: 'ludiko-daily',
    });
    expect(subscription.keys).toEqual({ p256dh: expect.any(String), auth: expect.any(String) });

    // lastSentDay written only on success; 404/410 deleted
    expect(t.fake.calls.updates).toEqual([
      { id: 'ok', patch: { lastSentDay: '2026-07-01', updatedAt: expect.any(Number) } },
    ]);
    expect(t.fake.calls.deletes.sort()).toEqual(['gone404', 'gone410']);
  });

  it('never logs full endpoints, keys or payloads', async () => {
    const t = setup(behaviour);
    await t.run();
    const everything = [...t.logs, ...t.errors].join('\n');
    expect(everything).not.toContain('SECRET-ENDPOINT');
    expect(everything).not.toContain('auth-boom');
    expect(everything).not.toContain('p256-boom');
    expect(everything).toContain('push.example.test');
    expect(everything).toContain('500');
  });

  it('dry run sends nothing and writes nothing, but still reports what is due', async () => {
    const t = setup(behaviour);
    const { exitCode, summary } = await t.run(['--dry-run']);
    expect(exitCode).toBe(0);
    expect(summary).toEqual({ checked: 7, due: 5, sent: 0, removed: 0, failed: 0 });
    expect(t.sendNotification).not.toHaveBeenCalled();
    expect(t.fake.calls.updates).toHaveLength(0);
    expect(t.fake.calls.deletes).toHaveLength(0);
  });

  it('exits 1 when Firebase cannot be initialised', async () => {
    const t = setup(behaviour);
    const deps = {
      firebase: vi.fn(async () => {
        throw new Error('bad credentials');
      }),
      webPush: t.webPush,
    };
    const errors: string[] = [];
    const result = await runReminders({ env, now: SUMMER_EVENING, log: () => {}, error: (m) => errors.push(m), deps });
    expect(result.exitCode).toBe(1);
    expect(errors.join('\n')).toContain('bad credentials');
  });

  it('exits 1 when FIREBASE_SERVICE_ACCOUNT is not JSON', async () => {
    const t = setup(behaviour);
    const errors: string[] = [];
    const result = await runReminders({
      env: { ...env, FIREBASE_SERVICE_ACCOUNT: '{not json' },
      now: SUMMER_EVENING,
      log: () => {},
      error: (m) => errors.push(m),
      deps: { firebase: t.firebase, webPush: t.webPush },
    });
    expect(result.exitCode).toBe(1);
    expect(t.firebase).not.toHaveBeenCalled();
  });
});
