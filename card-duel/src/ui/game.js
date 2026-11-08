// 게임 화면: 1:1과 2:2 공용. 세션(솔로/대전)이 무엇이든 s(게임 상태), mySeat, act(), isMyTurn()만 쓴다.
import { CARDS, FACTIONS } from '../cards.js';
import { targetsFor, attackTargets, canAttack, heroPower, check, findUnit } from '../engine.js';
import { cardHtml, unitHtml, avatarHtml, esc, fmtTime, toast, modal, cardRules, facColor } from './common.js';

export function newGameUi() {
  return { sel: null, lastEv: 0, game: null, names: {}, log: [] };
}

function seatName(app, i) {
  const l = app.seatLabels && app.seatLabels[i];
  return (l && l.name) || `${i + 1}번`;
}

function refName(app, s, r, my) {
  if (!r) return '';
  if (r[0] === 'h') {
    const side = Number(r.slice(1));
    const team = s.mode === 'team';
    return side === my ? (team ? '우리 팀 영웅' : '내 영웅') : team ? '상대 팀 영웅' : '상대 영웅';
  }
  const uid = Number(r.slice(1));
  const u = findUnit(s, uid);
  const id = u ? u.id : app.gameUi.names[uid];
  return id ? CARDS[id].name : '유닛';
}

function validTargets(app) {
  const sess = app.session;
  const s = sess.s;
  const sel = app.gameUi.sel;
  if (!sel || !s || !sess.isMyTurn()) return [];
  const me = sess.mySeat;
  if (sel.kind === 'card') {
    const d = CARDS[sel.c];
    return d.tg ? targetsFor(s, me, d.tg, 0) : [];
  }
  if (sel.kind === 'unit') return attackTargets(s, me);
  if (sel.kind === 'power') {
    const pw = heroPower(s, me);
    return pw && pw.tg ? targetsFor(s, me, pw.tg, 0) : [];
  }
  return [];
}

function seatChip(app, s, i, active) {
  const P = s.seats[i];
  const l = (app.seatLabels && app.seatLabels[i]) || {};
  const me = i === app.session.mySeat;
  return `<div class="seat ${active ? 'active' : ''} ${me ? 'me' : ''}" style="--fc:${facColor(P.fac)}">
    ${avatarHtml(l, 26)}
    <div class="sx"><b>${esc(l.name || `${i + 1}번`)}${me ? ' (나)' : ''}</b>
    <span title="${FACTIONS[P.fac] ? FACTIONS[P.fac].name : ''}">손패 ${P.hand.length} · 덱 ${P.deck.length} · 에너지 ${P.mana}/${P.maxMana}</span></div>
  </div>`;
}

function heroHtml(s, side, my, targets, label) {
  const H = s.sides[side];
  const ref = `h${side}`;
  const t = targets.includes(ref);
  return `<button type="button" class="hero ${side === my ? 'mine' : 'enemy'} ${t ? 'target' : ''} ${H.hp <= 8 ? 'low' : ''}" data-ref="${ref}" aria-label="${esc(`${label} 생명력 ${H.hp}${H.armor ? `, 방어도 ${H.armor}` : ''}`)}">
    <span class="hl">${esc(label)}</span>
    <span class="hhp">${H.hp}</span>
    ${H.armor ? `<span class="harm">${H.armor}</span>` : ''}
  </button>`;
}

