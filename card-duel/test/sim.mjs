// AI 대 AI 시뮬레이션: 기본 덱끼리 밸런스(승률)와 게임 길이를 본다.
// 사용: node test/sim.mjs [판수] [team]
import { createGame, act } from '../src/engine.js';
import { aiTurn } from '../src/ai.js';
import { PRESETS, validateDeck } from '../src/cards.js';

const N = Number(process.argv[2] || 60);
const team = process.argv[3] === 'team';

for (const p of PRESETS) {
  const err = validateDeck(p.fac, p.ids);
  if (err) { console.error('덱 오류', p.key, err); process.exit(1); }
}

function play(decks, seed) {
  const seats = decks.map((p, i) => ({ fac: p.fac, deck: p.ids, seed: seed * 31 + i * 7 + 1 }));
  const s = createGame({ mode: team ? 'team' : 'duel', seats, shared: seed * 2654435761, first: seed % 2 });
  const ais = seats.map((_, i) => ({ rng: seed * 97 + i }));
  let guard = 0;
  while (!s.over && guard++ < 500) aiTurn(s, s.active, 'normal', ais[s.active]);
  return s;
}

const names = PRESETS.map((p) => p.key);
const wins = Object.fromEntries(names.map((n) => [n, { w: 0, g: 0 }]));
const matrix = {};
let turns = 0, games = 0, draws = 0, limit = 0;
const t0 = Date.now();
for (let i = 0; i < PRESETS.length; i++) {
  for (let j = i + 1; j < PRESETS.length; j++) {
    let wi = 0;
    for (let k = 0; k < N; k++) {
      const A = PRESETS[i], B = PRESETS[j];
      const decks = team ? [A, B, A, B] : [A, B];
      const s = play(decks, k * 1000 + i * 37 + j);
      games++; turns += s.turn;
      if (s.reason === 'limit') limit++;
      if (s.winner === 2) { draws++; continue; }
      wins[A.key].g++; wins[B.key].g++;
      if (s.winner === 0) { wins[A.key].w++; wi++; } else wins[B.key].w++;
    }
    matrix[`${PRESETS[i].key}-${PRESETS[j].key}`] = Math.round((wi / N) * 100);
  }
}
console.log(`${team ? '2:2 팀전' : '1:1'} ${games}판, 평균 ${(turns / games).toFixed(1)}턴, 무승부 ${draws}, 턴 제한 종료 ${limit}, ${((Date.now() - t0) / games).toFixed(1)}ms/판`);
for (const n of names) console.log(`  ${n.padEnd(7)} 승률 ${((wins[n].w / wins[n].g) * 100).toFixed(0)}%`);
console.log('  상성(왼쪽 덱 승률%):', JSON.stringify(matrix));
