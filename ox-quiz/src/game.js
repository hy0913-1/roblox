// O/X 퀴즈 진행 로직(진행자 화면에서만 돈다). 네트워크와 무관한 순수 코드라 노드에서 테스트할 수 있다.
// 진행자가 유일한 심판: 정답은 공개 단계 전까지 snapshot()에 절대 들어가지 않는다.

export const VERSION = 1;

export const SKILLS = {
  ink: { name: '먹물', cost: 1, dur: 4000, desc: '4초 동안 상대 문제를 먹물로 가려요' },
  mess: { name: '뒤죽박죽', cost: 1, dur: 4000, desc: '4초 동안 상대 문제 글자를 뒤섞어요' },
  swap: { name: '뒤집기', cost: 1, desc: '이번 문제 동안 상대의 O·X 버튼 자리를 바꿔요' },
  ice: { name: '얼음', cost: 2, dur: 3000, desc: '3초 동안 상대를 얼려 못 움직이게 해요' },
  push: { name: '밀치기', cost: 2, desc: '상대를 반대편으로 밀어내요' },
  shield: { name: '방패', cost: 1, self: true, desc: '이번 문제 동안 나에게 오는 방해를 한 번 막아요' },
};
export const SKILL_ORDER = ['ink', 'mess', 'swap', 'ice', 'push', 'shield'];
export const LIMITS = { maxPlayers: 12, maxEnergy: 5, startEnergy: 2 };
export const TIMING = { count: 3500, grace: 600, reveal: 5500 };
export const POINTS = { correct: 10, streak: 5, survive: 20, place: [50, 30, 20] };
export const WEIGHTS = { gen: 60, game: 30, host: 10 };
export const CATS = { gen: '상식', game: '게임·서브컬처', host: '주최자' };
export const DEFAULT_SETTINGS = { total: 15, lives: 3, askMs: 10000 };
export const BOT_NAMES = ['봇 콩이', '봇 두부', '봇 감자', '봇 호떡', '봇 만두', '봇 꿀떡', '봇 찐빵', '봇 깨비'];

export function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const flip = (s) => (s === 'O' ? 'X' : 'O');

// 카테고리 비율대로 안 쓴 문제를 고른다. 모자라면 이미 쓴 문제로 채운다.
export function pickQuestions(bank, total, seed, used = new Set(), weights = WEIGHTS) {
  const r = mulberry(seed);
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const pools = {};
  for (const q of bank) if (!used.has(q.id)) (pools[q.c in weights ? q.c : 'gen'] ||= []).push(q);
  for (const k of Object.keys(pools)) shuffle(pools[k]);
  const out = [];
  while (out.length < total) {
    const avail = Object.keys(weights).filter((c) => pools[c] && pools[c].length);
    if (!avail.length) break;
    const sum = avail.reduce((s, c) => s + weights[c], 0);
    let x = r() * sum;
    let cat = avail[avail.length - 1];
    for (const c of avail) {
      x -= weights[c];
      if (x < 0) {
        cat = c;
        break;
      }
    }
    out.push(pools[cat].pop());
  }
  if (out.length < total) {
    const picked = new Set(out.map((q) => q.id));
    const rest = shuffle(bank.filter((q) => !picked.has(q.id)));
    while (out.length < total && rest.length) out.push(rest.pop());
  }
  return out;
}

export class HostGame {
  // opts: { code, official, title, bank:[{id,c,q,a,x}], settings, seed, used:Set }
  constructor(opts) {
    this.code = opts.code;
    this.official = !!opts.official;
    this.title = opts.title || (this.official ? '공식전' : '일반전');
    this.bank = opts.bank || [];
    this.used = opts.used || new Set();
    this.settings = { ...DEFAULT_SETTINGS, ...(opts.settings || {}) };
    this.seed = (opts.seed >>> 0) || 1;
    this.rand = mulberry(this.seed ^ 0x9e3779b9);
    this.players = new Map();
    this.pidSeq = 0;
    this.fx = [];
    this.fxSeq = 0;
    this.match = 0;
    this.reset();
  }

