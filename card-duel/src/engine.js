// 카드 대결 규칙 엔진. 1:1(duel)과 2:2(team) 모두 지원한다.
// - 결정적: 같은 설정과 같은 행동 순서면 어느 기기에서든 같은 결과 (정수/사칙연산만 사용)
// - 숨김 정보: 남의 덱/손패는 '?'로 두고 계산해도 공개 상태(공개 해시)가 똑같이 나온다
// - 무작위 효과는 모두가 아는 공유 시드(s.rng)로만 정한다
import { CARDS, FACTIONS } from './cards.js';

export const ENGINE_V = 1;
const HAND_MAX = 10;

// ---------- 난수/해시 ----------
export function rnd(st, n) {
  let t = (st.rng = (st.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) % n;
}

export function shuffled(ids, seed) {
  const a = ids.slice();
  const st = { rng: seed >>> 0 };
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(st, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ---------- 생성 ----------
// cfg = { mode, seats: [{fac, deck: [ids] | null(숨김), count, seed, extra}], shared, first(먼저 하는 진영), hp: [진영0, 진영1], turnLimit }
export function createGame(cfg) {
  const mode = cfg.mode === 'team' ? 'team' : 'duel';
  const team = mode === 'team';
  const hp = cfg.hp || (team ? [30, 30] : [20, 20]);
  const maxHp = cfg.maxHp || hp.map((h) => Math.max(h, team ? 30 : 20));
  const s = {
    v: ENGINE_V,
    mode,
    turn: 0,
    oi: 0,
    order: [],
    active: -1,
    over: false,
    winner: -1, // 이긴 진영 0/1, 무승부 2
    reason: '',
    rng: cfg.shared >>> 0 || 0x9e3779b9,
    uid: 1,
    boardMax: team ? 8 : 6,
    turnLimit: cfg.turnLimit || (team ? 64 : 40),
    sides: [0, 1].map((i) => ({ hp: hp[i], max: maxHp[i], armor: 0, board: [] })),
    seats: cfg.seats.map((st, i) => ({
      side: team ? i % 2 : i,
      fac: st.fac,
      hidden: !Array.isArray(st.deck),
      deck: Array.isArray(st.deck) ? shuffled(st.deck, st.seed >>> 0) : Array(st.count ?? 20).fill('?'),
      hand: [],
      mana: 0,
      maxMana: 0,
      fatigue: 0,
      hpUsed: false,
      extra: st.extra || 0,
    })),
    ev: [],
  };
  const first = cfg.first === 1 ? 1 : 0;
  if (team) s.order = first === 0 ? [0, 1, 2, 3] : [1, 2, 3, 0];
  else s.order = first === 0 ? [0, 1] : [1, 0];

  s.order.forEach((pi, k) => {
    const n = (k === 0 ? 3 : 4) + s.seats[pi].extra;
    for (let i = 0; i < n; i++) drawCard(s, pi);
    if (k % 2 === 1) addToHand(s, pi, 'tc');
  });
  s.oi = 0;
  s.active = s.order[0];
  beginTurn(s);
  return s;
}

// ---------- 공개 상태 ----------
const KW_BITS = ['taunt', 'charge', 'shield', 'poison', 'lifesteal', 'windfury', 'stealth'];
function kwBits(u) {
  let b = 0;
  KW_BITS.forEach((k, i) => {
    if (u.kw[k]) b |= 1 << i;
  });
  return b;
}

export function publicHash(s) {
  let str = `${s.v}|${s.mode}|${s.turn}|${s.oi}|${s.active}|${s.over ? 1 : 0}|${s.winner}|${s.rng}|${s.uid}|`;
  for (const sd of s.sides) {
    str += `S${sd.hp},${sd.armor};`;
    for (const u of sd.board) {
      str += `${u.uid}:${u.id}:${u.owner}:${u.atk}:${u.hp}:${u.max}:${kwBits(u)}:${u.sd}:${u.sleep ? 1 : 0}${u.atkLeft}${u.frozen ? 1 : 0}${u.frz ? 1 : 0}${u.sil ? 1 : 0};`;
    }
  }
  for (const P of s.seats) {
    str += `P${P.mana},${P.maxMana},${P.hand.length},${P.deck.length},${P.fatigue},${P.hpUsed ? 1 : 0},${P.hand.filter((c) => c === 'tc').length};`;
  }
  return hash32(str).toString(36);
}

export function clone(s) {
  return {
    ...s,
    ev: [],
    sides: s.sides.map((sd) => ({ ...sd, board: sd.board.map((u) => ({ ...u, kw: { ...u.kw } })) })),
    seats: s.seats.map((P) => ({ ...P, deck: P.deck.slice(), hand: P.hand.slice() })),
  };
}

// ---------- 행동 문자열 ----------
// p.<카드>.<대상>  a.<유닛uid>.<대상>  h.<대상>  e(턴 종료)  x(항복)   대상: h0 h1 u<uid> 또는 빈칸
export function enc(a) {
  switch (a.t) {
    case 'play':
      return `p.${a.c}.${a.tgt || ''}`;
    case 'atk':
      return `a.${a.u}.${a.tgt}`;
    case 'hp':
      return `h.${a.tgt || ''}`;
    case 'end':
      return 'e';
    case 'x':
      return 'x';
    default:
      return '?';
  }
}

export function dec(str) {
  if (str === 'e') return { t: 'end' };
  if (str === 'x') return { t: 'x' };
  const [k, x, y] = String(str).split('.');
  if (k === 'p') return { t: 'play', c: x, tgt: y || '' };
  if (k === 'a') return { t: 'atk', u: Number(x), tgt: y };
  if (k === 'h') return { t: 'hp', tgt: x || '' };
  return { t: '?' };
}

// ---------- 조회 ----------
const ref = (u) => `u${u.uid}`;

export function findUnit(s, uid) {
  for (const sd of s.sides) for (const u of sd.board) if (u.uid === uid) return u;
  return null;
}

function resolveRef(s, r) {
  if (!r) return null;
  if (r[0] === 'h') return { hero: Number(r.slice(1)) };
  if (r[0] === 'u') {
    const u = findUnit(s, Number(r.slice(1)));
    return u ? { unit: u } : null;
  }
  return null;
}

export function spellDamage(s, side) {
  let n = 0;
  for (const u of s.sides[side].board) if (!u.sil) n += u.sd || 0;
  return n;
}

export function costOf(s, pi, id) {
  return CARDS[id] ? CARDS[id].cost : 99;
}

export function targetsFor(s, pi, spec, selfUid = 0) {
  const my = s.seats[pi].side;
  const en = 1 - my;
  const mine = s.sides[my].board.filter((u) => u.uid !== selfUid).map(ref);
  const enemy = s.sides[en].board.filter((u) => !u.kw.stealth);
  const enemyRefs = enemy.map(ref);
  switch (spec) {
    case 'enemy':
      return [...enemyRefs, `h${en}`];
    case 'enemyUnit':
      return enemyRefs;
    case 'enemyUnit4':
      return enemy.filter((u) => u.atk >= 4).map(ref);
    case 'allyUnit':
      return mine;
    case 'anyUnit':
      return [...mine, ...enemyRefs];
    case 'friendly':
      return [...mine, `h${my}`];
    case 'any':
      return [...mine, ...enemyRefs, `h${my}`, `h${en}`];
    default:
      return [];
  }
}

export function attackTargets(s, pi) {
  const en = 1 - s.seats[pi].side;
  const vis = s.sides[en].board.filter((u) => !u.kw.stealth);
  const taunts = vis.filter((u) => u.kw.taunt);
  if (taunts.length) return taunts.map(ref);
  return [...vis.map(ref), `h${en}`];
}

export function canAttack(s, pi, u) {
  return !!u && u.owner === pi && s.active === pi && !s.over && u.atk > 0 && u.atkLeft > 0 && !u.sleep && !u.frz;
}

export function heroPower(s, pi) {
  const f = FACTIONS[s.seats[pi].fac];
  return f ? f.power : null;
}

// ---------- 검사 ----------
export function check(s, pi, a) {
  if (s.over) return '게임이 끝났어요';
  if (a.t === 'x') return null;
  if (s.active !== pi) return '내 턴이 아니에요';
  const P = s.seats[pi];
  const board = s.sides[P.side].board;
  switch (a.t) {
    case 'end':
      return null;
    case 'play': {
      const d = CARDS[a.c];
      if (!d || d.token && a.c !== 'tc') return '알 수 없는 카드';
      if (!P.hand.includes(a.c) && !(P.hidden && P.hand.includes('?'))) return '손에 없는 카드';
      if (P.mana < costOf(s, pi, a.c)) return '에너지가 부족해요';
      if (d.type === 'unit' && board.length >= s.boardMax) return '전장이 가득 찼어요';
      const tgt = a.tgt || '';
      if (d.tg) {
        const tl = targetsFor(s, pi, d.tg, 0);
        if (!tl.length) {
          if (d.type === 'spell') return '대상이 없어요';
          if (tgt) return '잘못된 대상';
        } else if (!tl.includes(tgt)) return '대상을 골라주세요';
      } else if (tgt) return '잘못된 대상';
      return null;
    }
    case 'atk': {
      const u = findUnit(s, a.u);
      if (!u || u.side !== P.side) return '내 유닛이 아니에요';
      if (!canAttack(s, pi, u)) return '지금은 공격할 수 없어요';
      if (!attackTargets(s, pi).includes(a.tgt)) return '그 대상은 공격할 수 없어요';
      return null;
    }
    case 'hp': {
      const pw = heroPower(s, pi);
      if (!pw) return '영웅 능력이 없어요';
      if (P.hpUsed) return '이번 턴에 이미 썼어요';
      if (P.mana < pw.cost) return '에너지가 부족해요';
      if (pw.summon && board.length >= s.boardMax) return '전장이 가득 찼어요';
      const tgt = a.tgt || '';
      if (pw.tg) {
        if (!targetsFor(s, pi, pw.tg, 0).includes(tgt)) return '대상을 골라주세요';
      } else if (tgt) return '잘못된 대상';
      return null;
    }
    default:
      return '알 수 없는 행동';
  }
}

// ---------- 실행 ----------
export function act(s, pi, a) {
  const err = check(s, pi, a);
  if (err) return err;
  switch (a.t) {
    case 'end':
      endTurn(s);
      break;
    case 'x':
      s.over = true;
      s.winner = 1 - s.seats[pi].side;
      s.reason = 'concede';
      emit(s, { k: 'over', w: s.winner, why: 'concede', pi });
      break;
    case 'play':
      doPlay(s, pi, a.c, a.tgt || '');
      break;
    case 'atk':
      doAttack(s, pi, a.u, a.tgt);
      break;
    case 'hp':
      doPower(s, pi, a.tgt || '');
      break;
    default:
  }
  return null;
}

function emit(s, e) {
  s.ev.push(e);
}

function addToHand(s, pi, c) {
  const P = s.seats[pi];
  if (P.hand.length >= HAND_MAX) {
    emit(s, { k: 'burn', pi, c });
    return;
  }
  P.hand.push(c);
}

function drawCard(s, pi) {
  const P = s.seats[pi];
  if (!P.deck.length) {
    P.fatigue += 1;
    emit(s, { k: 'fatigue', pi, n: P.fatigue });
    damageHero(s, P.side, P.fatigue);
    return;
  }
  const c = P.deck.shift();
  emit(s, { k: 'draw', pi, c });
  addToHand(s, pi, c);
}

function removeFromHand(P, c) {
  let i = P.hand.indexOf(c);
  if (i < 0 && P.hidden) i = P.hand.indexOf('?');
  if (i >= 0) P.hand.splice(i, 1);
}

function makeUnit(s, pi, id) {
  const d = CARDS[id];
  const kw = {};
  for (const k of d.kw || []) kw[k] = true;
  const P = s.seats[pi];
  return {
    uid: s.uid++,
    id,
    owner: pi,
    side: P.side,
    atk: d.atk,
    hp: d.hp,
    max: d.hp,
    kw,
    sd: d.spellDmg || 0,
    sleep: !kw.charge,
    atkLeft: kw.charge ? (kw.windfury ? 2 : 1) : 0,
    frozen: false,
    frz: false,
    sil: false,
    dead: false,
  };
}

function summon(s, pi, id) {
  const P = s.seats[pi];
  const board = s.sides[P.side].board;
  if (board.length >= s.boardMax) return null;
  const u = makeUnit(s, pi, id);
  board.push(u);
  emit(s, { k: 'summon', r: ref(u), c: id, pi });
  return u;
}

function beginTurn(s) {
  s.turn += 1;
  if (s.turn > s.turnLimit) {
    finishByHp(s);
    return;
  }
  const pi = s.active;
  const P = s.seats[pi];
  P.maxMana = Math.min(10, P.maxMana + 1);
  P.mana = P.maxMana;
  P.hpUsed = false;
  for (const u of s.sides[P.side].board) {
    if (u.owner !== pi) continue;
    u.sleep = false;
    u.atkLeft = u.kw.windfury ? 2 : 1;
    if (u.frozen) {
      u.frz = true;
      u.frozen = false;
    }
  }
  emit(s, { k: 'turn', pi, turn: s.turn });
  drawCard(s, pi);
  settle(s);
}

function endTurn(s) {
  const pi = s.active;
  const P = s.seats[pi];
  for (const u of [...s.sides[P.side].board]) {
    const d = CARDS[u.id];
    if (u.owner === pi && !u.sil && d.turnEnd) runFx(s, pi, d.turnEnd, { self: u });
  }
  settle(s);
  if (s.over) return;
  for (const u of s.sides[P.side].board) if (u.owner === pi) u.frz = false;
  s.oi = (s.oi + 1) % s.order.length;
  s.active = s.order[s.oi];
  beginTurn(s);
}

function finishByHp(s) {
  const [a, b] = s.sides;
  s.over = true;
  s.winner = a.hp === b.hp ? 2 : a.hp > b.hp ? 0 : 1;
  s.reason = 'limit';
  emit(s, { k: 'over', w: s.winner, why: 'limit' });
}

function doPlay(s, pi, c, tgt) {
  const P = s.seats[pi];
  const d = CARDS[c];
  removeFromHand(P, c);
  P.mana -= costOf(s, pi, c);
  emit(s, { k: 'play', pi, c, tgt });
  if (d.type === 'unit') {
    const u = summon(s, pi, c);
    if (u && d.play) runFx(s, pi, d.play, { self: u, tgt, spell: false });
  } else {
    runFx(s, pi, d.play || [], { self: null, tgt, spell: true });
    for (const u of [...s.sides[P.side].board]) {
      const ud = CARDS[u.id];
      if (u.owner === pi && !u.sil && ud.onSpell) runFx(s, pi, ud.onSpell, { self: u });
    }
  }
  settle(s);
}

function doPower(s, pi, tgt) {
  const P = s.seats[pi];
  const pw = heroPower(s, pi);
  P.mana -= pw.cost;
  P.hpUsed = true;
  emit(s, { k: 'power', pi, tgt });
  runFx(s, pi, pw.fx, { self: null, tgt, spell: false });
  settle(s);
}

function doAttack(s, pi, uid, tgt) {
  const A = findUnit(s, uid);
  A.atkLeft -= 1;
  if (A.kw.stealth) A.kw.stealth = false;
  emit(s, { k: 'atk', a: ref(A), t: tgt });
  const r = resolveRef(s, tgt);
  if (r.hero !== undefined) {
    const dealt = damageHero(s, r.hero, A.atk);
    if (A.kw.lifesteal && dealt > 0) healHero(s, A.side, dealt);
  } else {
    const D = r.unit;
    const atkA = A.atk;
    const atkD = D.atk;
    const toD = damageUnit(s, D, atkA, A.kw.poison);
    const toA = damageUnit(s, A, atkD, D.kw.poison);
    if (A.kw.lifesteal && toD > 0) healHero(s, A.side, toD);
    if (D.kw.lifesteal && toA > 0) healHero(s, D.side, toA);
  }
  settle(s);
}

function damageUnit(s, u, n, poison = false) {
  if (n <= 0 || u.dead) return 0;
  if (u.kw.shield) {
    u.kw.shield = false;
    emit(s, { k: 'shield', r: ref(u) });
    return 0;
  }
  u.hp -= n;
  emit(s, { k: 'dmg', r: ref(u), n });
  if (poison) u.dead = true;
  return n;
}

function damageHero(s, side, n) {
  if (n <= 0) return 0;
  const H = s.sides[side];
  let rest = n;
  if (H.armor > 0) {
    const a = Math.min(H.armor, rest);
    H.armor -= a;
    rest -= a;
  }
  H.hp -= rest;
  emit(s, { k: 'dmg', r: `h${side}`, n });
  return n;
}

function healHero(s, side, n) {
  const H = s.sides[side];
  const before = H.hp;
  H.hp = Math.min(H.max, H.hp + n);
  if (H.hp > before) emit(s, { k: 'heal', r: `h${side}`, n: H.hp - before });
}

function healRef(s, r, n) {
  const x = resolveRef(s, r);
  if (!x) return;
  if (x.hero !== undefined) return healHero(s, x.hero, n);
  const u = x.unit;
  const before = u.hp;
  u.hp = Math.min(u.max, u.hp + n);
  if (u.hp > before) emit(s, { k: 'heal', r: ref(u), n: u.hp - before });
}

function damageRef(s, r, n) {
  const x = resolveRef(s, r);
  if (!x) return;
  if (x.hero !== undefined) damageHero(s, x.hero, n);
  else damageUnit(s, x.unit, n);
}

function giveKw(u, kws) {
  for (const k of kws || []) {
    u.kw[k] = true;
    if (k === 'charge' && u.sleep) {
      u.sleep = false;
      u.atkLeft = u.kw.windfury ? 2 : 1;
    }
  }
}

function runFx(s, pi, list, ctx) {
  for (const fx of list) applyFx(s, pi, fx, ctx);
}

function applyFx(s, pi, fx, ctx) {
  const P = s.seats[pi];
  const my = P.side;
  const en = 1 - my;
  const sd = ctx.spell ? spellDamage(s, my) : 0;
  const tgtUnit = () => {
    const x = resolveRef(s, ctx.tgt);
    return x && x.unit ? x.unit : null;
  };
  switch (fx.do) {
    case 'dmg': {
      const n = fx.n + sd;
      switch (fx.to) {
        case 'tgt':
          damageRef(s, ctx.tgt, n);
          break;
        case 'enemyHero':
          damageHero(s, en, n);
          break;
        case 'myHero':
          damageHero(s, my, n);
          break;
        case 'randEnemy': {
          const times = (fx.times || 1) + sd;
          for (let i = 0; i < times; i++) {
            const cands = [...s.sides[en].board.filter((u) => !u.dead && u.hp > 0).map(ref), `h${en}`];
            damageRef(s, cands[rnd(s, cands.length)], fx.n);
          }
          break;
        }
        case 'allEnemyUnits':
          for (const u of [...s.sides[en].board]) damageUnit(s, u, n);
          break;
        case 'allEnemies':
          for (const u of [...s.sides[en].board]) damageUnit(s, u, n);
          damageHero(s, en, n);
          break;
        case 'allUnits':
          for (const si of [my, en]) for (const u of [...s.sides[si].board]) damageUnit(s, u, n);
          break;
        case 'otherUnits':
          for (const si of [my, en]) for (const u of [...s.sides[si].board]) if (u !== ctx.self) damageUnit(s, u, n);
          break;
        default:
      }
      break;
    }
    case 'drain': {
      const n = fx.n + sd;
      damageRef(s, ctx.tgt, n);
      healHero(s, my, n);
      break;
    }
    case 'heal':
      if (fx.to === 'myHero') healHero(s, my, fx.n);
      else healRef(s, ctx.tgt, fx.n);
      break;
    case 'armor':
      s.sides[my].armor += fx.n;
      emit(s, { k: 'armor', r: `h${my}`, n: fx.n });
      break;
    case 'draw':
      for (let i = 0; i < fx.n; i++) drawCard(s, pi);
      break;
    case 'buff': {
      let list = [];
      if (fx.to === 'tgt') list = [tgtUnit()].filter(Boolean);
      else if (fx.to === 'self') list = ctx.self ? [ctx.self] : [];
      else if (fx.to === 'allyUnits') list = s.sides[my].board.slice();
      else if (fx.to === 'otherAllyUnits') list = s.sides[my].board.filter((u) => u !== ctx.self);
      for (const u of list) {
        u.atk += fx.a || 0;
        u.hp += fx.h || 0;
        u.max += fx.h || 0;
        giveKw(u, fx.kw);
        emit(s, { k: 'buff', r: ref(u), a: fx.a || 0, h: fx.h || 0 });
      }
      break;
    }
    case 'summon':
      for (let i = 0; i < fx.n; i++) summon(s, pi, fx.id);
      break;
    case 'destroy': {
      const u = tgtUnit();
      if (u) {
        u.dead = true;
        emit(s, { k: 'destroy', r: ref(u) });
      }
      break;
    }
    case 'freeze': {
      const list = fx.to === 'allEnemyUnits' ? s.sides[en].board : [tgtUnit()].filter(Boolean);
      for (const u of list) {
        u.frozen = true;
        emit(s, { k: 'freeze', r: ref(u) });
      }
      break;
    }
    case 'silence': {
      const u = tgtUnit();
      if (u) {
        u.kw = {};
        u.sd = 0;
        u.sil = true;
        u.frozen = false;
        u.frz = false;
        if (u.atkLeft > 1) u.atkLeft = 1;
        emit(s, { k: 'silence', r: ref(u) });
      }
      break;
    }
    case 'mana':
      P.mana = Math.min(10, P.mana + fx.n);
      break;
    case 'armorDmg':
      damageRef(s, ctx.tgt, s.sides[my].armor + sd);
      break;
    case 'sacrifice': {
      const u = tgtUnit();
      if (u) {
        u.dead = true;
        emit(s, { k: 'destroy', r: ref(u) });
      }
      for (let i = 0; i < (fx.draw || 0); i++) drawCard(s, pi);
      break;
    }
    case 'selfHit':
      damageHero(s, my, fx.n);
      break;
    case 'selfAtk':
      if (ctx.self && !ctx.self.dead) {
        ctx.self.atk += fx.n;
        emit(s, { k: 'buff', r: ref(ctx.self), a: fx.n, h: 0 });
      }
      break;
    default:
  }
}

// 죽은 유닛 정리 + 유언/사망 트리거. 연쇄가 끝날 때까지 반복한다.
function settle(s) {
  for (let loop = 0; loop < 40; loop++) {
    const first = s.active >= 0 ? s.seats[s.active].side : 0;
    const order = [first, 1 - first];
    const dead = [];
    for (const si of order) for (const u of s.sides[si].board) if (u.hp <= 0 || u.dead) dead.push(u);
    if (!dead.length) break;
    for (const u of dead) {
      const b = s.sides[u.side].board;
      b.splice(b.indexOf(u), 1);
      emit(s, { k: 'die', r: ref(u), c: u.id });
    }
    for (const u of dead) {
      for (const si of order) {
        for (const w of [...s.sides[si].board]) {
          const wd = CARDS[w.id];
          if (!w.sil && !w.dead && wd.onAnyDeath) runFx(s, w.owner, wd.onAnyDeath, { self: w });
        }
      }
      const d = CARDS[u.id];
      if (!u.sil && d.death) runFx(s, u.owner, d.death, { self: null, spell: false });
    }
  }
  checkEnd(s);
}

function checkEnd(s) {
  if (s.over) return;
  const d0 = s.sides[0].hp <= 0;
  const d1 = s.sides[1].hp <= 0;
  if (!d0 && !d1) return;
  s.over = true;
  s.winner = d0 && d1 ? 2 : d0 ? 1 : 0;
  s.reason = 'hp';
  emit(s, { k: 'over', w: s.winner, why: 'hp' });
}

// ---------- 가능한 행동 목록(AI/화면 공용) ----------
export function legalActions(s, pi) {
  const out = [];
  if (s.over || s.active !== pi) return out;
  const P = s.seats[pi];
  const board = s.sides[P.side].board;
  const seen = new Set();
  for (const c of P.hand) {
    if (c === '?' || seen.has(c)) continue;
    seen.add(c);
    const d = CARDS[c];
    if (!d || P.mana < costOf(s, pi, c)) continue;
    if (d.type === 'unit' && board.length >= s.boardMax) continue;
    if (d.tg) {
      const tl = targetsFor(s, pi, d.tg, 0);
      if (!tl.length) {
        if (d.type === 'unit') out.push({ t: 'play', c, tgt: '' });
      } else for (const t of tl) out.push({ t: 'play', c, tgt: t });
    } else out.push({ t: 'play', c, tgt: '' });
  }
  const pw = heroPower(s, pi);
  if (pw && !P.hpUsed && P.mana >= pw.cost && !(pw.summon && board.length >= s.boardMax)) {
    if (pw.tg) for (const t of targetsFor(s, pi, pw.tg, 0)) out.push({ t: 'hp', tgt: t });
    else out.push({ t: 'hp', tgt: '' });
  }
  const ats = attackTargets(s, pi);
  for (const u of board) if (canAttack(s, pi, u)) for (const t of ats) out.push({ t: 'atk', u: u.uid, tgt: t });
  out.push({ t: 'end' });
  return out;
}
