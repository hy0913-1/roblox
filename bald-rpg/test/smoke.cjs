// 브라우저에서 실제로 돌려 본다: 시작 → 걷기 → 스킬 → 사냥. 화면을 찍어 눈으로 확인한다.
const { chromium } = require('playwright');
const path = require('node:path');
const OUT = process.argv[2] || 'shots';
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const pg = await b.newPage({ viewport: { width: 1152, height: 700 } });
  pg.on('pageerror', (e) => errors.push(e.message));
  pg.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await pg.goto('file://' + path.resolve(__dirname, '../dist/index.html'));
  await pg.waitForSelector('.tbox');
  await pg.screenshot({ path: `${OUT}/1-title.png` });
  await pg.click('[data-ui="new"]');
  await pg.waitForTimeout(800);
  const G = (fn) => pg.evaluate(fn);
  await pg.keyboard.down('ArrowRight'); await pg.waitForTimeout(900); await pg.keyboard.up('ArrowRight');
  await pg.screenshot({ path: `${OUT}/2-village.png` });
  // 촌장과 대화
  await G(() => { const g = window.__rpg.game; g.p.x = 12 * 16 + 8; });
  await pg.keyboard.press('ArrowUp'); await pg.waitForTimeout(200);
  await pg.screenshot({ path: `${OUT}/3-dialog.png` });
  for (let i = 0; i < 9 && (await pg.locator('.dialog').count()); i++) { await pg.keyboard.press('Enter'); await pg.waitForTimeout(120); }
  // 초원으로
  await G(() => { const g = window.__rpg.game; g.p.lv = 9; g.p.skills = { beam: 2, slam: 2, quake: 2, air: 1 }; g.p.mp = 999; g.enter('meadow', 34, 11); });
  await pg.waitForTimeout(900);
  await pg.keyboard.press('KeyA'); await pg.waitForTimeout(260);
  await pg.screenshot({ path: `${OUT}/4-beam.png` });
  await pg.waitForTimeout(700);
  await G(() => { window.__rpg.game.p.mp = 999; });
  await pg.keyboard.press('KeyS'); await pg.waitForTimeout(330);
  await pg.screenshot({ path: `${OUT}/5-slam-air.png` });
  await pg.waitForTimeout(330);
  await pg.screenshot({ path: `${OUT}/6-slam-land.png` });
  await pg.waitForTimeout(900);
  await G(() => { const g = window.__rpg.game; g.p.mp = 999; g.p.x = 60 * 16; g.p.y = 14 * 16; });
  await pg.waitForTimeout(600);
  await pg.keyboard.press('KeyD'); await pg.waitForTimeout(520);
  await pg.screenshot({ path: `${OUT}/7-quake-charge.png` });
  await pg.waitForTimeout(330);
  await pg.screenshot({ path: `${OUT}/8-quake-burst.png` });
  await pg.waitForTimeout(1200);
  await G(() => { window.__rpg.game.p.mp = 999; window.__rpg.game.p.inv = 99; });
  await pg.keyboard.press('KeyF'); await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${OUT}/9-air-jets.png` });
  await pg.waitForTimeout(700);
  await pg.screenshot({ path: `${OUT}/10-air-boom.png` });
  await pg.waitForTimeout(600);
  const st = await G(() => { const g = window.__rpg.game; return { lv: g.p.lv, exp: g.p.exp, gold: g.p.gold, mobs: g.mobs.length, fx: g.fx.length, kills: g.p.kills }; });
  console.log(JSON.stringify(st));
  // 프레임 시간
  const perf = await G(() => new Promise((res) => { const g = window.__rpg.game; let n = 0, t = 0; const f = () => { const a = performance.now(); g.update(1 / 60); g.draw(); t += performance.now() - a; if (++n < 60) setTimeout(f, 0); else res(t / n); }; f(); }));
  console.log('ms/frame', perf.toFixed(2));
  console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : 'no errors');
  await b.close();
})();