  reset() {
    this.phase = 'wait';
    this.round = 0;
    this.questions = [];
    this.q = null;
    this.phaseEnd = 0;
    this.deadline = 0;
    this.ranking = null;
    this.allWrong = false;
    for (const p of this.players.values()) this.resetStats(p);
    this.dirty = true;
  }

  resetStats(p) {
    Object.assign(p, {
      score: 0,
      hearts: this.settings.lives,
      energy: LIMITS.startEnergy,
      alive: true,
      correct: 0,
      streak: 0,
      elim: 0,
      side: '',
      mv: p.mv || 0,
      res: '',
      usedSkill: false,
      shield: false,
      frozenUntil: 0,
      override: null,
      plan: [],
      em: p.em || null,
    });
  }

  // ---------- 참가자 ----------
  addPlayer({ key, by = null, peer = null, char = 0, bot = false, name = '' }) {
    for (const p of this.players.values()) {
      if (p.key === key) {
        p.peer = peer || p.peer;
        p.char = char;
        p.gone = false;
        this.dirty = true;
        return p.pid;
      }
    }
    if (this.phase !== 'wait' || this.players.size >= LIMITS.maxPlayers) return null;
    const pid = `p${++this.pidSeq}`;
    const p = { pid, key, by, peer, char, bot, name, acc: bot ? 0.55 + this.rand() * 0.3 : 0, skillN: 0 };
    this.resetStats(p);
    this.players.set(pid, p);
    this.dirty = true;
    return pid;
  }

  addBot() {
    const used = new Set([...this.players.values()].map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) || `봇 ${this.pidSeq + 1}`;
    return this.addPlayer({ key: `bot:${name}`, bot: true, name, char: Math.floor(this.rand() * 8) });
  }

  removePlayer(pid) {
    if (this.phase === 'wait') this.players.delete(pid);
    else {
      const p = this.players.get(pid);
      if (p) p.gone = true;
    }
    this.dirty = true;
  }

  byKey(key) {
    for (const p of this.players.values()) if (p.key === key) return p;
    return null;
  }

  setSettings(s) {
    if (this.phase !== 'wait') return;
    this.settings = { ...this.settings, ...s };
    for (const p of this.players.values()) p.hearts = this.settings.lives;
    this.dirty = true;
  }

  // ---------- 진행 ----------
  start(now) {
    if (this.phase !== 'wait' && this.phase !== 'end') return false;
    if (this.phase === 'end') this.reset();
    if (!this.players.size) return false;
    this.match += 1;
    const weights = this.official ? WEIGHTS : { gen: WEIGHTS.gen, game: WEIGHTS.game };
    this.questions = pickQuestions(this.bank, this.settings.total, this.seed + this.match * 7919, this.used, weights);
    if (!this.questions.length) return false;
    for (const p of this.players.values()) this.resetStats(p);
    this.startCount = this.players.size;
    this.phase = 'count';
    this.phaseEnd = now + TIMING.count;
    this.round = 0;
    this.dirty = true;
    return true;
  }

  get total() {
    return Math.min(this.settings.total, this.questions.length || this.settings.total);
  }

  alive() {
    return [...this.players.values()].filter((p) => p.alive);
  }

  nextQuestion(now) {
    this.round += 1;
    this.q = this.questions[this.round - 1];
    this.phase = 'ask';
    this.deadline = now + this.settings.askMs;
    this.allWrong = false;
    for (const p of this.players.values()) {
      p.side = '';
      p.res = '';
      p.usedSkill = false;
      p.shield = false;
      p.frozenUntil = 0;
      p.override = null;
      p.plan = p.bot && p.alive ? this.botPlan(p, now) : [];
    }
    this.dirty = true;
  }

  botPlan(p, now) {
    const ms = this.settings.askMs;
    const r = this.rand;
    const answer = r() < p.acc ? this.q.a : flip(this.q.a);
    const plan = [
      { t: now + 700 + r() * 2200, side: r() < 0.5 ? 'O' : 'X' },
      { t: now + Math.min(ms - 900, 3000 + r() * (ms - 4000)), side: answer },
    ];
    if (r() < 0.45) plan.push({ t: now + 1500 + r() * (ms - 3200), skill: true });
    return plan.sort((a, b) => a.t - b.t);
  }

