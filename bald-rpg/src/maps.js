// 맵: 타일(16px) 배치와, 코드로 그리는 도트 배경·지형.
import { hex, mix, rand, fbm, noise } from '../vendor/pixelfx/core/index.js';

export const T = 16;
export const SW = 384;
export const SH = 216;

const H = (s) => hex(s) >>> 0;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// ---------- 맵 짓기 ----------
function grid(w, h) {
  const g = { w, h, t: new Uint8Array(w * h) }; // 0 빈칸 1 땅 2 발판 3 사다리
  g.ground = (x0, x1, row) => {
    for (let x = x0; x <= x1; x++) for (let y = row; y < h; y++) g.t[y * w + x] = 1;
    return g;
  };
  g.block = (x0, x1, y0, y1) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) g.t[y * w + x] = 1;
    return g;
  };
  g.plat = (x0, x1, row) => {
    for (let x = x0; x <= x1; x++) if (!g.t[row * w + x]) g.t[row * w + x] = 2;
    return g;
  };
  g.ladder = (x, y0, y1) => {
    for (let y = y0; y <= y1; y++) if (g.t[y * w + x] !== 1) g.t[y * w + x] = g.t[y * w + x] === 2 ? 4 : 3; // 4: 발판+사다리
    return g;
  };
  return g;
}

const THEMES = {
  village: {
    sky: ['#3f8fe0', '#58a6ea', '#79bdf0', '#a2d4f5', '#cfeafa', '#f4f6e6'],
    far: ['#8fc7a6', '#74b58f'], mid: ['#5fa86f', '#4b9560'],
    grass: ['#9be060', '#6fc644', '#4ea836', '#3a8a30'], dirt: ['#b0774a', '#94603c', '#7a4c32', '#5f3a28'],
    plat: ['#e0b070', '#b98548', '#8a5e32', '#5f3f24'], clouds: true, sun: true,
  },
  meadow: {
    sky: ['#2f7fd8', '#4a98e6', '#6db3ee', '#98cdf4', '#c6e6f8', '#eef6e0'],
    far: ['#86c0b0', '#6aae9c'], mid: ['#58a060', '#44904f'],
    grass: ['#a6e85c', '#74cc42', '#52ae34', '#3c8e2e'], dirt: ['#a8704a', '#8c5a3c', '#724732', '#583628'],
    plat: ['#d8b070', '#b08448', '#825a30', '#5a3c22'], clouds: true, sun: true,
  },
  cave: {
    sky: ['#0d0a1c', '#120e26', '#171230', '#1c163a', '#211a44', '#261e4e'],
    far: ['#2a2258', '#221b48'], mid: ['#352a6a', '#2a2156'],
    grass: ['#7d8bd8', '#5a67b8', '#434c94', '#323872'], dirt: ['#4a4284', '#3a3368', '#2c2750', '#201c3c'],
    plat: ['#8a80c8', '#6a60a8', '#4c4482', '#342e5e'], cave: true,
  },
  ruins: {
    sky: ['#2a1640', '#4a1f58', '#7a2c68', '#b04468', '#e07860', '#ffc078'],
    far: ['#6a3a78', '#562e68'], mid: ['#48285a', '#3a204c'],
    grass: ['#d8c088', '#b89a62', '#927648', '#6e5636'], dirt: ['#7a6a6a', '#625458', '#4c4048', '#382e38'],
    plat: ['#c8b8b0', '#a09088', '#786a68', '#54484c'], ruins: true,
  },
  throne: {
    sky: ['#0c0616', '#12081f', '#190b2a', '#200e36', '#281142', '#30144e'],
    far: ['#2a1248', '#22103a'], mid: ['#3a1860', '#2c124a'],
    grass: ['#c090e8', '#9a62c8', '#743f9e', '#522a76'], dirt: ['#3c2458', '#301c48', '#241438', '#1a0e2a'],
    plat: ['#b890d8', '#9068b8', '#684890', '#463068'], hall: true,
  },
};

