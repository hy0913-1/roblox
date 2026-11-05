// The places: the village, the forest, and two dungeons (the Slime Cave and the Old Crypt).
// The village is laid out by hand, the forest from a seed with fixed landmarks, the dungeons are rooms and
// corridors generated from a seed (the same every visit). Each scene's floor is painted once into a canvas.

import { Rng } from "./vendor/pixelfx/src/core/index.js";
import { TILE } from "./config.js";

export const T = { GRASS: 0, PATH: 1, WATER: 2, CAVE: 3, CAVE_WALL: 4, CRYPT: 5, CRYPT_WALL: 6, COBBLE: 7 };
const WALLS = new Set([T.CAVE_WALL, T.CRYPT_WALL]);

const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function blank(id, name, w, h, fill) {
  const tiles = new Uint8Array(w * h).fill(fill);
  return { id, name, w, h, tiles, solid: new Uint8Array(w * h), objects: [], portals: [], chests: [], npcs: [], zones: [], spawns: [], torches: [], entries: {}, dark: false };
}
const at = (s, x, y) => (x < 0 || y < 0 || x >= s.w || y >= s.h ? -1 : s.tiles[y * s.w + x]);
const set = (s, x, y, v) => x >= 0 && y >= 0 && x < s.w && y < s.h && (s.tiles[y * s.w + x] = v);
const block = (s, x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h && (s.solid[y * s.w + x] = 1);
const tc = (t) => t * TILE + TILE / 2; // tile centre in pixels
const tb = (t) => (t + 1) * TILE; // tile bottom in pixels

function pond(s, cx, cy, rx, ry) {
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 + (hash(x, y, 3) - 0.5) * 0.25 && at(s, x, y) === T.GRASS) set(s, x, y, T.WATER);
}
function tree(s, x, y, R) {
  block(s, x, y);
  s.objects.push({ kind: "tree", x: tc(x), y: tb(y), v: Math.floor(R.range(0, 3)) });
}
const free = (s, x, y) => at(s, x, y) === T.GRASS && !s.solid[y * s.w + x];

// ---- the village -----------------------------------------------------------------------------------
function buildTown() {
  const s = blank("town", "평화로운 마을", 40, 26, T.GRASS), R = new Rng(11);
  for (let x = 2; x < 40; x++) for (const y of [12, 13]) set(s, x, y, T.PATH);
  for (let y = 2; y < 24; y++) for (const x of [19, 20]) set(s, x, y, T.PATH);
  for (let y = 8; y <= 17; y++) for (let x = 13; x <= 26; x++) set(s, x, y, T.COBBLE);
  pond(s, 6, 18, 3.2, 2.2);
  const houses = [[10, 7, 0], [29, 7, 1], [10, 21, 2], [29, 21, 0]];
  for (const [hx, hy, v] of houses) {
    for (let x = hx - 1; x <= hx + 1; x++) for (let y = hy - 1; y <= hy; y++) block(s, x, y);
    s.objects.push({ kind: "house", x: tc(hx), y: tb(hy), v });
    for (let y = hy + 1; y < 12; y++) set(s, hx, y, T.PATH);
    for (let y = 14; y < hy; y++) set(s, hx, y, T.PATH);
  }
  block(s, 17, 10);
  s.objects.push({ kind: "well", x: tc(17), y: tb(10) });
  for (let x = 3; x <= 8; x++) {
    block(s, x, 15);
    s.objects.push({ kind: "fence", x: tc(x), y: tb(15) });
  }
  s.objects.push({ kind: "sign", x: tc(36), y: tb(10), text: "동쪽: 숲  ·  숲 북쪽: 슬라임 동굴  ·  숲 동쪽: 고대 묘지" });
  block(s, 36, 10);
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const border = x <= 1 || y <= 1 || x >= 38 || y >= 24;
      const exit = x >= 38 && y >= 11 && y <= 14;
      if (border && !exit) tree(s, x, y, R);
    }
  for (const [x, y] of [[4, 4], [7, 3], [33, 3], [35, 5], [34, 17], [36, 19], [23, 21], [15, 22], [3, 9]]) if (free(s, x, y)) tree(s, x, y, R);
  s.npcs = [
    { id: "elder", x: tc(12), y: tb(9) },
    { id: "merchant", x: tc(29), y: tb(9) },
    { id: "guard", x: tc(35), y: tb(13) },
    { id: "kid", x: tc(15), y: tb(15) },
  ];
  s.portals.push({ x: tc(39), y: tb(12) + 4, to: "forest", entry: "west", color: "green" });
  s.entries = { start: { x: tc(20), y: tb(14) }, east: { x: tc(37), y: tb(12) + 4 } };
  s.safe = true;
  return s;
}

