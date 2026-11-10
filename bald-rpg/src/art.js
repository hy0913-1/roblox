// 직접 그린 작은 도트 그림들(전투기, 폭탄, 3톤 추, 동전, 털 뭉치, 스킬 아이콘)과 구워 둘 pixelfx 그림 목록.
import { hex } from '../vendor/pixelfx/core/index.js';
import * as torch from '../vendor/pixelfx/fx/fire/torch.js';
import * as portal from '../vendor/pixelfx/fx/arcane/portal.js';
import * as potion from '../vendor/pixelfx/fx/pickups/potion.js';
import * as coin from '../vendor/pixelfx/fx/pickups/coin-spin.js';
import * as stunned from '../vendor/pixelfx/fx/status/stunned.js';
import * as laser from '../vendor/pixelfx/fx/projectiles/laser-bolt.js';
import * as sun from '../vendor/pixelfx/fx/holy/sunburst.js';
import { bake } from './sprites.js';
import { MOBS } from './mobs-data.js';

const pal = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, hex(v) >>> 0]));

export const JET = {
  rows: [
    '..........kk..................',
    '.........kddk.................',
    '........kdllk.................',
    'kk.....kdlllk.................',
    'kdkk..kdlllllkkkkkkkkk........',
    'kdldkkdllllllllllllccckkk.....',
    'kdllllllllllllllllccwwcllkkk..',
    '.kdddddddlllllllllllllllllldkk',
    '..kkkkkddddddddllllllldddddkk.',
    '......kkkkkkkddddddkkkkkkk....',
    '...........kdddk..............',
    '............kkk...............',
  ],
  pal: pal({ k: '#141a26', d: '#5a6a80', l: '#a8b8c8', c: '#3a78c8', w: '#d8f4ff' }),
};
export const BOMB = {
  rows: ['.kkk.', 'kfffk', '.kfk.', '.kdk.', 'kdddk', 'kdldk', 'kdldk', 'kdddk', '.kdk.', '..k..'],
  pal: pal({ k: '#141a26', d: '#3c4654', l: '#8898a8', f: '#e04a3a' }),
};
export const WEIGHT = {
  rows: [
    '........kkkkkk........',
    '.......kd....dk.......',
    '.......kd....dk.......',
    '....kkkkkkkkkkkkkk....',
    '...klllllllllllllldk..',
    '...klddddddddddddddk..',
    '..klddwwwdddwwwwwdddk.',
    '..klddddwddddwdddddddk',
    '.klddddwwddddwddddddk.',
    '.kldddddwddddwdddddddk',
    'klddddwwwdddddwwdddddk',
    'kldddddddddddddddddddk',
    'kdddddddddddddddddddsk',
    'kkkkkkkkkkkkkkkkkkkkkk',
  ],
  pal: pal({ k: '#0e0c14', d: '#3a3a48', l: '#6a6a7c', s: '#22222c', w: '#ffe07a' }),
};
export const COIN = { rows: ['.kkkk.', 'kywyyk', 'kwyyok', 'kyyyok', 'kyyook', '.kkkk.'], pal: pal({ k: '#5a3a08', y: '#ffd23f', w: '#fff6c2', o: '#d89a18' }) };
const POT = ['..kkkk..', '..kbbk..', '...kk...', '..kwwk..', '.kwrrwk.', 'kwrrrrwk', 'kwrwrrrk', 'kwrrrrrk', '.krrrrk.', '..kkkk..'];
export const POT_HP = { rows: POT, pal: pal({ k: '#1b1226', b: '#a8744a', w: '#ffe8ee', r: '#ff4d6d' }) };
export const POT_MP = { rows: POT, pal: pal({ k: '#1b1226', b: '#a8744a', w: '#e8f0ff', r: '#4d8aff' }) };
// 도는 동전 4장
const CK = pal({ k: '#5a3a08', y: '#ffd23f', w: '#fff6c2', o: '#d89a18' });
export const COINS = [
  ['..kkkk..', '.kywyyk.', 'kywyyyok', 'kyyyyyok', 'kyyyyook', 'kyyyoook', '.kyoook.', '..kkkk..'],
  ['...kk...', '..kywk..', '.kywyok.', '.kyyyok.', '.kyyyok.', '.kyyook.', '..kyok..', '...kk...'],
  ['...kk...', '...kwk..', '...kyk..', '...kyk..', '...kyk..', '...kyk..', '...kok..', '...kk...'],
  ['...kk...', '..kwyk..', '.kwyyok.', '.kyyyok.', '.kyyyok.', '.kyyook.', '..kyok..', '...kk...'],
].map((rows) => ({ rows, pal: CK }));
export const HAIR = { rows: ['..k.k...', '.kbkbk.k', 'kbcbbkkb', 'kcbbcbbk', '.kbcbbk.', '..kkkk..'], pal: pal({ k: '#2a180c', b: '#8a5a2c', c: '#c08a48' }) };

