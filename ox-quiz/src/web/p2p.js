// 웹판 실시간 연결(P2P). PeerJS(WebRTC)로 방장 브라우저가 "허브"가 되고 참가자는 방장에게 직접 붙는다.
// 클로드 room의 presence(각자 지금 상태를 모두에게 공유) 모양을 그대로 흉내 내서 net.js를 고치지 않고 쓴다.
//  - 허브 아이디 = 'oxdot-v1-' + 방 이름. 같은 이름이 이미 있으면 'taken'
//  - 들어올 때 허브가 준 일회용 숫자에 서명 → 허브가 공개키 해시로 아이디(by)를 정함(흉내 불가)
//  - presence는 바뀐 칸만 50ms마다 묶어서 모두에게 보냄. 2초마다 서로 안부(ping), 9초 조용하면 끊긴 것으로 봄
import { Peer } from 'peerjs';
import { idOf, verify, randomToken } from './identity.js';

const PREFIX = 'oxdot-v1-';
const FLUSH_MS = 50;
const PING_MS = 2000;
const DEAD_MS = 9000;
const OPEN_TIMEOUT = 15000;
const MAX_MEMBERS = 16;
const MAX_PRESENCE = 16 * 1024;
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;

const err = (code, message = '') => Object.assign(new Error(message || code), { code });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
export const cleanName = (s) =>
  [...String(s || '')]
    .filter((ch) => {
      const c = ch.codePointAt(0);
      return c >= 32 && !(c >= 0x200b && c <= 0x200f) && !(c >= 0x2028 && c <= 0x202e) && c !== 0xfeff;
    })
    .join('')
    .trim()
    .slice(0, 12);
export const hubIdOf = (name) => PREFIX + String(name).toLowerCase();

function openPeer(id, options) {
  return new Promise((resolve, reject) => {
    let peer;
    try {
      peer = id ? new Peer(id, options) : new Peer(options);
    } catch (e) {
      reject(err('unsupported', e && e.message));
      return;
    }
    const finish = (fn, v) => {
      clearTimeout(timer);
      peer.off('open', onOpen);
      peer.off('error', onErr);
      fn(v);
    };
    const onOpen = () => finish(resolve, peer);
    const onErr = (e) => {
      const type = e && e.type;
      peer.destroy();
      finish(reject, err(type === 'unavailable-id' ? 'taken' : type === 'browser-incompatible' ? 'unsupported' : 'network', e && e.message));
    };
    const timer = setTimeout(() => {
      peer.destroy();
      finish(reject, err('network', 'signaling timeout'));
    }, OPEN_TIMEOUT);
    peer.on('open', onOpen);
    peer.on('error', onErr);
  });
}

// 신호 서버와의 연결이 끊기면(데이터 연결은 살아 있음) 조용히 다시 붙는다
function keepSignaling(peer, isClosed) {
  peer.on('disconnected', () => {
    setTimeout(() => {
      if (isClosed() || peer.destroyed || !peer.disconnected) return;
      try {
        peer.reconnect();
      } catch {
        /* 다음 기회에 */
      }
    }, 1500);
  });
}

const wire = (m) => ({ p: m.peer, by: m.by, n: m.name, pr: m.presence, at: m.updatedAt });

// 공통: 클로드 NamedRoom과 같은 모양의 겉면
class RoomCore {
  constructor(name, ident, onName) {
    this.name = name;
    this.ident = ident;
    this.onName = onName || (() => {});
    this.members = new Map(); // label → {peer, by, name, presence, frozen, updatedAt}
    this.handlers = new Set();
    this.errHandlers = new Set();
    this.list = Object.freeze([]);
    this.closed = false;
    this.label = '';
  }

  api() {
    const self = this;
    return {
      name: this.name,
      webRoom: true,
      emit: async () => {},
      on: () => () => {},
      presence: (patch) => self.setPresence(patch),
      peers: () => self.list,
      onPeers(handler, onError) {
        self.handlers.add(handler);
        if (onError) self.errHandlers.add(onError);
        setTimeout(() => {
          if (self.handlers.has(handler)) handler({ peers: self.list, joined: self.list, left: [], updated: [] });
        }, 0);
        return () => {
          self.handlers.delete(handler);
          if (onError) self.errHandlers.delete(onError);
        };
      },
      connected: () => !self.closed,
      onConnection(h) {
        setTimeout(() => h(!self.closed), 0);
        return () => {};
      },
      leave: () => self.leave(),
    };
  }

  setMember(w) {
    const presence = w.pr && typeof w.pr === 'object' ? clone(w.pr) : {};
    const m = { peer: w.p, by: w.by, name: w.n || '', presence, frozen: Object.freeze(clone(presence)), updatedAt: Date.now() };
    this.members.set(w.p, m);
    if (m.by && m.name) this.onName(m.by, m.name);
    return m;
  }