  tick(now) {
    const ev = [];
    if (this.phase === 'count' && now >= this.phaseEnd) {
      this.nextQuestion(now);
      ev.push({ e: 'ask', round: this.round });
    } else if (this.phase === 'ask') {
      for (const p of this.players.values()) {
        if (!p.bot || !p.alive) continue;
        while (p.plan.length && p.plan[0].t <= now) {
          const step = p.plan.shift();
          if (step.side) {
            if (p.frozenUntil <= now) {
              p.side = step.side;
              this.dirty = true;
            } else p.plan.push({ t: p.frozenUntil + 200, side: step.side });
            p.plan.sort((a, b) => a.t - b.t);
          } else if (step.skill) this.botSkill(p, now, ev);
        }
      }
      if (now >= this.deadline + TIMING.grace) {
        this.lock(now);
        ev.push({ e: 'reveal', round: this.round, allWrong: this.allWrong });
      }
    } else if (this.phase === 'reveal' && now >= this.phaseEnd) {
      const aliveN = this.alive().length;
      if (this.round >= this.total || (this.startCount >= 2 && aliveN <= 1)) {
        this.finish();
        ev.push({ e: 'end' });
      } else {
        this.nextQuestion(now);
        ev.push({ e: 'ask', round: this.round });
      }
    }
    return ev;
  }

  botSkill(p, now, ev) {
    const can = SKILL_ORDER.filter((k) => SKILLS[k].cost <= p.energy);
    if (!can.length) return;
    const id = can[Math.floor(this.rand() * can.length)];
    let to = p.pid;
    if (!SKILLS[id].self) {
      const others = this.alive().filter((x) => x.pid !== p.pid);
      if (!others.length) return;
      to = others[Math.floor(this.rand() * others.length)].pid;
    }
    p.skillN += 1;
    const f = this.useSkill(p.pid, { n: p.skillN, id, to }, now);
    if (f) ev.push({ e: 'skill', fx: f });
  }

  // 사람 참가자의 위치(presence)를 반영한다. mv는 내가 움직일 때마다 1씩 느는 번호
  setSide(pid, side, mv, now) {
    const p = this.players.get(pid);
    if (!p || p.bot || !p.alive) return;
    if (side !== 'O' && side !== 'X' && side !== '') return;
    if (!(mv > p.mv)) return;
    if (this.phase === 'ask') {
      if (now > this.deadline + TIMING.grace) return;
      if (p.frozenUntil > now) return; // 얼어 있는 동안 움직임 무시
    }
    p.mv = mv;
    if (p.side !== side) this.dirty = true;
    p.side = side;
    p.override = null;
  }

  // 스킬 요청. 성공하면 효과 기록을 돌려준다(막혔으면 b:1)
  useSkill(pid, req, now) {
    const p = this.players.get(pid);
    if (!p || !req || !(req.n > (p.lastSkillN || 0))) return null;
    // 거부되더라도 번호는 소모: 늦게 온 요청이 다음 문제에서 발동하지 않게
    p.lastSkillN = req.n;
    const sk = SKILLS[req.id];
    if (!sk || !p.alive || this.phase !== 'ask' || now > this.deadline) return null;
    if (req.r !== undefined && req.r !== this.round) return null;
    if (p.usedSkill || p.energy < sk.cost) return null;
    const t = sk.self ? p : this.players.get(req.to);
    if (!t || !t.alive || (!sk.self && t.pid === p.pid)) return null;
    p.energy -= sk.cost;
    p.usedSkill = true;
    const entry = { i: ++this.fxSeq, f: p.pid, t: t.pid, k: req.id, b: 0 };
    if (sk.self) t.shield = true;
    else if (t.shield) {
      t.shield = false;
      entry.b = 1;
    } else if (req.id === 'ice') {
      t.frozenUntil = now + sk.dur;
    } else if (req.id === 'push') {
      t.side = t.side ? flip(t.side) : this.rand() < 0.5 ? 'O' : 'X';
      t.override = t.side;
    }
    this.fx.push(entry);
    if (this.fx.length > 12) this.fx.shift();
    this.dirty = true;
    return entry;
  }

