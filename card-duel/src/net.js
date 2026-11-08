// 실시간 연결: 로비(누가 접속해 있는지, 도전장, 빠른 대전), 팀전 방, 경기 세션.
// 모든 통신은 room의 presence(각자 "지금 내 상태"를 계속 내보냄)만 쓴다. 메시지가 빠져도 다음 상태로 바로 맞춰지고,
// 이벤트 토픽 권한이 필요 없어서 참여자라면 누구나 대전할 수 있다.
import { commitOf, sharedFrom, createMatchGame, MatchSync, verifyMatch, randomSeed, randomId, aiAction } from './match.js';
import { check, enc } from './engine.js';
import { parseDeckCode } from './cards.js';
import { lget, lset } from './local.js';

export const NET_V = 1;
const LOBBY = 'cdl';
const TEAMROOM = 'cdt';
const MATCH = 'cdm';
export const TURN_MS = { duel: 60000, team: 45000 };
const ABSENT_MS = 60000;
const REVEAL_WAIT_MS = 20000;
const SETUP_WAIT_MS = 45000;
const INVITE_MS = 30000;

const fresh = (p, ms) => Date.now() - (p.updatedAt || 0) < ms;

// ---------------- 로비 ----------------
export class Lobby {
  constructor(room, me, hooks) {
    this.room = room;
    this.me = me;
    this.hooks = hooks; // onChange, onInvite(peer, inv), onMatch({id, mode, roster, mySeat}), onDeclined()
    this.peers = [];
    this.myPeer = null;
    this.state = { app: LOBBY, v: NET_V, st: 'idle', qAt: 0, fac: '', inv: null, ans: null, tr: null };
    this.handled = new Set();
    this.error = null;
    this.invAt = 0;
  }

  start() {
    this.unsub = this.room.onPeers(
      (ch) => {
        this.peers = ch.peers;
        const mine = ch.peers.find((p) => p.sameTab);
        if (mine) this.myPeer = mine.peer;
        this.process();
        this.hooks.onChange();
      },
      (e) => {
        this.error = e.code;
        this.hooks.onChange();
      },
    );
    this.push();
    this.tick = setInterval(() => this.process(), 2000);
  }

  stop() {
    clearInterval(this.tick);
    if (this.unsub) this.unsub();
  }

  push() {
    this.room.presence({ ...this.state }).catch(() => {});
  }

  set(patch) {
    Object.assign(this.state, patch);
    this.push();
  }

  others() {
    return this.peers.filter((p) => !p.isMe && p.kind === 'viewer' && p.presence && p.presence.app === LOBBY && p.presence.v === NET_V);
  }

  teamRooms() {
    return this.others()
      .filter((p) => p.presence.tr && p.presence.tr.code && fresh(p, 10 * 60000))
      .map((p) => ({ code: String(p.presence.tr.code), n: Number(p.presence.tr.n) || 1, host: p }));
  }

  setStatus(st) {
    this.set({ st, qAt: st === 'q' ? Date.now() : 0 });
  }

  invite(peer) {
    const id = randomId(10);
    this.invAt = Date.now();
    this.set({ inv: { to: peer.peer, id, mode: 'duel' }, st: this.state.st === 'q' ? 'q' : 'busy' });
    return id;
  }

  cancelInvite() {
    this.set({ inv: null, st: 'idle' });
  }

  answer(peer, inv, ok) {
    this.handled.add(inv.id);
    this.set({ ans: { to: peer.peer, id: inv.id, ok } });
    if (ok) {
      this.set({ st: 'busy', inv: null, qAt: 0 });
      this.hooks.onMatch({
        id: inv.id,
        mode: 'duel',
        mySeat: 1,
        roster: [
          { kind: 'human', peer: peer.peer, by: peer.by },
          { kind: 'human', peer: this.myPeer, by: this.me.id },
        ],
      });
    }
  }