// ---- the forest ------------------------------------------------------------------------------------
function buildForest() {
  const s = blank("forest", "속삭이는 숲", 56, 40, T.GRASS), R = new Rng(20260105);
  const road = (x0, y0, x1, y1) => {
    let x = x0, y = y0;
    while (x !== x1 || y !== y1) {
      set(s, x, y, T.PATH);
      set(s, x, y + 1, T.PATH);
      if (x !== x1 && (y === y1 || R.chance(0.7))) x += Math.sign(x1 - x);
      else y += Math.sign(y1 - y);
    }
  };
  road(0, 19, 28, 20);
  road(28, 20, 28, 4);
  road(28, 20, 52, 20);
  road(14, 20, 15, 27);
  pond(s, 12, 31, 6.5, 4);
  pond(s, 42, 9, 3.5, 2.4);
  // graveyard by the crypt
  for (const [x, y] of [[45, 15], [47, 16], [49, 15], [45, 24], [47, 25], [49, 24], [44, 18], [44, 22], [50, 17], [50, 23]]) {
    block(s, x, y);
    s.objects.push({ kind: "grave", x: tc(x), y: tb(y), v: (x + y) % 3 });
  }
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const border = x <= 1 || y <= 1 || x >= s.w - 2 || y >= s.h - 2;
      const gates = (x <= 1 && y >= 18 && y <= 21) || (y <= 3 && x >= 26 && x <= 30) || (x >= s.w - 3 && y >= 18 && y <= 22);
      if (border && !gates) tree(s, x, y, R);
      else if (!border && at(s, x, y) === T.GRASS && !s.solid[y * s.w + x]) {
        const near = Math.hypot(x - 28, y - 20) < 4 || Math.hypot(x - 3, y - 19.5) < 4 || Math.hypot(x - 52, y - 20) < 5 || Math.hypot(x - 28, y - 4) < 4;
        const r = R.next();
        if (!near && r < 0.085) tree(s, x, y, R);
        else if (!near && r < 0.11) {
          block(s, x, y);
          s.objects.push({ kind: "rock", x: tc(x), y: tb(y), v: Math.floor(R.range(0, 3)) });
        }
      }
    }
  for (let x = 26; x <= 30; x++) for (let y = 0; y <= 2; y++) block(s, x, y);
  s.objects.push({ kind: "cave", x: tc(28), y: tb(3) });
  s.objects.push({ kind: "gate", x: tc(54), y: tb(20) + 2 });
  for (let y = 18; y <= 22; y++) block(s, 55, y);
  s.portals.push({ x: tc(0), y: tb(19) + 2, to: "town", entry: "east", color: "green" });
  s.portals.push({ x: tc(28), y: tb(4) + 2, to: "cave", entry: "start", color: "purple" });
  s.portals.push({ x: tc(53), y: tb(20) + 2, to: "crypt", entry: "start", color: "shadow", needs: "q2" });
  s.entries = { west: { x: tc(2), y: tb(19) + 4 }, cave: { x: tc(28), y: tb(6) }, crypt: { x: tc(51), y: tb(20) + 4 } };
  const chest = (x, y, opts = {}) => {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1]]) if (free(s, x + dx, y + dy) || at(s, x + dx, y + dy) === T.PATH) return s.chests.push({ id: `forest:${s.chests.length}`, x: tc(x + dx), y: tb(y + dy), ...opts });
  };
  chest(19, 30, { contains: "doll" });
  chest(8, 6);
  chest(40, 34);
  chest(36, 12);
  s.zones = [
    { x0: 6, y0: 8, x1: 30, y1: 36, types: ["slime"], count: 9, lv: [1, 2] },
    { x0: 18, y0: 4, x1: 42, y1: 18, types: ["bat", "slime"], count: 6, lv: [2, 3] },
    { x0: 36, y0: 12, x1: 52, y1: 34, types: ["archer", "archer", "skeleton", "bat"], count: 7, lv: [3, 4] },
  ];
  return s;
}

