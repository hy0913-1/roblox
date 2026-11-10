import './style.css';
import { Game } from './game.js';
import { SKILLS, SKILL_ORDER, SHOP, TALK, expNeed, maxHp, maxMp, atkOf, gloveCost } from './data.js';
import { iconURL } from './art.js';
import { sfx, music, unlock, isMuted, setMuted } from './audio.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const root = $('#app');
root.innerHTML = `
<div id="wrap">
<div id="stage">
  <canvas id="cv" aria-label="게임 화면"></canvas>
  <div id="hud" hidden>
    <div class="me">
      <div class="lv"><b id="h-lv">Lv.1</b> <span>빛나리</span></div>
      <div class="bar hp"><i id="h-hp"></i><em id="h-hpt"></em></div>
      <div class="bar mp"><i id="h-mp"></i><em id="h-mpt"></em></div>
      <div class="bar xp"><i id="h-xp"></i><em id="h-xpt"></em></div>
    </div>
    <div class="side">
      <div class="gold"><i class="coin"></i><b id="h-gold">0</b></div>
      <div id="h-quest" class="quest"></div>
    </div>
    <div id="h-boss" class="boss" hidden><span>털보 대왕</span><div class="bar"><i id="h-bosshp"></i></div></div>
    <div id="h-map" class="mapname"></div>
    <div class="topbtn"><button type="button" class="pb" data-ui="skills" id="b-skill">스킬<kbd>K</kbd></button><button type="button" class="pb" data-ui="menu">메뉴</button></div>
    <div id="h-hint" class="hint" hidden></div>
  </div>
  <div id="toast" aria-live="polite"></div>
  <div id="win" hidden></div>
  <div id="title"></div>
</div>
<div id="pad" hidden>
  <div class="dpad">
    <button type="button" class="tb" data-k="up" aria-label="위">▲</button>
    <button type="button" class="tb" data-k="left" aria-label="왼쪽">◀</button>
    <button type="button" class="tb" data-k="right" aria-label="오른쪽">▶</button>
    <button type="button" class="tb" data-k="down" aria-label="아래">▼</button>
  </div>
  <div class="acts">
    <div class="row pots">
      <button type="button" class="tb slot" data-k="hp" data-slot="hp" aria-label="빨간 물약"></button>
      <button type="button" class="tb slot" data-k="mp" data-slot="mp" aria-label="파란 물약"></button>
    </div>
    <div class="row skills">
      <button type="button" class="tb slot" data-k="s1" data-slot="beam" aria-label="탈모빔"></button>
      <button type="button" class="tb slot" data-k="s2" data-slot="slam" aria-label="몸무게 3톤 어택"></button>
      <button type="button" class="tb slot" data-k="s3" data-slot="quake" aria-label="진동 폭발"></button>
      <button type="button" class="tb slot" data-k="s4" data-slot="air" aria-label="공군 폭격"></button>
    </div>
    <div class="row main">
      <button type="button" class="tb slot big" data-k="attack" data-slot="punch" aria-label="공격"></button>
      <button type="button" class="tb slot big" data-k="jump" data-slot="jump" aria-label="점프"></button>
    </div>
  </div>
</div>
</div>`;

const KEYLABEL = { punch: 'X', jump: 'Space', beam: 'A', slam: 'S', quake: 'D', air: 'F', hp: '1', mp: '2' };
for (const b of document.querySelectorAll('.slot')) {
  const id = b.dataset.slot;
  b.innerHTML = `<img src="${iconURL(id, 3)}" alt=""><i class="cd"></i><span class="n"></span><kbd>${KEYLABEL[id]}</kbd>`;
}

let toastT = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'show';
  clearTimeout(toastT);
  toastT = setTimeout(() => (el.className = ''), 2800);
}

