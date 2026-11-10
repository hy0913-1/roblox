// 처음부터 끝까지 흐름 확인: 퀘스트 받기 → 사냥 → 보고 → … → 보스 → 엔딩, 사다리, 사망·부활, 저장·이어하기
const { chromium } = require('playwright');
const path = require('node:path');
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fail++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1152, height: 700 } });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', (e) => errors.push(e.message));
  await pg.goto('file://' + path.resolve(__dirname, '../dist/index.html'));
  await pg.click('[data-ui="new"]');
  await pg.waitForTimeout(500);
  const G = (fn, a) => pg.evaluate(fn, a);
  const talk = async () => {
    await G(() => { const g = window.__rpg.game; if (g.p.map !== 'village') g.enter('village'); g.p.x = 12 * 16 + 8; g.p.y = 12 * 16; g.p.vy = 0; });
    await pg.waitForTimeout(450);
    await pg.keyboard.press('ArrowUp');
    await pg.waitForSelector('.dialog', { timeout: 3000 });
    for (let i = 0; i < 12 && (await pg.locator('.dialog').count()); i++) { await pg.keyboard.press('Space'); await pg.waitForTimeout(90); }
  };
  // 걷기·점프·사다리
  const x0 = await G(() => window.__rpg.game.p.x);
  await pg.keyboard.down('ArrowRight'); await pg.waitForTimeout(500); await pg.keyboard.up('ArrowRight');
  ok((await G(() => window.__rpg.game.p.x)) > x0 + 30, '걷기');
  await pg.keyboard.press('Space'); await pg.waitForTimeout(200);
  ok(await G(() => !window.__rpg.game.p.ground), '점프');
  await G(() => { const g = window.__rpg.game; g.p.x = 31 * 16 + 8; g.p.y = 12 * 16; });
  await pg.waitForTimeout(400);
  await pg.keyboard.down('ArrowUp'); await pg.waitForTimeout(1300); await pg.keyboard.up('ArrowUp');
  await pg.waitForTimeout(300);
  ok(await G(() => { const p = window.__rpg.game.p; return p.y <= 9 * 16 + 1 && p.ground; }), '사다리로 발판 위에 오름');
  await G(() => { window.__rpg.game.p.x = 28 * 16 + 8; }); await pg.waitForTimeout(200);
  await pg.keyboard.down('ArrowDown'); await pg.waitForTimeout(80); await pg.keyboard.down('Space'); await pg.waitForTimeout(80); await pg.keyboard.up('Space'); await pg.keyboard.up('ArrowDown'); await pg.waitForTimeout(700);
  ok(await G(() => window.__rpg.game.p.y >= 12 * 16 - 1), '↓+점프로 발판 아래로');
  // 퀘스트 6개를 차례로
  const kill = (type, n) => G(([type, n]) => { const g = window.__rpg.game; for (let i = 0; i < n; i++) { const m = g.spawnMob({ type, x0: 30, x1: 30, row: 12, n: 1 }, true); m.minion = true; g.hitMob(m, 9999); } g.mobs = g.mobs.filter((m) => !m.dead); }, [type, n]);
  const steps = [[['fluff', 6]], [], [['snake', 6]], [['bat', 8], ['ghost', 6]], [['skull', 8], ['eye', 6]]];
  for (let q = 0; q < 5; q++) {
    await talk();
    ok(await G((q) => window.__rpg.game.p.quest === q && window.__rpg.game.p.qstate === 'active', q), `퀘스트 ${q + 1} 받음`);
    for (const [t, n] of steps[q]) await kill(t, n);
    if (q === 1) await G(() => { window.__rpg.game.p.hair = 8; });
    ok(await G(() => window.__rpg.game.questProgress().done), `퀘스트 ${q + 1} 조건 달성`);
    await talk();
    ok(await G((q) => window.__rpg.game.p.quest === q + 1, q), `퀘스트 ${q + 1} 보상`);
  }
  const st = await G(() => { const p = window.__rpg.game.p; return { lv: p.lv, gold: p.gold, skills: p.skills, sp: p.sp }; });
  ok(st.lv >= 9 && st.skills.air >= 1, `레벨 ${st.lv}, 스킬 전부 배움 ${JSON.stringify(st.skills)}`);
  await talk();
  // 보스
  await G(() => { const g = window.__rpg.game; g.enter('throne', 6, 11); });
  await pg.waitForTimeout(600);
  ok(await G(() => !!window.__rpg.game.boss), '보스 등장');
  await pg.waitForTimeout(4500);
  ok(await G(() => window.__rpg.game.boss.act !== undefined && window.__rpg.game.boss.x !== 28 * 16), '보스가 움직임');
  await G(() => { const g = window.__rpg.game; g.p.inv = 5; g.hitMob(g.boss, 99999); });
  await pg.waitForTimeout(800);
  ok(await G(() => window.__rpg.game.p.won && !window.__rpg.game.boss), '보스 처치');
  await talk();
  await pg.waitForSelector('.end', { timeout: 3000 });
  ok(true, '엔딩');
  await pg.keyboard.press('Enter');
  // 사망·부활
  await G(() => { const g = window.__rpg.game; g.enter('meadow', 34, 11); g.p.inv = 0; g.hurt(99999, 0); });
  await pg.waitForTimeout(3300);
  ok(await G(() => { const p = window.__rpg.game.p; return p.map === 'village' && !p.dead && p.hp > 0; }), '쓰러지면 마을에서 부활');
  // 상점·스킬 강화
  await G(() => { const g = window.__rpg.game; g.p.x = 21 * 16 + 8; g.p.y = 12 * 16; g.p.gold = 500; });
  await pg.waitForTimeout(300);
  await pg.keyboard.press('ArrowUp');
  await pg.click('[data-ui="buy"][data-id="hp"]');
  await pg.click('[data-ui="buy"][data-id="glove"]');
  ok(await G(() => window.__rpg.game.p.glove === 1), '상점 구매');
  await pg.keyboard.press('Escape');
  await pg.keyboard.press('KeyK');
  await pg.click('[data-ui="skillup"][data-id="beam"]');
  ok(await G(() => window.__rpg.game.p.skills.beam === 2), '스킬 강화');
  await pg.keyboard.press('KeyK');
  // 이어하기
  await pg.reload();
  await pg.click('[data-ui="continue"]');
  await pg.waitForTimeout(400);
  ok(await G(() => { const p = window.__rpg.game.p; return p.quest === 6 && p.glove === 1 && p.skills.beam === 2; }), '저장 후 이어하기');
  console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : '페이지 오류 없음');
  await b.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
