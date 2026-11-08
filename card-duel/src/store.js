// 공유 기록(db): 이벤트 설정, 각자의 기록(솔로 최고 점수/대전 결과), 내 덱(비공개).
// 경로
//   event/config            주최자만 씀: {id, state:'live'|'ended', title, startedAt, endsAt, minutes}
//   event/final             주최자만 씀: 종료 순간의 최종 순위
//   players/<내 id>          각자 자기 것만 씀: {ev, solo:{best, run, at}, games:[...]}
//   data/users/<내 id>/decks 나만 읽고 씀: {list:[{id, name, code}]}
import { computeStandings } from './standings.js';
import { replayRun } from './solo.js';
import { lget, lset } from './local.js';

const GAME_KEEP = 120;

export class Store {
  constructor(plat, onChange) {
    this.p = plat;
    this.db = plat.db;
    this.me = plat.me;
    this.onChange = onChange;
    this.config = null;
    this.final = null;
    this.players = new Map();
    this.decks = [];
    this.loaded = { config: false, players: false };
    this.stale = false;
    this.writeChain = Promise.resolve();
    this.verifyCache = new Map();
    this.readOnly = plat.canWrite === false;
    this.lastError = '';
  }

  get available() {
    return !!this.db && !!this.me.id;
  }

  start() {
    if (!this.db) return;
    const timer = setTimeout(() => {
      this.stale = true;
      this.onChange();
    }, 10000);
    const done = () => {
      clearTimeout(timer);
      this.stale = false;
    };
    this.db.doc('event/config').onSnapshot(
      (snap) => {
        if (!snap.metadata.fromCache) done();
        this.config = snap.exists ? snap.data() : null;
        this.loaded.config = true;
        this.onChange();
      },
      () => {
        done();
        this.loaded.config = true;
        this.onChange();
      },
    );
    this.db.doc('event/final').onSnapshot(
      (snap) => {
        this.final = snap.exists ? snap.data() : null;
        this.onChange();
      },
      () => {},
    );
    this.db.collection('players').onSnapshot(
      (snap) => {
        if (!snap.metadata.fromCache) done();
        this.players = new Map(snap.docs.map((d) => [d.id, d.data()]));
        this.loaded.players = true;
        this.onChange();
      },
      () => {
        done();
        this.loaded.players = true;
        this.onChange();
      },
    );
    if (this.me.id) this.loadDecks();
  }

  // ---------- 이벤트 ----------
  get liveEvent() {
    const c = this.config;
    if (!c || c.state !== 'live') return null;
    if (c.endsAt && Date.now() > c.endsAt) return null;
    return c;
  }

  get myDoc() {
    const d = this.players.get(this.me.id);
    return d && this.config && d.ev === this.config.id ? d : null;
  }

  async startEvent(minutes, title) {
    const id = `ev-${Date.now().toString(36)}`;
    const now = Date.now();
    await this.db.doc('event/config').set({ id, state: 'live', title: title || '카드 결투장 이벤트', startedAt: now, endsAt: now + minutes * 60000, minutes });
    await this.db.doc('event/final').delete();
  }

  async endEvent() {
    const c = this.config;
    if (!c) return;
    const rows = this.standings();
    await this.db.doc('event/final').set({ id: c.id, endedAt: Date.now(), rows: rows.map(({ uid, total, solo, pvp, w, l, d, rank }) => ({ uid, total, solo, pvp, w, l, d, rank })) });
    await this.db.doc('event/config').set({ ...c, state: 'ended', endsAt: Math.min(c.endsAt || Date.now(), Date.now()) });
  }

  async deletePlayer(uid) {
    await this.db.doc(`players/${uid}`).delete();
  }

