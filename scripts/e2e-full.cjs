// 브라우저에서 실제 GameScene을 10웨이브 끝까지 자동 플레이한다. (렌더링/이펙트/UI 오류가 끝까지 안 나는지 확인)
// 사용: npm run build && npm run preview (다른 터미널)  →  node scripts/e2e-full.cjs [url] [전략]
const { chromium } = require('playwright');

const URL = process.argv[2] || 'http://localhost:4173/';
const STRATEGY = process.argv[3] || 'mixed';
const errors = [];

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console.error: ${m.text()}`));

  await page.goto(URL);
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('menu'), null, { timeout: 15000 });
  await page.evaluate(() => window.__game.scene.start('menu') && 0);
  await page.evaluate(() => window.__game.scene.getScene('menu').scene.start('game'));
  await page.waitForFunction(() => window.__td && window.__td.sim && window.__td.scene.sys.isActive(), null, { timeout: 5000 });

  // 페이지 안에서 봇을 돌린다: 준비 단계마다 아안을 쓰고 웨이브를 시작, 속도는 최대로.
  await page.evaluate((strategy) => {
    const { sim, scene, spend } = window.__td;
    scene.speed = 12;
    scene.tweens.timeScale = 4;
    window.__botTimer = setInterval(() => {
      if (sim.phase === 'prep') {
        spend(sim, strategy);
        scene.startWave();
      }
    }, 100);
  }, STRATEGY);

  const t0 = Date.now();
  let last = '';
  let shotWave = 0;
  for (;;) {
    const s = await page.evaluate(() => ({ phase: window.__td.sim.phase, wave: window.__td.sim.wave, lives: window.__td.sim.lives, kills: window.__td.sim.kills, ahn: window.__td.sim.ahn, towers: window.__td.sim.towers.length, over: window.__td.scene.over }));
    const line = `웨이브 ${s.wave} | ${s.phase} | 내구도 ${s.lives} | 처치 ${s.kills} | 타워 ${s.towers}`;
    if (line !== last && s.wave !== shotWave) {
      console.log(line);
      if (s.wave === 10) await page.screenshot({ path: 'shots/full-wave10.png' });
      shotWave = s.wave;
    }
    last = line;
    if (s.phase === 'won' || s.phase === 'lost') {
      await page.waitForTimeout(1800); // 결과 오버레이가 뜰 시간
      await page.screenshot({ path: `shots/full-${s.phase}.png` });
      console.log(`종료: ${s.phase === 'won' ? '승리' : '패배'} | 웨이브 ${s.wave} | 내구도 ${s.lives} | 처치 ${s.kills} | 실제 소요 ${Math.round((Date.now() - t0) / 1000)}s`);
      break;
    }
    if (Date.now() - t0 > 170000) {
      console.log('시간 초과(170s):', line);
      errors.push('timeout');
      break;
    }
    await page.waitForTimeout(500);
  }
  await browser.close();
  console.log(errors.length ? `\n에러 ${errors.length}건:\n${[...new Set(errors)].join('\n')}` : '\n콘솔 에러 없음');
  process.exit(errors.length ? 1 : 0);
})();
