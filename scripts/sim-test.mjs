// 규칙 단위 테스트(Phaser 없이). 사용: npm test
import assert from 'node:assert/strict';
import { Sim, DEFAULT_DATA, STEP } from '../src/sim/Sim.js';
import { TOWERS } from '../src/data/towers.js';
import { ENEMIES } from '../src/data/enemies.js';
import { MAP } from '../src/data/map.js';

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
const step = (sim, sec) => { for (let t = 0; t < sec; t += STEP) sim.update(STEP); };
const freeCell = (sim) => { for (let c = 0; c < MAP.cols; c++) for (let r = 0; r < MAP.rows; r++) if (sim.canBuild(c, r)) return [c, r]; };

test('길과 바위 칸에는 건설할 수 없다', () => {
  const s = new Sim();
  const [pc, pr] = [...MAP.pathCells][0].split(',').map(Number);
  assert.equal(s.canBuild(pc, pr), false);
  const [rc, rr] = [...MAP.rocks][0].split(',').map(Number);
  assert.equal(s.canBuild(rc, rr), false);
  assert.equal(s.canBuild(-1, 0), false);
  assert.equal(s.canBuild(MAP.cols, 0), false);
});

test('건설: 아안이 차감되고, 같은 칸 중복/잔액 부족은 실패한다', () => {
  const s = new Sim();
  const [c, r] = freeCell(s);
  assert.ok(s.build('yisang', c, r));
  assert.equal(s.ahn, DEFAULT_DATA.cfg.startAhn - TOWERS.yisang.cost);
  assert.equal(s.build('yisang', c, r), null);
  s.ahn = 10;
  const [c2, r2] = freeCell(s);
  assert.equal(s.build('donquixote', c2, r2), null);
});

test('업그레이드: 비용 차감, 최대 레벨에서 멈춤', () => {
  const s = new Sim();
  s.ahn = 9999;
  const [c, r] = freeCell(s);
  const t = s.build('yisang', c, r);
  assert.ok(s.upgrade(t.id));
  assert.ok(s.upgrade(t.id));
  assert.equal(t.level, 3);
  assert.equal(s.upgrade(t.id), false);
  assert.equal(s.upgradeCost(t), null);
});

test('판매: 투자액의 70%를 돌려받고 칸이 비워진다', () => {
  const s = new Sim();
  const [c, r] = freeCell(s);
  const t = s.build('faust', c, r);
  const before = s.ahn;
  assert.ok(s.sell(t.id));
  assert.equal(s.ahn, before + Math.floor(TOWERS.faust.cost * 0.7));
  assert.equal(s.canBuild(c, r), true);
});

test('웨이브 시작 중에는 다시 시작할 수 없고, 적이 길을 따라 이동한다', () => {
  const s = new Sim();
  assert.ok(s.startWave());
  assert.equal(s.startWave(), false);
  step(s, 3);
  assert.ok(s.enemies.length > 0);
  const e = s.enemies[0];
  assert.ok(e.progress > 0 && e.x > 0);
});

test('방치하면 누수로 내구도가 줄고 0이 되면 패배한다', () => {
  const s = new Sim();
  let guard = 0;
  while (s.phase !== 'lost' && guard++ < 50) {
    if (s.phase === 'prep') s.startWave();
    step(s, 20);
  }
  assert.equal(s.phase, 'lost');
  assert.equal(s.lives, 0);
});

test('방어력은 피해를 줄이지만 최소 1은 들어간다', () => {
  const s = new Sim();
  s.startWave();
  step(s, 0.1);
  const e = { alive: true, hp: 100, armor: 4, flash: 0, slow: 0, slowT: 0, reward: 1, x: 0, y: 0, type: 'shade', size: 10 };
  s.enemies.push(e);
  s.damage(e, 3, 0, 0);
  assert.equal(e.hp, 99);
  s.damage(e, 10, 0, 0);
  assert.equal(e.hp, 93);
});

test('감속은 가장 센 값이 적용되고 시간이 지나면 풀린다', () => {
  const s = new Sim();
  const e = { alive: true, hp: 100, armor: 0, flash: 0, slow: 0, slowT: 0, reward: 1, x: 0, y: 0, type: 'shade', size: 10, progress: 0, speed: 50, leak: 1 };
  s.enemies.push(e);
  s.damage(e, 1, 0.4, 2);
  s.damage(e, 1, 0.2, 1);
  assert.equal(e.slow, 0.4);
  s.phase = 'wave';
  s.queue = [{ t: 99, type: 'shade' }];
  s.wave = 1;
  step(s, 2.1);
  assert.equal(e.slow, 0);
});

test('처치하면 보상이 들어오고 웨이브 클리어 시 보너스를 받는다', () => {
  const s = new Sim();
  s.startWave();
  s.queue = [];
  const e = { id: 999, alive: true, hp: 1, armor: 0, flash: 0, slow: 0, slowT: 0, reward: 8, x: 0, y: 0, type: 'shade', size: 10, progress: 0, speed: 0, leak: 1 };
  s.enemies.push(e);
  const before = s.ahn;
  s.damage(e, 5, 0, 0);
  step(s, 0.1);
  assert.equal(s.ahn, before + 8 + DEFAULT_DATA.waves[0].bonus);
  assert.equal(s.phase, 'prep');
});

test('데이터 검증: 모든 웨이브의 적 종류와 타워 업그레이드 배열이 올바르다', () => {
  for (const w of DEFAULT_DATA.waves) for (const g of w.groups) assert.ok(ENEMIES[g.type], `없는 적 ${g.type}`);
  for (const t of Object.values(TOWERS)) assert.equal(t.upgrade.length, t.levels.length - 1);
  assert.ok(MAP.length > 500);
});

test('같은 입력이면 같은 결과(결정적)', async () => {
  const { run } = await import('./balance.mjs');
  const a = run('mixed');
  const b = run('mixed');
  assert.deepEqual(a, b);
});

console.log(`\n${passed}개 통과`);