// ---- dungeons --------------------------------------------------------------------------------------
function buildDungeon(id, name, seed, floorT, wallT, cfg) {
  const s = blank(id, name, cfg.w, cfg.h, wallT), R = new Rng(seed);
  s.dark = true;
  const rooms = [];
  for (let tries = 0; tries < 400 && rooms.length < cfg.rooms; tries++) {
    const w = R.int(7, 12), h = R.int(6, 9), x = R.int(2, s.w - w - 3), y = R.int(3, s.h - h - 3);
    if (rooms.some((r) => x < r.x + r.w + 3 && x + w + 3 > r.x && y < r.y + r.h + 3 && y + h + 3 > r.y)) continue;
    rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });
  }
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set(s, x, y, floorT);
  // corridors: each room joins the nearest one already joined (a tree, so every room is reachable)
  const carve = (x, y) => {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (at(s, x + dx, y + dy) === wallT && x + dx > 0 && y + dy > 1 && x + dx < s.w - 1 && y + dy < s.h - 1) set(s, x + dx, y + dy, floorT);
  };
  for (let i = 1; i < rooms.length; i++) {
    let best = 0, bd = 1e9;
    for (let j = 0; j < i; j++) {
      const d = Math.abs(rooms[i].cx - rooms[j].cx) + Math.abs(rooms[i].cy - rooms[j].cy);
      if (d < bd) (bd = d), (best = j);
    }
    const a = rooms[i], b = rooms[best];
    let x = a.cx, y = a.cy;
    const hFirst = R.chance(0.5);
    while (x !== b.cx || y !== b.cy) {
      carve(x, y);
      if ((hFirst && x !== b.cx) || y === b.cy) x += Math.sign(b.cx - x);
      else y += Math.sign(b.cy - y);
    }
    carve(x, y);
  }
  for (let i = 0; i < s.tiles.length; i++) if (WALLS.has(s.tiles[i])) s.solid[i] = 1;
  // the boss waits in the room furthest from the way in (by walking distance)
  const dist = flood(s, rooms[0].cx, rooms[0].cy);
  let boss = rooms[1];
  for (const r of rooms.slice(1)) if (dist[r.cy * s.w + r.cx] > dist[boss.cy * s.w + boss.cx]) boss = r;
  s.rooms = rooms;
  s.bossRoom = boss;
  s.entries = { start: { x: tc(rooms[0].cx), y: tb(rooms[0].cy) + 18 } };
  s.portals.push({ x: tc(rooms[0].cx), y: tb(rooms[0].cy) - 2, to: "forest", entry: id, color: "green" });
  s.bossExit = { x: tc(boss.cx), y: tb(boss.cy) - 26, to: "forest", entry: id, color: "green" };
  s.boss = { type: cfg.boss, x: tc(boss.cx), y: tb(boss.cy), lv: cfg.bossLv, flag: cfg.boss + "Dead" };
  // monsters per room, chests in some rooms, a gold chest in the boss room
  rooms.forEach((r, i) => {
    if (i === 0 || r === boss) return;
    const n = R.int(cfg.perRoom[0], cfg.perRoom[1]);
    for (let k = 0; k < n; k++) s.spawns.push({ type: R.pick(cfg.types), x: tc(R.int(r.x + 1, r.x + r.w - 2)), y: tb(R.int(r.y + 1, r.y + r.h - 2)), lv: R.int(cfg.lv[0], cfg.lv[1]) });
    if (R.chance(0.45)) s.chests.push({ id: `${id}:${s.chests.length}`, x: tc(r.x + r.w - 2), y: tb(r.y + 1), tier: cfg.tier });
  });
  s.chests.push({ id: `${id}:boss`, x: tc(boss.x + boss.w - 2), y: tb(boss.y + 1), gold: true, tier: cfg.tier + 1 });
  // torches on wall faces that look onto a floor, and some furniture
  for (let y = 1; y < s.h - 1; y++)
    for (let x = 1; x < s.w - 1; x++)
      if (WALLS.has(at(s, x, y)) && at(s, x, y + 1) === floorT && hash(x, y, 7) < 0.16) s.torches.push({ x: tc(x), y: tb(y) - 6 });
  for (const r of rooms)
    for (let k = 0; k < 2; k++) {
      const x = R.int(r.x + 1, r.x + r.w - 2), y = R.int(r.y + 1, r.y + r.h - 2);
      if (Math.abs(x - r.cx) + Math.abs(y - r.cy) < 3) continue;
      if (cfg.decor === "crypt" && r.w > 8 && k === 0) {
        block(s, r.x + 1, r.y + 1);
        s.objects.push({ kind: "pillar", x: tc(r.x + 1), y: tb(r.y + 1) });
        block(s, r.x + r.w - 2, r.y + r.h - 2);
        s.objects.push({ kind: "pillar", x: tc(r.x + r.w - 2), y: tb(r.y + r.h - 2) });
      } else if (r !== rooms[0]) s.objects.push({ kind: cfg.decor === "crypt" ? "bones" : "pebbles", x: tc(x), y: tb(y), flat: true });
    }
  s.explored = new Uint8Array(s.w * s.h);
  return s;
}
function flood(s, sx, sy) {
  const d = new Int32Array(s.w * s.h).fill(1e9), q = [sy * s.w + sx];
  d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % s.w, y = (i / s.w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (y + dy) * s.w + x + dx;
      if (!s.solid[j] && d[j] > d[i] + 1) (d[j] = d[i] + 1), q.push(j);
    }
  }
  return d;
}