// ---------- 창 ----------
const win = $('#win');
let winKind = '', dialogState = null;
function openWin(kind, html) {
  winKind = kind;
  win.innerHTML = html;
  win.hidden = false;
  game.paused = true;
  for (const k of Object.keys(game.keys)) game.keys[k] = false;
}
function closeWin() {
  winKind = '';
  win.hidden = true;
  win.innerHTML = '';
  game.paused = false;
  dialogState = null;
}
function dialog(name, lines, then) {
  dialogState = { name, lines, i: 0, then };
  showDialog();
}
function showDialog() {
  const d = dialogState;
  openWin('dialog', `<div class="dialog" data-ui="next"><b>${esc(d.name)}</b><p>${esc(d.lines[d.i])}</p><span class="more">${d.i < d.lines.length - 1 ? '다음 ▶' : '닫기 ✕'}</span></div>`);
  dialogState = d;
}
function nextDialog() {
  const d = dialogState;
  if (!d) return;
  sfx('click');
  d.i += 1;
  if (d.i < d.lines.length) return showDialog();
  closeWin();
  if (d.then) d.then();
  return null;
}
function shop() {
  const p = game.p;
  const rows = SHOP.map((it) => {
    const cost = it.id === 'glove' ? gloveCost(p.glove) : it.cost;
    const have = it.id === 'glove' ? `+${p.glove}` : `${p.pots[it.id]}개`;
    return `<li><img src="${iconURL(it.id === 'glove' ? 'punch' : it.id, 2)}" alt=""><div><b>${it.name}</b> <small>보유 ${have}</small><br><small>${it.desc}</small></div><button type="button" class="pb" data-ui="buy" data-id="${it.id}" ${p.gold >= cost ? '' : 'disabled'}>${cost} G</button>${it.id === 'glove' ? '' : `<button type="button" class="pb" data-ui="buy5" data-id="${it.id}" ${p.gold >= cost * 5 ? '' : 'disabled'}>×5</button>`}</li>`;
  }).join('');
  openWin('shop', `<div class="panel"><h2>광택 상점 <small>${p.gold} G</small></h2><p class="say">${TALK.shop[0]}</p><ul class="list">${rows}</ul><button type="button" class="pb close" data-ui="close">닫기</button></div>`);
}
function buy(id, n) {
  const p = game.p;
  for (let i = 0; i < n; i++) {
    const cost = id === 'glove' ? gloveCost(p.glove) : SHOP.find((s) => s.id === id).cost;
    if (p.gold < cost) break;
    p.gold -= cost;
    if (id === 'glove') p.glove += 1;
    else p.pots[id] += 1;
  }
  sfx('coin');
  game.save();
  shop();
  updateHud(true);
}
function skillsWin() {
  const p = game.p;
  const rows = SKILL_ORDER.map((id) => {
    const s = SKILLS[id], lv = p.skills[id], locked = !lv;
    const mult = Math.round((s.mult + s.per * Math.max(0, lv - 1)) * 100);
    return `<li class="${locked ? 'locked' : ''}"><img src="${iconURL(id, 3)}" alt=""><div><b>${s.name}</b> <small>${locked ? `레벨 ${s.unlock}에 배움` : `Lv.${lv}/${s.max} · 피해 ${mult}% · MP ${s.mp} · 대기 ${s.cd}초`}</small><br><small>${s.desc}</small></div><button type="button" class="pb" data-ui="skillup" data-id="${id}" ${!locked && p.sp > 0 && lv < s.max ? '' : 'disabled'}>강화</button></li>`;
  }).join('');
  openWin('skills', `<div class="panel"><h2>스킬 <small>스킬 포인트 ${p.sp}</small></h2><p class="say">공격력 ${atkOf(p)} · 평타(X) 100%</p><ul class="list">${rows}</ul><button type="button" class="pb close" data-ui="close">닫기</button></div>`);
}
let resetArmed = 0;
function menuWin() {
  openWin('menu', `<div class="panel"><h2>메뉴</h2>
    <ul class="help">
      <li><b>이동</b> ← → · <b>점프</b> Space · <b>공격</b> X</li>
      <li><b>스킬</b> A 탈모빔 · S 3톤 어택 · D 진동 폭발 · F 공군 폭격</li>
      <li><b>물약</b> 1 빨강 · 2 파랑 · <b>스킬 창</b> K</li>
      <li><b>↑</b> 사다리 / 포탈 들어가기 / 말 걸기 · <b>↓ + 점프</b> 발판 아래로</li>
      <li>진행 상황은 이 기기에 자동으로 저장돼요.</li>
    </ul>
    <div class="btns"><button type="button" class="pb" data-ui="mute">${isMuted() ? '소리 켜기' : '소리 끄기'}</button><button type="button" class="pb ${resetArmed ? 'warn' : ''}" data-ui="reset">${resetArmed ? '한 번 더 누르면 처음부터' : '처음부터 다시'}</button><button type="button" class="pb close" data-ui="close">닫기</button></div></div>`);
}
function ending() {
  openWin('ending', `<div class="panel end"><h2>세상이 반짝이기 시작했어요</h2><p>털보 대왕의 털은 한 올도 남지 않았고,<br>빛나리 마을에는 오늘도 눈부신 아침이 밝았어요.</p><p class="say">— 끝 —<br><small>계속 돌아다니며 레벨을 올릴 수 있어요.</small></p><button type="button" class="pb close" data-ui="close">계속하기</button></div>`);
  sfx('level');
}

// ---------- 게임 ----------
const game = new Game($('#cv'), {
  sfx, toast, dialog, shop, ending, TALK,
  ui: () => updateHud(true),
  mapChanged: (m) => {
    music(m.bgm);
    const el = $('#h-map');
    el.textContent = m.name;
    el.className = 'mapname show';
    setTimeout(() => (el.className = 'mapname'), 2400);
  },
});
window.__rpg = { game };

