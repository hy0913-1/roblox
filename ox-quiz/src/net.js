// 실시간 연결: 로비 / 진행자(심판) / 참가자. 모든 통신은 room presence(각자 "지금 내 상태")만 쓴다.
import { HostGame, VERSION } from './game.js';

const LOBBY = 'oxl';
const HOST = 'oxh';
const PLAYER = 'oxp';
const HOST_GONE_MS = 9000;

const flip = (s) => (s === 'O' ? 'X' : 'O');

export class Lobby {
  constructor(room, hooks) {
    this.room = room;
    this.hooks = hooks;
    this.peers = [];
    this.state = { app: LOBBY, v: VERSION, ch: 0, st: 'lobby', rm: null };
  }

  start() {
    this.unsub = this.room.onPeers(
      (ch) => {
        this.peers = ch.peers;
        this.hooks.onChange();
      },
      (e) => {
        this.error = e.code;
        this.hooks.onChange();
      },
    );
    this.push();
  }

  push() {
    this.room.presence({ ...this.state }).catch(() => {});
  }

  set(patch) {
    Object.assign(this.state, patch);
    this.push();
  }

  online() {
    return this.peers.filter((p) => p.kind === 'viewer' && p.presence && p.presence.app === LOBBY);
  }

  rooms() {
    return this.online()
      .filter((p) => p.presence.rm && p.presence.rm.code)
      .map((p) => ({ ...p.presence.rm, host: p, mine: p.sameTab }));
  }
}

// ---------- 화면용 상태 만들기(진행자/참가자 공용) ----------
export function buildView(snap, { myKey, liveSides, mySide, myPid }) {
  if (!snap) return null;
  const roster = (snap.R || []).map(([pid, by, peer, char, bot, name]) => {
    const st = (snap.S && snap.S[pid]) || [];
    const key = by || peer;
    let side = st[6] || '';
    if (!bot && liveSides && liveSides.has(key)) side = liveSides.get(key);
    return { pid, by, peer, key, char, bot: !!bot, name, score: st[0] | 0, hearts: st[1] | 0, energy: st[2] | 0, alive: !!st[3], correct: st[4] | 0, streak: st[5] | 0, side, res: st[7] || '', shield: !!st[8], frozen: !!st[9], emN: st[10] | 0, em: st[11] || '' };
  });
  const me = roster.find((p) => (myPid ? p.pid === myPid : p.key === myKey)) || null;
  if (me && mySide !== undefined && me.alive) me.side = mySide;
  return {
    phase: snap.ph,
    round: snap.rd,
    total: snap.tot,
    lives: snap.lv,
    askMs: snap.ask,
    official: !!snap.off,
    title: snap.ti,
    q: snap.q || null,
    a: snap.a || null,
    x: snap.x || '',
    allWrong: !!snap.aw,
    ranking: snap.rk || null,
    roster,
    me,
    fx: snap.fx || [],
    tl: snap.tl,
  };
}

class RoomBase {
  constructor({ room, code, me, hooks }) {
    this.room = room;
    this.code = code;
    this.me = me;
    this.hooks = hooks; // onUpdate(), onClosed(reason)
    this.peers = [];
    this.myPeer = null;
  }

  async join() {
    this.nr = await this.room.join(`q-${this.code}`);
    this.unsub = this.nr.onPeers(
      (ch) => {
        this.peers = ch.peers;
        const mine = ch.peers.find((p) => p.sameTab);
        if (mine) this.myPeer = mine.peer;
        this.onPeers();
      },
      (e) => this.hooks.onClosed(e.code),
    );
  }

  async leave() {
    clearInterval(this.timer);
    if (this.unsub) this.unsub();
    if (this.nr) await this.nr.leave().catch(() => {});
    this.nr = null;
  }

  // 참가자들이 지금 서 있는 쪽(presence) — 화면에서 바로 반영
  liveSides() {
    const m = new Map();
    for (const p of this.peers) {
      const pr = p.presence;
      if (!p.sameTab && pr && pr.app === PLAYER && pr.code === this.code) m.set(p.by || p.peer, pr.sd || '');
    }
    return m;
  }
}

// ---------- 진행자 ----------
// opts: { room, code, me, hooks, official, mc(진행만), bank, used, title, char, settings }
export class HostClient extends RoomBase {
  constructor(opts) {
    super(opts);
    this.role = opts.mc ? 'mc' : 'host';
    this.official = !!opts.official;
    this.char = opts.char | 0;
    this.game = new HostGame({ code: opts.code, official: opts.official, title: opts.title, bank: opts.bank, used: opts.used, settings: opts.settings, seed: (Math.random() * 0xffffffff) >>> 0 });
    this.events = [];
    this.lastPub = 0;
    this.selfMv = 0;
    this.selfSk = 0;
    this.selfEm = 0;
    if (!opts.mc) this.myPid = this.game.addPlayer({ key: opts.me.id || 'host', by: opts.me.id || null, peer: null, char: this.char });
  }

  async start() {
    await this.join();
    this.publish(true);
    this.timer = setInterval(() => this.tick(), 100);
  }