export function renderGame(app, root) {
  const sess = app.session;
  const s = sess.s;
  const ui = app.gameUi;
  if (!s) {
    root.innerHTML = `<section class="wait"><div class="spinner" aria-hidden="true"></div><p>${esc(sess.msg || '준비 중…')}</p>
      <button type="button" class="btn" data-act="leave-game">나가기</button></section>`;
    return;
  }
  if (ui.game !== s) {
    ui.game = s;
    ui.lastEv = 0;
    ui.sel = null;
    ui.log = [];
  }
  for (const sd of s.sides) for (const u of sd.board) ui.names[u.uid] = u.id;
  const me = sess.mySeat;
  const my = s.seats[me].side;
  const en = 1 - my;
  const team = s.mode === 'team';
  const mine = sess.isMyTurn();
  const targets = validTargets(app);
  const sel = ui.sel;
  const P = s.seats[me];

  const enemySeats = s.seats.map((x, i) => i).filter((i) => s.seats[i].side === en);
  const allySeats = s.seats.map((x, i) => i).filter((i) => s.seats[i].side === my);
  const unitList = (side) =>
    s.sides[side].board
      .map((u) => {
        const own = team ? seatName(app, u.owner) : '';
        return unitHtml(u, {
          canAttack: mine && side === my && canAttack(s, me, u),
          selected: sel && sel.kind === 'unit' && sel.uid === u.uid,
          target: targets.includes(`u${u.uid}`),
          ally: team && side === my && u.owner !== me,
          owner: own,
        });
      })
      .join('') || `<span class="empty">${side === my ? '내 전장' : '상대 전장'}</span>`;

  const pw = heroPower(s, me);
  const pwOk = pw && mine && !check(s, me, { t: 'hp', tgt: pw.tg ? (targetsFor(s, me, pw.tg, 0)[0] || '') : '' });
  const activeName = s.over ? '' : s.active === me ? '내 턴' : `${seatName(app, s.active)}의 턴`;
  const left = sess.timeLeft ? sess.timeLeft() : 0;

  // 선택한 것 설명
  let detail = '';
  if (sel && sel.kind === 'card') {
    const d = CARDS[sel.c];
    const need = d.tg && targets.length;
    const err = check(s, me, { t: 'play', c: sel.c, tgt: need ? targets[0] : '' });
    detail = `<b>${esc(d.name)}</b> <span class="muted">${d.cost} 에너지${d.type === 'unit' ? ` · ${d.atk}/${d.hp}` : ' · 주문'}</span><br>${esc(cardRules(sel.c)) || '능력 없음'}
      <div class="dact">${err ? `<span class="warn">${esc(err)}</span>` : need ? '<span class="hint">빛나는 대상을 고르세요</span>' : '<button type="button" class="btn primary" data-act="play-sel">내기</button>'}
      <button type="button" class="btn ghost" data-act="cancel">취소</button></div>`;
  } else if (sel && sel.kind === 'unit') {
    detail = `<span class="hint">공격할 대상을 고르세요</span> <button type="button" class="btn ghost" data-act="cancel">취소</button>`;
  } else if (sel && sel.kind === 'power') {
    detail = `<b>${esc(pw.name)}</b> · ${esc(pw.text)} <span class="hint">대상을 고르세요</span> <button type="button" class="btn ghost" data-act="cancel">취소</button>`;
  } else if (sel && sel.kind === 'inspect') {
    const u = sel.ref[0] === 'u' ? findUnit(s, Number(sel.ref.slice(1))) : null;
    if (u) {
      const d = CARDS[u.id];
      detail = `<b>${esc(d.name)}</b> <span class="muted">${u.atk}/${u.hp}${u.sil ? ' · 침묵됨' : ''}${u.frozen || u.frz ? ' · 빙결' : ''}</span><br>${esc(cardRules(u.id)) || '능력 없음'}`;
    }
  } else {
    detail = mine ? '<span class="hint">카드나 내 유닛을 눌러 고르세요. 다 했으면 턴 종료.</span>' : `<span class="hint">${esc(sess.msg || `${activeName} · 기다리는 중`)}</span>`;
  }

  const hand = P.hand
    .map((c, i) => {
      const playable = mine && c !== '?' && CARDS[c] && P.mana >= CARDS[c].cost;
      return cardHtml(c, { playable, selected: sel && sel.kind === 'card' && sel.i === i, attrs: `data-hand="${i}"` });
    })
    .join('');

  root.innerHTML = `<section class="game ${team ? 'team' : 'duel'} ${mine ? 'my-turn' : ''}">
    <div class="side enemy">
      <div class="seats">${enemySeats.map((i) => seatChip(app, s, i, s.active === i)).join('')}</div>
      ${heroHtml(s, en, my, targets, team ? '상대 팀' : '상대')}
    </div>
    <div class="board enemy">${unitList(en)}</div>
    <div class="mid">
      <span class="turn ${mine ? 'mine' : ''}">${esc(activeName)}${left ? ` · <span id="timer">${fmtTime(left)}</span>` : ''}</span>
      <span class="sp"></span>
      ${pw ? `<button type="button" class="btn power ${sel && sel.kind === 'power' ? 'on' : ''}" data-act="power" ${pwOk ? '' : 'disabled'} title="${esc(pw.text)}">${esc(pw.name)} <small>${pw.cost}</small></button>` : ''}
      <button type="button" class="btn end ${mine ? 'primary' : ''}" data-act="end" ${mine ? '' : 'disabled'}>턴 종료</button>
      <button type="button" class="btn ghost more" data-act="menu" aria-label="메뉴">⋯</button>
    </div>
    <div class="board mine">${unitList(my)}</div>
    <div class="side mine">
      ${heroHtml(s, my, my, targets, team ? '우리 팀' : '나')}
      <div class="seats">${allySeats.map((i) => seatChip(app, s, i, s.active === i)).join('')}</div>
    </div>
    <div class="detail">${detail}</div>
    <div class="hand">${hand || '<span class="empty">손패 없음</span>'}</div>
    <ol class="log">${ui.log.slice(-4).map((l) => `<li>${esc(l)}</li>`).join('')}</ol>
    ${overlay(app)}
  </section>`;
  animate(app, root);
}

