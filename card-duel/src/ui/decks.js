// 덱 목록과 덱 편집기
import { CARDS, COLLECTIBLE, FACTIONS, PRESETS, DECK_SIZE, deckCode, parseDeckCode, validateDeck } from '../cards.js';
import { esc, cardHtml, facColor, modal, toast } from './common.js';
import { randomId } from '../match.js';

const FACS = ['fire', 'steel', 'arcane', 'wild', 'shadow'];

function curve(ids) {
  const b = [0, 0, 0, 0, 0, 0, 0];
  for (const id of ids) b[Math.min(6, Math.max(0, CARDS[id].cost - 1))] += 1;
  const max = Math.max(1, ...b);
  return `<div class="curve" aria-label="비용 분포">${b.map((n, i) => `<span style="--h:${Math.round((n / max) * 100)}%" title="${i === 6 ? '7+' : i + 1}비용 ${n}장"><i></i><em>${i === 6 ? '7+' : i + 1}</em></span>`).join('')}</div>`;
}

function deckRow(d, current, custom) {
  const p = parseDeckCode(d.code);
  const f = FACTIONS[p.fac];
  return `<li class="deckrow ${current ? 'current' : ''}" style="--fc:${facColor(p.fac)}">
    <span class="dot"></span>
    <div class="dinfo"><b>${esc(d.name)}</b><span>${f.name} · ${esc(f.style)}</span>${curve(p.ids)}</div>
    <div class="dbtns">
      ${current ? '<span class="pill">사용 중</span>' : `<button type="button" class="btn primary" data-act="use-deck" data-code="${esc(d.code)}" data-name="${esc(d.name)}">이 덱 쓰기</button>`}
      <button type="button" class="btn ghost" data-act="edit-deck" data-id="${esc(d.id)}">${custom ? '편집' : '복사해서 편집'}</button>
      ${custom ? `<button type="button" class="btn ghost" data-act="del-deck" data-id="${esc(d.id)}">삭제</button>` : ''}
    </div>
  </li>`;
}

export function renderDecks(app, root) {
  const cur = app.currentDeck().code;
  const presets = PRESETS.map((p) => ({ id: `preset-${p.key}`, name: p.name, code: deckCode(p.fac, p.ids) }));
  root.innerHTML = `<section class="decks">
    <header class="bar"><button type="button" class="btn ghost" data-act="home">← 로비</button><h2>덱 고르기</h2></header>
    <h3>기본 덱</h3>
    <ul class="decklist">${presets.map((d) => deckRow(d, d.code === cur, false)).join('')}</ul>
    <h3>내 덱</h3>
    <ul class="decklist">${app.store.decks.map((d) => deckRow(d, d.code === cur, true)).join('') || '<li class="muted">아직 만든 덱이 없어요.</li>'}</ul>
    <button type="button" class="btn primary" data-act="new-deck">새 덱 만들기</button>
  </section>`;
}

// ---------- 편집기 ----------
export function openBuilder(app, base) {
  // base: {id?, name, code} 또는 {fac}
  let fac = base.fac;
  let ids = [];
  if (base.code) {
    const p = parseDeckCode(base.code);
    fac = p.fac;
    ids = p.ids.slice();
  }
  app.builder = { id: base.custom ? base.id : null, name: base.name || `${FACTIONS[fac].name} 덱`, fac, ids, cost: 'all' };
  app.go('builder');
}

export function renderBuilder(app, root) {
  const b = app.builder;
  const pool = COLLECTIBLE.filter((id) => CARDS[id].fac === b.fac || CARDS[id].fac === 'neutral')
    .filter((id) => b.cost === 'all' || (b.cost === '7' ? CARDS[id].cost >= 7 : CARDS[id].cost === Number(b.cost)))
    .sort((x, y) => CARDS[x].cost - CARDS[y].cost || (CARDS[x].fac === 'neutral') - (CARDS[y].fac === 'neutral') || CARDS[x].name.localeCompare(CARDS[y].name));
  const count = {};
  for (const id of b.ids) count[id] = (count[id] || 0) + 1;
  const err = validateDeck(b.fac, b.ids);
  const list = Object.keys(count)
    .sort((x, y) => CARDS[x].cost - CARDS[y].cost || CARDS[x].name.localeCompare(CARDS[y].name))
    .map((id) => `<li style="--fc:${facColor(CARDS[id].fac)}"><span class="c">${CARDS[id].cost}</span><span class="n">${esc(CARDS[id].name)}${CARDS[id].leg ? ' ★' : ''}</span><span class="x">×${count[id]}</span><button type="button" class="btn ghost tiny" data-act="b-del" data-id="${id}" aria-label="${esc(CARDS[id].name)} 빼기">−</button></li>`)
    .join('');
  root.innerHTML = `<section class="builder" style="--fc:${facColor(b.fac)}">
    <header class="bar">
      <button type="button" class="btn ghost" data-act="decks">← 덱 목록</button>
      <label class="sr" for="deck-name">덱 이름</label>
      <input id="deck-name" maxlength="20" value="${esc(b.name)}">
      <button type="button" class="btn primary" data-act="b-save" ${err ? 'disabled' : ''}>저장</button>
    </header>
    <p class="bfac"><b>${FACTIONS[b.fac].name}</b> · ${esc(FACTIONS[b.fac].style)} · 영웅 능력: ${esc(FACTIONS[b.fac].power.name)} (${esc(FACTIONS[b.fac].power.text)})</p>
    <div class="bwrap">
      <div class="bpool">
        <div class="chips" role="group" aria-label="비용으로 거르기">${['all', '1', '2', '3', '4', '5', '6', '7'].map((c) => `<button type="button" class="chip ${b.cost === c ? 'on' : ''}" data-act="b-cost" data-cost="${c}">${c === 'all' ? '전체' : c === '7' ? '7+' : c}</button>`).join('')}</div>
        <div class="cards">${pool.map((id) => cardHtml(id, { attrs: `data-act="b-add" data-id="${id}"`, badge: count[id] ? `×${count[id]}` : '', cls: count[id] >= (CARDS[id].leg ? 1 : 2) ? 'maxed' : '' })).join('')}</div>
      </div>
      <aside class="blist">
        <h3>${b.ids.length} / ${DECK_SIZE}장</h3>
        ${curve(b.ids)}
        <ul>${list || '<li class="muted">왼쪽 카드를 눌러 추가하세요</li>'}</ul>
        ${err ? `<p class="warn">${esc(err)}</p>` : '<p class="good">규칙에 맞는 덱이에요</p>'}
      </aside>
    </div>
  </section>`;
}