  // ---------- 내 기록 쓰기(한 번에 하나씩) ----------
  writeMine(mutate) {
    if (!this.available || !this.liveEvent) return Promise.resolve(false);
    const ev = this.liveEvent.id;
    this.writeChain = this.writeChain.then(async () => {
      const ref = this.db.doc(`players/${this.me.id}`);
      let cur = this.players.get(this.me.id);
      if (!cur || cur.ev !== ev) cur = { ev, solo: null, games: [] };
      const next = mutate(JSON.parse(JSON.stringify(cur)));
      if (!next) return false;
      next.ev = ev;
      next.upd = Date.now();
      if (next.games && next.games.length > GAME_KEEP) next.games = next.games.slice(-GAME_KEEP);
      try {
        await ref.set(next);
        this.players.set(this.me.id, next);
        this.lastError = '';
        return true;
      } catch (e) {
        this.lastError = e && e.code === 'invalid_argument' ? '기록을 저장할 권한이 없어요 (공유 권한이 "참여" 이상인지 확인해 주세요)' : '기록 저장에 실패했어요';
        if (e && e.code === 'invalid_argument') this.readOnly = true;
        this.onChange();
        return false;
      }
    });
    return this.writeChain;
  }

  saveSolo(run, score) {
    const ev = this.liveEvent ? this.liveEvent.id : null;
    return this.writeMine((doc) => {
      if (doc.solo && doc.solo.best >= score) return null;
      doc.solo = { best: score, run: { v: run.v, seed: run.seed, deck: run.deck, acts: run.acts }, at: Date.now(), ev };
      return doc;
    });
  }

  addGame(g) {
    const ev = this.liveEvent ? this.liveEvent.id : null;
    return this.writeMine((doc) => {
      doc.games = (doc.games || []).filter((x) => x.m !== g.m);
      doc.games.push({ ...g, ev });
      return doc;
    });
  }

  finishGame(m, r, vf) {
    return this.writeMine((doc) => {
      const g = (doc.games || []).find((x) => x.m === m);
      if (!g || g.r === r) return null;
      g.r = r;
      g.vf = !!vf;
      return doc;
    });
  }

  // 결과가 안 적힌(창을 닫은) 경기는 30분이 지나면 패배로 정리
  settleAbandoned(activeMid) {
    const doc = this.myDoc;
    if (!doc) return;
    const old = (doc.games || []).filter((g) => g.r === '?' && g.m !== activeMid && Date.now() - (g.at || 0) > 30 * 60000);
    if (!old.length) return;
    this.writeMine((d) => {
      for (const g of d.games || []) if (g.r === '?' && g.m !== activeMid && Date.now() - (g.at || 0) > 30 * 60000) g.r = 'L';
      return d;
    });
  }

  // ---------- 순위 ----------
  verifySolo(run, uid, at) {
    const key = `${uid}|${at}|${run && run.seed}`;
    if (this.verifyCache.has(key)) return this.verifyCache.get(key);
    let v = null;
    try {
      const r = replayRun(run);
      v = r.ok ? r.score : -1;
    } catch {
      v = -1;
    }
    this.verifyCache.set(key, v);
    return v;
  }

  standings() {
    const ev = this.config ? this.config.id : null;
    if (!ev) return [];
    const list = [...this.players].map(([uid, doc]) => ({ uid, doc }));
    return computeStandings(list, ev, (run) => {
      const owner = list.find((p) => p.doc.solo && p.doc.solo.run === run);
      return this.verifySolo(run, owner ? owner.uid : '', owner ? owner.doc.solo.at : 0);
    });
  }

  // ---------- 내 덱 (비공개) ----------
  async loadDecks() {
    const local = readLocal();
    this.decks = local;
    if (!this.db || !this.me.id) return;
    try {
      const snap = await this.db.doc(`data/users/${this.me.id}/decks`).get();
      if (snap.exists && Array.isArray(snap.data().list)) {
        this.decks = snap.data().list;
        writeLocal(this.decks);
      }
    } catch {
      /* 로컬 사본으로 계속 */
    }
    this.onChange();
  }

  async saveDecks(list) {
    this.decks = list;
    writeLocal(list);
    if (!this.db || !this.me.id) return;
    try {
      await this.db.doc(`data/users/${this.me.id}/decks`).set({ list });
    } catch {
      /* 로컬에는 남아 있음 */
    }
  }
}

function readLocal() {
  const v = lget('cd-decks', []);
  return Array.isArray(v) ? v : [];
}

function writeLocal(list) {
  lset('cd-decks', list);
}
