// 다른 맵·보스·폰 화면을 찍어 본다
const { chromium, devices } = require('playwright');
const path = require('node:path');
const OUT = process.argv[2] || 'shots';
const URL = 'file://' + path.resolve(__dirname, '../dist/index.html');
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const open = async (ctxOpts) => {
    const ctx = await b.newContext(ctxOpts);
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => errors.push(e.message));
    await pg.goto(URL);
    await pg.waitForSelector('.tbox');
    return pg;
  };
  const pg = await open({ viewport: { width: 1152, height: 700 } });
  await pg.click('[data-ui="new"]');
  await pg.waitForTimeout(500);
  const G = (fn, a) => pg.evaluate(fn, a);
  const prep = (map, tx, ty) => G(([map, tx, ty]) => { const g = window.__rpg.game; g.p.lv = 14; g.p.quest = 5; g.p.qstate = 'active'; g.p.skills = { beam: 3, slam: 3, quake: 3, air: 3 }; g.p.hp = 426; g.p.mp = 166; g.enter(map, tx, ty); }, [map, tx, ty]);
  await prep('cave', 20, 16); await pg.waitForTimeout(1500);
  await pg.keyboard.press('KeyA'); await pg.waitForTimeout(250);
  await pg.screenshot({ path: `${OUT}/11-cave.png` });
  await prep('ruins', 36, 15); await pg.waitForTimeout(1800);
  await pg.keyboard.press('KeyD'); await pg.waitForTimeout(820);
  await pg.screenshot({ path: `${OUT}/12-ruins.png` });
  await prep('throne', 14, 11); await pg.waitForTimeout(1200);
  await pg.keyboard.press('KeyF'); await pg.waitForTimeout(2300);
  await pg.screenshot({ path: `${OUT}/13-boss.png` });
  await G(() => { const g = window.__rpg.game; g.boss.hp = g.boss.d.hp * 0.45; }); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: `${OUT}/14-boss-bald.png` });
  await pg.keyboard.press('KeyK'); await pg.waitForTimeout(200);
  await pg.screenshot({ path: `${OUT}/15-skills.png` });
  // 폰 세로/가로
  for (const [name, dev, land] of [['16-phone-portrait', devices['iPhone 13'], false], ['17-phone-landscape', devices['iPhone 13 landscape'], true]]) {
    const ph = await open({ ...dev });
    await ph.tap('[data-ui="new"]');
    await ph.waitForTimeout(700);
    await ph.evaluate(() => { const g = window.__rpg.game; g.p.lv = 9; g.p.skills = { beam: 2, slam: 2, quake: 2, air: 1 }; g.enter('meadow', 34, 11); });
    await ph.waitForTimeout(900);
    await ph.tap('[data-k="s1"]'); await ph.waitForTimeout(240);
    await ph.screenshot({ path: `${OUT}/${name}.png` });
    const x0 = await ph.evaluate(() => window.__rpg.game.p.x);
    const box = await ph.locator('[data-k="right"]').boundingBox();
    await ph.touchscreen.tap(box.x + 5, box.y + 5);
    await ph.dispatchEvent('[data-k="right"]', 'pointerdown', { pointerId: 7, clientX: box.x + 9, clientY: box.y + 9, bubbles: true });
    await ph.waitForTimeout(600);
    await ph.evaluate(() => dispatchEvent(new PointerEvent('pointerup', { pointerId: 7 })));
    const x1 = await ph.evaluate(() => window.__rpg.game.p.x);
    console.log(name, 'moved', Math.round(x1 - x0), 'overflowX', await ph.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  }
  console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : 'no errors');
  await b.close();
})();
