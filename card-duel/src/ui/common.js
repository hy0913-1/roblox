import { CARDS, FACTIONS, KEYWORDS } from '../cards.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const facColor = (fac) => (FACTIONS[fac] ? FACTIONS[fac].color : '#888');

// 카드 종류별 작은 아이콘 (짧은 SVG)
const ICON = {
  unit: '<path d="M12 3l2.5 5 5.5.8-4 3.9 1 5.5L12 15.6 7 18.2l1-5.5-4-3.9 5.5-.8z"/>',
  spell: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
};
export function icon(kind, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[kind] || ''}</svg>`;
}

export function kwText(id) {
  const c = CARDS[id];
  return (c.kw || []).map((k) => KEYWORDS[k].name).join(' · ');
}

export function cardRules(id) {
  const c = CARDS[id];
  const parts = [];
  const kws = kwText(id);
  if (kws) parts.push(kws);
  if (c.text) parts.push(c.text);
  return parts.join('. ');
}

// 손패/덱 편집용 카드
export function cardHtml(id, opts = {}) {
  if (id === '?') return `<div class="card back" aria-label="숨겨진 카드"></div>`;
  const c = CARDS[id];
  const cls = ['card', `fac-${c.fac}`, `t-${c.type}`, opts.playable ? 'playable' : '', opts.selected ? 'selected' : '', c.leg ? 'leg' : '', opts.cls || ''].join(' ');
  const stats = c.type === 'unit' ? `<span class="st atk">${c.atk}</span><span class="st hp">${c.hp}</span>` : `<span class="st spell">${icon('spell')}</span>`;
  const attrs = opts.attrs || '';
  return `<button type="button" class="${cls}" style="--fc:${facColor(c.fac)}" ${attrs} aria-label="${esc(`${c.name}, 비용 ${c.cost}, ${c.type === 'unit' ? `${c.atk}/${c.hp}` : '주문'}. ${cardRules(id)}`)}">
    <span class="cost">${c.cost}</span>
    <span class="nm">${esc(c.name)}</span>
    <span class="tx">${esc(cardRules(id))}</span>
    ${stats}
    ${opts.badge ? `<span class="badge">${esc(opts.badge)}</span>` : ''}
  </button>`;
}

// 전장 유닛
export function unitHtml(u, opts = {}) {
  const c = CARDS[u.id];
  const k = u.kw;
  const cls = [
    'unit',
    `fac-${c.fac}`,
    k.taunt ? 'taunt' : '',
    k.shield ? 'shield' : '',
    k.stealth ? 'stealth' : '',
    k.poison ? 'poison' : '',
    u.frozen || u.frz ? 'frozen' : '',
    u.sil ? 'silenced' : '',
    opts.canAttack ? 'can-attack' : '',
    opts.selected ? 'selected' : '',
    opts.target ? 'target' : '',
    opts.ally ? 'ally' : '',
  ].join(' ');
  const flags = [k.charge ? '돌' : '', k.lifesteal ? '흡' : '', k.windfury ? '질' : '', k.poison ? '독' : '', u.sd ? `주+${u.sd}` : '', !u.sil && (c.death || c.onAnyDeath || c.onSpell) ? '◆' : '']
    .filter(Boolean)
    .map((f) => `<i>${f}</i>`)
    .join('');
  const hurt = u.hp < u.max ? 'hurt' : u.hp > CARDS[u.id].hp ? 'up' : '';
  const atkUp = u.atk > c.atk ? 'up' : '';
  return `<button type="button" class="${cls}" data-ref="u${u.uid}" style="--fc:${facColor(c.fac)}" aria-label="${esc(`${c.name} ${u.atk}/${u.hp}. ${cardRules(u.id)}`)}">
    <span class="un">${esc(c.name)}</span>
    <span class="fl">${flags}</span>
    <span class="st atk ${atkUp}">${u.atk}</span><span class="st hp ${hurt}">${u.hp}</span>
    ${opts.owner ? `<span class="own">${esc(opts.owner)}</span>` : ''}
  </button>`;
}

export function avatarHtml(p, size = 28) {
  const url = p && p.avatarUrl;
  const name = (p && p.name) || '?';
  if (url) return `<img class="av" src="${esc(url)}" width="${size}" height="${size}" alt="">`;
  return `<span class="av ph" style="width:${size}px;height:${size}px">${esc(name.slice(0, 1))}</span>`;
}

export function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

let toastTimer = null;
export function toast(msg, kind = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = '';
  }, 2600);
}

// 간단한 모달: buttons [{label, value, primary}] → Promise<value>
export function modal(title, bodyHtml, buttons) {
  const el = document.getElementById('modal');
  el.innerHTML = `<div class="mbox" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <h3>${esc(title)}</h3><div class="mbody">${bodyHtml}</div>
    <div class="mbtns">${buttons.map((b, i) => `<button type="button" class="btn ${b.primary ? 'primary' : ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
  el.hidden = false;
  return new Promise((resolve) => {
    const onClick = (e) => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      el.hidden = true;
      el.innerHTML = '';
      el.removeEventListener('click', onClick);
      resolve(buttons[Number(b.dataset.i)].value);
    };
    el.addEventListener('click', onClick);
    const first = el.querySelector('button.primary') || el.querySelector('button');
    if (first) first.focus();
  });
}

export function closeModal() {
  const el = document.getElementById('modal');
  if (el && !el.hidden) {
    el.hidden = true;
    el.innerHTML = '';
  }
}