// ---- painting --------------------------------------------------------------------------------------
const PALETTES = {
  [T.GRASS]: ["#3f7f3f", "#336a35", "#58a050"],
  [T.PATH]: ["#b08f5c", "#957548", "#c9a977"],
  [T.WATER]: ["#2a5fa8", "#235090", "#2a5fa8"],
  [T.COBBLE]: ["#8a8a98", "#6e6e7e", "#a4a4b2"],
  [T.CAVE]: ["#4a3e34", "#3c3229", "#5a4c3e"],
  [T.CRYPT]: ["#3a3644", "#2e2a38", "#48445a"],
};
function paint(s) {
  const c = Object.assign(document.createElement("canvas"), { width: s.w * TILE, height: s.h * TILE }), g = c.getContext("2d");
  const px = (x, y, col) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  };
  for (let ty = 0; ty < s.h; ty++)
    for (let tx = 0; tx < s.w; tx++) {
      const t = at(s, tx, ty), X = tx * TILE, Y = ty * TILE;
      if (WALLS.has(t)) {
        // walls at 3/4: a dark top, and a lit stone face where a floor lies below
        const face = !WALLS.has(at(s, tx, ty + 1)) && at(s, tx, ty + 1) !== -1;
        const top = t === T.CAVE_WALL ? ["#1c1712", "#241d17"] : ["#15131c", "#1d1a26"], faceC = t === T.CAVE_WALL ? ["#6a5a48", "#57493a", "#7d6b56"] : ["#55526a", "#46435a", "#6a6782"];
        for (let y = 0; y < TILE; y++)
          for (let x = 0; x < TILE; x++) {
            const r = hash(X + x, Y + y, 9);
            if (face && y >= 7) {
              const brick = t === T.CRYPT_WALL && (y === 11 || (x + (y > 11 ? 8 : 0)) % 16 === 0);
              px(X + x, Y + y, brick ? faceC[1] : y === 7 ? faceC[2] : r < 0.12 ? faceC[1] : faceC[0]);
            } else px(X + x, Y + y, r < 0.1 ? top[1] : top[0]);
          }
        continue;
      }
      const P = PALETTES[t];
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
          const r = hash(X + x, Y + y);
          px(X + x, Y + y, r < 0.07 ? P[1] : r < 0.11 ? P[2] : P[0]);
        }
      if (t === T.GRASS) {
        for (let k = 0; k < 2; k++) {
          const x = X + 1 + Math.floor(hash(tx, ty, 10 + k) * 13), y = Y + 2 + Math.floor(hash(tx, ty, 20 + k) * 12);
          px(x, y, "#5fae55");
          px(x - 1, y - 1, "#5fae55");
          px(x + 1, y - 1, "#5fae55");
        }
        if (hash(tx, ty, 30) < (s.id === "town" ? 0.2 : 0.1)) {
          const x = X + 3 + Math.floor(hash(tx, ty, 31) * 10), y = Y + 3 + Math.floor(hash(tx, ty, 32) * 10);
          px(x, y, ["#ffffff", "#ffd84a", "#ff8ac8", "#9bdcff"][Math.floor(hash(tx, ty, 33) * 4)]);
          px(x, y + 1, "#2f6a32");
        }
      } else if (t === T.COBBLE) {
        for (let y = 0; y < TILE; y += 4)
          for (let x = 0; x < TILE; x++) if ((x + (y % 8 ? 2 : 0)) % 5 === 0 || y % 4 === 0) px(X + x, Y + y + (x % 5 === 0 ? 0 : 0), "#5c5c6b");
      } else if (t === T.WATER) {
        for (let k = 0; k < 2; k++) {
          const x = X + 2 + Math.floor(hash(tx, ty, 50 + k) * 10), y = Y + 2 + Math.floor(hash(tx, ty, 60 + k) * 12);
          px(x, y, "#5a9ae0");
          px(x + 1, y, "#5a9ae0");
          px(x + 2, y, "#8cc4f4");
        }
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const n = at(s, tx + dx, ty + dy);
          if (n === T.WATER || n === -1) continue;
          for (let i = 0; i < TILE; i++) {
            const x = dx < 0 ? X : dx > 0 ? X + TILE - 1 : X + i, y = dy < 0 ? Y : dy > 0 ? Y + TILE - 1 : Y + i;
            px(x, y, "#9ad4f4");
          }
        }
      } else if (t === T.PATH) {
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          if (at(s, tx + dx, ty + dy) !== T.GRASS) continue;
          for (let i = 0; i < TILE; i++)
            if (hash(tx * 16 + i, ty, dx * 3 + dy) < 0.7) px(dx < 0 ? X : dx > 0 ? X + TILE - 1 : X + i, dy < 0 ? Y : dy > 0 ? Y + TILE - 1 : Y + i, "#8a6c40");
        }
      } else if (t === T.CAVE || t === T.CRYPT) {
        // shadow under the wall above, and cracks
        if (WALLS.has(at(s, tx, ty - 1))) for (let x = 0; x < TILE; x++) for (let y = 0; y < 3; y++) px(X + x, Y + y, t === T.CAVE ? "#2a221b" : "#211e2a");
        if (t === T.CRYPT && (tx + ty) % 2 === 0) for (let x = 0; x < TILE; x++) px(X + x, Y + TILE - 1, "#2e2a38");
        if (hash(tx, ty, 70) < 0.15) {
          const x = X + 3 + Math.floor(hash(tx, ty, 71) * 9), y = Y + 4 + Math.floor(hash(tx, ty, 72) * 9);
          px(x, y, "#1c1712");
          px(x + 1, y + 1, "#1c1712");
          px(x + 2, y + 1, "#1c1712");
        }
      }
    }
  return c;
}

