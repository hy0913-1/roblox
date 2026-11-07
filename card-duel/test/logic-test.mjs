// 솔로 기록 검증, 대전 동기화/검증, 순위 계산 테스트. 사용: node test/logic-test.mjs
import assert from 'node:assert/strict';
import { act, enc, publicHash } from '../src/engine.js';
import { aiChoose } from '../src/ai.js';
import { PRESETS, deckCode } from '../src/cards.js';
import { newRun, floorGame, aiStateFor, floorPoints, nextHp, replayRun, FLOORS } from '../src/solo.js';
import { commitOf, sharedFrom, createMatchGame, MatchSync, verifyMatch } from '../src/match.js';
import { computeStandings, PTS } from '../src/standings.js';

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

const codeOf = (key) => {
  const p = PRESETS.find((x) => x.key === key);
  return deckCode(p.fac, p.ids);
};

// 사람 대신 AI가 솔로 런을 진행하며 화면과 똑같이 기록을 남긴다
function playRun(seed, deck, stopAt = Infinity) {
  const run = newRun(seed, deck);
  for (let f = 0; f < FLOORS.length; f++) {
    run.acts[f] = [];
    const s = floorGame(run.seed, run.deck, f, run.hp);
    const ai = aiStateFor(run.seed, f);
    const me = { rng: seed + 1000 + f };
    let n = 0;
    while (!s.over) {
      if (s.active === 0) {
        if (n++ >= stopAt) return { run, live: run.score, abandoned: true };
        const a = aiChoose(s, 0, 'normal', me);
        assert.equal(act(s, 0, a), null);
        run.acts[f].push(enc(a));
      } else {
        const a = aiChoose(s, 1, FLOORS[f].level, ai);
        if (act(s, 1, a)) act(s, 1, { t: 'end' });
      }
    }
    if (s.winner !== 0) break;
    run.score += floorPoints(f, s);
    run.hp = nextHp(s);
  }
  return { run, live: run.score };
}

test('솔로: 저장한 기록을 다시 계산하면 같은 점수 (여러 시드/덱)', () => {
  let cleared = 0;
  for (let sd = 1; sd <= 10; sd++) {
    const deck = codeOf(PRESETS[sd % 5].key);
    const { run, live } = playRun(sd * 7777, deck);
    const r = replayRun(run);
    assert.equal(r.ok, true, r.why);
    assert.equal(r.score, live);
    cleared += r.floors;
  }
  assert.ok(cleared > 3, `AI가 층을 너무 못 깸: ${cleared}`);
});

test('솔로: 행동을 바꾸거나 덱을 바꾸면 검증에서 걸린다', () => {
  const { run, live } = playRun(424242, codeOf('fire'));
  const fake = JSON.parse(JSON.stringify(run));
  fake.acts[0] = fake.acts[0].map((a) => (a.startsWith('p.') ? 'p.f12.h1' : a));
  const r1 = replayRun(fake);
  assert.ok(!r1.ok || r1.score !== live);
  const fake2 = { ...run, deck: codeOf('steel') };
  const r2 = replayRun(fake2);
  assert.ok(!r2.ok || r2.score !== live);
});

test('솔로: 중간에 그만둔 런은 깬 층까지만 점수', () => {
  const { run } = playRun(99, codeOf('wild'), 3);
  const r = replayRun(run);
  assert.equal(r.ok, true);
  assert.equal(r.floors, 0);
  assert.equal(r.score, 0);
});