function overlay(app) {
  const sess = app.session;
  if (sess.kind === 'solo' && sess.phase === 'floorClear') {
    const r = sess.run.results[sess.run.results.length - 1];
    return `<div class="over"><div class="obox"><h2>${r.f + 1}층 클리어</h2><p>+${r.pts}점 · 지금까지 ${sess.run.score}점</p><p class="muted">다음 층은 생명력 ${sess.run.hp}로 시작해요</p>
      <button type="button" class="btn primary" data-act="next-floor">다음 층으로</button></div></div>`;
  }
  return '';
}

// 새 사건(피해/회복 숫자, 기록 줄)
function animate(app, root) {
  const s = app.session.s;
  const ui = app.gameUi;
  const evs = s.ev.slice(ui.lastEv);
  ui.lastEv = s.ev.length;
  const my = s.seats[app.session.mySeat].side;
  const lines = [];
  for (const e of evs) {
    if (e.k === 'summon') ui.names[Number(e.r.slice(1))] = e.c;
    if (e.k === 'dmg' || e.k === 'heal' || e.k === 'armor') {
      const el = root.querySelector(`[data-ref="${e.r}"]`);
      if (el) {
        const f = document.createElement('span');
        f.className = `float ${e.k}`;
        f.textContent = `${e.k === 'dmg' ? '-' : '+'}${e.n}`;
        el.appendChild(f);
        if (e.k === 'dmg') el.classList.add('hit');
        setTimeout(() => f.remove(), 1100);
      }
    }
    if (e.k === 'play') lines.push(`${seatName(app, e.pi)}: ${CARDS[e.c] ? CARDS[e.c].name : '카드'}${e.tgt ? ` → ${refName(app, s, e.tgt, my)}` : ''}`);
    if (e.k === 'power') lines.push(`${seatName(app, e.pi)}: 영웅 능력${e.tgt ? ` → ${refName(app, s, e.tgt, my)}` : ''}`);
    if (e.k === 'atk') lines.push(`${refName(app, s, e.a, my)} 공격 → ${refName(app, s, e.t, my)}`);
    if (e.k === 'die') lines.push(`${CARDS[e.c] ? CARDS[e.c].name : '유닛'} 쓰러짐`);
    if (e.k === 'fatigue') lines.push(`${seatName(app, e.pi)}: 덱이 비어 ${e.n} 피해`);
    if (e.k === 'turn' && e.pi === app.session.mySeat) lines.push('— 내 턴 —');
  }
  if (lines.length) {
    ui.log.push(...lines);
    if (ui.log.length > 40) ui.log.splice(0, ui.log.length - 40);
    const ol = root.querySelector('.log');
    if (ol) ol.innerHTML = ui.log.slice(-4).map((l) => `<li>${esc(l)}</li>`).join('');
  }
}