// ---------- 맵 목록 ----------
function mVillage() {
  const g = grid(52, 15).ground(0, 51, 12);
  g.block(0, 0, 0, 11);
  g.plat(26, 31, 9).plat(33, 37, 6).ladder(31, 9, 11);
  return {
    id: 'village', name: '빛나리 마을', theme: 'village', g, safe: true, weather: 'blossom', bgm: 'town',
    start: [6, 12],
    portals: [{ x: 48, y: 12, to: 'meadow', tx: 3, ty: 15, label: '솜털 초원' }],
    npcs: [{ id: 'elder', x: 12, y: 12, name: '민둥 촌장' }, { id: 'shop', x: 21, y: 12, name: '광택 상인' }, { id: 'guide', x: 35, y: 6, name: '수련생 반짝이' }],
    houses: [{ x: 7, w: 6, kind: 0 }, { x: 16, w: 7, kind: 1 }, { x: 40, w: 5, kind: 2 }],
    spawns: [],
  };
}

function mMeadow() {
  const g = grid(112, 18).ground(0, 111, 15);
  g.block(0, 0, 0, 14).block(111, 111, 0, 14);
  g.ground(18, 30, 14).ground(22, 28, 13).ground(52, 70, 14).ground(86, 100, 13).ground(90, 96, 12);
  g.plat(8, 16, 11).plat(32, 44, 11).plat(36, 42, 7).plat(46, 50, 9).plat(58, 68, 10).plat(72, 84, 11).plat(76, 82, 7).plat(100, 108, 9);
  g.ladder(16, 11, 14).ladder(44, 11, 14).ladder(42, 7, 10).ladder(72, 11, 14).ladder(82, 7, 10).ladder(108, 9, 14);
  return {
    id: 'meadow', name: '솜털 초원', theme: 'meadow', g, weather: 'none', bgm: 'field',
    start: [3, 15],
    portals: [{ x: 2, y: 15, to: 'village', tx: 46, ty: 12, label: '빛나리 마을' }, { x: 109, y: 15, to: 'cave', tx: 3, ty: 17, label: '덥수룩 동굴' }],
    npcs: [],
    spawns: [
      { type: 'fluff', x0: 6, x1: 17, row: 15, n: 3 }, { type: 'fluff', x0: 8, x1: 16, row: 11, n: 2 }, { type: 'fluff', x0: 22, x1: 28, row: 13, n: 2 },
      { type: 'fluff', x0: 32, x1: 44, row: 11, n: 3 }, { type: 'mint', x0: 36, x1: 42, row: 7, n: 2 }, { type: 'mint', x0: 52, x1: 70, row: 14, n: 4 },
      { type: 'frog', x0: 58, x1: 68, row: 10, n: 2 }, { type: 'frog', x0: 72, x1: 84, row: 11, n: 3 }, { type: 'mint', x0: 76, x1: 82, row: 7, n: 2 },
      { type: 'snake', x0: 86, x1: 100, row: 13, n: 3 }, { type: 'snake', x0: 100, x1: 108, row: 9, n: 2 }, { type: 'frog', x0: 101, x1: 108, row: 15, n: 2 },
    ],
  };
}

function mCave() {
  const g = grid(104, 20).ground(0, 103, 17);
  g.block(0, 103, 0, 1).block(0, 0, 0, 16).block(103, 103, 0, 16);
  g.ground(14, 24, 16).ground(40, 52, 16).ground(44, 48, 15).ground(70, 80, 15).ground(88, 96, 16);
  g.plat(6, 12, 13).plat(16, 26, 12).plat(20, 24, 8).plat(30, 38, 13).plat(32, 36, 9).plat(54, 66, 12).plat(58, 64, 8).plat(68, 72, 10).plat(82, 92, 11).plat(86, 90, 7).plat(94, 100, 13);
  g.ladder(12, 13, 16).ladder(26, 12, 15).ladder(24, 8, 11).ladder(38, 13, 16).ladder(36, 9, 12).ladder(54, 12, 16).ladder(64, 8, 11).ladder(82, 11, 14).ladder(90, 7, 10);
  return {
    id: 'cave', name: '덥수룩 동굴', theme: 'cave', g, weather: 'fireflies', bgm: 'cave',
    start: [3, 17],
    portals: [{ x: 2, y: 17, to: 'meadow', tx: 107, ty: 15, label: '솜털 초원' }, { x: 101, y: 17, to: 'ruins', tx: 3, ty: 17, label: '가발 폐허' }],
    npcs: [],
    torches: [[10, 16], [28, 16], [46, 14], [60, 16], [75, 14], [98, 16], [22, 7], [60, 7], [88, 6]],
    spawns: [
      { type: 'snake', x0: 5, x1: 13, row: 17, n: 2 }, { type: 'bat', x0: 6, x1: 26, row: 11, n: 4 }, { type: 'snake', x0: 14, x1: 24, row: 16, n: 2 },
      { type: 'bat', x0: 28, x1: 40, row: 8, n: 3 }, { type: 'ghost', x0: 30, x1: 52, row: 14, n: 4 }, { type: 'bat', x0: 54, x1: 66, row: 7, n: 3 },
      { type: 'ghost', x0: 54, x1: 68, row: 11, n: 3 }, { type: 'wisp', x0: 68, x1: 84, row: 13, n: 4 }, { type: 'ghost', x0: 82, x1: 100, row: 10, n: 3 },
      { type: 'wisp', x0: 86, x1: 100, row: 15, n: 3 },
    ],
  };
}