  process() {
    if (!this.myPeer) return;
    const others = this.others();
    // 1) 나에게 온 도전장
    for (const p of others) {
      const inv = p.presence.inv;
      if (!inv || inv.to !== this.myPeer || this.handled.has(inv.id) || !fresh(p, INVITE_MS)) continue;
      if (this.state.st === 'busy' && !this.state.inv) continue;
      if (this.state.st === 'q' && p.presence.st === 'q') {
        this.answer(p, inv, true); // 빠른 대전끼리는 자동 수락
        return;
      }
      this.handled.add(inv.id);
      this.hooks.onInvite(p, inv);
    }
    // 2) 내 도전장에 대한 답
    const inv = this.state.inv;
    if (inv) {
      const target = this.peers.find((p) => p.peer === inv.to);
      const ans = target && target.presence && target.presence.ans;
      if (ans && ans.to === this.myPeer && ans.id === inv.id) {
        if (ans.ok) {
          this.set({ inv: null, st: 'busy', qAt: 0 });
          this.hooks.onMatch({
            id: inv.id,
            mode: 'duel',
            mySeat: 0,
            roster: [
              { kind: 'human', peer: this.myPeer, by: this.me.id },
              { kind: 'human', peer: target.peer, by: target.by },
            ],
          });
        } else {
          this.set({ inv: null, st: 'idle' });
          this.hooks.onDeclined();
        }
        return;
      }
      if (!target || Date.now() - this.invAt > INVITE_MS) {
        this.set({ inv: null, st: this.state.st === 'q' ? 'q' : 'idle' });
        if (this.state.st !== 'q') this.hooks.onDeclined(true);
      }
    }
    // 3) 빠른 대전: 대기열을 같은 순서로 정렬해 짝수 번째가 다음 사람에게 도전장
    if (this.state.st === 'q' && !this.state.inv) {
      const queue = [{ peer: this.myPeer, qAt: this.state.qAt }, ...others.filter((p) => p.presence.st === 'q' && !p.presence.inv).map((p) => ({ peer: p.peer, qAt: p.presence.qAt || 0, p }))].sort(
        (a, b) => a.qAt - b.qAt || (a.peer < b.peer ? -1 : 1),
      );
      const i = queue.findIndex((x) => x.peer === this.myPeer);
      if (i % 2 === 0 && queue[i + 1]) this.invite(queue[i + 1].p);
    }
  }
}

// ---------------- 팀전 방 ----------------
export class TeamRoom {
  constructor(room, code, isHost, me, hooks) {
    this.room = room;
    this.code = code;
    this.isHost = isHost;
    this.me = me;
    this.hooks = hooks; // onChange, onStart({mid, roster, mySeat, nr}), onClosed(reason)
    this.peers = [];
    this.myPeer = null;
    this.state = { app: TEAMROOM, v: NET_V, seat: null, ready: false, fac: '', host: isHost, ai: [], start: null };
    this.started = false;
  }

  async join() {
    this.nr = await this.room.join(`t-${this.code}`);
    this.unsub = this.nr.onPeers(
      (ch) => {
        this.peers = ch.peers;
        const mine = ch.peers.find((p) => p.sameTab);
        if (mine) this.myPeer = mine.peer;
        this.process();
        this.hooks.onChange();
      },
      (e) => this.hooks.onClosed(e.code),
    );
    this.push();
  }

  push() {
    if (this.nr) this.nr.presence({ ...this.state }).catch(() => {});
  }

  set(patch) {
    Object.assign(this.state, patch);
    this.push();
    this.hooks.onChange();
  }

  members() {
    return this.peers.filter((p) => p.kind === 'viewer' && p.presence && p.presence.app === TEAMROOM && p.presence.v === NET_V);
  }

  host() {
    return this.members().find((p) => p.presence.host) || null;
  }

  // 자리 현황: 같은 자리를 둘이 고르면 peer 이름이 앞선 사람이 갖는다
  seats() {
    const out = [0, 1, 2, 3].map(() => ({ kind: 'empty' }));
    const ms = this.members().slice().sort((a, b) => (a.peer < b.peer ? -1 : 1));
    for (const p of ms) {
      const i = p.presence.seat;
      if (Number.isInteger(i) && i >= 0 && i < 4 && out[i].kind === 'empty') {
        out[i] = { kind: 'human', peer: p.peer, by: p.by, ready: !!p.presence.ready, fac: p.presence.fac || '', isMe: p.sameTab };
      }
    }
    const h = this.host();
    const ai = (h && Array.isArray(h.presence.ai) && h.presence.ai) || [];
    for (const i of ai) if (out[i] && out[i].kind === 'empty') out[i] = { kind: 'ai', ctrl: h.peer };
    return out;
  }

