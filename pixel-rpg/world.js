// The map: grass, a crossroads of path, a lake and a pond, a wall of trees round the edge and rocks and
// trees scattered about. Everything is generated from one seed and painted once into a canvas.

import { Rng } from "./vendor/pixelfx/src/core/index.js";

export const TILE = 16, MAP_W = 40, MAP_H = 30;
const GRASS = 0, PATH = 1, WATER = 2;

const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export function buildWorld(seed) {
  const R = new Rng(seed);
  const tiles = new Uint8Array(MAP_W * MAP_H), solid = new Uint8Array(MAP_W * MAP_H);
  const at = (tx, ty) => (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H ? -1 : tiles[ty * MAP_W + tx]);
  const set = (tx, ty, v) => {
    if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) tiles[ty * MAP_W + tx] = v;
  };

  // crossroads, with a gentle wobble so it isn't a ruler line
  for (let x = 0; x < MAP_W; x++) {
    const w = Math.round(Math.sin(x * 0.35) * 0.8);
    set(x, 14 + w, PATH);
    set(x, 15 + w, PATH);
  }
  for (let y = 0; y < MAP_H; y++) {
    const w = Math.round(Math.sin(y * 0.4 + 1) * 0.8);
    set(19 + w, y, PATH);
    set(20 + w, y, PATH);
  }
  // water
  const pool = (cx, cy, rx, ry) => {
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d < 1 + (hash(x, y, 3) - 0.5) * 0.25 && at(x, y) !== PATH) set(x, y, WATER);
      }
  };
  pool(31, 22, 5.5, 3.6);
  pool(8, 7, 3.2, 2.2);

  const objects = [];
  const spawn = { x: 20 * TILE, y: 15 * TILE + 8 };
  for (let ty = 0; ty < MAP_H; ty++)
    for (let tx = 0; tx < MAP_W; tx++) {
      const i = ty * MAP_W + tx, t = tiles[i];
      if (t === WATER) {
        solid[i] = 1;
        continue;
      }
      const border = tx <= 1 || ty <= 1 || tx >= MAP_W - 2 || ty >= MAP_H - 2;
      const farFromSpawn = Math.hypot(tx - 20, ty - 15) > 5;
      let kind = null;
      if (border) kind = "tree";
      else if (t === GRASS && farFromSpawn) {
        const r = R.next();
        if (r < 0.075) kind = "tree";
        else if (r < 0.1) kind = "rock";
      }
      if (kind) {
        solid[i] = 1;
        objects.push({ kind, x: tx * TILE + TILE / 2, y: (ty + 1) * TILE, v: Math.floor(R.range(0, 3)) });
      }
    }
  objects.sort((a, b) => a.y - b.y);

  return { tiles, solid, objects, spawn, ground: paintGround(tiles, at) };
}

export function isSolidAt(world, x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
  return world.solid[ty * MAP_W + tx] === 1;
}

function paintGround(tiles, at) {
  const cv = document.createElement("canvas");
  cv.width = MAP_W * TILE;
  cv.height = MAP_H * TILE;
  const g = cv.getContext("2d");
  const px = (x, y, c) => {
    g.fillStyle = c;
    g.fillRect(x, y, 1, 1);
  };
  for (let ty = 0; ty < MAP_H; ty++)
    for (let tx = 0; tx < MAP_W; tx++) {
      const t = tiles[ty * MAP_W + tx], X = tx * TILE, Y = ty * TILE;
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
          const r = hash(X + x, Y + y);
          let c;
          if (t === GRASS) c = r < 0.07 ? "#336a35" : r < 0.1 ? "#58a050" : "#3f7f3f";
          else if (t === PATH) c = r < 0.08 ? "#957548" : r < 0.13 ? "#c9a977" : "#b08f5c";
          else c = r < 0.05 ? "#235090" : "#2a5fa8";
          px(X + x, Y + y, c);
        }
      if (t === GRASS) {
        // tufts and the odd flower
        for (let k = 0; k < 2; k++) {
          const x = X + 1 + Math.floor(hash(tx, ty, 10 + k) * 13), y = Y + 2 + Math.floor(hash(tx, ty, 20 + k) * 12);
          px(x, y, "#5fae55");
          px(x - 1, y - 1, "#5fae55");
          px(x + 1, y - 1, "#5fae55");
        }
        if (hash(tx, ty, 30) < 0.12) {
          const x = X + 3 + Math.floor(hash(tx, ty, 31) * 10), y = Y + 3 + Math.floor(hash(tx, ty, 32) * 10);
          const c = ["#ffffff", "#ffd84a", "#ff8ac8", "#9bdcff"][Math.floor(hash(tx, ty, 33) * 4)];
          px(x, y, c);
          px(x, y + 1, "#2f6a32");
        }
      } else if (t === PATH) {
        // edges where the path meets grass, and a few pebbles
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          if (at(tx + dx, ty + dy) !== GRASS) continue;
          for (let i = 0; i < TILE; i++) {
            if (hash(tx * 16 + i, ty, dx * 3 + dy) < 0.7) {
              const x = dx < 0 ? X : dx > 0 ? X + TILE - 1 : X + i, y = dy < 0 ? Y : dy > 0 ? Y + TILE - 1 : Y + i;
              px(x, y, "#8a6c40");
            }
          }
        }
        if (hash(tx, ty, 40) < 0.25) {
          const x = X + 3 + Math.floor(hash(tx, ty, 41) * 10), y = Y + 3 + Math.floor(hash(tx, ty, 42) * 10);
          px(x, y, "#7a6040");
          px(x + 1, y, "#d8c090");
        }
      } else {
        // ripples, and a pale rim where the water meets land
        for (let k = 0; k < 2; k++) {
          const x = X + 2 + Math.floor(hash(tx, ty, 50 + k) * 10), y = Y + 2 + Math.floor(hash(tx, ty, 60 + k) * 12);
          px(x, y, "#5a9ae0");
          px(x + 1, y, "#5a9ae0");
          px(x + 2, y, "#8cc4f4");
        }
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          if (at(tx + dx, ty + dy) === WATER || at(tx + dx, ty + dy) === -1) continue;
          for (let i = 0; i < TILE; i++) {
            const x = dx < 0 ? X : dx > 0 ? X + TILE - 1 : X + i, y = dy < 0 ? Y : dy > 0 ? Y + TILE - 1 : Y + i;
            px(x, y, "#9ad4f4");
            px(dx !== 0 ? x + (dx < 0 ? 1 : -1) : x, dy !== 0 ? y + (dy < 0 ? 1 : -1) : y, "#5a9ae0");
          }
        }
      }
    }
  return cv;
}
