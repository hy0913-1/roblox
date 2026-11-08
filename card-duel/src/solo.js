// 솔로 도전: AI 3층을 차례로 이기는 런. 시드 + 내 행동만 저장하면 누구든 똑같이 다시 계산해 점수를 검증할 수 있다.
import { createGame, act, dec, hash32 } from './engine.js';
import { aiChoose } from './ai.js';
import { parseDeckCode, validateDeck } from './cards.js';

export const SOLO_V = 1;

const BOSS_DECK = ['a03', 'a03', 'f08', 'f08', 's11', 's11', 'd11', 'd11', 'w08', 'w08', 'n13', 'n13', 'a10', 'a10', 'f07', 'f07', 's06', 's06', 'd12', 'a12'];
const WILD = ['w01', 'w01', 'w02', 'w02', 'w03', 'w03', 'w04', 'w04', 'w05', 'w05', 'w06', 'w06', 'w07', 'w07', 'w08', 'w08', 'n01', 'n01', 'n06', 'w11'];
const STEEL = ['s01', 's01', 's02', 's02', 's03', 's03', 's04', 's04', 's06', 's06', 's08', 's09', 's09', 's10', 's10', 's11', 's11', 'n05', 'n09', 's12'];

export const FLOORS = [
  { name: '1층 · 견습 결투가', fac: 'wild', deck: WILD, level: 'easy', hp: 18, extra: 0, base: 150 },
  { name: '2층 · 숙련 결투가', fac: 'steel', deck: STEEL, level: 'normal', hp: 22, extra: 0, base: 250 },
  { name: '3층 · 결투장의 주인', fac: 'fire', deck: BOSS_DECK, level: 'hard', hp: 26, extra: 1, base: 400 },
];

export function newRun(seed, deck) {
  return { v: SOLO_V, seed: seed >>> 0, deck, floor: 0, hp: 20, score: 0, acts: [[]], results: [], done: false };
}

const seedOf = (seed, f, tag) => hash32(`${seed}:${f}:${tag}`);

export function floorGame(seed, deck, f, hp) {
  const p = parseDeckCode(deck);
  const F = FLOORS[f];
  return createGame({
    mode: 'duel',
    seats: [
      { fac: p.fac, deck: p.ids, seed: seedOf(seed, f, 'me') },
      { fac: F.fac, deck: F.deck, seed: seedOf(seed, f, 'ai'), extra: F.extra },
    ],
    shared: seedOf(seed, f, 'shared'),
    first: seedOf(seed, f, 'first') % 2,
    hp: [hp, F.hp],
    maxHp: [20, F.hp],
  });
}

export function aiStateFor(seed, f) {
  return { rng: seedOf(seed, f, 'brain') };
}

export function humanTurns(s) {
  return s.order[0] === 0 ? Math.ceil(s.turn / 2) : Math.floor(s.turn / 2);
}

export function floorPoints(f, s) {
  const left = Math.max(0, s.sides[0].hp);
  return FLOORS[f].base + left * 5 + Math.max(0, 12 - humanTurns(s)) * 10;
}

export function nextHp(s) {
  return Math.min(20, Math.max(1, s.sides[0].hp) + 5);
}

// 기록을 처음부터 다시 돌려 점수를 계산한다. { ok, score, floors, why }
export function replayRun(rec) {
  if (!rec || rec.v !== SOLO_V || !Array.isArray(rec.acts)) return { ok: false, score: 0, why: '형식이 맞지 않아요' };
  const p = parseDeckCode(rec.deck);
  if (!p || validateDeck(p.fac, p.ids)) return { ok: false, score: 0, why: '덱이 규칙에 맞지 않아요' };
  let hp = 20;
  let score = 0;
  let floors = 0;
  for (let f = 0; f < FLOORS.length; f++) {
    const acts = rec.acts[f];
    if (!acts) break;
    const s = floorGame(rec.seed, rec.deck, f, hp);
    const ai = aiStateFor(rec.seed, f);
    let k = 0;
    let guard = 0;
    while (!s.over && guard++ < 5000) {
      if (s.active === 0) {
        if (k >= acts.length) break;
        const err = act(s, 0, dec(acts[k++]));
        if (err) return { ok: false, score, floors, why: `${f + 1}층 ${k}번째 행동이 규칙에 맞지 않아요` };
      } else {
        const a = aiChoose(s, 1, FLOORS[f].level, ai);
        if (act(s, 1, a)) act(s, 1, { t: 'end' });
      }
    }
    if (k < acts.length) return { ok: false, score, floors, why: '게임이 끝난 뒤의 행동이 있어요' };
    if (!s.over || s.winner !== 0) break;
    score += floorPoints(f, s);
    floors += 1;
    hp = nextHp(s);
  }
  return { ok: true, score, floors };
}
