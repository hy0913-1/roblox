// 진행 로직 테스트. 사용: node ox-quiz/test/game-test.mjs
import assert from 'node:assert/strict';
import { HostGame, pickQuestions, SKILLS, TIMING, POINTS, LIMITS, WEIGHTS } from '../src/game.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}\n${e.stack}`);
    process.exitCode = 1;
  }
}

// 가짜 문제은행: 카테고리별로 a를 번갈아
function bank(n = { gen: 60, game: 30, host: 10 }) {
  const out = [];
  for (const [c, k] of Object.entries(n)) for (let i = 0; i < k; i++) out.push({ id: `${c}${i}`, c, q: `${c} 문제 ${i} `.repeat(3), a: i % 2 ? 'X' : 'O', x: '해설' });
  return out;
}

function game(opts = {}) {
  return new HostGame({ code: 'abc', bank: bank(), seed: 42, settings: { total: 6, lives: 2, askMs: 10000 }, ...opts });
}

// 다음 단계까지 시간을 흘린다
function runTo(g, t0, phase) {
  let t = t0;
  for (let i = 0; i < 2000 && g.phase !== phase; i++) {
    t += 100;
    g.tick(t);
  }
  return t;
}

test('출제: 비율대로, 한 판 안에서 중복 없이, 이미 쓴 문제는 피함', () => {
  const b = bank();
  const counts = { gen: 0, game: 0, host: 0 };
  for (let s = 1; s <= 200; s++) for (const q of pickQuestions(b, 10, s)) counts[q.c] += 1;
  const tot = counts.gen + counts.game + counts.host;
  assert.ok(Math.abs(counts.gen / tot - 0.6) < 0.05, JSON.stringify(counts));
  assert.ok(Math.abs(counts.game / tot - 0.3) < 0.05, JSON.stringify(counts));
  assert.ok(Math.abs(counts.host / tot - 0.1) < 0.04, JSON.stringify(counts));
  const one = pickQuestions(b, 20, 7);
  assert.equal(new Set(one.map((q) => q.id)).size, 20);
  const used = new Set(b.slice(0, 95).map((q) => q.id));
  const rest = pickQuestions(b, 10, 9, used);
  assert.equal(rest.length, 10);
  assert.ok(rest.filter((q) => !used.has(q.id)).length === 5, '안 쓴 5개를 먼저 쓰고 나머지는 이미 쓴 문제로 채움');
});

test('흐름: 대기 → 카운트 → 문제(정답 비공개) → 공개(정답 포함) → 다음 문제', () => {
  const g = game();
  const a = g.addPlayer({ key: 'u_a', by: 'u_a' });
  g.addPlayer({ key: 'u_b', by: 'u_b' });
  assert.equal(g.start(0), true);
  assert.equal(g.phase, 'count');
  let t = runTo(g, 0, 'ask');
  const s1 = g.snapshot(t);
  assert.ok(s1.q && s1.q.t, '문제는 보임');
  assert.equal(s1.a, undefined, '문제 중엔 정답이 상태에 없음');
  assert.equal(JSON.stringify(s1).includes('"a"'), false);
  g.setSide(a, g.q.a, 1, t + 50);
  t = runTo(g, t, 'reveal');
  const s2 = g.snapshot(t);
  assert.equal(s2.a, g.q.a);
  assert.equal(g.players.get(a).correct, 1);
  t = runTo(g, t, 'ask');
  assert.equal(g.round, 2);
});