export function onDeckClick(app, e) {
  const t = e.target.closest('[data-act]');
  if (!t) return false;
  const act = t.dataset.act;
  const b = app.builder;
  switch (act) {
    case 'use-deck':
      app.setDeck(t.dataset.code, t.dataset.name);
      toast(`${t.dataset.name} 덱을 쓸게요`);
      app.go('home');
      return true;
    case 'edit-deck': {
      const id = t.dataset.id;
      const custom = app.store.decks.find((d) => d.id === id);
      if (custom) openBuilder(app, { ...custom, custom: true });
      else {
        const p = PRESETS.find((x) => `preset-${x.key}` === id);
        openBuilder(app, { name: `${p.name} (내 버전)`, code: deckCode(p.fac, p.ids) });
      }
      return true;
    }
    case 'del-deck':
      modal('덱 삭제', '<p>이 덱을 지울까요?</p>', [
        { label: '취소', value: false },
        { label: '삭제', value: true, primary: true },
      ]).then((ok) => {
        if (!ok) return;
        app.store.saveDecks(app.store.decks.filter((d) => d.id !== t.dataset.id));
        app.render(true);
      });
      return true;
    case 'new-deck':
      modal('어떤 파벌로 만들까요?', `<div class="facpick">${FACS.map((f) => `<p style="--fc:${facColor(f)}"><b>${FACTIONS[f].name}</b> ${esc(FACTIONS[f].style)}</p>`).join('')}</div>`, [
        ...FACS.map((f) => ({ label: FACTIONS[f].name, value: f })),
        { label: '취소', value: null },
      ]).then((f) => {
        if (f) openBuilder(app, { fac: f, name: `새 ${FACTIONS[f].name} 덱` });
      });
      return true;
    case 'b-cost':
      b.name = document.getElementById('deck-name').value;
      b.cost = t.dataset.cost;
      app.render(true);
      return true;
    case 'b-add': {
      const id = t.dataset.id;
      const n = b.ids.filter((x) => x === id).length;
      if (b.ids.length >= DECK_SIZE) toast(`이미 ${DECK_SIZE}장이에요`, 'bad');
      else if (n >= (CARDS[id].leg ? 1 : 2)) toast(`${CARDS[id].name}은(는) ${CARDS[id].leg ? 1 : 2}장까지예요`, 'bad');
      else b.ids.push(id);
      b.name = document.getElementById('deck-name').value;
      app.render(true);
      return true;
    }
    case 'b-del': {
      const i = b.ids.indexOf(t.dataset.id);
      if (i >= 0) b.ids.splice(i, 1);
      b.name = document.getElementById('deck-name').value;
      app.render(true);
      return true;
    }
    case 'b-save': {
      b.name = (document.getElementById('deck-name').value || '').trim() || `${FACTIONS[b.fac].name} 덱`;
      const err = validateDeck(b.fac, b.ids);
      if (err) {
        toast(err, 'bad');
        return true;
      }
      const code = deckCode(b.fac, b.ids);
      const list = app.store.decks.slice();
      if (b.id) {
        const i = list.findIndex((d) => d.id === b.id);
        if (i >= 0) list[i] = { id: b.id, name: b.name, code };
        else list.push({ id: b.id, name: b.name, code });
      } else list.push({ id: `d-${randomId(8)}`, name: b.name, code });
      app.store.saveDecks(list);
      app.setDeck(code, b.name);
      toast('덱을 저장하고 이 덱으로 바꿨어요');
      app.go('decks');
      return true;
    }
    default:
      return false;
  }
}