function mRuins() {
  const g = grid(112, 20).ground(0, 111, 17);
  g.block(0, 0, 0, 16).block(111, 111, 0, 16);
  g.ground(10, 18, 16).ground(30, 46, 16).ground(34, 42, 15).ground(60, 66, 16).ground(78, 94, 16).ground(84, 90, 15);
  g.plat(4, 8, 13).plat(12, 22, 12).plat(16, 20, 8).plat(24, 28, 10).plat(48, 58, 13).plat(50, 56, 9).plat(60, 70, 11).plat(64, 68, 7).plat(72, 76, 13).plat(96, 106, 13).plat(98, 104, 9);
  g.ladder(8, 13, 16).ladder(22, 12, 15).ladder(20, 8, 11).ladder(48, 13, 16).ladder(56, 9, 12).ladder(70, 11, 16).ladder(68, 7, 10).ladder(96, 13, 16).ladder(104, 9, 12);
  return {
    id: 'ruins', name: '가발 폐허', theme: 'ruins', g, weather: 'leaves', bgm: 'ruins',
    start: [3, 17],
    portals: [{ x: 2, y: 17, to: 'cave', tx: 99, ty: 17, label: '덥수룩 동굴' }, { x: 109, y: 17, to: 'throne', tx: 4, ty: 11, label: '털보의 옥좌', boss: true }],
    npcs: [],
    spawns: [
      { type: 'wisp', x0: 4, x1: 22, row: 14, n: 3 }, { type: 'skull', x0: 10, x1: 28, row: 12, n: 3 }, { type: 'skull', x0: 30, x1: 46, row: 15, n: 4 },
      { type: 'eye', x0: 34, x1: 58, row: 11, n: 3 }, { type: 'skull', x0: 48, x1: 70, row: 9, n: 3 }, { type: 'eye', x0: 60, x1: 76, row: 13, n: 3 },
      { type: 'skull', x0: 78, x1: 94, row: 14, n: 4 }, { type: 'eye', x0: 84, x1: 106, row: 10, n: 4 }, { type: 'ghost', x0: 96, x1: 108, row: 16, n: 2 },
    ],
  };
}

function mThrone() {
  const g = grid(44, 14).ground(0, 43, 11);
  g.block(0, 0, 0, 10).block(43, 43, 0, 10).block(0, 43, 0, 0);
  g.plat(6, 11, 8).plat(32, 37, 8).plat(18, 25, 6).ladder(11, 8, 10).ladder(32, 8, 10);
  return {
    id: 'throne', name: '털보의 옥좌', theme: 'throne', g, weather: 'none', bgm: 'boss',
    start: [4, 11],
    portals: [{ x: 2, y: 11, to: 'ruins', tx: 107, ty: 17, label: '가발 폐허' }],
    npcs: [],
    torches: [[8, 10], [16, 10], [27, 10], [35, 10], [21, 5]],
    spawns: [{ type: 'king', x0: 26, x1: 30, row: 11, n: 1, boss: true }],
  };
}

export const MAP_ORDER = ['village', 'meadow', 'cave', 'ruins', 'throne'];
const BUILDERS = { village: mVillage, meadow: mMeadow, cave: mCave, ruins: mRuins, throne: mThrone };

