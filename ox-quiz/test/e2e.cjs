// 브라우저 테스트: 가짜 claude 런타임(test/mock-claude.js)으로 여러 탭이 서로 다른 친구처럼 동작한다.
// 사용: node ox-quiz/build.mjs && (cd ox-quiz/dist && python3 -m http.server 4181) & node ox-quiz/test/e2e.cjs
// 공식전 문제는 테스트용 가짜 문제를 쓴다(진짜 비밀 문제은행은 저장소에 없음).
const { chromium } = require('playwright');

const URL = process.argv[2] || 'http://localhost:4181/harness.html';
const SHOTS = process.argv[3] || 'ox-quiz/shots';
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

async function open(ctx, uid, name, owner, viewport) {
  const page = await ctx.newPage();
  if (viewport) await page.setViewportSize(viewport);
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errors.push(`[${name}] ${m.text()}`);
  });
  await page.goto(`${URL}?uid=${uid}&name=${encodeURIComponent(name)}${owner ? '&owner=1' : ''}`);
  await page.waitForSelector('.lobby', { timeout: 15000 });
  return page;
}

const view = (page) => page.evaluate(() => {
  const v = window.__ox.app.view();
  return v && { phase: v.phase, round: v.round, me: v.me, roster: v.roster, fx: v.fx, a: v.a, mcAnswer: v.mcAnswer, ranking: v.ranking };
});

async function waitFor(page, fn, arg, timeout = 30000) {
  await page.waitForFunction(fn, arg, { timeout, polling: 100 });
}

const waitPhase = (page, phase, round, timeout = 30000) =>
  waitFor(page, ([ph, rd]) => {
    const v = window.__ox.app.view();
    return v && v.phase === ph && (rd === null || v.round === rd);
  }, [phase, round ?? null], timeout);