test('하트: 틀리면 1개 잃고 0이면 탈락, 마지막 1명이면 종료', () => {
  const g = game();
  const a = g.addPlayer({ key: 'a' });
  const b = g.addPlayer({ key: 'b' });
  g.start(0);
  let t = runTo(g, 0, 'ask');
  let mv = 0;
  for (let r = 0; r < 2; r++) {
    g.setSide(a, g.q.a, ++mv, t + 10);
    g.setSide(b, g.q.a === 'O' ? 'X' : 'O', mv, t + 10);
    t = runTo(g, t, 'reveal');
    if (r === 0) t = runTo(g, t, 'ask');
  }
  assert.equal(g.players.get(b).alive, false);
  assert.equal(g.players.get(b).elim, 2);
  t = runTo(g, t, 'end');
  assert.equal(g.phase, 'end');
  const res = g.results();
  assert.equal(res[0].key, 'a');
  assert.equal(res[0].place, 1);
  assert.equal(res[0].pts, 2 * POINTS.correct + POINTS.survive + POINTS.place[0]);
  assert.equal(res[1].place, 2);
});

test('전원 오답이면 아무도 하트를 잃지 않음', () => {
  const g = game();
  const a = g.addPlayer({ key: 'a' });
  const b = g.addPlayer({ key: 'b' });
  g.start(0);
  let t = runTo(g, 0, 'ask');
  const wrong = g.q.a === 'O' ? 'X' : 'O';
  g.setSide(a, wrong, 1, t);
  g.setSide(b, wrong, 1, t);
  t = runTo(g, t, 'reveal');
  assert.equal(g.allWrong, true);
  assert.equal(g.players.get(a).hearts, 2);
  assert.equal(g.snapshot(t).aw, 1);
});

test('스킬: 비용 차감, 한 문제에 한 번, 자기 자신/탈락자 대상 불가, 마감 후 불가', () => {
  const g = game();
  const a = g.addPlayer({ key: 'a' });
  const b = g.addPlayer({ key: 'b' });
  g.start(0);
  const t = runTo(g, 0, 'ask');
  assert.equal(g.useSkill(a, { n: 1, id: 'ink', to: a }, t), null, '자기 자신에게 방해 불가');
  const f = g.useSkill(a, { n: 2, id: 'ink', to: b }, t);
  assert.ok(f && f.k === 'ink' && f.b === 0);
  assert.equal(g.players.get(a).energy, LIMITS.startEnergy - SKILLS.ink.cost);
  assert.equal(g.useSkill(a, { n: 3, id: 'mess', to: b }, t), null, '한 문제에 한 번');
  assert.equal(g.useSkill(b, { n: 1, id: 'ink', to: a }, g.deadline + 1), null, '마감 후 불가');
  assert.equal(g.useSkill(b, { n: 1, id: 'ice', to: a }, t), null, '거부된 번호도 다시 못 씀');
  assert.equal(g.useSkill(b, { n: 2, id: 'ice', to: a, r: g.round + 1 }, t), null, '다른 문제용 요청은 무시');
  assert.ok(g.useSkill(b, { n: 3, id: 'ice', to: a, r: g.round }, t), '이번 문제용 새 요청은 됨');
});

test('스킬: 방패는 방해 하나를 막고 사라짐, 에너지는 그대로 소모', () => {
  const g = game();
  const a = g.addPlayer({ key: 'a' });
  const b = g.addPlayer({ key: 'b' });
  const c = g.addPlayer({ key: 'c' });
  g.start(0);
  const t = runTo(g, 0, 'ask');
  assert.ok(g.useSkill(b, { n: 1, id: 'shield', to: '' }, t));
  const f = g.useSkill(a, { n: 1, id: 'push', to: b }, t + 10);
  assert.equal(f.b, 1);
  assert.equal(g.players.get(b).shield, false);
  assert.equal(g.players.get(a).energy, 0);
  const f2 = g.useSkill(c, { n: 1, id: 'ink', to: b }, t + 20);
  assert.equal(f2.b, 0, '방패는 한 번만');
});

test('얼음: 3초 동안 움직임 무시, 풀리면 다시 반영', () => {
  const g = game();
  const a = g.addPlayer({ key: 'a' });
  const b = g.addPlayer({ key: 'b' });
  g.start(0);
  const t = runTo(g, 0, 'ask');
  g.setSide(b, 'O', 1, t);
  g.useSkill(a, { n: 1, id: 'ice', to: b }, t + 100);
  g.setSide(b, 'X', 2, t + 500);
  assert.equal(g.players.get(b).side, 'O');
  g.setSide(b, 'X', 3, t + 100 + SKILLS.ice.dur + 10);
  assert.equal(g.players.get(b).side, 'X');
});