// ---------- 그림 ----------
class Buf {
  constructor(w, h) {
    this.w = w; this.h = h; this.d = new Uint32Array(w * h);
  }
  px(x, y, c) {
    x |= 0; y |= 0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  }
  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0;
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  // 외곽선 있는 상자: 위·왼쪽 밝게, 아래·오른쪽 어둡게
  box(x, y, w, h, r, ink) {
    this.rect(x, y, w, h, r[1]);
    this.rect(x, y, w, 1, r[0]);
    this.rect(x, y, 1, h, r[0]);
    this.rect(x, y + h - 1, w, 1, r[2]);
    this.rect(x + w - 1, y, 1, h, r[2]);
    if (ink) {
      this.rect(x - 1, y - 1, w + 2, 1, ink); this.rect(x - 1, y + h, w + 2, 1, ink);
      this.rect(x - 1, y, 1, h, ink); this.rect(x + w, y, 1, h, ink);
    }
  }
}

const INK = H('#1b1226');

function drawTiles(m, th) {
  const { g } = m, W = g.w * T, Hh = g.h * T, b = new Buf(W, Hh);
  const G = th.grass.map(H), D = th.dirt.map(H), P = th.plat.map(H);
  const at = (x, y) => (x < 0 || x >= g.w ? 1 : y < 0 ? 0 : y >= g.h ? 1 : g.t[y * g.w + x]);
  const solid = (x, y) => at(x, y) === 1;
  // 장식(땅 뒤): 폐허 기둥, 동굴 수정, 마을 집
  decorBack(m, th, b);
  for (let ty = 0; ty < g.h; ty++)
    for (let tx = 0; tx < g.w; tx++) {
      const k = g.t[ty * g.w + tx], X = tx * T, Y = ty * T;
      if (k === 1) {
        const top = !solid(tx, ty - 1), left = !solid(tx - 1, ty), right = !solid(tx + 1, ty), bottom = !solid(tx, ty + 1);
        let depth = 0;
        while (depth < 6 && solid(tx, ty - 1 - depth)) depth++;
        for (let y = 0; y < T; y++)
          for (let x = 0; x < T; x++) {
            const wx = X + x, wy = Y + y, n = fbm(wx / 9, wy / 9, 31, 2), r = rand(wx, wy, 5);
            let c = D[Math.min(3, (depth > 1 ? 2 : depth) + (n > 0.56 ? 0 : 1))];
            if (depth === 0 && y < 12) c = D[n > 0.5 ? 0 : 1];
            // 돌멩이·결
            if (r > 0.975) c = D[0];
            else if (r < 0.03) c = D[3];
            if (((wy + ((wx / 16) | 0) * 5) % 8 === 7) && r > 0.35 && depth > 0) c = D[3];
            b.px(wx, wy, c);
          }
        if (top) {
          // 풀 덮개: 위는 밝고, 아래로 들쭉날쭉 흘러내린다
          for (let x = 0; x < T; x++) {
            const wx = X + x, drip = 3 + Math.floor(noise(wx / 3.1, 9) * 3.2) + (rand(wx, 3) > 0.8 ? 1 : 0);
            for (let y = 0; y < drip; y++) b.px(wx, Y + y, y === 0 ? G[0] : y < 2 ? G[1] : y < drip - 1 ? G[2] : G[3]);
            b.px(wx, Y - 1, th.cave || th.hall ? 0 : rand(wx, 77) > 0.72 ? G[1] : 0);
            if (!(th.cave || th.hall) && rand(wx, 78) > 0.9) { b.px(wx, Y - 2, G[0]); b.px(wx, Y - 1, G[1]); }
          }
          b.rect(X, Y - 0, T, 0, INK);
        }
        if (left) for (let y = top ? 1 : 0; y < T; y++) b.px(X, Y + y, D[3]);
        if (right) for (let y = top ? 1 : 0; y < T; y++) b.px(X + T - 1, Y + y, D[3]);
        if (bottom) b.rect(X, Y + T - 1, T, 1, D[3]);
      } else if (k === 3 || k === 4) {
        // 밧줄 사다리
        for (let y = 0; y < T; y++) {
          b.px(X + 4, Y + y, y % 4 === 0 ? P[2] : P[1]);
          b.px(X + 11, Y + y, y % 4 === 0 ? P[2] : P[1]);
          b.px(X + 3, Y + y, INK); b.px(X + 12, Y + y, INK);
        }
        for (const y of [3, 9, 15]) { b.rect(X + 4, Y + y, 8, 1, P[0]); b.rect(X + 4, Y + y + 1, 8, 1, P[2]); }
      }
      if (k === 2 || k === 4) {
        const l = at(tx - 1, ty), r = at(tx + 1, ty), L = l !== 2 && l !== 4, R = r !== 2 && r !== 4;
        // 발판: 두꺼운 널/석판 + 아래 그림자
        for (let x = 0; x < T; x++) {
          const wx = X + x, seam = wx % 13 === 0;
          b.px(wx, Y, INK);
          b.px(wx, Y + 1, P[0]);
          b.px(wx, Y + 2, seam ? P[2] : P[1]);
          b.px(wx, Y + 3, seam ? P[2] : rand(wx, 4) > 0.8 ? P[2] : P[1]);
          b.px(wx, Y + 4, P[2]);
          b.px(wx, Y + 5, P[3]);
          b.px(wx, Y + 6, INK);
        }
        if (L) { b.rect(X, Y, 1, 7, INK); b.rect(X + 2, Y + 7, 2, 4, P[3]); b.px(X + 2, Y + 11, INK); b.px(X + 3, Y + 11, INK); }
        if (R) { b.rect(X + T - 1, Y, 1, 7, INK); b.rect(X + T - 4, Y + 7, 2, 4, P[3]); b.px(X + T - 4, Y + 11, INK); b.px(X + T - 3, Y + 11, INK); }
      }
    }
  // 땅 윗면에 잉크 선
  for (let ty = 0; ty < g.h; ty++)
    for (let tx = 0; tx < g.w; tx++)
      if (solid(tx, ty) && !solid(tx, ty - 1)) for (let x = 0; x < T; x++) if (!b.get(tx * T + x, ty * T - 1)) b.px(tx * T + x, ty * T - 1, 0);
  decorFront(m, th, b, solid);
  return b;
}