// 스킬 아이콘 16x16 (UI용)
export const ICONS = {
  beam: { rows: ['................', '.....kkkkk......', '....kssssskwwwww', '...kswssssskyyyy', '...kssssssskwwww', '...kssskssskyyyy', '...ksssssssk....', '....kssssskwwwww', '.....kkskk......', '....krrrrrk.....', '...krrrrrrrk....', '...krrrrrrrk....', '...krrrrrrrk....', '....kkkkkkk.....', '................', '................'], pal: pal({ k: '#1b1226', s: '#f6c49c', w: '#fffbe0', y: '#ffd23f', r: '#e23d44' }) },
  slam: { rows: ['......kkkk......', '.....kd..dk.....', '...kkkkkkkkkk...', '..kllllllllldk..', '..klddddddddk...', '.klddwwddwwwdk..', '.kldddwdddwddk..', '.klddwwdddwddk..', '.kldddwdddwddk..', '.klddwwddddwdk..', '.kddddddddddsk..', '.kkkkkkkkkkkkk..', '...y...y...y....', '..y.y.y.y.y.y...', '................', '................'], pal: pal({ k: '#0e0c14', d: '#3a3a48', l: '#6a6a7c', s: '#22222c', w: '#ffe07a', y: '#c9bfb8' }) },
  quake: { rows: ['................', '..y..........y..', '.y..kkkkkkkk..y.', 'y..kwwwwwwwwk..y', '.y.kwyyyyyywk.y.', '..ykwyoooywkky..', '.y.kwyowoywk.y..', 'y..kwyoooywk..y.', '.y.kwyyyyyywk.y.', '..ykwwwwwwwwky..', '.y..kkkkkkkk..y.', 'y..y...y...y...y', '..y...y.y...y...', '.y..y.....y..y..', '................', '................'], pal: pal({ k: '#3a2408', w: '#fff6c2', y: '#ffd23f', o: '#ff8a2a' }) },
  air: { rows: ['................', '..........kk....', '.........kllk...', 'kk......kllllk..', 'kdkkkkkkllllcckk', 'kdllllllllllcwlk', '.kdddddlllllllk.', '..kkkkkdddddkk..', '.......kkkkk....', '....kk....kk....', '...kfk...kfk....', '...kdk...kdk....', '...kdk...kdk....', '....k.....k.....', '................', '................'], pal: pal({ k: '#141a26', d: '#5a6a80', l: '#a8b8c8', c: '#3a78c8', w: '#d8f4ff', f: '#e04a3a' }) },
  punch: { rows: ['................', '................', '....kkkkkkk.....', '...ksssssssk....', '..kswsksksksk...', '..kssskskskssk..', '..kssssssssssk..', '..kssssssssssk..', '...kssssssssk...', '....kkkssskk....', '......krrrk.....', '......krrrk.....', '......kkkkk.....', '................', '................', '................'], pal: pal({ k: '#1b1226', s: '#f6c49c', w: '#fff2e0', r: '#e23d44' }) },
  hp: { rows: ['................', '.....kkkkkk.....', '.....kbbbbk.....', '......kwwk......', '......kwwk......', '.....kwwwwk.....', '....kwrrrrwk....', '...kwrrrrrrwk...', '...kwrwrrrrwk...', '...kwrwrrrrwk...', '...kwrrrrrrwk...', '....kwrrrrwk....', '.....kkkkkk.....', '................', '................', '................'], pal: pal({ k: '#1b1226', b: '#a8744a', w: '#e8f4ff', r: '#ff4d6d' }) },
  mp: { rows: ['................', '.....kkkkkk.....', '.....kbbbbk.....', '......kwwk......', '......kwwk......', '.....kwwwwk.....', '....kwrrrrwk....', '...kwrrrrrrwk...', '...kwrwrrrrwk...', '...kwrwrrrrwk...', '...kwrrrrrrwk...', '....kwrrrrwk....', '.....kkkkkk.....', '................', '................', '................'], pal: pal({ k: '#1b1226', b: '#a8744a', w: '#e8f4ff', r: '#4d8aff' }) },
  jump: { rows: ['................', '.......kk.......', '......kwwk......', '.....kwwwwk.....', '....kwwwwwwk....', '...kwwwwwwwwk...', '..kkkkwwwwkkkk..', '.....kwwwwk.....', '.....kwwwwk.....', '.....kwwwwk.....', '.....kkkkkk.....', '................', '....kkkkkkkk....', '....kyyyyyyk....', '....kkkkkkkk....', '................'], pal: pal({ k: '#1b1226', w: '#f4efff', y: '#ffd23f' }) },
};

