// 테스트 전용 가짜 window.claude (OX 퀴즈용). 같은 출처의 여러 탭이 BroadcastChannel + localStorage로 db/room/user를 공유한다.
// 주소 ?uid=u_a&name=앨리스&owner=1 로 사람을 흉내 낸다. 실제 게시본에는 들어가지 않는다.
// 실제 규칙과 같게: 모든 쓰기는 주인만, bank/ 아래는 주인만 읽을 수 있다(남에게는 없는 문서처럼 보임).
(function () {
  const q = new URLSearchParams(location.search);
  const uid = q.get('uid') || `u_${Math.random().toString(36).slice(2, 8)}`;
  const name = q.get('name') || uid;
  const owner = q.get('owner') === '1';
  const canWrite = q.get('ro') !== '1';
  const peerId = Math.random().toString(36).slice(2, 14);
  const bc = new BroadcastChannel('mock-claude-ox');
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

  // ---------- 이름 등록부 ----------
  const names = () => {
    try {
      return JSON.parse(localStorage.getItem('mock-names') || '{}');
    } catch {
      return {};
    }
  };
  const reg = names();
  reg[uid] = name;
  localStorage.setItem('mock-names', JSON.stringify(reg));

  // ---------- db ----------
  const KEY = 'mockox:';
  const readDoc = (path) => {
    const v = localStorage.getItem(KEY + path);
    return v === null ? undefined : JSON.parse(v);
  };
  const load = () => {
    const d = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(KEY)) d[k.slice(KEY.length)] = JSON.parse(localStorage.getItem(k));
    }
    return d;
  };
  const docL = new Map();
  const colL = new Map();
  const meta = { fromCache: false, hasPendingWrites: false };
  const hidden = (path) => !owner && path.split('/')[0] === 'bank';
  const deepFreeze = (o) => {
    if (o && typeof o === 'object') {
      Object.values(o).forEach(deepFreeze);
      Object.freeze(o);
    }
    return o;
  };
  const snapDoc = (path, d = load()) => {
    const ok = path in d && !hidden(path);
    const body = ok ? deepFreeze(clone(d[path])) : undefined;
    return { id: path.split('/').pop(), exists: ok, data: () => body, metadata: meta };
  };
  const snapCol = (col) => {
    const d = load();
    const n = col.split('/').length + 1;
    const docs = Object.keys(d)
      .filter((p) => p.startsWith(`${col}/`) && p.split('/').length === n)
      .filter((p) => !hidden(p))
      .sort()
      .map((p) => snapDoc(p, d));
    return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: meta };
  };
  const notify = () => {
    for (const [p, set] of docL) for (const fn of set) fn(snapDoc(p));
    for (const [c, set] of colL) for (const fn of set) fn(snapCol(c));
  };
  const allowed = () => canWrite && owner;
  const write = (path, fn) => {
    if (!allowed(path)) return Promise.reject({ code: 'invalid_argument', message: `write refused: ${path}` });
    const d = {};
    const cur = readDoc(path);
    if (cur !== undefined) d[path] = cur;
    fn(d);
    if (path in d) localStorage.setItem(KEY + path, JSON.stringify(d[path]));
    else localStorage.removeItem(KEY + path);
    setTimeout(notify, 0);
    bc.postMessage({ t: 'db' });
    return Promise.resolve();
  };
  const sub = (map, key, fn, snap) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(fn);
    setTimeout(() => fn(snap()), 5);
    return () => map.get(key).delete(fn);
  };
  const db = {
    doc(path) {
      return {
        id: path.split('/').pop(),
        path,
        get: async () => snapDoc(path),
        set: (data) => write(path, (d) => (d[path] = clone(data))),
        update: (data) => write(path, (d) => (d[path] = { ...d[path], ...clone(data) })),
        delete: () => write(path, (d) => delete d[path]),
        onSnapshot: (next) => sub(docL, path, next, () => snapDoc(path)),
      };
    },
    collection(col) {
      return { path: col, get: async () => snapCol(col), doc: (id) => db.doc(`${col}/${id}`), onSnapshot: (next) => sub(colL, col, next, () => snapCol(col)) };
    },
  };

  // ---------- room ----------
  const rooms = new Map(); // name → {peers: Map, handlers:Set, mine:{}}
  const lobbyName = '';
  const getRoom = (n) => {
    if (!rooms.has(n)) rooms.set(n, { peers: new Map(), handlers: new Set(), mine: {}, joined: false });
    return rooms.get(n);
  };
  const snapshot = (n) => {
    const r = getRoom(n);
    const me = { peer: peerId, by: uid, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: Object.freeze(clone(r.mine)), updatedAt: Date.now() };
    return [me, ...r.peers.values()];
  };
  const fire = (n) => {
    const r = getRoom(n);
    const peers = snapshot(n);
    for (const h of r.handlers) h({ peers, joined: [], left: [], updated: [] });
  };
  const send = (n, kind) => bc.postMessage({ t: 'room', room: n, kind, peer: peerId, by: uid, presence: getRoom(n).mine });
  bc.addEventListener('message', (e) => {
    const m = e.data;
    if (m.t === 'db') notify();
    if (m.t !== 'room') return;
    const r = rooms.get(m.room);
    if (!r || !r.joined) return;
    if (m.kind === 'leave') r.peers.delete(m.peer);
    else {
      const prev = r.peers.get(m.peer);
      const changed = !prev || JSON.stringify(prev.presence) !== JSON.stringify(m.presence);
      r.peers.set(m.peer, { peer: m.peer, by: m.by, isMe: m.by === uid, sameTab: false, kind: 'viewer', guest: false, presence: Object.freeze(clone(m.presence)), updatedAt: changed || !prev ? Date.now() : prev.updatedAt });
      if (m.kind === 'hello') send(m.room, 'state');
    }
    fire(m.room);
  });
  // 다른 탭의 localStorage 쓰기는 이 탭에 조금 늦게 보인다. 실제로 보이는 순간(storage 이벤트)에 다시 알린다.
  addEventListener('storage', (e) => {
    if (!e.key || e.key.startsWith(KEY)) notify();
  });
  addEventListener('pagehide', () => {
    for (const n of rooms.keys()) send(n, 'leave');
  });
  const roomApi = (n) => ({
    name: n,
    emit: async () => {},
    on: () => () => {},
    async presence(patch) {
      const r = getRoom(n);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) delete r.mine[k];
        else r.mine[k] = clone(v);
      }
      if (new TextEncoder().encode(JSON.stringify(r.mine)).length > 4096) throw { code: 'invalid_argument', message: 'presence too large' };
      window.__mockMaxPresence = Math.max(window.__mockMaxPresence || 0, new TextEncoder().encode(JSON.stringify(r.mine)).length);
      send(n, 'state');
      setTimeout(() => fire(n), 0);
    },
    peers: () => snapshot(n),
    onPeers(h) {
      const r = getRoom(n);
      r.handlers.add(h);
      setTimeout(() => h({ peers: snapshot(n), joined: snapshot(n), left: [], updated: [] }), 0);
      return () => r.handlers.delete(h);
    },
    connected: () => true,
    onConnection(h) {
      setTimeout(() => h(true), 0);
      return () => {};
    },
    async leave() {
      send(n, 'leave');
      rooms.delete(n);
    },
  });
  const lobby = roomApi(lobbyName);
  getRoom(lobbyName).joined = true;
  send(lobbyName, 'hello');
  const room = {
    ...lobby,
    async join(n) {
      const r = getRoom(n);
      r.joined = true;
      send(n, 'hello');
      return roomApi(n);
    },
    sendToClaudeSession: async () => ({ to: 'pane' }),
    canSendToClaudeSession: async () => 'off',
  };

  // ---------- user ----------
  const user = {
    isOwner: async () => owner,
    canEdit: async () => owner,
    can: async (c) => (c === 'data.write' ? canWrite : false),
    id: async () => uid,
    me: async () => ({ id: uid, name, avatarUrl: '', color: '#7d8bb0', email: null, isOwner: owner, canEdit: owner }),
    name: async () => name,
    profiles: async (ids) => {
      const n = names();
      return Object.fromEntries([].concat(ids).map((id) => [id, { id, name: n[id] || '', avatarUrl: '', color: '#888', email: null, isMe: id === uid, guest: false }]));
    },
    search: async () => [],
  };

  window.claude = {
    use: async (cap) => ({ db, room, user })[cap] || null,
  };
  window.__mock = { uid, peerId };
})();