let hudSig = '';
function updateHud(force) {
  const p = game.p;
  $('#h-hp').style.width = `${(100 * p.hp) / maxHp(p)}%`;
  $('#h-mp').style.width = `${(100 * p.mp) / maxMp(p)}%`;
  $('#h-xp').style.width = `${(100 * p.exp) / expNeed(p.lv)}%`;
  const pr = game.questProgress();
  const sig = `${p.lv}|${Math.ceil(p.hp)}|${Math.floor(p.mp)}|${p.exp}|${p.gold}|${p.pots.hp}|${p.pots.mp}|${p.sp}|${p.quest}|${p.qstate}|${pr ? pr.parts.join() : ''}|${SKILL_ORDER.map((k) => p.skills[k]).join()}`;
  if (force || sig !== hudSig) {
    hudSig = sig;
    $('#h-lv').textContent = `Lv.${p.lv}`;
    $('#h-hpt').textContent = `${Math.ceil(p.hp)} / ${maxHp(p)}`;
    $('#h-mpt').textContent = `${Math.floor(p.mp)} / ${maxMp(p)}`;
    $('#h-xpt').textContent = `EXP ${Math.floor((100 * p.exp) / expNeed(p.lv))}%`;
    $('#h-gold').textContent = p.gold;
    $('#b-skill').classList.toggle('glow', p.sp > 0);
    const q = $('#h-quest');
    if (pr) q.innerHTML = `<b>${esc(pr.q.title)}</b>${pr.parts.map((s) => `<span>${esc(s)}</span>`).join('')}${pr.done ? '<span class="ok">촌장에게 보고하세요</span>' : ''}`;
    else if (p.qstate === 'new' && p.quest < 6) q.innerHTML = '<b>새 퀘스트</b><span>민둥 촌장과 이야기하세요</span>';
    else q.innerHTML = '';
    for (const b of document.querySelectorAll('.slot')) {
      const id = b.dataset.slot, n = b.querySelector('.n');
      if (id === 'hp' || id === 'mp') n.textContent = p.pots[id];
      else if (SKILLS[id]) b.classList.toggle('locked', !p.skills[id]);
    }
  }
  for (const b of document.querySelectorAll('.slot')) {
    const id = b.dataset.slot, cd = b.querySelector('.cd');
    const max = SKILLS[id] ? SKILLS[id].cd : id === 'punch' ? 0.38 : 0, left = p.cd[id] || 0;
    cd.style.height = max ? `${(100 * left) / max}%` : '0';
    if (SKILLS[id]) b.classList.toggle('nomp', !!p.skills[id] && p.mp < SKILLS[id].mp);
  }
  const boss = game.boss;
  $('#h-boss').hidden = !boss;
  if (boss) $('#h-bosshp').style.width = `${Math.max(0, (100 * boss.hp) / boss.d.hp)}%`;
  // 근처에 말 걸 대상/포탈이 있으면 안내
  const m = game.map;
  let hint = '';
  if (m && !game.paused) {
    for (const n of m.npcs || []) if (Math.abs(n.x * 16 + 8 - p.x) < 22 && Math.abs(n.y * 16 - p.y) < 20) hint = `▲ ${n.name}와 이야기`;
    for (const po of m.portals) if (Math.abs(po.x * 16 + 8 - p.x) < 18 && Math.abs(po.y * 16 - p.y) < 20) hint = `▲ ${po.label}(으)로`;
  }
  const h = $('#h-hint');
  if (h.textContent !== hint) h.textContent = hint;
  h.hidden = !hint;
}

// ---------- 입력 ----------
const CODE = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Space: 'jump', KeyC: 'jump', AltLeft: 'jump', KeyX: 'attack', ControlLeft: 'attack', KeyZ: 'attack', KeyA: 's1', KeyS: 's2', KeyD: 's3', KeyF: 's4', Digit1: 'hp', Digit2: 'mp', KeyQ: 'hp', KeyW: 'mp', Enter: 'up' };
let started = false;
addEventListener('keydown', (e) => {
  unlock();
  if (!started) {
    if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); start(Game.hasSave()); }
    return;
  }
  if (winKind) {
    if (['Enter', 'Space', 'KeyX', 'Escape'].includes(e.code)) {
      e.preventDefault();
      if (winKind === 'dialog' && e.code !== 'Escape') nextDialog();
      else if (winKind !== 'dialog') closeWin();
    }
    if (e.code === 'KeyK' && winKind === 'skills') closeWin();
    return;
  }
  if (e.code === 'KeyK') return skillsWin();
  if (e.code === 'Escape') return menuWin();
  const k = CODE[e.code];
  if (k) {
    e.preventDefault();
    if (!e.repeat) game.key(k, true);
  }
});
addEventListener('keyup', (e) => {
  const k = CODE[e.code];
  if (k) game.key(k, false);
});
addEventListener('blur', () => { for (const k of Object.keys(game.keys)) game.keys[k] = false; });