  rebuild() {
    this.list = Object.freeze(
      [...this.members.values()].map((m) =>
        Object.freeze({ peer: m.peer, by: m.by, name: m.name, isMe: m.by === this.ident.id, sameTab: m.peer === this.label, kind: 'viewer', guest: false, presence: m.frozen, updatedAt: m.updatedAt }),
      ),
    );
    if (this.emitQueued) return;
    this.emitQueued = true;
    queueMicrotask(() => {
      this.emitQueued = false;
      if (this.closed) return;
      const ch = { peers: this.list, joined: [], left: [], updated: [] };
      for (const h of [...this.handlers]) {
        try {
          h(ch);
        } catch (e) {
          console.error(e);
        }
      }
    });
  }

  // 되돌릴 수 없는 끊김: 듣는 쪽에 한 번 알리고 정리
  fail(code) {
    if (this.closed) return;
    const hs = [...this.errHandlers];
    this.cleanup();
    for (const h of hs) {
      try {
        h({ code, message: code });
      } catch {
        /* 무시 */
      }
    }
  }

  cleanup() {
    this.closed = true;
    this.handlers.clear();
    this.errHandlers.clear();
    clearInterval(this.pingTimer);
    clearTimeout(this.flushT);
    try {
      if (this.peer && !this.peer.destroyed) this.peer.destroy();
    } catch {
      /* 무시 */
    }
  }
}

// ---------- 방장(허브) ----------
class HubRoom extends RoomCore {
  constructor(name, peer, ident, getName, onName) {
    super(name, ident, onName);
    this.peer = peer;
    this.label = peer.id;
    this.conns = new Map(); // label → conn
    this.queue = new Map(); // label → {set, del:Set, full}
    this.goneQ = new Set();
    this.setMember({ p: this.label, by: ident.id, n: getName(), pr: {} });
    this.rebuild();
    peer.on('connection', (conn) => this.accept(conn));
    peer.on('error', () => {
      /* 참가자 하나의 문제는 그 연결에서 처리 */
    });
    keepSignaling(peer, () => this.closed);
    this.pingTimer = setInterval(() => this.ping(), PING_MS);
  }