  onPeers() {
    const g = this.game;
    const now = Date.now();
    const present = new Set();
    for (const p of this.peers) {
      const pr = p.presence;
      if (p.sameTab || !pr || pr.app !== PLAYER || pr.code !== this.code || p.kind !== 'viewer') continue;
      const key = p.by || p.peer;
      present.add(key);
      let pl = g.byKey(key);
      if (!pl && g.phase === 'wait') {
        g.addPlayer({ key, by: p.by || null, peer: p.peer, char: pr.ch | 0 });
        pl = g.byKey(key);
      }
      if (!pl) continue;
      if (g.phase === 'wait' && pl.char !== (pr.ch | 0)) {
        pl.char = pr.ch | 0;
        g.dirty = true;
      }
      if (typeof pr.mv === 'number') g.setSide(pl.pid, pr.sd || '', pr.mv, now);
      if (pr.sk) {
        const f = g.useSkill(pl.pid, pr.sk, now);
        if (f) this.events.push({ e: 'skill', fx: f });
      }
      if (pr.em) g.emote(pl.pid, pr.em.n, pr.em.e);
    }
    if (g.phase === 'wait') {
      for (const p of [...g.players.values()]) if (!p.bot && p.pid !== this.myPid && !present.has(p.key)) g.removePlayer(p.pid);
    }
    if (g.dirty) this.publish();
    this.hooks.onUpdate();
  }

  tick() {
    const now = Date.now();
    const ev = this.game.tick(now);
    if (ev.length) this.events.push(...ev);
    if (this.game.dirty || ev.length || now - this.lastPub > 2000) this.publish();
    if (ev.some((e) => e.e === 'end') && this.official) this.hooks.onOfficialEnd && this.hooks.onOfficialEnd(this.game);
    if (ev.length || this.game.phase === 'ask' || this.game.phase === 'count') this.hooks.onUpdate();
  }

  publish(force = false) {
    const now = Date.now();
    if (!this.nr || (!force && now - this.lastPub < 100)) return;
    this.lastPub = now;
    this.game.dirty = false;
    this.snap = this.game.snapshot(now);
    this.snapAt = performance.now();
    this.nr.presence({ app: HOST, v: VERSION, code: this.code, ...this.snap }).catch(() => {});
    this.hooks.onPublish && this.hooks.onPublish(this.game);
  }

  view() {
    const snap = this.snap || this.game.snapshot(Date.now());
    const v = buildView(snap, { myPid: this.myPid, liveSides: this.liveSides() });
    v.deadline = this.snapAt + (snap.tl || 0);
    if (this.role === 'mc' && this.game.q && (this.game.phase === 'ask' || this.game.phase === 'count')) v.mcAnswer = this.game.q.a;
    return v;
  }

  // 진행자도 플레이(일반 방)
  move(side) {
    if (!this.myPid) return;
    this.selfMv += 1;
    const p = this.game.players.get(this.myPid);
    this.game.setSide(this.myPid, side, Math.max(this.selfMv, (p && p.mv + 1) || 0), Date.now());
    this.publish();
  }

  skill(id, to) {
    if (!this.myPid) return null;
    this.selfSk += 1;
    const f = this.game.useSkill(this.myPid, { n: this.selfSk, id, to, r: this.game.round }, Date.now());
    if (f) this.events.push({ e: 'skill', fx: f });
    this.publish(true);
    return f;
  }

  emote(e) {
    if (!this.myPid) return;
    this.selfEm += 1;
    this.game.emote(this.myPid, this.selfEm, e);
    this.publish(true);
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}

// ---------- 참가자 ----------
export class PlayerClient extends RoomBase {
  constructor(opts) {
    super(opts);
    this.role = 'player';
    this.state = { app: PLAYER, v: VERSION, code: opts.code, ch: opts.char | 0, sd: '', mv: 0, sk: null, em: null };
    this.snap = null;
    this.hostSeenAt = 0;
    this.lastKey = '';
  }

  async start() {
    await this.join();
    this.push();
    this.joinedAt = performance.now();
    this.timer = setInterval(() => this.watchHost(), 1000);
  }

  push() {
    if (this.nr) this.nr.presence({ ...this.state }).catch(() => {});
  }

  host() {
    return this.peers.find((p) => p.presence && p.presence.app === HOST && p.presence.code === this.code) || null;
  }

  onPeers() {
    const h = this.host();
    if (h) {
      this.hostSeenAt = performance.now();
      const snap = h.presence;
      const key = `${snap.ph}|${snap.rd}`;
      if (key !== this.lastKey || !this.snap || Math.abs((this.deadline || 0) - (performance.now() + snap.tl)) > 400) {
        this.deadline = performance.now() + (snap.tl || 0);
      }
      if (key !== this.lastKey) {
        // 새 문제가 오면 가운데에서 다시 시작
        if (snap.ph === 'ask') this.setSide('');
        this.lastKey = key;
      }
      this.snap = snap;
    }
    this.hooks.onUpdate();
  }

  watchHost() {
    const t = performance.now();
    const seen = this.hostSeenAt || this.joinedAt;
    if (t - seen > HOST_GONE_MS) this.hooks.onClosed('host_left');
  }

  get myKey() {
    return this.me.id || this.myPeer;
  }

  view() {
    if (!this.snap) return null;
    const v = buildView(this.snap, { myKey: this.myKey, liveSides: this.liveSides(), mySide: this.state.sd });
    v.deadline = this.deadline;
    return v;
  }

  setSide(side) {
    if (this.state.sd === side && side !== '') return;
    this.state.sd = side;
    this.state.mv += 1;
    this.push();
  }

  move(side) {
    this.setSide(side);
  }

  // 밀치기에 맞음: 진행자가 정한 쪽(snapshot)을 따른다
  pushed(side) {
    this.setSide(side === 'O' || side === 'X' ? side : this.state.sd ? flip(this.state.sd) : 'O');
  }

  skill(id, to) {
    const n = ((this.state.sk && this.state.sk.n) || 0) + 1;
    this.state.sk = { n, id, to, r: this.snap ? this.snap.rd : 0 };
    this.push();
  }

  emote(e) {
    const n = ((this.state.em && this.state.em.n) || 0) + 1;
    this.state.em = { n, e };
    this.push();
  }

  setChar(ch) {
    this.state.ch = ch | 0;
    this.push();
  }
}