// ---- the registry ----------------------------------------------------------------------------------
const builders = {
  town: buildTown,
  forest: buildForest,
  cave: () => buildDungeon("cave", "슬라임 동굴", 7001, T.CAVE, T.CAVE_WALL, { w: 56, h: 44, rooms: 9, types: ["slime", "slime", "bat"], perRoom: [2, 4], lv: [3, 5], boss: "king", bossLv: 5, tier: 2, decor: "cave" }),
  crypt: () => buildDungeon("crypt", "고대 묘지", 9013, T.CRYPT, T.CRYPT_WALL, { w: 60, h: 46, rooms: 10, types: ["archer", "skeleton", "skeleton", "bat"], perRoom: [2, 4], lv: [6, 8], boss: "lich", bossLv: 9, tier: 3, decor: "crypt" }),
};
const cache = new Map();
export function getScene(id) {
  if (!cache.has(id)) {
    const s = builders[id]();
    s.objects.sort((a, b) => a.y - b.y);
    s.ground = paint(s);
    cache.set(id, s);
  }
  return cache.get(id);
}

export function isSolidAt(s, x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= s.w || ty >= s.h) return true;
  return s.solid[ty * s.w + tx] === 1;
}
export function isWaterAt(s, x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  return tx >= 0 && ty >= 0 && tx < s.w && ty < s.h && s.tiles[ty * s.w + tx] === T.WATER;
}
export const tileAt = (s, x, y) => at(s, Math.floor(x / TILE), Math.floor(y / TILE));