async function chipOf(page, name) {
  return page.locator('.chips button.chip.target', { hasText: name }).first();
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const phone = { width: 390, height: 844 };

  const own = await open(ctx, 'u_own', '주최자', true);
  // 깨끗한 db + 테스트용 공식전 문제
  await own.evaluate(async () => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('mockox:')) localStorage.removeItem(k);
    const db = await window.claude.use('db');
    const list = [];
    for (let i = 1; i <= 30; i++) list.push({ id: `t${i}`, c: i % 3 === 0 ? 'game' : 'gen', q: `테스트 문제 ${i}: 이 문장은 ${i % 2 ? '참' : '거짓'}이다.`, a: i % 2 ? 'O' : 'X', x: `해설 ${i}` });
    await db.doc('bank/main').set({ v: 1, list });
    await db.doc('bank/custom').set({ v: 1, list: [{ id: 'h1', c: 'host', q: '테스트 주최자 문제: 주최자는 테스트를 좋아한다.', a: 'O', x: '그렇다.' }] });
  });
  await own.reload();
  await own.waitForSelector('.lobby');

  const A = await open(ctx, 'u_a', '앨리스', false, phone);
  const B = await open(ctx, 'u_b', '밥', false);
  const C = await open(ctx, 'u_c', '찰리', false);

  // ---------- 1. 비밀 문제은행은 주인만 읽힌다 ----------
  log('1. 문제은행 권한');
  const hiddenForB = await B.evaluate(async () => {
    const db = await window.claude.use('db');
    const s = await db.doc('bank/main').get();
    return { exists: s.exists, data: s.data() };
  });
  check(hiddenForB.exists === false && hiddenForB.data === undefined, '친구에게 bank/main은 없는 문서');
  const ownerSees = await own.evaluate(async () => (await window.__ox.app.store.loadBank()).main.length);
  check(ownerSees === 30, `주인은 문제 ${ownerSees}개 읽음`);
  const writeRefused = await B.evaluate(async () => {
    const db = await window.claude.use('db');
    try {
      await db.doc('results/fake').set({ season: 'x', rows: [] });
      return false;
    } catch {
      return true;
    }
  });
  check(writeRefused, '친구는 결과를 쓸 수 없음');

  // ---------- 2. 혼자 연습(봇 4명) ----------
  log('2. 혼자 연습');
  await A.click('[data-act="practice"]');
  await A.waitForSelector('.room canvas');
  await waitPhase(A, 'ask', 1, 15000);
  let v = await view(A);
  check(v.roster.length === 5, `연습 참가자 ${v.roster.length}명(나+봇4)`);
  await A.click('.answer.ob');
  await waitFor(A, () => window.__ox.app.view().me.side === 'O');
  check(true, 'O 버튼으로 이동');
  const fx0 = (await view(A)).fx.length;
  await A.click('[data-act="skill"][data-id="ink"]');
  await A.waitForSelector('.chips button.chip.target');
  await A.locator('.chips button.chip.target').first().click();
  await waitFor(A, (n) => window.__ox.app.view().fx.some((f) => f[1] === window.__ox.app.view().me.pid), fx0);
  check(true, '먹물 스킬 발사(내가 쏜 효과 기록)');
  v = await view(A);
  check(v.me.energy === 1, `에너지 2→${v.me.energy}`);
  await A.screenshot({ path: `${SHOTS}/1-practice-phone.png` });
  await waitPhase(A, 'reveal', 1, 20000);
  v = await view(A);
  check(!!v.a && v.me.res !== '', `정답 공개(${v.a}), 내 결과 ${v.me.res}`);
  await A.screenshot({ path: `${SHOTS}/2-reveal-phone.png` });
  await A.click('[data-act="leave"]');
  await A.waitForSelector('.lobby');

  // ---------- 3. 공식전: 주최자 MC + 친구 3명 ----------
  log('3. 공식전');
  await own.click('[data-act="official"]');
  await own.waitForSelector('.room canvas');
  for (const p of [A, B, C]) {
    await p.waitForSelector('.rooms li.official [data-act="join"]', { timeout: 15000 });
    await p.click('.rooms li.official [data-act="join"]');
    await p.waitForSelector('.room canvas');
  }
  await waitFor(own, () => window.__ox.app.view().roster.length === 3, null, 15000);
  check(true, 'MC 화면에 참가자 3명');
  await own.evaluate(() => {
    const c = window.__ox.app.client;
    c.game.setSettings({ total: 3, askMs: 6000, lives: 3 });
    c.publish(true);
  });
  await own.click('[data-act="start"]');
  await waitPhase(A, 'ask', 1, 15000);
  const ans1 = await own.evaluate(() => window.__ox.app.client.game.q.a);
  const leak = await A.evaluate(() => ({ a: window.__ox.app.client.snap.a, x: window.__ox.app.client.snap.x }));
  check(leak.a === undefined && leak.x === undefined, '문제 중에는 친구 쪽 데이터에 정답 없음');
  check((await own.locator('.mcans').count()) === 1, 'MC 화면에만 정답 표시');
  // A: 키보드로 정답, B: 오답, C: A에게 먹물
  await A.keyboard.press(ans1 === 'O' ? 'o' : 'x');
  await B.click(ans1 === 'O' ? '.answer.xb' : '.answer.ob');
  await C.click('[data-act="skill"][data-id="ink"]');
  await (await chipOf(C, '앨리스')).click();
  await waitFor(A, () => document.querySelector('.qbox').classList.contains('inked'), null, 5000);
  check(true, '앨리스 문제판이 먹물로 가려짐');
  await A.screenshot({ path: `${SHOTS}/3-official-ink-phone.png` });
  await own.screenshot({ path: `${SHOTS}/4-mc-desktop.png` });
  await waitPhase(own, 'reveal', 1, 20000);
  const r1 = await own.evaluate(() => Object.fromEntries([...window.__ox.app.client.game.players.values()].map((p) => [p.key, { res: p.res, hearts: p.hearts, energy: p.energy, side: p.side }])));
  check(r1.u_a.res === 'o' && r1.u_b.res === 'x', `1번: 앨리스 정답, 밥 오답 (${JSON.stringify(r1)})`);
  check(r1.u_b.hearts === 2, '밥 하트 3→2');

  // 2번: 밥이 O로 간 뒤 앨리스가 밥을 밀친다
  await waitPhase(own, 'ask', 2, 20000);
  await B.click('.answer.ob');
  await waitFor(own, () => [...window.__ox.app.client.game.players.values()].find((p) => p.key === 'u_b').side === 'O', null, 5000);
  await A.click('[data-act="skill"][data-id="push"]');
  await (await chipOf(A, '밥')).click();
  await waitFor(B, () => window.__ox.app.view().me.side === 'X', null, 5000);
  await waitFor(own, () => [...window.__ox.app.client.game.players.values()].find((p) => p.key === 'u_b').side === 'X', null, 5000);
  check(true, '밀치기: 밥이 O→X로 밀려남(진행자·밥 화면 일치)');
  await waitPhase(own, 'reveal', 2, 20000);

  // 3번: 찰리가 방패, 앨리스의 뒤죽박죽이 막힘
  await waitPhase(own, 'ask', 3, 20000);
  await C.click('[data-act="skill"][data-id="shield"]');
  await waitFor(own, () => [...window.__ox.app.client.game.players.values()].find((p) => p.key === 'u_c').shield === true, null, 5000);
  await A.click('[data-act="skill"][data-id="mess"]');
  await (await chipOf(A, '찰리')).click();
  await waitFor(own, () => window.__ox.app.client.game.fx.some((f) => f.k === 'mess' && f.b === 1), null, 5000);
  check(true, '방패가 뒤죽박죽을 막음');
  await waitPhase(own, 'end', null, 30000);
  await own.waitForSelector('.qbox .rank');
  await own.screenshot({ path: `${SHOTS}/5-results-desktop.png` });
  await waitFor(own, () => {
    try {
      return Object.keys(localStorage).some((k) => k.startsWith('mockox:results/'));
    } catch {
      return false;
    }
  }, null, 10000);
  const saved = await own.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith('mockox:results/'));
    return JSON.parse(localStorage.getItem(k));
  });
  check(saved.rows.length === 3 && saved.rows.every((r) => r.by), `결과 기록: ${saved.rows.map((r) => `${r.by}:${r.place}등 ${r.pts}점`).join(', ')}`);
  const season = await own.evaluate(() => JSON.parse(localStorage.getItem('mockox:meta/season')));
  check(season.used.length === 3, `시즌에 낸 문제 ${season.used.length}개 기록`);
  const maxPresence = await own.evaluate(() => window.__mockMaxPresence);
  check(maxPresence < 4096, `진행자 presence 최대 ${maxPresence}B (< 4KB)`);

  // 친구 로비 순위표
  await A.click('[data-act="leave"]');
  await A.waitForSelector('.lobby');
  await waitFor(A, () => document.querySelectorAll('.lobby table.rank tbody tr').length === 3, null, 10000);
  const board = await A.evaluate(() => [...document.querySelectorAll('.lobby table.rank tbody tr')].map((tr) => tr.innerText.replace(/\s+/g, ' ')));
  check(board.length === 3, `순위표: ${board.join(' | ')}`);
  await A.screenshot({ path: `${SHOTS}/6-lobby-phone.png`, fullPage: true });

  // ---------- 4. 일반 방: 밥이 방장, 찰리 참가 → 밥이 나가면 찰리 방 닫힘 ----------
  log('4. 일반 방');
  await own.click('[data-act="leave"]');
  await own.waitForSelector('.lobby');
  for (const p of [B, C]) {
    await p.click('[data-act="leave"]');
    await p.waitForSelector('.lobby');
  }
  await B.click('[data-act="host"]');
  await B.waitForSelector('.room canvas');
  await B.click('[data-act="bot-add"]');
  await C.waitForSelector('.rooms li:not(.official) [data-act="join"]', { timeout: 15000 });
  await C.click('.rooms li:not(.official) [data-act="join"]');
  await waitFor(B, () => window.__ox.app.view().roster.length === 3, null, 15000);
  check(true, '방장+봇+찰리 = 3명');
  await B.click('[data-act="start"]');
  await waitPhase(C, 'ask', 1, 15000);
  check(true, '찰리 화면에 1번 문제');
  await B.click('[data-act="leave"]');
  await C.waitForSelector('.lobby', { timeout: 20000 });
  check(true, '방장이 나가면 참가자는 로비로');

  // ---------- 5. 주최자 문제 추가 ----------
  log('5. 문제 관리');
  await own.click('[data-act="admin"]');
  await own.waitForSelector('#aq-q');
  await own.fill('#aq-q', '주최자는 오늘 테스트를 세 번 돌렸다.');
  await own.check('input[name="aq-a"][value="X"]');
  await own.fill('#aq-x', '네 번 돌렸어요.');
  await own.click('[data-act="add-q"]');
  await waitFor(own, () => document.querySelectorAll('.qlist li .tag').length === 2, null, 5000);
  const custom = await own.evaluate(() => JSON.parse(localStorage.getItem('mockox:bank/custom')).list);
  check(custom.length === 2 && custom[1].a === 'X' && custom[1].c === 'host', '내 문제 추가 저장');
  await own.screenshot({ path: `${SHOTS}/7-admin-desktop.png`, fullPage: true });

  log(errors.length ? `페이지 오류 ${errors.length}개:\n${errors.join('\n')}` : '페이지 오류 없음');
  await browser.close();
  if (failed || errors.length) process.exit(1);
  log('전부 통과');
})().catch((e) => {
  console.error(e);
  console.error(errors.join('\n'));
  process.exit(1);
});