  sit(i) {
    this.set({ seat: i, ready: false });
  }

  stand() {
    this.set({ seat: null, ready: false });
  }

  setReady(ready, fac) {
    this.set({ ready, fac });
  }

  toggleAi(i) {
    if (!this.isHost) return;
    const ai = new Set(this.state.ai);
    if (ai.has(i)) ai.delete(i);
    else ai.add(i);
    this.set({ ai: [...ai].sort() });
  }

  canStart() {
    const seats = this.seats();
    return seats.every((s) => s.kind === 'ai' || (s.kind === 'human' && s.ready)) && seats.some((s) => s.kind === 'human' && s.isMe) && seats.filter((s) => s.kind === 'human').length >= 2;
  }

  startMatch() {
    if (!this.isHost || !this.canStart()) return;
    const seats = this.seats();
    const roster = seats.map((s) => (s.kind === 'human' ? { kind: 'human', peer: s.peer, by: s.by } : { kind: 'ai', ctrl: this.myPeer }));
    const mid = randomId(10);
    this.set({ start: { mid, roster } });
    this.begin(mid, roster);
  }

  process() {
    if (this.started) return;
    const me = this.state.seat;
    // 내 자리를 다른 사람이 가져갔으면 일어선다
    if (Number.isInteger(me)) {
      const s = this.seats()[me];
      if (s.kind === 'human' && !s.isMe) {
        this.state.seat = null;
        this.state.ready = false;
        this.push();
        this.hooks.onToast && this.hooks.onToast('그 자리는 다른 사람이 먼저 앉았어요');
      }
    }
    // 들어온 직후 첫 목록에는 방장이 아직 안 보일 수 있다: 한 번 본 방장이 사라졌거나, 10초 동안 못 찾을 때만 닫는다
    const h = this.host();
    if (!this.isHost) {
      if (h) this.seenHost = true;
      else if (this.seenHost) {
        this.hooks.onClosed('host_left');
        return;
      } else if (!this.hostTimer) {
        this.hostTimer = setTimeout(() => {
          if (!this.seenHost && !this.started) this.hooks.onClosed('not_found');
        }, 10000);
      }
    }
    if (!this.isHost && h && h.presence.start) {
      const { mid, roster } = h.presence.start;
      if (Array.isArray(roster) && roster.some((r) => r.peer === this.myPeer)) this.begin(mid, roster);
    }
  }

  begin(mid, roster) {
    if (this.started) return;
    this.started = true;
    if (this.unsub) this.unsub();
    const mySeat = roster.findIndex((r) => r.kind === 'human' && r.peer === this.myPeer);
    this.hooks.onStart({ mid, roster, mySeat, nr: this.nr, mode: 'team' });
  }

  async leave() {
    if (this.unsub) this.unsub();
    if (this.nr) await this.nr.leave().catch(() => {});
  }
}

// ---------------- 경기 세션 ----------------
const encodeLog = (arr) => arr.join(' ');
const decodeLog = (str) => (typeof str === 'string' && str ? str.split(' ') : []);

export class MatchSession {
  // opts: { room, nr?, mid, mode, roster, mySeat, me, deck, store, onUpdate, resume? }
  constructor(opts) {
    Object.assign(this, opts);
    this.phase = 'setup'; // setup → play → reveal → done | aborted | desync
    this.peers = [];
    this.game = null;
    this.sync = null;
    this.result = null;
    this.msg = '상대를 기다리는 중…';
    const r = opts.resume;
    this.seed = r ? r.seed : randomSeed();
    this.nonce = r ? r.nonce : randomId(12);
    this.log = r ? r.log.slice() : [];
    this.facs = this.roster.map(() => '');
    this.myFac = parseDeckCode(this.deck).fac;
    this.commit = commitOf(this.deck, this.seed);
    // 내가 조종하는 AI 좌석 (팀전 빈자리)
    this.aiSeats = {};
    this.roster.forEach((r2, i) => {
      if (r2.kind === 'ai' && r2.ctrl === this.roster[this.mySeat].peer) {
        const saved = r && r.ai && r.ai[`s${i}`];
        const deck = saved ? saved.deck : opts.aiDeckFor(i);
        const seed = saved ? saved.seed : randomSeed();
        this.aiSeats[i] = { deck, seed, nonce: saved ? saved.nonce : randomId(12), log: saved ? saved.log.slice() : [], brain: { rng: seed ^ 0x5bd1e995 }, fac: parseDeckCode(deck).fac, commit: commitOf(deck, seed) };
      }
    });
    this.absentSince = {};
    this.turnStart = Date.now();
    this.lastActive = -1;
    this.startedAt = Date.now();
    this.aiTimer = null;
  }