function surfaceRow(g, tx) {
  for (let y = 0; y < g.h; y++) if (g.t[y * g.w + tx] === 1) return y;
  return g.h;
}

function house(b, x, base, w, kind) {
  const wall = [['#fff0d8', '#f0d8b0', '#c8a880'], ['#e8f0ff', '#c8d8f0', '#98a8c8'], ['#ffe0e0', '#f0b8b8', '#c88888']][kind].map(H);
  const roof = [['#ff8a5a', '#e0563a', '#a8322a'], ['#6aa8f0', '#3f78d0', '#2a4f9a'], ['#b890e8', '#8a5cc8', '#5c3a94']][kind].map(H);
  const hgt = 34 + kind * 4, y = base - hgt;
  b.box(x, y, w, hgt, wall, INK);
  for (let j = 0; j < hgt; j += 6) for (let i = (j / 6) % 2 ? 0 : 5; i < w; i += 10) b.px(x + i, y + j + 3, wall[2]);
  // 지붕(계단식 삼각)
  const rh = 18;
  for (let j = 0; j < rh; j++) {
    const inset = Math.floor(((rh - 1 - j) * (w / 2 + 3)) / rh), x0 = x - 4 + inset, x1 = x + w + 4 - inset;
    for (let i = x0; i < x1; i++) b.px(i, y - rh + j, j % 5 === 4 ? roof[2] : (i + j) % 7 === 0 ? roof[0] : roof[1]);
    b.px(x0 - 1, y - rh + j, INK); b.px(x1, y - rh + j, INK);
  }
  b.rect(x - 5, y, w + 10, 1, INK);
  // 문과 창
  const dx = x + Math.floor(w / 2) - 5;
  b.box(dx, base - 18, 10, 18, ['#b07a48', '#8a5a32', '#5f3c22'].map(H), INK);
  b.px(dx + 7, base - 9, H('#ffe07a'));
  if (w > 70) {
    for (const wx of [x + 8, x + w - 20]) {
      b.box(wx, y + 10, 12, 10, ['#d8f4ff', '#9ad8f8', '#5aa0d0'].map(H), INK);
      b.rect(wx + 5, y + 10, 1, 10, INK); b.rect(wx, y + 14, 12, 1, INK);
    }
  }
}