// ---------- 대전 ----------
// clients: 사람 좌석마다 하나. AI 좌석은 ctrl 클라이언트가 둔다.
function simulateMatch(mode, keys, opts = {}) {
  const n = keys.length;
  const seeds = keys.map((_, i) => 1000 + i * 17 + (opts.salt || 0));
  const decks = keys.map((k) => codeOf(k));
  const facs = keys.map((k) => PRESETS.find((p) => p.key === k).fac);
  const commits = decks.map((d, i) => commitOf(d, seeds[i]));
  const nonces = keys.map((_, i) => `n${i}-${opts.salt || 0}`);
  const shared = sharedFrom(nonces);
  const aiSeats = new Set(opts.aiSeats || []);
  const ctrlOf = (i) => (aiSeats.has(i) ? opts.ctrl : i); // AI 좌석의 조종자
  const humans = [...Array(n).keys()].filter((i) => !aiSeats.has(i));
  const clients = humans.map((me) => {
    // 부정 클라이언트는 자기 손패 검사를 건너뛴다(자기 좌석도 '?'로 계산)
    const knows = (i) => ctrlOf(i) === me && !(opts.cheat && opts.cheat.seat === me);
    const seats = keys.map((_, i) => (knows(i) ? { fac: facs[i], deck: decks[i], seed: seeds[i] } : { fac: facs[i] }));
    const g = createMatchGame(mode, seats, shared);
    return { me, sync: new MatchSync(g), brain: { rng: me + 7 } };
  });
  const logs = keys.map(() => []);
  const published = keys.map(() => ({ n: 0, h: '' }));
  let steps = 0;
  const truthHash = () => publicHash(clients[0].sync.s);
  while (!clients[0].sync.s.over && steps++ < 4000) {
    const pi = clients[0].sync.s.active;
    const owner = clients.find((c) => c.me === ctrlOf(pi));
    let a = aiChoose(owner.sync.s, pi, 'normal', owner.brain);
    if (opts.cheat && pi === opts.cheat.seat && !opts.cheat.done) {
      a = { t: 'play', c: opts.cheat.card, tgt: '' };
      opts.cheat.done = true;
    }
    logs[pi].push(enc(a));
    owner.sync.advance(logs);
    if (owner.sync.error) return { error: owner.sync.error };
    published[pi] = { n: logs[pi].length, h: owner.sync.hashAt[pi][logs[pi].length - 1] };
    for (const c of clients) {
      if (c === owner) continue;
      c.sync.advance(logs);
      if (c.sync.error) return { error: c.sync.error, steps };
      for (let j = 0; j < n; j++) assert.notEqual(c.sync.hashMatches(j, published[j].n, published[j].h), false, `해시 불일치 좌석 ${j}`);
      assert.equal(publicHash(c.sync.s), truthHash());
    }
  }
  const s = clients[0].sync.s;
  assert.ok(s.over);
  const reveal = keys.map((_, i) => ({ fac: facs[i], commit: commits[i], deck: opts.badReveal === i ? codeOf('steel') : decks[i], seed: opts.badSeed === i ? seeds[i] + 1 : seeds[i] }));
  const v = verifyMatch(mode, reveal, shared, logs);
  return { s, v, steps };
}

test('대전 1:1: 각자 자기 패만 알아도 끝까지 같은 상태, 공개 후 검증 통과', () => {
  for (const [a, b] of [['fire', 'steel'], ['arcane', 'wild'], ['shadow', 'fire']]) {
    const { s, v } = simulateMatch('duel', [a, b], { salt: a.length });
    assert.equal(v.ok, true, v.why);
    assert.equal(v.winner, s.winner);
  }
});

test('대전 2:2 팀전 (AI 빈자리 포함): 동기화와 검증 통과', () => {
  const r1 = simulateMatch('team', ['fire', 'steel', 'wild', 'shadow'], { salt: 3 });
  assert.equal(r1.v.ok, true, r1.v.why);
  const r2 = simulateMatch('team', ['arcane', 'fire', 'steel', 'wild'], { salt: 5, aiSeats: [2, 3], ctrl: 0 });
  assert.equal(r2.v.ok, true, r2.v.why);
  assert.equal(r2.v.winner, r2.s.winner);
});

test('대전 부정: 덱에 없는 카드를 내면 공개 검증에서 걸린다', () => {
  // 0번 자리(불꽃 덱)가 덱에 없는 1비용 '견습 기사'를 낸다. 상대는 손패를 모르니 그 순간엔 못 막는다.
  const cheat = { seat: 0, card: 'n01' };
  const r = simulateMatch('duel', ['fire', 'steel'], { salt: 9, cheat });
  assert.equal(r.error, undefined, '상대 쪽 계산은 그 순간 받아들여야 함');
  assert.equal(cheat.done, true);
  assert.equal(r.v.ok, false);
  assert.match(r.v.why, /규칙에 맞지 않아요/);
});