  accept(conn) {
    const nonce = randomToken(16);
    let state = 'new';
    const timer = setTimeout(() => {
      if (state !== 'ok') conn.close();
    }, OPEN_TIMEOUT);
    conn.on('open', () => {
      try {
        conn.send({ t: 'nonce', n: nonce });
      } catch {
        /* 무시 */
      }
    });
    conn.on('data', async (m) => {
      if (!m || typeof m !== 'object' || this.closed) return;
      if (state === 'new') {
        if (m.t !== 'hello' || !m.pub || typeof m.sig !== 'string') return;
        state = 'checking';
        const ok = await verify(m.pub, `${nonce}|${this.name}`, m.sig);
        if (!ok || this.closed) {
          state = 'bad';
          conn.close();
          return;
        }
        const by = await idOf(m.pub);
        // 같은 사람(같은 아이디)이 다시 들어오면 예전 연결을 정리
        for (const [label, mem] of [...this.members]) if (mem.by === by && label !== this.label) this.drop(label);
        if (this.members.size >= MAX_MEMBERS) {
          state = 'bad';
          try {
            conn.send({ t: 'full' });
          } catch {
            /* 무시 */
          }
          setTimeout(() => conn.close(), 300);
          return;
        }
        state = 'ok';
        clearTimeout(timer);
        conn.lastSeen = Date.now();
        this.conns.set(conn.peer, conn);
        const pr = m.pr && typeof m.pr === 'object' && JSON.stringify(m.pr).length <= MAX_PRESENCE ? m.pr : {};
        this.setMember({ p: conn.peer, by, n: cleanName(m.name), pr });
        this.rebuild();
        try {
          conn.send({ t: 'welcome', you: conn.peer, by, all: [...this.members.values()].map(wire) });
        } catch {
          /* 무시 */
        }
        this.q(conn.peer).full = true;
        this.scheduleFlush();
        return;
      }
      if (state !== 'ok' || this.conns.get(conn.peer) !== conn) return;
      conn.lastSeen = Date.now();
      if (m.t === 'p') this.applyPatch(conn.peer, m.set, m.del);
      else if (m.t === 'bye') this.drop(conn.peer);
    });
    const gone = () => {
      clearTimeout(timer);
      if (state === 'ok' && this.conns.get(conn.peer) === conn) this.drop(conn.peer);
    };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  q(label) {
    if (!this.queue.has(label)) this.queue.set(label, { set: {}, del: new Set(), full: false });
    return this.queue.get(label);
  }

  applyPatch(label, set, del) {
    const m = this.members.get(label);
    if (!m) return;
    let changed = false;
    const q = this.q(label);
    if (set && typeof set === 'object') {
      for (const [k, v] of Object.entries(set)) {
        if (!KEY_RE.test(k) || same(m.presence[k], v)) continue;
        m.presence[k] = clone(v);
        q.set[k] = m.presence[k];
        q.del.delete(k);
        changed = true;
      }
    }
    if (Array.isArray(del)) {
      for (const k of del) {
        if (typeof k !== 'string' || !(k in m.presence)) continue;
        delete m.presence[k];
        delete q.set[k];
        q.del.add(k);
        changed = true;
      }
    }
    if (!changed) return;
    if (JSON.stringify(m.presence).length > MAX_PRESENCE) {
      // 너무 큰 상태를 보내는 참가자는 내보낸다
      if (label !== this.label) this.drop(label);
      return;
    }
    m.frozen = Object.freeze(clone(m.presence));
    m.updatedAt = Date.now();
    this.rebuild();
    this.scheduleFlush();
  }

  setPresence(patch) {
    if (this.closed) return Promise.reject(err('revoked'));
    const set = {};
    const del = [];
    for (const [k, v] of Object.entries(patch || {})) {
      if (v === null) del.push(k);
      else set[k] = v;
    }
    this.applyPatch(this.label, set, del);
    return Promise.resolve();
  }

  scheduleFlush() {
    if (this.flushT || this.closed) return;
    this.flushT = setTimeout(() => {
      this.flushT = 0;
      this.flush();
    }, FLUSH_MS);
  }

  flush() {
    const up = [];
    for (const [label, q] of this.queue) {
      const m = this.members.get(label);
      if (!m) continue;
      if (q.full) up.push({ ...wire(m), f: 1 });
      else up.push({ p: label, by: m.by, n: m.name, s: q.set, d: [...q.del] });
    }
    const gone = [...this.goneQ];
    this.queue.clear();
    this.goneQ.clear();
    if (!up.length && !gone.length) return;
    this.sendAll({ t: 'd', up, gone });
  }

  sendAll(msg) {
    for (const conn of this.conns.values()) {
      try {
        if (conn.open) conn.send(msg);
      } catch {
        /* 무시 */
      }
    }
  }

  drop(label) {
    const conn = this.conns.get(label);
    this.conns.delete(label);
    if (conn) {
      try {
        conn.close();
      } catch {
        /* 무시 */
      }
    }
    if (!this.members.delete(label)) return;
    this.queue.delete(label);
    this.goneQ.add(label);
    this.rebuild();
    this.scheduleFlush();
  }

  ping() {
    const now = Date.now();
    for (const [label, conn] of [...this.conns]) {
      if (now - (conn.lastSeen || 0) > DEAD_MS) this.drop(label);
      else {
        try {
          if (conn.open) conn.send({ t: 'ping' });
        } catch {
          /* 무시 */
        }
      }
    }
  }

  async leave() {
    if (this.closed) return;
    this.sendAll({ t: 'bye' });
    await new Promise((r) => setTimeout(r, 150));
    this.cleanup();
  }
}

// ---------- 참가자 ----------
class ClientRoom extends RoomCore {
  constructor(name, ident, getName, onName, options) {
    super(name, ident, onName);
    this.getName = getName;
    this.options = options;
    this.mine = {};
    this.hubId = hubIdOf(name);
    this.lastSeen = Date.now();
  }

  async start() {
    this.peer = await openPeer(null, this.options);
    this.label = this.peer.id;
    keepSignaling(this.peer, () => this.closed);
    this.peer.on('error', (e) => {
      if (this.pending && e && e.type === 'peer-unavailable') this.pending('not_found');
    });
    try {
      await this.connect();
    } catch (e) {
      this.cleanup();
      throw e;
    }
    this.pingTimer = setInterval(() => this.ping(), PING_MS);
  }

