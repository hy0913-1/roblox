// 브라우저 테스트: 가짜 claude 런타임(test/mock-claude.js)으로 여러 탭이 서로 다른 친구처럼 동작한다.
// 사용: node build.mjs && (cd dist && python3 -m http.server 4180) & node test/e2e.cjs
const { chromium } = require('playwright');

const URL = process.argv[2] || 'http://localhost:4180/harness.html';
const SHOTS = process.argv[3] || 'shots';
const errors = [];
const log = (...a) => console.log(...a);

async function open(ctx, uid, name, owner, viewport) {
  const page = await ctx.newPage();
  if (viewport) await page.setViewportSize(viewport);
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/fonts\.g|Failed to load resource|ERR_/.test(m.text())) errors.push(`[${name}] ${m.text()}`);
  });
  await page.route('**/fonts.g*/**', (r) => r.abort());
  await page.goto(`${URL}?uid=${uid}&name=${encodeURIComponent(name)}${owner ? '&owner=1' : ''}`);
  await page.waitForSelector('.home', { timeout: 15000 });
  return page;
}

// 내 턴이면 AI 판단으로 둔다(화면과 같은 세션 API 사용)
async function autoplay(page, seed) {
  await page.evaluate((seed) => {
    window.__brain = { rng: seed };
    clearInterval(window.__auto);
    window.__auto = setInterval(() => {
      const { app, aiChoose } = window.__cd;
      const s = app.session;
      if (!s) return;
      if (s.kind === 'solo' && s.phase === 'floorClear') {
        s.nextFloor();
        return;
      }
      if (s.isMyTurn && s.isMyTurn()) {
        const a = aiChoose(s.s, s.mySeat, 'normal', window.__brain);
        if (s.act(a)) s.act({ t: 'end' });
        app.render();
      }
    }, 60);
  }, seed);
}

async function resultOf(page) {
  await page.waitForSelector('.result', { timeout: 240000 });
  return page.evaluate(() => ({ h: document.querySelector('.result h2').textContent.trim(), text: document.querySelector('.result').innerText }));
}

async function goHome(page) {
  const b = await page.$('.result [data-act="home"]');
  if (b) await b.click();
  await page.waitForSelector('.home');
}

