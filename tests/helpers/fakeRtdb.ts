/** Tiny in-memory stand-in for firebase/database: a JSON tree addressed by "a/b/c" paths (no rules, no listeners). */
export function createFakeRtdb() {
  let root: Record<string, unknown> = {};
  const parts = (p: string) => p.split('/').filter(Boolean);
  const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

  const read = (path: string): unknown => {
    let cur: unknown = root;
    for (const k of parts(path)) {
      if (cur == null || typeof cur !== 'object') return null;
      cur = (cur as Record<string, unknown>)[k];
    }
    return cur === undefined ? null : clone(cur);
  };
  const write = (path: string, value: unknown) => {
    const ks = parts(path);
    if (ks.length === 0) { root = (clone(value) as Record<string, unknown>) ?? {}; return; }
    let cur = root as Record<string, unknown>;
    for (const k of ks.slice(0, -1)) {
      if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
      cur = cur[k] as Record<string, unknown>;
    }
    const last = ks[ks.length - 1];
    if (value === null || value === undefined) delete cur[last];
    else cur[last] = clone(value);
  };

  const snap = (value: unknown, key: string) => ({ exists: () => value !== null, val: () => clone(value), key });
  const refOf = (_db: unknown, path: string) => ({ path });
  const disconnects: string[] = [];

  return {
    read,
    write,
    disconnects,
    module: {
      ref: refOf,
      get: async (r: { path: string }) => snap(read(r.path), r.path.split('/').pop() ?? ''),
      set: async (r: { path: string }, v: unknown) => write(r.path, v),
      remove: async (r: { path: string }) => write(r.path, null),
      update: async (r: { path: string }, values: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(values)) write(`${r.path}/${k}`, v);
      },
      runTransaction: async (r: { path: string }, fn: (cur: unknown) => unknown) => {
        const next = fn(read(r.path));
        if (next === undefined) return { committed: false, snapshot: snap(read(r.path), '') };
        write(r.path, next);
        return { committed: true, snapshot: snap(next, '') };
      },
      onValue: (r: { path: string }, cb: (s: ReturnType<typeof snap>) => void) => {
        cb(snap(read(r.path), r.path.split('/').pop() ?? ''));
        return () => {};
      },
      onDisconnect: (r: { path: string }) => ({ remove: () => { disconnects.push(r.path); return Promise.resolve(); } }),
    },
  };
}
