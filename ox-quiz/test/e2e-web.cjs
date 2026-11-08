// 웹판 브라우저 테스트: 사람마다 따로 브라우저 프로필(기기)을 쓰고, 내 컴퓨터에 띄운 PeerJS 신호 서버로 P2P 연결한다.
// 사용: npm run quiz:web && OX_BANK_PASS='주최자 비밀번호' node ox-quiz/test/e2e-web.cjs
// (비밀번호가 없으면 공식전 부분은 건너뛴다)
const { chromium } = require('playwright');
const { PeerServer } = require('peer');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../dist-web');
const SHOTS = process.argv[2] || 'ox-quiz/shots';
const PASS = process.env.OX_BANK_PASS || '';
const WEB_PORT = 4182;
const PS_PORT = 9000;
const SITE = `http://localhost:${WEB_PORT}/?ps=local&psport=${PS_PORT}`;
const errors = [];
const log = (...a) => console.log(...a);
let failed = 0;
const check = (ok, msg) => {
  if (ok) log(`  ok  ${msg}`);
  else {
    failed += 1;
    log(`  FAIL ${msg}`);
  }
};

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new globalThis.URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, p === '/' ? 'index.html' : p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

async function person(browser, label, viewport, nick) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${label}] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_|favicon/.test(m.text())) errors.push(`[${label}] ${m.text()}`);
  });
  await page.goto(SITE);
  await page.waitForSelector('.lobby', { timeout: 15000 });
  if (nick) {
    await page.fill('#nick', nick);
    await page.click('[data-act="nick-save"]');
    await page.waitForFunction((n) => window.__ox.app.me.name === n, nick);
  }
  return page;
}

const waitFor = (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout, polling: 100 });
const waitPhase = (page, phase, round, timeout = 30000) =>
  waitFor(page, ([ph, rd]) => {
    const v = window.__ox.app.view();
    return v && v.phase === ph && (rd === null || v.round === rd);
  }, [phase, round ?? null], timeout);
const hostPlayer = (page, nick) =>
  page.evaluate((n) => {
    const g = window.__ox.app.client.game;
    const p = [...g.players.values()].find((x) => x.name === n);
    return p ? { side: p.side, res: p.res, hearts: p.hearts, score: p.score, shield: p.shield, pid: p.pid } : null;
  }, nick);
const chip = (page, name) => page.locator('.chips button.chip.target', { hasText: name }).first();