async function rows(page) {
  return page.evaluate(() => window.__cd.app.rows.map((r) => ({ name: window.__cd.app.nameOf(r.uid), total: r.total, solo: r.solo, soloState: r.soloState, pvp: r.pvp, w: r.w, l: r.l, d: r.d, unconfirmed: r.unconfirmed })));
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const alice = await open(ctx, 'u_alice', '앨리스', true);
  await alice.evaluate(() => localStorage.clear());
  await alice.reload();
  await alice.waitForSelector('.home');

  // ---------- 1. 이벤트 시작 + 솔로 ----------
  await alice.selectOption('#ev-min', '90');
  await alice.click('[data-act="ev-start"]');
  await alice.waitForSelector('.event.live');
  log('이벤트 시작됨');
  await alice.screenshot({ path: `${SHOTS}/cd-home.png` });
  await alice.click('[data-act="solo"]');
  await alice.waitForSelector('.game');
  // 직접 조작: 내 턴이 될 때까지 기다렸다가 낼 수 있는 카드 한 장 내기
  await alice.waitForFunction(() => window.__cd.app.session.isMyTurn(), null, { timeout: 15000 });
  const playable = await alice.$('.hand .card.playable');
  if (playable) {
    await playable.click();
    await alice.waitForSelector('[data-act="play-sel"], .target, .detail .warn', { timeout: 5000 });
    const playBtn = await alice.$('[data-act="play-sel"]');
    if (playBtn) await playBtn.click();
    else {
      const tg = await alice.$('.target');
      if (tg) await tg.click();
    }
    await alice.waitForTimeout(300);
  }
  await alice.screenshot({ path: `${SHOTS}/cd-solo.png` });
  const handAfter = await alice.evaluate(() => window.__cd.app.session.run.acts[0].length);
  log('직접 조작한 행동 수:', handAfter);
  await alice.click('[data-act="end"]');
  await autoplay(alice, 11);
  const solo = await resultOf(alice);
  log('솔로 결과:', solo.h, '|', solo.text.replace(/\s+/g, ' ').slice(0, 120));
  await alice.screenshot({ path: `${SHOTS}/cd-solo-result.png` });
  await goHome(alice);
  log('순위(솔로 후):', JSON.stringify(await rows(alice)));

  // ---------- 2. 1:1 도전 ----------
  const bob = await open(ctx, 'u_bob', '밥', false);
  await alice.waitForSelector('[data-act="challenge"]', { timeout: 10000 });
  await alice.click('[data-act="challenge"]');
  await bob.waitForSelector('#modal:not([hidden]) .mbox', { timeout: 10000 });
  await bob.click('#modal button.primary');
  await alice.waitForSelector('.game .board', { timeout: 20000 });
  await bob.waitForSelector('.game .board', { timeout: 20000 });
  log('1:1 대전 시작');
  await alice.screenshot({ path: `${SHOTS}/cd-duel.png` });
  await autoplay(alice, 21);
  await autoplay(bob, 22);
  const [ra, rb] = await Promise.all([resultOf(alice), resultOf(bob)]);
  log('1:1 결과: 앨리스', ra.h, '/ 밥', rb.h);
  log('  앨리스 화면:', ra.text.replace(/\s+/g, ' ').slice(0, 140));
  const pair = `${ra.h}/${rb.h}`;
  if (!['승리/패배', '패배/승리', '무승부/무승부'].includes(pair)) errors.push(`1:1 결과가 맞지 않음: ${pair}`);
  if (!/✓/.test(ra.text) || !/✓/.test(rb.text)) errors.push('1:1 공개 검증 표시 없음');
  await goHome(alice);
  await goHome(bob);
  await alice.waitForTimeout(500);
  log('순위(1:1 후):', JSON.stringify(await rows(alice)));

  // ---------- 3. 2:2 팀전 (사람 3 + AI 1) ----------
  const carol = await open(ctx, 'u_carol', '캐럴', false, { width: 390, height: 844 });
  await alice.click('[data-act="team-host"]');
  await alice.waitForSelector('.teamroom');
  for (const p of [bob, carol]) {
    await p.waitForSelector('[data-act="team-join"]', { timeout: 10000 });
    await p.click('[data-act="team-join"]');
    await p.waitForSelector('.teamroom');
    await p.waitForFunction(() => Number.isInteger(window.__cd.app.room.state.seat), null, { timeout: 10000 });
  }
  await alice.waitForTimeout(400);
  const emptyAi = await alice.$('.seatbox.empty [data-act="room-ai"]');
  if (emptyAi) await emptyAi.click();
  for (const p of [alice, bob, carol]) await p.click('[data-act="room-ready"]');
  await alice.waitForSelector('[data-act="room-start"]:not([disabled])', { timeout: 10000 });
  await alice.screenshot({ path: `${SHOTS}/cd-room.png` });
  await alice.click('[data-act="room-start"]');
  for (const p of [alice, bob, carol]) await p.waitForSelector('.game .board', { timeout: 20000 });
  log('팀전 시작');
  await carol.waitForTimeout(1500);
  await carol.screenshot({ path: `${SHOTS}/cd-team-mobile.png` });
  await autoplay(alice, 31);
  await autoplay(bob, 32);
  await autoplay(carol, 33);
  const team = await Promise.all([alice, bob, carol].map(resultOf));
  const seats = await Promise.all([alice, bob, carol].map((p) => p.evaluate(() => (window.__cd.app.lastResult ? window.__cd.app.lastResult.result : null))));
  log('팀전 결과: 앨리스', team[0].h, '/ 밥', team[1].h, '/ 캐럴', team[2].h);
  const verified = seats.map((x) => x && x.verified);
  log('  공개 검증:', JSON.stringify(verified));
  for (const p of [alice, bob, carol]) await goHome(p);
  await alice.waitForTimeout(600);
  log('순위(팀전 후):', JSON.stringify(await rows(alice)));
  await alice.waitForTimeout(2500);
  const docs = await alice.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('mockdb:players/'))
      .map((k) => [k.slice(15), (JSON.parse(localStorage.getItem(k)).games || []).map((g) => `${g.mode}:${g.m.slice(0, 4)}:${g.r}:o=${(g.o || []).join('+')}`)]),
  );
  log('저장된 대전 기록:', JSON.stringify(docs));
  // 모든 경기가 확정됐고, 같은 경기의 상대 기록이 반대 결과인지
  const all = await alice.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('mockdb:players/')).map((k) => [k.slice(15), JSON.parse(localStorage.getItem(k)).games || []]));
  const byMid = {};
  for (const [uid, games] of all) for (const g of games) (byMid[g.m] = byMid[g.m] || []).push({ uid, r: g.r, mode: g.mode });
  for (const [m, list] of Object.entries(byMid)) {
    if (list.some((x) => x.r === '?')) errors.push(`경기 ${m} 결과 미확정: ${JSON.stringify(list)}`);
    const want = list[0].mode === 'team' ? 3 : 2;
    if (list.length !== want) errors.push(`경기 ${m} 기록 수 ${list.length} (기대 ${want})`);
  }
  log('순위(2.5초 뒤):', JSON.stringify(await rows(alice)));
  const diag = await alice.evaluate(() => {
    const st = window.__cd.app.store;
    const mem = [...st.players].map(([uid, d]) => [uid, d.ev, (d.games || []).map((g) => `${g.m.slice(0, 4)}:${g.r}:${g.ev}`)]);
    return { evId: st.config && st.config.id, mem };
  });
  log('진단(앨리스 화면의 메모리):', JSON.stringify(diag));

  // ---------- 4. 덱 편집기 ----------
  await bob.click('[data-act="decks"]');
  await bob.waitForSelector('.decks');
  await bob.click('[data-act="new-deck"]');
  await bob.click('#modal button:has-text("그림자")');
  await bob.waitForSelector('.builder');
  for (let i = 0; i < 10; i++) {
    // 누를 때마다 화면이 다시 그려지므로 매번 새로 찾는다
    await bob.locator('.bpool .card:not(.maxed)').nth(0).click();
    await bob.locator('.bpool .card:not(.maxed)').nth(0).click();
  }
  await bob.screenshot({ path: `${SHOTS}/cd-builder.png` });
  const count = await bob.evaluate(() => window.__cd.app.builder.ids.length);
  log('덱 편집기 카드 수:', count);

  await browser.close();
  console.log(errors.length ? `\n오류 ${errors.length}건:\n${[...new Set(errors)].join('\n')}` : '\n콘솔 오류 없음');
  process.exit(errors.length ? 1 : 0);
})().catch((e) => {
  console.error('테스트 중단:', e);
  console.log(errors.join('\n'));
  process.exit(1);
});