// 클릭 처리. 처리했으면 true
export function onGameClick(app, e) {
  const sess = app.session;
  const ui = app.gameUi;
  const t = e.target.closest('[data-act],[data-hand],[data-ref]');
  if (!t || !sess) return false;
  const s = sess.s;
  const doAct = (a) => {
    const err = sess.act(a);
    ui.sel = null;
    if (err) toast(err, 'bad');
    app.render();
  };
  const act = t.dataset.act;
  if (act === 'leave-game') {
    app.leaveGame();
    return true;
  }
  if (!s) return true;
  if (act === 'next-floor') {
    sess.nextFloor();
    return true;
  }
  if (act === 'cancel') {
    ui.sel = null;
    app.render();
    return true;
  }
  if (act === 'menu') {
    gameMenu(app);
    return true;
  }
  if (act === 'end') {
    doAct({ t: 'end' });
    return true;
  }
  if (act === 'play-sel' && ui.sel && ui.sel.kind === 'card') {
    doAct({ t: 'play', c: ui.sel.c, tgt: '' });
    return true;
  }
  if (act === 'power') {
    const pw = heroPower(s, sess.mySeat);
    if (pw && pw.tg) {
      ui.sel = ui.sel && ui.sel.kind === 'power' ? null : { kind: 'power' };
      app.render();
    } else doAct({ t: 'hp', tgt: '' });
    return true;
  }
  if (t.dataset.hand !== undefined) {
    const i = Number(t.dataset.hand);
    const c = s.seats[sess.mySeat].hand[i];
    if (!c || c === '?') return true;
    const d = CARDS[c];
    if (ui.sel && ui.sel.kind === 'card' && ui.sel.i === i && sess.isMyTurn()) {
      const tl = d.tg ? targetsFor(s, sess.mySeat, d.tg, 0) : [];
      if (!tl.length) {
        doAct({ t: 'play', c, tgt: '' });
        return true;
      }
    }
    ui.sel = { kind: 'card', c, i };
    app.render();
    return true;
  }
  if (t.dataset.ref) {
    const ref = t.dataset.ref;
    const tl = validTargets(app);
    if (ui.sel && tl.includes(ref)) {
      if (ui.sel.kind === 'card') doAct({ t: 'play', c: ui.sel.c, tgt: ref });
      else if (ui.sel.kind === 'unit') doAct({ t: 'atk', u: ui.sel.uid, tgt: ref });
      else if (ui.sel.kind === 'power') doAct({ t: 'hp', tgt: ref });
      return true;
    }
    if (ref[0] === 'u') {
      const u = findUnit(s, Number(ref.slice(1)));
      if (u && sess.isMyTurn() && canAttack(s, sess.mySeat, u)) {
        ui.sel = ui.sel && ui.sel.kind === 'unit' && ui.sel.uid === u.uid ? null : { kind: 'unit', uid: u.uid };
      } else ui.sel = { kind: 'inspect', ref };
      app.render();
      return true;
    }
    ui.sel = null;
    app.render();
    return true;
  }
  return false;
}

async function gameMenu(app) {
  const sess = app.session;
  const solo = sess.kind === 'solo';
  const v = await modal(solo ? '도전 그만두기' : '항복', solo ? '<p>지금까지 깬 층의 점수만 기록돼요.</p>' : `<p>항복하면 ${sess.mode === 'team' ? '우리 팀이' : '내가'} 지는 걸로 기록돼요.</p>`, [
    { label: '계속하기', value: 'stay', primary: true },
    { label: solo ? '그만두기' : '항복하기', value: 'quit' },
  ]);
  if (v === 'quit') {
    const err = sess.act({ t: 'x' });
    if (err) toast(err, 'bad');
    app.render();
  }
}

export function tickGame(app) {
  const el = document.getElementById('timer');
  if (el && app.session && app.session.timeLeft) el.textContent = fmtTime(app.session.timeLeft());
}