function tree(b, x, base, s, leaf) {
  const tr = ['#a8744a', '#7a5032', '#543622'].map(H), L = leaf.map(H), hgt = 18 + s * 6;
  b.rect(x - 2, base - hgt, 4, hgt, tr[1]); b.rect(x - 2, base - hgt, 1, hgt, tr[0]); b.rect(x + 1, base - hgt, 1, hgt, tr[2]);
  b.rect(x - 3, base - hgt, 1, hgt, INK); b.rect(x + 2, base - hgt, 1, hgt, INK);
  const blobs = [[0, -hgt - 8, 13 + s * 2], [-9, -hgt - 1, 9 + s], [9, -hgt - 2, 9 + s], [0, -hgt + 2, 10 + s]];
  for (const [bx, by, r] of blobs)
    for (let j = -r - 1; j <= r + 1; j++)
      for (let i = -r - 1; i <= r + 1; i++) {
        const d = Math.hypot(i, j * 1.15);
        if (d > r + 1) continue;
        const px = x + bx + i, py = base + by + j;
        if (d > r) { if (!b.get(px, py)) b.px(px, py, INK); continue; }
        const lit = (-i - j * 1.4) / r + (rand(px, py, 8) - 0.5) * 0.7;
        b.px(px, py, lit > 0.75 ? L[0] : lit > 0.1 ? L[1] : lit > -0.6 ? L[2] : L[3]);
      }
}

function flower(b, x, base, c) {
  b.px(x, base - 1, H('#3a8a30')); b.px(x, base - 2, H('#3a8a30')); b.px(x, base - 3, c); b.px(x - 1, base - 4, c); b.px(x + 1, base - 4, c); b.px(x, base - 5, c); b.px(x, base - 4, H('#fff2a0'));
}

function decorBack(m, th, b) {
  const { g } = m;
  if (m.houses) for (const h of m.houses) house(b, h.x * T, surfaceRow(g, h.x) * T, h.w * T, h.kind);
  if (th.clouds) {
    for (let tx = 2; tx < g.w - 2; tx++) {
      const r = rand(tx, 91), base = surfaceRow(g, tx) * T;
      const blocked = (m.houses || []).some((h) => tx >= h.x - 1 && tx <= h.x + h.w + 1) || m.portals.some((p) => Math.abs(p.x - tx) < 3) || (m.npcs || []).some((n) => Math.abs(n.x - tx) < 2);
      if (blocked) continue;
      if (r > 0.86) tree(b, tx * T + 8, base, Math.floor(rand(tx, 92) * 3), m.theme === 'village' ? ['#ffd0e6', '#f79ac4', '#d86a9c', '#a8487a'] : ['#b6ec6a', '#7ccc48', '#4ea83a', '#347c34']);
    }
  }
  if (th.cave) {
    // 수정 기둥
    for (let tx = 3; tx < g.w - 3; tx++) {
      if (rand(tx, 51) < 0.82) continue;
      const base = surfaceRow(g, tx) * T, x = tx * T + 6, hgt = 10 + Math.floor(rand(tx, 52) * 16), C = ['#d8f8ff', '#8fe0f8', '#4aa8e0', '#2a68b0'].map(H);
      for (let j = 0; j < hgt; j++) {
        const w = Math.max(1, Math.round(4 * Math.min(1, (hgt - j) / 6)));
        for (let i = -w; i <= w; i++) b.px(x + i, base - 1 - j, i === -w ? C[0] : i < 0 ? C[1] : i === w ? C[3] : C[2]);
      }
    }
  }
  if (th.ruins || th.hall) {
    for (let tx = 4; tx < g.w - 4; tx += 1) {
      if (rand(tx, 61) < (th.hall ? 0.8 : 0.86)) continue;
      const base = surfaceRow(g, tx) * T, x = tx * T, hgt = th.hall ? 120 : 28 + Math.floor(rand(tx, 62) * 60), C = (th.hall ? ['#6a4a98', '#4c3278', '#34205a'] : ['#b8a8a8', '#8c7c80', '#62545c']).map(H);
      b.box(x + 2, base - hgt, 12, hgt, C, INK);
      for (let j = 4; j < hgt; j += 9) b.rect(x + 3, base - hgt + j, 10, 1, C[2]);
      b.box(x, base - hgt - 4, 16, 4, C, INK);
      b.box(x, base - 4, 16, 4, C, INK);
      if (!th.hall) for (let i = 0; i < 14; i++) if (rand(tx, i, 63) > 0.5) b.px(x + 2 + i, base - hgt - 5 - Math.floor(rand(tx, i, 64) * 3), 0);
    }
  }
}