test('밀치기: 반대편으로 옮기고, 본인이 다시 움직이면 그 위치가 인정됨', () => {
  const g = game();
  const a = g.addPlayer({ key: 'a' });
  const b = g.addPlayer({ key: 'b' });
  g.start(0);
  const t = runTo(g, 0, 'ask');
  g.setSide(b, 'O', 1, t);
  g.useSkill(a, { n: 1, id: 'push', to: b }, t + 100);
  assert.equal(g.players.get(b).side, 'X');
  g.setSide(b, 'O', 1, t + 200); // 오래된 번호: 무시
  assert.equal(g.players.get(b).side, 'X');
  g.setSide(b, 'O', 2, t + 300);
  assert.equal(g.players.get(b).side, 'O');
});

test('봇: 혼자서 문제를 풀고 가끔 스킬을 쓰며 끝까지 진행', () => {
  const g = game({ settings: { total: 10, lives: 3, askMs: 8000 } });
  const me = g.addPlayer({ key: 'me' });
  for (let i = 0; i < 4; i++) g.addBot();
  g.start(0);
  let t = 0;
  let skills = 0;
  for (let i = 0; i < 5000 && g.phase !== 'end'; i++) {
    t += 100;
    for (const e of g.tick(t)) if (e.e === 'skill') skills += 1;
    if (g.phase === 'ask' && i % 7 === 0) g.setSide(me, g.q.a, g.players.get(me).mv + 1, t);
  }
  assert.equal(g.phase, 'end');
  assert.ok(skills > 0, '봇이 스킬을 한 번은 써야 함');
  const bots = [...g.players.values()].filter((p) => p.bot);
  assert.ok(bots.some((p) => p.correct > 0));
  assert.equal(g.results().length, 1, '기록에는 사람만');
});

test('대기 중에만 새 참가자, 같은 사람이 다시 들어오면 같은 자리', () => {
  const g = game();
  const a = g.addPlayer({ key: 'u_a', peer: 'p1' });
  assert.equal(g.addPlayer({ key: 'u_a', peer: 'p2' }), a);
  g.addPlayer({ key: 'u_b' });
  g.start(0);
  assert.equal(g.addPlayer({ key: 'u_c' }), null);
  assert.equal(g.addPlayer({ key: 'u_a', peer: 'p3' }), a, '재접속은 허용');
});

test('presence 크기: 12명, 긴 문제/해설, 효과 12개여도 4KB 이하', () => {
  const long = '가'.repeat(110);
  const b = [{ id: 'x1', c: 'gen', q: long, a: 'O', x: '나'.repeat(120) }];
  const g = new HostGame({ code: 'abc', bank: b, seed: 3, settings: { total: 1 } });
  for (let i = 0; i < 12; i++) g.addPlayer({ key: `u_${'x'.repeat(20)}${i}`, by: `u_${'x'.repeat(20)}${i}`, peer: 'k3v6q2rt7wacd4fn' });
  for (const p of g.players.values()) g.emote(p.pid, 1, 'ㅋㅋㅋㅋ');
  g.start(0);
  let t = runTo(g, 0, 'ask');
  const pids = [...g.players.keys()];
  for (let i = 0; i < 12; i++) g.useSkill(pids[i], { n: 1, id: 'ink', to: pids[(i + 1) % 12] }, t);
  t = runTo(g, t, 'reveal');
  const bytes = Buffer.byteLength(JSON.stringify({ app: 'oxh', v: 1, code: 'abcdef', ...g.snapshot(t) }), 'utf8');
  assert.ok(bytes < 4096, `${bytes} bytes`);
  console.log(`      (최대 상태 크기 ${bytes} bytes)`);
});

console.log(`\n${passed}개 통과`);
