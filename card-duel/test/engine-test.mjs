// 엔진 규칙 테스트. 사용: node test/engine-test.mjs
import assert from 'node:assert/strict';
import { createGame, act, publicHash, enc, dec, clone, attackTargets, targetsFor, findUnit } from '../src/engine.js';
import { aiChoose } from '../src/ai.js';
import { PRESETS, CARDS, validateDeck, deckCode, parseDeckCode, COLLECTIBLE } from '../src/cards.js';

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

const P = Object.fromEntries(PRESETS.map((p) => [p.key, p]));
const duel = (a = 'fire', b = 'steel', extra = {}) =>
  createGame({ seats: [{ fac: P[a].fac, deck: P[a].ids, seed: 1 }, { fac: P[b].fac, deck: P[b].ids, seed: 2 }], shared: 99, first: 0, ...extra });

// 테스트용: pi가 카드를 즉시 내게 만든다(손패/에너지 조작)
function put(s, pi, id, tgt = '') {
  s.seats[pi].hand.push(id);
  s.seats[pi].mana = 10;
  const err = act(s, pi, { t: 'play', c: id, tgt });
  assert.equal(err, null, `${id} 내기 실패: ${err}`);
  const b = s.sides[s.seats[pi].side].board;
  return b[b.length - 1];
}
function pass(s) {
  // 상대 턴을 그냥 넘겨서 다시 내 턴으로
  act(s, s.active, { t: 'end' });
  act(s, s.active, { t: 'end' });
}

test('기본 덱 5개가 모두 덱 규칙을 지킨다', () => {
  for (const p of PRESETS) assert.equal(validateDeck(p.fac, p.ids), null, p.key);
});

test('덱 규칙: 장수, 타 파벌, 3장 이상, 전설 2장, 토큰을 막는다', () => {
  assert.match(validateDeck('fire', P.fire.ids.slice(1)), /20장/);
  assert.match(validateDeck('fire', [...P.fire.ids.slice(1), 's01']), /넣을 수 없어요/);
  const three = [...P.fire.ids.slice(0, 18), 'f01', 'f01'];
  assert.match(validateDeck('fire', three), /2장까지/);
  assert.match(validateDeck('fire', [...P.fire.ids.slice(0, 18), 'f12', 'f12']), /1장까지/);
  assert.match(validateDeck('wild', [...P.wild.ids.slice(1), 'tw']), /쓸 수 없는/);
  const code = deckCode('fire', P.fire.ids);
  assert.deepEqual(parseDeckCode(code), { fac: 'fire', ids: [...P.fire.ids].sort() });
});

test('카드 데이터: 모든 수집 카드에 이름/비용/종류가 있고, 효과 카드에는 설명이 있다', () => {
  assert.ok(COLLECTIBLE.length >= 70);
  for (const id of COLLECTIBLE) {
    const c = CARDS[id];
    assert.ok(c.name && Number.isInteger(c.cost) && (c.type === 'unit' || c.type === 'spell'), id);
    if (c.play || c.death || c.onSpell || c.onAnyDeath || c.spellDmg || c.type === 'spell') assert.ok(c.text, `${id} 설명 없음`);
  }
});

test('시작: 선공 3장, 후공 4장+동전, 선공 1에너지', () => {
  const s = duel();
  assert.equal(s.active, 0);
  assert.equal(s.seats[0].hand.length, 4); // 3장 + 첫 턴 드로우
  assert.equal(s.seats[1].hand.length, 5); // 4장 + 동전
  assert.ok(s.seats[1].hand.includes('tc'));
  assert.equal(s.seats[0].mana, 1);
});

test('행동 문자열 왕복 변환', () => {
  for (const a of [{ t: 'play', c: 'f02', tgt: 'h1' }, { t: 'play', c: 'f01', tgt: '' }, { t: 'atk', u: 12, tgt: 'u7' }, { t: 'hp', tgt: 'h0' }, { t: 'end' }, { t: 'x' }]) {
    assert.deepEqual(dec(enc(a)), a);
  }
});

test('수호: 수호 유닛이 있으면 그것만 공격할 수 있다', () => {
  const s = duel();
  const atk = put(s, 0, 'f03'); // 돌진 2/1
  pass(s);
  act(s, 0, { t: 'end' });
  const t = put(s, 1, 's01');
  act(s, 1, { t: 'end' });
  const ats = attackTargets(s, 0);
  assert.deepEqual(ats, [`u${t.uid}`]);
  assert.notEqual(act(s, 0, { t: 'atk', u: atk.uid, tgt: 'h1' }), null);
});

test('돌진은 바로 공격, 일반 유닛은 다음 턴부터', () => {
  const s = duel();
  const c = put(s, 0, 'f03');
  const n = put(s, 0, 'f01');
  assert.equal(act(s, 0, { t: 'atk', u: n.uid, tgt: 'h1' }) !== null, true);
  assert.equal(act(s, 0, { t: 'atk', u: c.uid, tgt: 'h1' }), null);
  assert.equal(s.sides[1].hp, 18);
});