function decorFront(m, th, b, solid) {
  const { g } = m;
  if (th.clouds) {
    const cols = ['#ff7a9a', '#ffd84a', '#ffffff', '#b890ff'].map(H);
    for (let x = 20; x < g.w * T - 20; x++) {
      if (rand(x, 71) < 0.965) continue;
      const tx = (x / T) | 0, row = surfaceRow(g, tx);
      if (m.portals.some((p) => Math.abs(p.x - tx) < 2)) continue;
      flower(b, x, row * T, cols[Math.floor(rand(x, 72) * 4)]);
    }
  }
  if (th.cave || th.hall) {
    // 천장 종유석
    for (let x = 0; x < g.w * T; x++) {
      const tx = (x / T) | 0;
      let ry = -1;
      for (let y = 0; y < 4; y++) if (solid(tx, y) && !solid(tx, y + 1)) ry = y;
      if (ry < 0) continue;
      const len = Math.floor(noise(x / 5, 14) * 14) - 4, D = th.dirt.map(H);
      for (let j = 0; j < len; j++) b.px(x, (ry + 1) * T + j, j > len - 3 ? D[1] : D[2]);
    }
  }
}

function drawSky(th) {
  const b = new Buf(SW, SH), S = th.sky.map(H), n = S.length - 1;
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      const t = (y / SH) * n, i = Math.min(n - 1, Math.floor(t)), f = t - i;
      b.d[y * SW + x] = f > (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16 ? S[i + 1] : S[i];
    }
  if (th.sun) {
    const cx = 300, cy = 44;
    for (let j = -18; j <= 18; j++) for (let i = -18; i <= 18; i++) {
      const d = Math.hypot(i, j);
      if (d < 11) b.px(cx + i, cy + j, d < 9 ? H('#fffbe0') : H('#fff0a8'));
      else if (d < 17 && BAYER[(((cy + j) & 3) << 2) | ((cx + i) & 3)] / 16 > (d - 11) / 6) b.px(cx + i, cy + j, mix(b.get(cx + i, cy + j), H('#fff6c0'), 0.6));
    }
  }
  if (th.ruins) {
    // 지는 해와 별
    for (let j = -22; j <= 22; j++) for (let i = -22; i <= 22; i++) if (Math.hypot(i, j) < 20 && 170 + j < SH) b.px(250 + i, 150 + j, (j + 200) % 6 < 2 && j > 0 ? b.get(250 + i, 150 + j) : H('#ffe9a8'));
    for (let i = 0; i < 70; i++) b.px(rand(i, 1) * SW, rand(i, 2) * 90, rand(i, 3) > 0.7 ? H('#ffffff') : H('#d8a8e8'));
  }
  if (th.cave || th.hall) {
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const v = fbm(x / 26, y / 18, 3, 3);
      if (v > 0.58) b.d[y * SW + x] = mix(b.d[y * SW + x], H(th.hall ? '#3a1a5c' : '#2c2460'), 0.5);
      else if (v < 0.36) b.d[y * SW + x] = mix(b.d[y * SW + x], H('#05030c'), 0.5);
    }
  }
  return b;
}