export function iconURL(name, scale = 3) {
  const ic = ICONS[name], cv = document.createElement('canvas');
  cv.width = 16 * scale; cv.height = 16 * scale;
  const ctx = cv.getContext('2d');
  ic.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    const c = ic.pal[ch];
    ctx.fillStyle = `rgb(${c & 255},${(c >>> 8) & 255},${(c >>> 16) & 255})`;
    ctx.fillRect(x * scale, y * scale, scale, scale);
  }));
  return cv.toDataURL();
}

/** 직접 그린 그림을 프레임에 찍는다(왼쪽 위 기준). */
export function stamp(frame, spr, x, y, flip = false) {
  const X = Math.round(x) - frame.ox, Y = Math.round(y) - frame.oy, w = spr.rows[0].length;
  for (let r = 0; r < spr.rows.length; r++) {
    const py = Y + r;
    if (py < 0 || py >= frame.h) continue;
    const row = spr.rows[r];
    for (let q = 0; q < w; q++) {
      const ch = row[flip ? w - 1 - q : q];
      if (ch === '.') continue;
      const px = X + q;
      if (px >= 0 && px < frame.w) frame.color[py * frame.w + px] = spr.pal[ch];
    }
  }
}

// 처음에 한 번 굽는 그림들
export function bakeAll() {
  const S = { mobs: {} };
  for (const [k, m] of Object.entries(MOBS)) S.mobs[k] = bake(m.mod, m.opts, 14);
  // 털이 다 밀린 대왕(체력 절반 이하)
  S.kingBald = bake(MOBS.king.mod, { palette: ['#5a2a3a', '#9a5a5a', '#d08a78', '#f0b89a', '#ffd8c0', '#fff0e4', '#ffffff'], hop: 10, seed: 9 }, 14);
  S.torch = bake(torch, {}, 12);
  S.portal = bake(portal, {}, 12);
  S.portalBoss = bake(portal, { palette: ['#1a0408', '#4a0c18', '#8a1828', '#d0303a', '#ff6a4a', '#ffb078', '#ffe8c0', '#ffffff'] }, 12);
  S.hp = bake(potion, { palette: ['#3a0a14', '#7a1428', '#c0283c', '#ff4d6d', '#ff8a9c', '#ffc2cf', '#ffe8ee', '#ffffff'] }, 10);
  S.mp = bake(potion, { palette: ['#0a143a', '#14287a', '#2848c0', '#4d8aff', '#8ab4ff', '#c2d8ff', '#e8f0ff', '#ffffff'] }, 10);
  S.coin = bake(coin, {}, 14);
  S.stun = bake(stunned, { actor: { mask: { w: 1, h: 1, data: new Uint8Array(1) }, pixels: new Uint32Array(1), x: 0, y: -1, w: 1, h: 1, k: 2, head: [0, -38], chest: [0, -26] } }, 14);
  S.laser = bake(laser, { length: 18 }, 16);
  S.sun = bake(sun, { rays: 8 }, 10);
  return S;
}
