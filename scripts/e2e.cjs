// 실제 브라우저 스모크 테스트: PC(마우스)와 모바일(터치)에서 메뉴 → 배치 → 웨이브 진행까지 확인한다.
// 사용: (다른 터미널에서) npm run preview  →  node scripts/e2e.cjs [url]
const { chromium } = require('playwright');

const URL = process.argv[2] || 'http://localhost:4173/';
const PX = 768; // 패널 x
const errors = [];

function hook(page, tag) {
  page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${tag}] console.error: ${m.text()}`);
  });
}

async function world(page) {
  return page.evaluate(() => {
    const r = document.querySelector('canvas').getBoundingClientRect();
    return { left: r.left, top: r.top, k: r.width / 960 };
  });
}

async function pointAt(page, wx, wy, touch) {
  const w = await world(page);
  const x = w.left + wx * w.k;
  const y = w.top + wy * w.k;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

async function run(name, ctxOpts, touch) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  hook(page, name);
  await page.goto(URL);
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('menu'), null, { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `shots/${name}-menu.png` });

  await pointAt(page, 480, 250, touch); // 게임 시작
  await page.waitForFunction(() => window.__td && window.__td.sim, null, { timeout: 5000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `shots/${name}-game0.png` });

  const info = () => page.evaluate(() => ({ towers: window.__td.sim.towers.length, ahn: window.__td.sim.ahn, phase: window.__td.sim.phase, wave: window.__td.sim.wave, lives: window.__td.sim.lives, enemies: window.__td.sim.enemies.length, kills: window.__td.sim.kills }));

  // 이상 카드 선택 → 칸 (4,3) 배치
  await pointAt(page, PX + 88, 116, touch);
  const cell = (c, r) => [(c + 0.5) * 48, 50 + (r + 0.5) * 48];
  await pointAt(page, ...cell(4, 3), touch);
  let s = await info();
  if (touch) {
    console.log(`[${name}] 첫 탭 후 타워 수(0이어야 함):`, s.towers);
    await page.screenshot({ path: `shots/${name}-preview.png` });
    await pointAt(page, ...cell(4, 3), touch);
    s = await info();
  }
  console.log(`[${name}] 배치 후:`, JSON.stringify(s));

  // 파우스트(3번 카드)와 이상을 더 배치
  for (const [card, c, r] of [[0, 5, 3], [2, 2, 3], [1, 8, 3]]) {
    await pointAt(page, PX + 88, 116 + card * 82, touch);
    await pointAt(page, ...cell(c, r), touch);
    if (touch) await pointAt(page, ...cell(c, r), touch);
  }
  s = await info();
  console.log(`[${name}] 추가 배치 후:`, JSON.stringify(s));

  // 웨이브 시작 → 배속 3배로 진행
  await pointAt(page, PX + 88, 508, touch);
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__td.scene.speed = 3; window.__td.scene.tweens.timeScale = 3; });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `shots/${name}-wave.png` });
  s = await info();
  console.log(`[${name}] 전투 중:`, JSON.stringify(s));

  // 배치한 타워 선택 → 패널 확인
  await pointAt(page, ...cell(4, 3), touch);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `shots/${name}-select.png` });

  await browser.close();
}

(async () => {
  await run('pc', { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }, false);
  await run('mobile', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, true);
  console.log(errors.length ? `\n에러 ${errors.length}건:\n${errors.join('\n')}` : '\n콘솔 에러 없음');
  process.exit(errors.length ? 1 : 0);
})();