// 멀리 보이는 층(가로로 이어 붙는 512px 띠)
function drawFar(th, layer) {
  const W = 512, b = new Buf(W, SH), C = (layer ? th.mid : th.far).map(H), seed = layer ? 40 : 20;
  const base = layer ? 150 : 120, amp = layer ? 26 : 44, per = layer ? 46 : 90;
  for (let x = 0; x < W; x++) {
    // 양끝이 이어지게 주기 함수 조합
    const a = (x / W) * Math.PI * 2;
    let hgt = Math.sin(a * 2 + seed) * 0.5 + Math.sin(a * 5 + seed * 2) * 0.3 + Math.sin(a * 11 + seed * 3) * 0.15;
    if (th.cave || th.hall) hgt = Math.sign(hgt) * Math.pow(Math.abs(hgt), 0.5);
    const top = Math.round(base - hgt * amp - (th.ruins && layer === 0 ? (Math.floor(x / 24) % 3 === 0 ? 22 : 0) : 0));
    for (let y = top; y < SH; y++) b.d[y * W + x] = y - top < 3 ? C[0] : (y - top) % 9 === 8 && ((x + y) % per) < per * 0.5 ? C[0] : C[1];
    if (th.clouds && layer === 1 && x % 9 === 0 && rand(x, 15) > 0.5) {
      // 덤불 윗선
      for (let i = 0; i < 7; i++) for (let j = 0; j < 4 - Math.abs(i - 3); j++) if (top - j >= 0) b.d[(top - j) * W + ((x + i) % W)] = C[0];
    }
  }
  if (th.clouds && layer === 0) {
    const cl = [H('#ffffff'), H('#e6f4ff'), H('#c8e2f8')];
    for (let k = 0; k < 6; k++) {
      const cx = 30 + k * 84, cy = 26 + (k % 3) * 22, w = 26 + (k % 2) * 14;
      for (let j = -9; j <= 6; j++) for (let i = -w; i <= w; i++) {
        const top = Math.sin(((i + w) / (2 * w)) * Math.PI) * 9 + Math.sin(i / 4 + k) * 2;
        if (-j > top || j > 5) continue;
        b.d[(cy + j) * W + ((cx + i + W) % W)] = j > 3 ? cl[2] : j > 0 ? cl[1] : cl[0];
      }
    }
  }
  return b;
}

const cache = new Map();
export function loadMap(id) {
  if (cache.has(id)) return cache.get(id);
  const m = BUILDERS[id](), th = THEMES[m.theme];
  m.th = th;
  m.w = m.g.w * T;
  m.h = m.g.h * T;
  m.tiles = drawTiles(m, th);
  m.sky = drawSky(th);
  m.far = [drawFar(th, 0), drawFar(th, 1)];
  cache.set(id, m);
  return m;
}

/** 화면 배경을 만든다: 하늘 → 먼 층(천천히 따라옴) → 지형. out: SW*SH Uint32Array */
export function composeBg(m, camX, camY, out) {
  out.set(m.sky.d);
  for (let l = 0; l < 2; l++) {
    const f = m.far[l], off = Math.floor(camX * (l ? 0.45 : 0.18)), yo = Math.round((m.h - SH - camY) * (l ? 0.25 : 0.1));
    for (let y = 0; y < SH; y++) {
      const sy = y - yo;
      if (sy < 0 || sy >= SH) continue;
      const row = sy * f.w, o = y * SW;
      for (let x = 0; x < SW; x++) {
        const c = f.d[row + ((x + off) & 511)];
        if (c) out[o + x] = c;
      }
    }
  }
  const tw = m.tiles.w, td = m.tiles.d;
  for (let y = 0; y < SH; y++) {
    const wy = y + camY;
    if (wy < 0 || wy >= m.h) continue;
    const row = wy * tw, o = y * SW;
    for (let x = 0; x < SW; x++) {
      const wx = x + camX;
      if (wx < 0 || wx >= tw) continue;
      const c = td[row + wx];
      if (c) out[o + x] = c;
    }
  }
}

// ---------- 충돌 조회 ----------
export const tileAt = (m, tx, ty) => (tx < 0 || tx >= m.g.w ? 1 : ty < 0 ? 0 : ty >= m.g.h ? 1 : m.g.t[ty * m.g.w + tx]);
export const isSolid = (m, x, y) => tileAt(m, Math.floor(x / T), Math.floor(y / T)) === 1;
export const isPlat = (m, x, y) => {
  const k = tileAt(m, Math.floor(x / T), Math.floor(y / T));
  return k === 2 || k === 4;
};
export const isLadder = (m, x, y) => {
  const k = tileAt(m, Math.floor(x / T), Math.floor(y / T));
  return k === 3 || k === 4;
};