  emote(pid, n, e) {
    const p = this.players.get(pid);
    if (!p || !(n > ((p.em && p.em.n) || 0))) return;
    p.em = { n, e: String(e).slice(0, 8) };
    this.dirty = true;
  }

  lock(now) {
    const a = this.q.a;
    const alive = this.alive();
    for (const p of alive) p.res = p.side === a ? 'o' : 'x';
    this.allWrong = alive.length > 0 && alive.every((p) => p.res === 'x');
    for (const p of alive) {
      if (p.res === 'o') {
        p.correct += 1;
        p.streak += 1;
        p.score += POINTS.correct + (p.streak >= 3 ? POINTS.streak : 0);
        p.energy = Math.min(LIMITS.maxEnergy, p.energy + 1);
      } else {
        p.streak = 0;
        if (!this.allWrong) {
          p.hearts -= 1;
          if (p.hearts <= 0) {
            p.alive = false;
            p.elim = this.round;
          }
        }
      }
    }
    this.used.add(this.q.id);
    this.phase = 'reveal';
    this.phaseEnd = now + TIMING.reveal;
    this.dirty = true;
  }

  finish() {
    const list = [...this.players.values()];
    const key = (p) => [p.alive ? 1 : 0, p.correct, p.hearts, p.elim];
    list.sort((x, y) => {
      const a = key(x);
      const b = key(y);
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
      return y.score - x.score;
    });
    let place = 0;
    let prev = null;
    this.ranking = list.map((p, i) => {
      const k = key(p).join(',');
      if (k !== prev) place = i + 1;
      prev = k;
      const pts = p.score + (p.alive ? POINTS.survive : 0) + (POINTS.place[place - 1] || 0);
      return { pid: p.pid, place, pts, correct: p.correct, alive: p.alive, bot: p.bot, by: p.by, key: p.key };
    });
    this.phase = 'end';
    this.dirty = true;
  }

  // 공식전 기록용: 사람만
  results() {
    return (this.ranking || []).filter((r) => !r.bot).map(({ by, key, place, pts, correct, alive }) => ({ by: by || null, key, place, pts, correct, alive }));
  }

  // ---------- 모두에게 보내는 상태 ----------
  snapshot(now) {
    const tl = this.phase === 'count' || this.phase === 'reveal' ? this.phaseEnd - now : this.phase === 'ask' ? this.deadline - now : 0;
    const R = [];
    const S = {};
    for (const p of this.players.values()) {
      R.push([p.pid, p.by || '', p.peer || '', p.char | 0, p.bot ? 1 : 0, p.bot ? p.name : '']);
      S[p.pid] = [p.score, p.hearts, p.energy, p.alive ? 1 : 0, p.correct, p.streak, p.side, p.res, p.shield ? 1 : 0, p.frozenUntil > now ? 1 : 0, p.em ? p.em.n : 0, p.em ? p.em.e : ''];
    }
    const snap = {
      ph: this.phase,
      rd: this.round,
      tot: this.total,
      lv: this.settings.lives,
      ask: this.settings.askMs,
      tl: Math.max(0, Math.round(tl)),
      off: this.official ? 1 : 0,
      ti: this.title,
      R,
      S,
      fx: this.fx.map((f) => [f.i, f.f, f.t, f.k, f.b]),
    };
    if (this.q && (this.phase === 'ask' || this.phase === 'reveal')) snap.q = { t: this.q.q, c: this.q.c };
    if (this.phase === 'reveal') {
      snap.a = this.q.a;
      snap.x = this.q.x || '';
      snap.aw = this.allWrong ? 1 : 0;
    }
    if (this.phase === 'end' && this.ranking) snap.rk = this.ranking.map((r) => [r.pid, r.place, r.pts]);
    return snap;
  }
}