  connect() {
    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(this.hubId, { reliable: true, serialization: 'json' });
      this.conn = conn;
      let settled = false;
      const fail = (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.pending = null;
        try {
          conn.close();
        } catch {
          /* 무시 */
        }
        reject(err(code));
      };
      const timer = setTimeout(() => fail('timeout'), OPEN_TIMEOUT);
      this.pending = fail;
      conn.on('data', async (m) => {
        if (!m || typeof m !== 'object' || this.conn !== conn) return;
        this.lastSeen = Date.now();
        if (m.t === 'nonce') {
          try {
            const sig = await this.ident.sign(`${m.n}|${this.name}`);
            conn.send({ t: 'hello', pub: this.ident.pub, sig, name: this.getName(), pr: this.mine });
          } catch {
            fail('unsupported');
          }
        } else if (m.t === 'welcome') {
          this.label = m.you;
          this.members.clear();
          for (const w of m.all || []) this.setMember(w);
          this.rebuild();
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            this.pending = null;
            resolve();
          }
        } else if (m.t === 'd') this.applyDelta(m);
        else if (m.t === 'full') {
          if (!settled) fail('full');
          else this.fail('full');
        } else if (m.t === 'bye') this.fail('host_left');
      });
      conn.on('close', () => {
        if (!settled) fail('timeout');
        else if (this.conn === conn) this.lost();
      });
      conn.on('error', () => {
        if (!settled) fail('timeout');
      });
    });
  }

  applyDelta(m) {
    for (const w of m.up || []) {
      if (!w || !w.p || w.p === this.label) continue; // 내 상태는 내가 가진 것이 정답
      if (w.f) {
        this.setMember(w);
        continue;
      }
      const cur = this.members.get(w.p);
      if (!cur) {
        this.setMember({ p: w.p, by: w.by, n: w.n, pr: w.s || {} });
        continue;
      }
      for (const [k, v] of Object.entries(w.s || {})) cur.presence[k] = v;
      for (const k of w.d || []) delete cur.presence[k];
      cur.frozen = Object.freeze(clone(cur.presence));
      cur.updatedAt = Date.now();
    }
    for (const label of m.gone || []) if (label !== this.label) this.members.delete(label);
    this.rebuild();
  }

  setPresence(patch) {
    if (this.closed) return Promise.reject(err('revoked'));
    const set = {};
    const del = [];
    for (const [k, v] of Object.entries(patch || {})) {
      if (v === null) {
        if (k in this.mine) {
          delete this.mine[k];
          del.push(k);
        }
      } else if (!same(this.mine[k], v)) {
        this.mine[k] = clone(v);
        set[k] = this.mine[k];
      }
    }
    if (!Object.keys(set).length && !del.length) return Promise.resolve();
    const me = this.members.get(this.label);
    if (me) {
      me.presence = clone(this.mine);
      me.frozen = Object.freeze(clone(this.mine));
      me.updatedAt = Date.now();
      this.rebuild();
    }
    try {
      if (this.conn && this.conn.open) this.conn.send({ t: 'p', set, del });
    } catch {
      /* 다시 붙으면 hello에 전부 실려 간다 */
    }
    return Promise.resolve();
  }

  ping() {
    if (this.closed) return;
    if (!this.reconnecting && Date.now() - this.lastSeen > DEAD_MS) {
      const old = this.conn;
      this.conn = null;
      try {
        if (old) old.close();
      } catch {
        /* 무시 */
      }
      this.lost();
      return;
    }
    try {
      if (this.conn && this.conn.open) this.conn.send({ t: 'ping' });
    } catch {
      /* 무시 */
    }
  }

  // 방장과 끊김: 12초 동안 다시 붙어 보고, 안 되면 방이 닫힌 것으로 본다
  lost() {
    if (this.closed || this.reconnecting) return;
    this.reconnecting = true;
    const until = Date.now() + 12000;
    const attempt = async () => {
      if (this.closed) return;
      try {
        if (this.peer.disconnected && !this.peer.destroyed) this.peer.reconnect();
      } catch {
        /* 무시 */
      }
      try {
        await this.connect();
        this.reconnecting = false;
        this.lastSeen = Date.now();
      } catch (e) {
        if ((e && e.code === 'not_found') || Date.now() > until) {
          this.reconnecting = false;
          this.fail('host_left');
        } else setTimeout(attempt, 1500);
      }
    };
    attempt();
  }

  async leave() {
    if (this.closed) return;
    try {
      if (this.conn && this.conn.open) this.conn.send({ t: 'bye' });
    } catch {
      /* 무시 */
    }
    await new Promise((r) => setTimeout(r, 100));
    this.cleanup();
  }
}

// 클로드 room과 같은 모양의 겉면. 전체 로비는 없고(join으로 방에만 들어감), 방 목록 대신 코드·링크로 들어온다.
export function createWebRoom({ ident, getName, onName, options }) {
  return {
    webRoom: true,
    presence: async () => {},
    onPeers(h) {
      const t = setTimeout(() => h({ peers: [], joined: [], left: [], updated: [] }), 0);
      return () => clearTimeout(t);
    },
    peers: () => [],
    connected: () => true,
    onConnection(h) {
      setTimeout(() => h(true), 0);
      return () => {};
    },
    async join(name, opts = {}) {
      if (opts.client) {
        const room = new ClientRoom(name, ident, getName, onName, options);
        await room.start();
        return room.api();
      }
      const peer = await openPeer(hubIdOf(name), options);
      return new HubRoom(name, peer, ident, getName, onName).api();
    },
  };
}