// 터치 버튼: 손가락마다 누른 버튼을 기억해서, 밀어서 옮겨도 자연스럽게
const pad = $('#pad');
const held = new Map();
function padAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const b = el && el.closest ? el.closest('.tb') : null;
  return b && pad.contains(b) ? b : null;
}
function padSet(id, b) {
  const cur = held.get(id);
  if (cur === b) return;
  if (cur) { cur.classList.remove('on'); if (![...held.entries()].some(([i, o]) => i !== id && o === cur)) game.key(cur.dataset.k, false); }
  if (b) { held.set(id, b); b.classList.add('on'); game.key(b.dataset.k, true); } else held.delete(id);
}
pad.addEventListener('pointerdown', (e) => {
  unlock();
  e.preventDefault();
  if (winKind === 'dialog') return void nextDialog();
  const b = padAt(e.clientX, e.clientY);
  if (b) padSet(e.pointerId, b);
});
pad.addEventListener('pointermove', (e) => {
  if (!held.has(e.pointerId)) return;
  const b = padAt(e.clientX, e.clientY), cur = held.get(e.pointerId);
  // 방향키끼리만 미끄러져 옮겨 간다
  if (b && b !== cur && cur.parentElement.classList.contains('dpad') && b.parentElement.classList.contains('dpad')) padSet(e.pointerId, b);
});
for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, (e) => padSet(e.pointerId, null));
pad.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-ui]');
  if (!t) return;
  unlock();
  const a = t.dataset.ui;
  if (a === 'next') return void nextDialog();
  sfx('click');
  if (a === 'close') closeWin();
  else if (a === 'skills') (winKind === 'skills' ? closeWin : skillsWin)();
  else if (a === 'menu') (winKind === 'menu' ? closeWin : menuWin)();
  else if (a === 'buy') buy(t.dataset.id, 1);
  else if (a === 'buy5') buy(t.dataset.id, 5);
  else if (a === 'skillup') {
    const p = game.p, id = t.dataset.id;
    if (p.sp > 0 && p.skills[id] && p.skills[id] < SKILLS[id].max) { p.sp -= 1; p.skills[id] += 1; game.save(); sfx('quest'); }
    skillsWin();
    updateHud(true);
  } else if (a === 'mute') { setMuted(!isMuted()); menuWin(); }
  else if (a === 'reset') {
    if (!resetArmed) { resetArmed = setTimeout(() => { resetArmed = 0; if (winKind === 'menu') menuWin(); }, 4000); menuWin(); }
    else { clearTimeout(resetArmed); resetArmed = 0; game.reset(); closeWin(); game.enter('village'); updateHud(true); toast('처음부터 다시 시작해요'); }
  } else if (a === 'new') start(false);
  else if (a === 'continue') start(true);
});

// ---------- 시작 화면 ----------
const touchy = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
document.body.classList.toggle('touch', touchy); // 처음부터 정해 둔다: 첫 터치에 배치가 바뀌면 누른 버튼이 빗나간다
function titleScreen() {
  const has = Game.hasSave();
  $('#title').innerHTML = `<div class="tbox"><h1><span>빛나리</span> 용사전</h1><p>털보 대왕의 털을 전부 밀어 버려라!</p>
    <div class="btns">${has ? '<button type="button" class="pb go" data-ui="continue">이어하기</button>' : ''}<button type="button" class="pb ${has ? '' : 'go'}" data-ui="new">${has ? '처음부터' : '시작하기'}</button></div>
    <small>${touchy ? '화면 아래 버튼으로 조작해요. 가로로 돌리면 더 크게 보여요.' : '← → 이동 · Space 점프 · X 공격 · A S D F 스킬 · 1 2 물약'}</small></div>`;
}
function start(cont) {
  if (started) return;
  started = true;
  unlock();
  if (cont) game.load();
  else game.reset();
  game.live = true;
  $('#title').hidden = true;
  $('#hud').hidden = false;
  pad.hidden = false;
  game.enter(game.p.map);
  updateHud(true);
  if (!cont) setTimeout(() => toast('민둥 촌장에게 가서 ▲(위)로 말을 걸어 보세요'), 600);
}

// ---------- 루프 ----------
game.enter('village');
game.paused = true;
titleScreen();
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.034, (now - last) / 1000);
  last = now;
  if (started) {
    if (!winKind) game.paused = false;
    game.update(dt);
    updateHud(false);
  } else {
    // 시작 화면 뒤로 마을이 살아 움직인다
    game.time += dt;
    if (game.weather) for (const w of game.weather) w.update(dt);
    game.fade = 0;
    game.p.anim += dt;
  }
  game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
