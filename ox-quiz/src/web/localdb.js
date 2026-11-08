// 웹판 저장소: 이 브라우저의 localStorage에 문서를 둔다(클로드 db와 같은 모양의 작은 부분만).
// 공식전 기록·시즌·문제은행은 주최자 기기에만 쌓인다.
export function createLocalDb(prefix = 'oxw-db:') {
  const docL = new Map();
  const colL = new Map();
  const meta = Object.freeze({ fromCache: false, hasPendingWrites: false });

  const read = (path) => {
    try {
      const v = localStorage.getItem(prefix + path);
      return v === null ? undefined : JSON.parse(v);
    } catch {
      return undefined;
    }
  };
  const freeze = (o) => {
    if (o && typeof o === 'object') {
      Object.values(o).forEach(freeze);
      Object.freeze(o);
    }
    return o;
  };
  const snapDoc = (path) => {
    const body = read(path);
    const data = body === undefined ? undefined : freeze(body);
    return { id: path.split('/').pop(), exists: body !== undefined, data: () => data, metadata: meta };
  };
  const snapCol = (col) => {
    const n = col.split('/').length + 1;
    const paths = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(prefix)) continue;
        const p = k.slice(prefix.length);
        if (p.startsWith(`${col}/`) && p.split('/').length === n) paths.push(p);
      }
    } catch {
      /* 저장소를 못 쓰면 비어 있음 */
    }
    const docs = paths.sort().map(snapDoc);
    return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: meta };
  };
  const notify = () => {
    for (const [p, set] of docL) for (const fn of set) fn(snapDoc(p));
    for (const [c, set] of colL) for (const fn of set) fn(snapCol(c));
  };
  const write = (path, value) => {
    try {
      if (value === undefined) localStorage.removeItem(prefix + path);
      else localStorage.setItem(prefix + path, JSON.stringify(value));
    } catch (e) {
      return Promise.reject({ code: 'quota_exceeded', message: String(e && e.message) });
    }
    setTimeout(notify, 0);
    return Promise.resolve();
  };
  const sub = (map, key, fn, snap) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(fn);
    setTimeout(() => fn(snap()), 0);
    return () => map.get(key).delete(fn);
  };
  // 같은 기기의 다른 탭에서 쓴 것도 반영
  try {
    addEventListener('storage', (e) => {
      if (!e.key || e.key.startsWith(prefix)) notify();
    });
  } catch {
    /* 무시 */
  }

  const db = {
    doc(path) {
      return {
        id: path.split('/').pop(),
        path,
        get: async () => snapDoc(path),
        set: (data) => write(path, JSON.parse(JSON.stringify(data))),
        update: (data) => {
          const cur = read(path);
          if (cur === undefined) return Promise.reject({ code: 'invalid_argument', message: 'no document' });
          return write(path, { ...cur, ...JSON.parse(JSON.stringify(data)) });
        },
        delete: () => write(path, undefined),
        onSnapshot: (next) => sub(docL, path, next, () => snapDoc(path)),
      };
    },
    collection(col) {
      return {
        path: col,
        get: async () => snapCol(col),
        doc: (id) => db.doc(`${col}/${id}`),
        onSnapshot: (next) => sub(colL, col, next, () => snapCol(col)),
      };
    },
  };
  return db;
}