test('보호막은 첫 피해를 막고, 맹독은 피해를 준 유닛을 죽인다', () => {
  const s = duel('wild', 'steel');
  const spider = put(s, 0, 'w02'); // 1/2 맹독
  act(s, 0, { t: 'end' });
  const knight = put(s, 1, 's09'); // 4/4 보호막
  act(s, 1, { t: 'end' });
  act(s, 0, { t: 'atk', u: spider.uid, tgt: `u${knight.uid}` });
  assert.equal(knight.kw.shield, false);
  assert.ok(findUnit(s, knight.uid), '보호막 덕에 살아 있어야 함');
  assert.equal(findUnit(s, spider.uid), null, '거미는 4 피해로 죽음');
  const s2 = duel('wild', 'steel');
  const sp2 = put(s2, 0, 'w02');
  act(s2, 0, { t: 'end' });
  const big = put(s2, 1, 's12'); // 6/8 수호
  act(s2, 1, { t: 'end' });
  act(s2, 0, { t: 'atk', u: sp2.uid, tgt: `u${big.uid}` });
  assert.equal(findUnit(s2, big.uid), null, '맹독으로 죽어야 함');
});

test('흡혈은 준 피해만큼 회복, 질풍은 두 번 공격', () => {
  const s = duel('shadow', 'fire');
  s.sides[0].hp = 10;
  const bat = put(s, 0, 'd02');
  const wf = put(s, 0, 'n10');
  pass(s);
  act(s, 0, { t: 'atk', u: bat.uid, tgt: 'h1' });
  assert.equal(s.sides[0].hp, 12);
  assert.equal(act(s, 0, { t: 'atk', u: wf.uid, tgt: 'h1' }), null);
  assert.equal(act(s, 0, { t: 'atk', u: wf.uid, tgt: 'h1' }), null);
  assert.notEqual(act(s, 0, { t: 'atk', u: wf.uid, tgt: 'h1' }), null);
});

test('은신은 공격 전까지 대상이 안 되고, 공격하면 풀린다', () => {
  const s = duel('shadow', 'fire');
  const sn = put(s, 0, 'd03');
  act(s, 0, { t: 'end' });
  assert.ok(!targetsFor(s, 1, 'enemy').includes(`u${sn.uid}`));
  assert.ok(!attackTargets(s, 1).includes(`u${sn.uid}`));
  act(s, 1, { t: 'end' });
  act(s, 0, { t: 'atk', u: sn.uid, tgt: 'h1' });
  assert.equal(sn.kw.stealth, false);
  assert.ok(targetsFor(s, 1, 'enemy').includes(`u${sn.uid}`) || s.active === 0);
});

test('빙결된 유닛은 다음 자기 턴에 공격할 수 없고, 그 턴이 끝나면 풀린다', () => {
  const s = duel('fire', 'arcane');
  const u = put(s, 0, 'n13'); // 6/7이라 서리 화살 3 피해로 죽지 않음
  act(s, 0, { t: 'end' });
  s.seats[1].hand.push('a03');
  s.seats[1].mana = 10;
  assert.equal(act(s, 1, { t: 'play', c: 'a03', tgt: `u${u.uid}` }), null);
  act(s, 1, { t: 'end' });
  assert.equal(u.frz, true);
  assert.notEqual(act(s, 0, { t: 'atk', u: u.uid, tgt: 'h1' }), null);
  act(s, 0, { t: 'end' });
  assert.equal(u.frz, false);
  act(s, 1, { t: 'end' });
  assert.equal(act(s, 0, { t: 'atk', u: u.uid, tgt: 'h1' }), null);
});

test('침묵은 키워드와 유언을 지운다', () => {
  const s = duel('wild', 'steel');
  const tree = put(s, 0, 'w11'); // 수호 + 유언
  act(s, 0, { t: 'end' });
  put(s, 1, 'n05', `u${tree.uid}`);
  assert.equal(tree.sil, true);
  assert.equal(tree.kw.taunt, undefined);
  s.seats[1].hand.push('s08');
  s.seats[1].mana = 10;
  const before = s.sides[0].board.length;
  assert.equal(act(s, 1, { t: 'play', c: 's08', tgt: `u${tree.uid}` }), null);
  assert.equal(s.sides[0].board.length, before - 1, '묘목이 나오면 안 됨');
});

test('주문 피해: 불꽃 연구가가 있으면 불꽃 화살이 3 피해', () => {
  const s = duel('fire', 'wild');
  put(s, 0, 'f05');
  put(s, 0, 'f02', 'h1');
  assert.equal(s.sides[1].hp, 17);
  assert.notEqual(act(s, 0, { t: 'play', c: 'f02', tgt: 'h0' }), null, '불꽃 화살은 내 영웅을 노릴 수 없음');
});