  get roomName() {
    return this.mode === 'team' ? null : `d-${this.mid}`;
  }

  // 화면 공용 인터페이스
  get s() {
    return this.game;
  }

  get kind() {
    return this.mode;
  }

  isMyTurn() {
    return this.phase === 'play' && !!this.game && !this.game.over && this.game.active === this.mySeat;
  }

  async start() {
    if (!this.nr) this.nr = await this.room.join(`d-${this.mid}`);
    this.unsub = this.nr.onPeers(
      (ch) => {
        this.peers = ch.peers;
        this.update();
      },
      (e) => {
        if (this.phase === 'play' || this.phase === 'setup') this.abort(`연결이 끊겼어요 (${e.code})`, 'X');
      },
    );
    this.publish();
    this.tick = setInterval(() => this.onTick(), 1000);
    this.persist();
  }

  dispose() {
    clearInterval(this.tick);
    clearTimeout(this.aiTimer);
    if (this.unsub) this.unsub();
    if (this.nr) this.nr.leave().catch(() => {});
    this.nr = null;
  }

  // ---- presence ----
  publish() {
    if (!this.nr) return;
    const ai = {};
    for (const [i, a] of Object.entries(this.aiSeats)) {
      ai[`s${i}`] = { fac: a.fac, commit: a.commit, nonce: a.nonce, L: encodeLog(a.log), n: a.log.length, h: this.hashFor(Number(i), a.log.length), rev: this.phase === 'reveal' || this.phase === 'done' ? { deck: a.deck, seed: a.seed } : null };
    }
    const p = {
      app: MATCH,
      v: NET_V,
      m: this.mid,
      seat: this.mySeat,
      fac: this.myFac,
      commit: this.commit,
      nonce: this.nonce,
      L: encodeLog(this.log),
      n: this.log.length,
      h: this.hashFor(this.mySeat, this.log.length),
      rev: this.phase === 'reveal' || this.phase === 'done' ? { deck: this.deck, seed: this.seed } : null,
      ai,
    };
    this.nr.presence(p).catch((e) => {
      if (e && e.code === 'invalid_argument') this.abort('경기 기록이 너무 길어져서 더 보낼 수 없어요', 'X');
    });
  }

  hashFor(seat, n) {
    if (!this.sync || !n) return '';
    return this.sync.hashAt[seat][n - 1] || '';
  }

  // 좌석 i의 상태(presence)를 찾는다: 사람은 같은 id(by)나 같은 peer, AI는 조종자의 ai.s<i>
  seatPresence(i) {
    const r = this.roster[i];
    if (r.kind === 'ai') {
      // 조종자가 새로고침하면 peer 이름이 바뀌므로, 그 AI 좌석 정보를 내보내는 사람을 찾는다
      const ctrl = this.peers.find((p) => p.presence && p.presence.app === MATCH && p.presence.m === this.mid && p.presence.ai && p.presence.ai[`s${i}`]);
      return ctrl ? ctrl.presence.ai[`s${i}`] : null;
    }
    const p = this.peers.find((x) => x.presence && x.presence.app === MATCH && x.presence.m === this.mid && x.presence.seat === i && !x.sameTab && (r.by ? x.by === r.by : x.peer === r.peer));
    return p ? p.presence : null;
  }

  seatPeerPresent(i) {
    const r = this.roster[i];
    const peer = r.kind === 'ai' ? r.ctrl : r.peer;
    if (r.kind === 'human' && i === this.mySeat) return true;
    if (r.kind === 'ai' && this.aiSeats[i]) return true;
    if (r.kind === 'ai') return !!this.seatPresence(i);
    return this.peers.some((x) => x.presence && x.presence.app === MATCH && x.presence.m === this.mid && x.presence.seat === i && (r.by ? x.by === r.by : x.peer === peer));
  }