test('대전 부정: 약속과 다른 덱/시드를 공개하면 걸린다', () => {
  const r1 = simulateMatch('duel', ['fire', 'steel'], { salt: 11, badSeed: 1 });
  assert.equal(r1.v.ok, false);
  assert.match(r1.v.why, /약속/);
  const r2 = simulateMatch('duel', ['fire', 'steel'], { salt: 12, badReveal: 0 });
  assert.equal(r2.v.ok, false);
});

test('공유 시드는 모든 사람의 난수로 정해진다 (한 명이 바꾸면 달라짐)', () => {
  assert.notEqual(sharedFrom(['a', 'b']), sharedFrom(['a', 'c']));
  assert.equal(sharedFrom(['a', 'b']), sharedFrom(['a', 'b']));
});

// ---------- 순위 ----------
test('순위: 상대 기록과 맞는 승부만, 상대별 3경기까지, 솔로는 검증된 점수만', () => {
  const ev = 'e1';
  const g = (m, o, r, mode = 'duel', at = 1) => ({ m, mode, o, r, ev, at });
  const docs = [
    { uid: 'a', doc: { ev, solo: { best: 500, run: { score: 500 } }, games: [g('m1', ['b'], 'W'), g('m2', ['b'], 'W', 'duel', 2), g('m3', ['b'], 'W', 'duel', 3), g('m4', ['b'], 'W', 'duel', 4), g('m5', ['c'], 'W', 'duel', 5)] } },
    { uid: 'b', doc: { ev, solo: { best: 900, run: { score: 300 } }, games: [g('m1', ['a'], 'L'), g('m2', ['a'], 'L'), g('m3', ['a'], 'L'), g('m4', ['a'], 'L')] } },
    { uid: 'c', doc: { ev, solo: null, games: [] } }, // m5는 c가 인정 안 함
    { uid: 'z', doc: { ev: 'old', solo: { best: 9999, run: { score: 9999 } }, games: [] } }, // 지난 이벤트
  ];
  const rows = computeStandings(docs, ev, (run) => run.score);
  const by = Object.fromEntries(rows.map((r) => [r.uid, r]));
  assert.equal(rows.length, 3);
  assert.equal(by.a.pvp, PTS.W * 3, '같은 상대 4승 중 3승만');
  assert.equal(by.a.capped, 1);
  assert.equal(by.a.unconfirmed, 1, 'c가 기록하지 않은 승리는 미확인');
  assert.equal(by.a.total, 500 + 360);
  assert.equal(by.b.soloState, 'bad', '주장 900, 재계산 300');
  assert.equal(by.b.solo, 0);
  assert.equal(by.b.pvp, PTS.L * 3);
  assert.equal(rows[0].uid, 'a');
  assert.equal(by.c.total, 0);
});

test('순위: 팀전은 상대 팀 중 한 명이라도 같은 결과면 인정, 1인 6경기까지', () => {
  const ev = 'e2';
  const games = (r, opp, n) => Array.from({ length: n }, (_, i) => ({ m: `t${i}`, mode: 'team', o: opp, tm: [], r, ev, at: i }));
  const docs = [
    { uid: 'a', doc: { ev, games: games('W', ['c', 'd'], 8) } },
    { uid: 'c', doc: { ev, games: games('L', ['a', 'b'], 8) } },
    { uid: 'd', doc: { ev, games: [] } },
  ];
  const rows = computeStandings(docs, ev, () => null);
  const a = rows.find((r) => r.uid === 'a');
  assert.equal(a.w, 6);
  assert.equal(a.capped, 2);
  assert.equal(a.pvp, PTS.W * 6);
});

console.log(`\n${passed}개 통과`);