test('유언 연쇄: 피의 의식 → 늑대 새끼 유언(늑대) → 폭발 마술사 유언이 그 늑대까지 처치', () => {
  const s = duel('fire', 'wild');
  const lab = put(s, 0, 'f05'); // 1/3
  const boom = put(s, 0, 'f04'); // 2/2 유언: 모든 적에게 1 피해
  act(s, 0, { t: 'end' });
  put(s, 1, 'w01'); // 1/1 유언: 늑대
  put(s, 1, 'd09'); // 모든 유닛에 2 피해
  assert.equal(findUnit(s, boom.uid), null);
  assert.equal(s.sides[1].board.length, 0, '늑대 새끼와 유언 늑대 모두 사라져야 함');
  assert.equal(s.sides[1].hp, 19, '마술사 유언 1 피해');
  assert.equal(findUnit(s, lab.uid).hp, 1);
});

test('맹수 조련사: 돌진을 받은 유닛은 이번 턴에 공격할 수 있다', () => {
  const s = duel('wild', 'fire');
  const w = put(s, 0, 'w08');
  put(s, 0, 'w09', `u${w.uid}`);
  assert.equal(w.atk, 6);
  assert.equal(act(s, 0, { t: 'atk', u: w.uid, tgt: 'h1' }), null);
});

test('영웅 능력: 턴당 한 번, 에너지 2', () => {
  const s = duel('steel', 'fire');
  s.seats[0].mana = 5;
  assert.equal(act(s, 0, { t: 'hp', tgt: '' }), null);
  assert.equal(s.sides[0].armor, 2);
  assert.notEqual(act(s, 0, { t: 'hp', tgt: '' }), null);
  assert.equal(s.seats[0].mana, 3);
});

test('덱이 비면 피로 피해가 1, 2, 3...으로 늘어난다', () => {
  const s = duel();
  s.seats[1].deck = [];
  act(s, 0, { t: 'end' });
  assert.equal(s.sides[1].hp, 19);
  act(s, 1, { t: 'end' });
  act(s, 0, { t: 'end' });
  assert.equal(s.sides[1].hp, 17);
});

test('항복하면 상대 진영 승리', () => {
  const s = duel();
  act(s, 1, { t: 'x' });
  assert.equal(s.over, true);
  assert.equal(s.winner, 0);
});

// ---------- 숨김 정보 일관성: 남의 덱을 모르는 계산도 공개 해시가 매 단계 같아야 한다 ----------
function consistency(mode, keys, seed) {
  const team = mode === 'team';
  const seats = keys.map((k, i) => ({ fac: P[k].fac, deck: P[k].ids, seed: seed * 13 + i }));
  const cfg = { mode, shared: seed * 7919, first: seed % 2 };
  const truth = createGame({ ...cfg, seats });
  const views = seats.map((_, me) => createGame({ ...cfg, seats: seats.map((st, i) => (i === me ? st : { fac: st.fac, deck: null, count: 20 })) }));
  for (const v of views) assert.equal(publicHash(v), publicHash(truth), '시작 해시');
  const ais = seats.map((_, i) => ({ rng: seed + i }));
  let steps = 0;
  while (!truth.over && steps++ < 2000) {
    const pi = truth.active;
    const a = aiChoose(truth, pi, 'normal', ais[pi]);
    const code = enc(a);
    assert.equal(act(truth, pi, dec(code)), null);
    for (const v of views) {
      const err = act(v, pi, dec(code));
      assert.equal(err, null, `관점 계산이 행동을 거부: ${code} ${err}`);
      assert.equal(publicHash(v), publicHash(truth), `해시 불일치 (단계 ${steps}, ${code})`);
    }
  }
  assert.ok(truth.over, '게임이 끝나야 함');
  return steps;
}

test('숨김 정보 일관성 1:1 (여러 시드, 여러 덱 조합)', () => {
  let n = 0;
  for (let sd = 1; sd <= 12; sd++) {
    const keys = [PRESETS[sd % 5].key, PRESETS[(sd * 3) % 5].key];
    n += consistency('duel', keys, sd);
  }
  assert.ok(n > 100);
});

test('숨김 정보 일관성 2:2 팀전', () => {
  for (let sd = 1; sd <= 6; sd++) {
    const keys = [0, 1, 2, 3].map((i) => PRESETS[(sd + i * 2) % 5].key);
    consistency('team', keys, sd);
  }
});

test('결정성: 같은 설정으로 두 번 돌리면 같은 결과', () => {
  const run = () => {
    const s = duel('arcane', 'shadow');
    const ais = [{ rng: 5 }, { rng: 6 }];
    const log = [];
    while (!s.over && log.length < 3000) {
      const a = aiChoose(s, s.active, 'normal', ais[s.active]);
      log.push(enc(a));
      act(s, s.active, a);
    }
    return publicHash(s) + log.join(',');
  };
  assert.equal(run(), run());
});

test('clone은 원본과 독립', () => {
  const s = duel();
  const c = clone(s);
  put(c, 0, 'f01');
  assert.equal(s.sides[0].board.length, 0);
  assert.notEqual(publicHash(s), publicHash(c));
});

console.log(`\n${passed}개 통과`);