(async () => {
  await new Promise((r) => server.listen(WEB_PORT, '127.0.0.1', r));
  const ps = PeerServer({ port: PS_PORT, path: '/', host: '127.0.0.1' });
  await new Promise((r) => setTimeout(r, 500));
  const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const phone = { width: 390, height: 844 };

  // ---------- 1. 처음 화면 · 닉네임 ----------
  log('1. 닉네임 · 혼자 연습(네트워크 없이)');
  const A = await person(browser, '앨리스', phone, null);
  check((await A.locator('.lobby .bad').count()) === 1, '닉네임이 없으면 안내');
  await A.fill('#nick', '앨리스');
  await A.click('[data-act="nick-save"]');
  await waitFor(A, () => window.__ox.app.me.name === '앨리스');
  check((await A.evaluate(() => localStorage.getItem('oxw-nick'))) === '"앨리스"', '닉네임이 이 기기에 저장됨');
  await A.click('[data-act="practice"]');
  await waitPhase(A, 'ask', 1, 15000);
  check((await A.evaluate(() => window.__ox.app.view().roster.length)) === 5, '혼자 연습: 나 + 봇 4');
  await A.click('[data-act="leave"]');
  await A.waitForSelector('.lobby');

  const B = await person(browser, '밥', null, '밥');
  const C = await person(browser, '찰리', null, '찰리');

  // ---------- 2. 없는 코드 ----------
  log('2. 없는 방 코드');
  await C.fill('#join-code', 'ZZZZ');
  await C.click('[data-act="join-code"]');
  await waitFor(C, () => /방이 없어요/.test(document.getElementById('toast').textContent), null, 20000);
  check(true, '없는 코드면 "방이 없어요" 안내');

  // ---------- 3. 일반 방: 밥 방장, 찰리는 코드, 앨리스는 링크 ----------
  log('3. 일반 방');
  await B.click('[data-act="host"]');
  await B.waitForSelector('.room canvas');
  const code1 = await B.evaluate(() => window.__ox.app.client.code);
  check(/^[A-HJ-NP-Z2-9]{4}$/.test(code1), `방 코드 ${code1}`);
  await B.waitForSelector('.share .code');
  await C.fill('#join-code', code1.toLowerCase());
  await C.click('[data-act="join-code"]');
  await C.waitForSelector('.room canvas', { timeout: 20000 });
  await A.goto(`${SITE}#${code1}`);
  await A.waitForSelector('.room canvas', { timeout: 20000 });
  await waitFor(B, () => window.__ox.app.view().roster.length === 3, null, 15000);
  check(true, '방장 화면에 3명(방장+코드 참가+링크 참가)');
  const names = await B.evaluate(() => window.__ox.app.view().roster.map((p) => window.__ox.app.playerName(p)).sort());
  check(JSON.stringify(names) === JSON.stringify(['밥', '앨리스', '찰리'].sort()), `닉네임이 보임: ${names.join(', ')}`);
  await B.click('[data-act="bot-add"]');
  await B.evaluate(() => {
    window.__ox.app.client.game.setSettings({ total: 3, askMs: 5000 });
    window.__ox.app.client.publish(true);
  });
  await B.click('[data-act="start"]');
  await waitPhase(C, 'ask', 1, 15000);
  await C.click('.answer.ob');
  await waitFor(B, () => [...window.__ox.app.client.game.players.values()].some((p) => p.name === '찰리' && p.side === 'O'), null, 5000);
  check(true, '참가자 이동이 방장에게 전달');
  await A.screenshot({ path: `${SHOTS}/web-1-casual-phone.png` });
  const t0 = Date.now();
  await B.click('[data-act="leave"]');
  await C.waitForSelector('.lobby', { timeout: 15000 });
  check(Date.now() - t0 < 6000, `방장이 나가면 참가자는 바로 로비로 (${Date.now() - t0}ms)`);
  await A.waitForSelector('.lobby', { timeout: 15000 });

  // ---------- 4. 공식전 ----------
  if (!PASS) log('4. 공식전: OX_BANK_PASS가 없어 건너뜀');
  else {
    log('4. 주최자 · 공식전');
    const own = await person(browser, '주최자', null, '주최자');
    await own.fill('#org-pass', 'WRONG-PASS-1234-5678');
    await own.click('[data-act="org-on"]');
    await waitFor(own, () => /맞지 않아요/.test(document.getElementById('toast').textContent), null, 20000);
    check(!(await own.evaluate(() => window.__ox.app.me.isOwner)), '틀린 비밀번호는 거절');
    await own.fill('#org-pass', PASS.toLowerCase());
    await own.click('[data-act="org-on"]');
    await waitFor(own, () => window.__ox.app.me.isOwner === true, null, 20000);
    const n = await own.evaluate(async () => (await window.__ox.app.store.loadBank()).main.length);
    check(n > 100, `비밀번호로 공식전 문제 ${n}개 열림`);
    check(!(await A.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('oxw-db:bank')))), '친구 기기에는 문제가 없음');

    await own.click('[data-act="official"]');
    await own.waitForSelector('.room canvas');
    const code = await own.evaluate(() => window.__ox.app.client.code);
    await A.goto(`${SITE}#${code}`);
    await A.waitForSelector('.room canvas', { timeout: 20000 });
    for (const p of [B, C]) {
      await p.fill('#join-code', code);
      await p.click('[data-act="join-code"]');
      await p.waitForSelector('.room canvas', { timeout: 20000 });
    }
    await waitFor(own, () => window.__ox.app.view().roster.length === 3, null, 15000);
    check(true, `공식전 방 ${code}에 3명`);
    await own.evaluate(() => {
      const c = window.__ox.app.client;
      c.game.setSettings({ total: 3, askMs: 7000, lives: 3 });
      c.publish(true);
    });
    await own.click('[data-act="start"]');
    await waitPhase(A, 'ask', 1, 15000);
    const ans1 = await own.evaluate(() => window.__ox.app.client.game.q.a);
    const leak = await A.evaluate(() => ({ a: window.__ox.app.client.snap.a, x: window.__ox.app.client.snap.x }));
    check(leak.a === undefined && leak.x === undefined, '문제 중에는 참가자 쪽에 정답 없음');
    check((await own.locator('.mcans').count()) === 1, 'MC 화면에만 정답');
    await A.keyboard.press(ans1 === 'O' ? 'o' : 'x');
    await B.click(ans1 === 'O' ? '.answer.xb' : '.answer.ob');
    await C.click('[data-act="skill"][data-id="ink"]');
    await (await chip(C, '앨리스')).click();
    await waitFor(A, () => document.querySelector('.qbox').classList.contains('inked'), null, 5000);
    check(true, '찰리의 먹물이 앨리스 화면을 가림');
    await A.screenshot({ path: `${SHOTS}/web-2-official-phone.png` });
    await waitPhase(own, 'reveal', 1, 20000);
    const a1 = await hostPlayer(own, '앨리스');
    const b1 = await hostPlayer(own, '밥');
    check(a1.res === 'o' && b1.res === 'x' && b1.hearts === 2, '1번: 앨리스 정답, 밥 오답(하트 2)');

    await waitPhase(own, 'ask', 2, 20000);
    await B.click('.answer.ob');
    await waitFor(own, () => [...window.__ox.app.client.game.players.values()].find((p) => p.name === '밥').side === 'O', null, 5000);
    await A.click('[data-act="skill"][data-id="push"]');
    await (await chip(A, '밥')).click();
    await waitFor(B, () => window.__ox.app.view().me.side === 'X', null, 5000);
    check(true, '밀치기: 밥이 X로 밀려남');
    // 앨리스가 새로고침해도 같은 사람으로 다시 들어온다
    const scoreBefore = (await hostPlayer(own, '앨리스')).score;
    await A.reload();
    await A.waitForSelector('.room canvas', { timeout: 20000 });
    await waitFor(A, () => {
      const v = window.__ox.app.view();
      return v && v.me;
    }, null, 15000);
    const afterReload = await A.evaluate(() => window.__ox.app.view().me.score);
    check(afterReload === scoreBefore && (await own.evaluate(() => window.__ox.app.client.game.players.size)) === 3, `새로고침 뒤 같은 참가자로 복귀(점수 ${afterReload})`);
    await waitPhase(own, 'reveal', 2, 20000);

    await waitPhase(own, 'ask', 3, 20000);
    await waitPhase(A, 'ask', 3, 10000);
    await C.click('[data-act="skill"][data-id="shield"]');
    await waitFor(own, () => [...window.__ox.app.client.game.players.values()].find((p) => p.name === '찰리').shield === true, null, 5000);
    await A.click('[data-act="skill"][data-id="mess"]');
    await (await chip(A, '찰리')).click();
    await waitFor(own, () => window.__ox.app.client.game.fx.some((f) => f.k === 'mess' && f.b === 1), null, 5000);
    check(true, '방패가 뒤죽박죽을 막음');
    await waitPhase(own, 'end', null, 30000);
    await waitFor(own, () => Object.keys(localStorage).some((k) => k.startsWith('oxw-db:results/')), null, 10000);
    const saved = await own.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('oxw-db:results/')))));
    check(saved.rows.length === 3 && saved.rows.every((r) => r.by && r.name), `주최자 기기에 결과 기록: ${saved.rows.map((r) => `${r.name} ${r.place}등 ${r.pts}점`).join(', ')}`);
    await waitFor(A, () => document.querySelectorAll('.lbbox table.rank tbody tr').length === 3, null, 10000);
    check(true, '참가자 화면에 순위표 도착');
    await A.screenshot({ path: `${SHOTS}/web-3-results-phone.png`, fullPage: true });
    await A.click('[data-act="leave"]');
    await A.waitForSelector('.lobby');
    const lobbyRows = await A.evaluate(() => [...document.querySelectorAll('.lobby table.rank tbody tr')].map((tr) => tr.innerText.replace(/\s+/g, ' ')));
    check(lobbyRows.length === 3, `로비에도 받은 순위표: ${lobbyRows.join(' | ')}`);
    await own.click('[data-act="leave"]');
    await own.waitForSelector('.lobby');
    await own.screenshot({ path: `${SHOTS}/web-4-organizer-lobby.png`, fullPage: true });
    for (const p of [B, C]) {
      if (await p.locator('[data-act="leave"]').count()) await p.click('[data-act="leave"]');
    }
  }

  log(errors.length ? `페이지 오류 ${errors.length}개:\n${errors.join('\n')}` : '페이지 오류 없음');
  await browser.close();
  ps.close?.();
  server.close();
  if (failed || errors.length) process.exit(1);
  log('전부 통과');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  console.error(errors.join('\n'));
  process.exit(1);
});