  logs() {
    return this.roster.map((r, i) => {
      if (i === this.mySeat) return this.log;
      if (this.aiSeats[i]) return this.aiSeats[i].log;
      const p = this.seatPresence(i);
      return p ? decodeLog(p.L) : [];
    });
  }

  // ---- 진행 ----
  update() {
    if (this.phase === 'setup') this.trySetup();
    if (this.phase === 'play') this.advance();
    if (this.phase === 'reveal') this.tryVerify();
    this.onUpdate();
  }

  trySetup() {
    const info = this.roster.map((r, i) => {
      if (i === this.mySeat) return { fac: this.myFac, commit: this.commit, nonce: this.nonce };
      if (this.aiSeats[i]) return this.aiSeats[i];
      return this.seatPresence(i);
    });
    if (!info.every((x) => x && x.fac && x.commit && x.nonce)) {
      if (Date.now() - this.startedAt > SETUP_WAIT_MS) this.abort('상대가 들어오지 않았어요', null);
      return;
    }
    this.info = info.map((x) => ({ fac: x.fac, commit: x.commit, nonce: x.nonce }));
    this.shared = sharedFrom(this.info.map((x) => x.nonce));
    const seats = this.info.map((x, i) => {
      if (i === this.mySeat) return { fac: x.fac, deck: this.deck, seed: this.seed };
      if (this.aiSeats[i]) return { fac: x.fac, deck: this.aiSeats[i].deck, seed: this.aiSeats[i].seed };
      return { fac: x.fac };
    });
    this.game = createMatchGame(this.mode, seats, this.shared);
    this.sync = new MatchSync(this.game);
    this.phase = 'play';
    this.msg = '';
    this.turnStart = Date.now();
    const mySide = this.game.seats[this.mySeat].side;
    const human = this.roster.map((r, i) => ({ ...r, i })).filter((r) => r.kind === 'human' && r.i !== this.mySeat && r.by);
    this.store.addGame({
      m: this.mid,
      mode: this.mode,
      o: human.filter((r) => this.game.seats[r.i].side !== mySide).map((r) => r.by),
      tm: human.filter((r) => this.game.seats[r.i].side === mySide).map((r) => r.by),
      r: '?',
      at: Date.now(),
    });
    this.advance();
    this.publish();
  }

  advance() {
    const before = this.game.ev.length;
    this.sync.advance(this.logs());
    if (this.sync.error) {
      this.desync(`${this.sync.error.seat + 1}번 자리의 행동을 적용할 수 없어요`);
      return;
    }
    // 남들이 낸 해시와 내 계산 비교
    for (let i = 0; i < this.roster.length; i++) {
      if (i === this.mySeat || this.aiSeats[i]) continue;
      const p = this.seatPresence(i);
      if (!p) continue;
      if (this.sync.hashMatches(i, Number(p.n) || 0, p.h) === false) {
        this.desync('서로 계산한 게임 상태가 달라요');
        return;
      }
    }
    if (this.game.active !== this.lastActive) {
      this.lastActive = this.game.active;
      this.turnStart = Date.now();
    }
    this.newEvents = this.game.ev.length > before;
    if (this.game.over) {
      this.phase = 'reveal';
      this.revealAt = Date.now();
      this.msg = '경기 확인 중…';
      this.publish();
      this.tryVerify();
      return;
    }
    this.scheduleAi();
    this.persist();
  }

  scheduleAi() {
    const pi = this.game.active;
    if (!this.aiSeats[pi] || this.aiTimer) return;
    this.aiTimer = setTimeout(() => {
      this.aiTimer = null;
      if (this.phase !== 'play' || this.game.active !== pi) return;
      const a = aiAction(this.game, pi, this.aiSeats[pi].brain);
      this.aiSeats[pi].log.push(enc(a));
      this.advance();
      this.publish();
      this.onUpdate();
    }, 900);
  }

  // 내 행동. 반환: 오류 메시지 또는 null
  act(a) {
    if (this.phase !== 'play') return '지금은 행동할 수 없어요';
    if (a.t !== 'x' && this.game.active !== this.mySeat) return '내 턴이 아니에요';
    const err = check(this.game, this.mySeat, a);
    if (err) return err;
    this.log.push(enc(a));
    this.advance();
    this.publish();
    this.onUpdate();
    return null;
  }

  timeLeft() {
    if (this.phase !== 'play') return 0;
    return Math.max(0, TURN_MS[this.mode] - (Date.now() - this.turnStart));
  }

  onTick() {
    if (this.phase === 'play') {
      if (this.game.active === this.mySeat && this.timeLeft() <= 0) this.act({ t: 'end' });
      for (let i = 0; i < this.roster.length; i++) {
        if (this.seatPeerPresent(i)) delete this.absentSince[i];
        else if (!this.absentSince[i]) this.absentSince[i] = Date.now();
      }
      const gone = Object.entries(this.absentSince).find(([, t]) => Date.now() - t > ABSENT_MS);
      if (gone) this.abort(this.mode === 'duel' ? '상대가 나가서 부전승이에요' : '참가자가 나가서 경기가 무효가 됐어요', this.mode === 'duel' ? 'W' : 'X');
    }
    if (this.phase === 'setup') this.trySetup();
    if (this.phase === 'reveal') this.tryVerify();
    this.onUpdate();
  }

  absentNames() {
    return Object.keys(this.absentSince).map(Number);
  }

  tryVerify() {
    const seats = this.roster.map((r, i) => {
      const base = this.info[i];
      if (i === this.mySeat) return { ...base, deck: this.deck, seed: this.seed };
      if (this.aiSeats[i]) return { ...base, deck: this.aiSeats[i].deck, seed: this.aiSeats[i].seed };
      const p = this.seatPresence(i);
      return p && p.rev ? { ...base, deck: p.rev.deck, seed: p.rev.seed } : base;
    });
    const all = seats.every((s) => s.deck);
    if (!all && Date.now() - this.revealAt < REVEAL_WAIT_MS) return;
    const v = all ? verifyMatch(this.mode, seats, this.shared, this.logs()) : { ok: false, why: '상대가 덱을 공개하기 전에 나갔어요' };
    const mySide = this.game.seats[this.mySeat].side;
    const w = this.game.winner;
    const r = w === 2 ? 'D' : w === mySide ? 'W' : 'L';
    const verified = v.ok && v.winner === w;
    this.finish(r, verified, verified ? '' : v.ok ? '다시 계산한 결과가 달라요' : v.why);
  }

  finish(r, verified, note) {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.result = { r, verified, note };
    this.store.finishGame(this.mid, r, verified);
    this.publish();
    this.clearPersist();
    this.onUpdate();
    // 공개 정보를 남들이 받아갈 시간을 주고 방을 나간다
    setTimeout(() => this.dispose(), 15000);
  }

  desync(why) {
    if (this.phase === 'done') return;
    this.phase = 'desync';
    this.result = { r: 'X', verified: false, note: why };
    this.store.finishGame(this.mid, 'X', false);
    this.clearPersist();
    this.onUpdate();
  }

  abort(why, r) {
    if (this.phase === 'done' || this.phase === 'aborted') return;
    const wasPlaying = this.phase === 'play';
    this.phase = 'aborted';
    this.result = { r: r || 'X', verified: false, note: why };
    if (wasPlaying && r) this.store.finishGame(this.mid, r, false);
    this.clearPersist();
    this.onUpdate();
  }

  // ---- 새로고침 복귀용 저장 ----
  persist() {
    const ai = {};
    for (const [i, a] of Object.entries(this.aiSeats)) ai[`s${i}`] = { deck: a.deck, seed: a.seed, nonce: a.nonce, log: a.log };
    lset('cd-match', { mid: this.mid, mode: this.mode, roster: this.roster, mySeat: this.mySeat, deck: this.deck, seed: this.seed, nonce: this.nonce, log: this.log, ai, at: Date.now(), team: this.teamCode || null });
  }

  clearPersist() {
    lset('cd-match', null);
  }
}

export function savedMatch() {
  const v = lget('cd-match', null);
  return v && Date.now() - v.at < 20 * 60000 ? v : null;
}

export function dropSavedMatch() {
  lset('cd-match', null);
}
