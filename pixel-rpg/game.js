// The run: player, enemies, skills, waves, levels. Pure game state and rules; drawing is in render.js.

import { createFx, Rng, PAL } from "./vendor/pixelfx/src/core/index.js";
import * as frostBolt from "./vendor/pixelfx/src/fx/rpg/frost-bolt.js";
import * as frostHit from "./vendor/pixelfx/src/fx/rpg/frost-hit.js";
import * as glacierRing from "./vendor/pixelfx/src/fx/rpg/glacier-ring.js";
import * as slimePop from "./vendor/pixelfx/src/fx/rpg/slime-pop.js";
import * as airBlast from "./vendor/pixelfx/src/fx/rpg/airstrike-blast.js";
import * as fighterJet from "./vendor/pixelfx/src/fx/rpg/fighter-jet.js";
import * as strikeMarker from "./vendor/pixelfx/src/fx/rpg/strike-marker.js";
import { BASE, BOLT, ULT, AIR, PLAYER, ENEMIES, UPGRADES, xpForLevel, waveRoster, waveHp, W, H } from "./config.js";
import { sfx } from "./audio.js";
import { input, down, tappedKey } from "./input.js";
import { buildWorld, isSolidAt, TILE, MAP_W, MAP_H } from "./world.js";

export const world = buildWorld(20260105);
export const G = {};
const rnd = new Rng(99);

const POP_PAL = {
  slime: undefined,
  bat: ["#1a0f24", "#2e1a46", "#4a2f72", "#6b4a9a", "#9a72d0", "#c4a4f0", "#ecdcff", "#ffffff"],
  archer: [...PAL.bone, "#ffffff"],
  king: undefined,
};
const SLAM_PAL = ["#0d1a0c", "#173a14", "#265e18", "#3f8a1e", "#6cb82a", "#a8e04a", "#e0ff8a", "#ffffff"];

// ---- run lifecycle ------------------------------------------------------------------------------
export function newRun(mode = "play") {
  const s = { ...BASE };
  Object.assign(G, {
    mode, // title | play | levelup | paused | dying | over
    time: 0,
    stats: s,
    taken: {},
    player: { x: world.spawn.x, y: world.spawn.y, dx: 0, dy: 1, face: "down", hp: s.maxHp, hurt: 0, boltCd: 0, ultCd: 0, airCd: 0, charge: 0, walk: 0, moving: false },
    enemies: [],
    bolts: [],
    arrows: [],
    strikes: [],
    fxs: [],
    gems: [],
    hearts: [],
    texts: [],
    banners: [],
    shake: 0,
    hitstop: 0,
    flash: 0,
    kills: 0,
    score: 0,
    level: 1,
    xp: 0,
    pendingLevels: 0,
    wave: { n: 0, queue: [], timer: 0, state: "break", breakTimer: mode === "play" ? 1.2 : 1e9 },
    seed: 1,
    preview: null, // strike-marker shown while aiming the airstrike
    boss: null,
    dyingTimer: 0,
  });
  flowFrom = -1;
  if (mode === "title") for (let i = 0; i < 5; i++) spawnEnemy("slime", 1, true);
}

const nextSeed = () => (G.seed = (G.seed * 1103515245 + 12345) & 0x7fffffff) % 1000;

export function addFx(mod, opts, follow) {
  // drop undefined options so they don't override the effect's own defaults (a palette of undefined breaks it)
  const o = { seed: nextSeed() };
  for (const k in opts) if (opts[k] !== undefined) o[k] = opts[k];
  const e = { fx: createFx(mod, o), follow, lift: opts.lift ?? 0 };
  G.fxs.push(e);
  return e;
}

function text(str, x, y, color, big = false) {
  G.texts.push({ str, x, y, color, t: 0, big });
}
export function banner(str, color, sub = "") {
  G.banners.push({ str, color, sub, t: 0 });
}

// ---- movement -----------------------------------------------------------------------------------
function blocked(x, y, hw = 4) {
  return isSolidAt(world, x - hw, y) || isSolidAt(world, x + hw, y) || isSolidAt(world, x - hw, y - 3) || isSolidAt(world, x + hw, y - 3);
}
function slide(e, mx, my, hw = 4) {
  if (!blocked(e.x + mx, e.y, hw)) e.x += mx;
  if (!blocked(e.x, e.y + my, hw)) e.y += my;
}
function faceFrom(p, dx, dy) {
  if (Math.abs(dx) + Math.abs(dy) < 1e-6) return;
  p.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}

export function camera() {
  const p = G.player;
  let cx = Math.round(p.x - W / 2), cy = Math.round(p.y - 12 - H / 2);
  cx = Math.max(0, Math.min(MAP_W * TILE - W, cx));
  cy = Math.max(0, Math.min(MAP_H * TILE - H, cy));
  return [cx, cy];
}
// where the mouse points, in world pixels
function mouseWorld() {
  const [cx, cy] = camera();
  return { x: input.mouse.x + cx, y: input.mouse.y + cy + 8 };
}

// ---- pathfinding --------------------------------------------------------------------------------
// A flow field: breadth-first distances over the tile grid from the player's tile, rebuilt when the player moves
// to another tile. Walkers step toward the neighbouring tile that is closer to you, so they go round lakes and
// tree lines instead of pushing into them.
let flow = new Int16Array(MAP_W * MAP_H), flowFrom = -1;
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const open = (tx, ty) => tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && !world.solid[ty * MAP_W + tx];
function updateFlow() {
  const p = G.player, tx = Math.floor(p.x / TILE), ty = Math.floor((p.y - 2) / TILE), start = ty * MAP_W + tx;
  if (start === flowFrom) return;
  flowFrom = start;
  flow.fill(-1);
  const q = [start];
  flow[start] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % MAP_W, y = (i / MAP_W) | 0;
    for (const [dx, dy] of NB) {
      const nx = x + dx, ny = y + dy;
      if (!open(nx, ny) || (dx && dy && (!open(x + dx, y) || !open(x, y + dy)))) continue;
      const j = ny * MAP_W + nx;
      if (flow[j] === -1) {
        flow[j] = flow[i] + 1;
        q.push(j);
      }
    }
  }
}
// can a shot fly from a to b at chest height? (trees and rocks block it, water doesn't)
function lineOfSight(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 5);
  for (let i = 1; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
    if (isSolidAt(world, x, y) && !isWaterAt(x, y)) return false;
  }
  return true;
}

// the way toward the player from (x, y): a unit vector
function steer(x, y, dx, dy, d) {
  const tx = Math.floor(x / TILE), ty = Math.floor((y - 2) / TILE), here = open(tx, ty) ? flow[ty * MAP_W + tx] : -1;
  if (d < 28 || here <= 1) return [dx / d, dy / d];
  let best = here, bx = 0, by = 0;
  for (const [ox, oy] of NB) {
    const nx = tx + ox, ny = ty + oy;
    if (!open(nx, ny) || (ox && oy && (!open(tx + ox, ty) || !open(tx, ty + oy)))) continue;
    const v = flow[ny * MAP_W + nx];
    if (v >= 0 && v < best) (best = v), (bx = ox), (by = oy);
  }
  if (best === here) return [dx / d, dy / d];
  const cx = (tx + bx + 0.5) * TILE - x, cy = (ty + by + 0.5) * TILE + 4 - y, l = Math.hypot(cx, cy) || 1;
  return [cx / l, cy / l];
}

// ---- enemies ------------------------------------------------------------------------------------
function spawnPoint(flying) {
  const p = G.player, [cx, cy] = camera();
  for (let tries = 0; tries < 60; tries++) {
    const a = rnd.range(0, Math.PI * 2), d = rnd.range(135, 210);
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * 0.8;
    if (x < 24 || y < 24 || x > MAP_W * TILE - 24 || y > MAP_H * TILE - 24) continue;
    const onScreen = x > cx - 8 && x < cx + W + 8 && y > cy - 8 && y < cy + H + 24;
    if (onScreen && tries < 40) continue;
    if (!flying && blocked(x, y, 6)) continue;
    return { x, y };
  }
  return null;
}

export function spawnEnemy(type, n, demo = false, at = null) {
  const def = ENEMIES[type], pos = at ?? spawnPoint(type === "bat");
  if (!pos) return null;
  const hp = Math.round(def.hp * waveHp(Math.max(1, n)));
  const e = { type, x: pos.x, y: pos.y, hp, max: hp, kx: 0, ky: 0, hit: 0, frozen: 0, anim: rnd.range(0, 2), touchCd: 0, wander: rnd.range(0, 6.28), wt: 0, z: 0, state: "walk", timer: rnd.range(2.5, 4), shootCd: rnd.range(1, 2.5), spawnT: 0, demo };
  G.enemies.push(e);
  if (type === "king") {
    G.boss = e;
    banner("BOSS", "#ff6a6a", "킹 슬라임 등장");
    sfx.boss();
  }
  return e;
}

function damageEnemy(e, dmg, kx = 0, ky = 0, crit = false) {
  if (e.dead) return;
  dmg = Math.round(dmg);
  e.hp -= dmg;
  e.hit = 0.1;
  const heavy = e.type === "king" ? 0.15 : 1;
  e.kx += kx * heavy;
  e.ky += ky * heavy;
  text(String(dmg), e.x, e.y - ENEMIES[e.type].hitY - 8, crit ? "#ffd84a" : "#9bdcff", crit);
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  const def = ENEMIES[e.type];
  G.kills++;
  G.score += def.score * Math.max(1, G.wave.n);
  sfx.pop();
  if (e.type === "king") {
    G.boss = null;
    G.hitstop = 0.25;
    G.shake = 0.5;
    for (let i = 0; i < 6; i++) addFx(slimePop, { x: e.x + rnd.range(-16, 16), y: e.y + rnd.range(-8, 8) });
    addFx(airBlast, { x: e.x, y: e.y, palette: SLAM_PAL, stone: "#2f6a32" });
    for (let i = 0; i < 10; i++) dropGem(e.x + rnd.range(-12, 12), e.y + rnd.range(-6, 6), 3);
    for (let i = 0; i < 3; i++) G.hearts.push({ x: e.x + rnd.range(-16, 16), y: e.y + rnd.range(-8, 8), t: 0 });
    banner("BOSS DOWN", "#ffd84a", `+${def.score * G.wave.n}`);
    return;
  }
  addFx(slimePop, { x: e.x, y: e.type === "bat" ? e.y - 8 : e.y, palette: POP_PAL[e.type] });
  for (let i = 0; i < def.xp; i++) dropGem(e.x, e.y, 1);
  if (rnd.chance(0.05)) G.hearts.push({ x: e.x, y: e.y, t: 0 });
}

function dropGem(x, y, v) {
  const a = rnd.range(0, Math.PI * 2), sp = rnd.range(20, 50);
  G.gems.push({ x, y, v, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, t: 0, pull: false });
}

function hurtPlayer(dmg, fx, fy) {
  const p = G.player;
  if (p.hurt > 0 || G.mode !== "play") return;
  p.hp -= dmg;
  p.hurt = PLAYER.invuln;
  G.shake = Math.max(G.shake, 0.25);
  G.flash = 0.25;
  sfx.hurt();
  const l = Math.hypot(p.x - fx, p.y - fy) || 1;
  slide(p, ((p.x - fx) / l) * 9, ((p.y - fy) / l) * 9);
  text(String(dmg), p.x, p.y - 22, "#ff6a6a");
  if (p.hp <= 0) {
    p.hp = 0;
    G.mode = "dying";
    G.dyingTimer = 1.4;
    sfx.over();
  }
}

function updateEnemy(e, dt) {
  const p = G.player, def = ENEMIES[e.type];
  e.anim += dt;
  e.hit = Math.max(0, e.hit - dt);
  e.touchCd = Math.max(0, e.touchCd - dt);
  e.frozen = Math.max(0, e.frozen - dt);
  e.spawnT += dt;
  const flying = e.type === "bat";
  if (e.kx || e.ky) {
    if (flying) {
      e.x += e.kx * dt * 4;
      e.y += e.ky * dt * 4;
    } else slide(e, e.kx * dt * 4, e.ky * dt * 4, e.type === "king" ? 10 : 4);
    e.kx *= 0.86;
    e.ky *= 0.86;
    if (Math.abs(e.kx) + Math.abs(e.ky) < 1) e.kx = e.ky = 0;
  }
  if (e.frozen > 0) return;
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, mul = 1 + 0.02 * (G.wave.n - 1);
  const chase = e.demo ? 0 : 1;

  if (e.type === "slime") {
    let vx, vy;
    if (chase) {
      // always comes for you, a little slower from far away
      const k = d < 140 ? 1 : 0.8, [sx, sy] = steer(e.x, e.y, dx, dy, d);
      vx = sx * def.speed * k;
      vy = sy * def.speed * k;
    } else {
      e.wt -= dt;
      if (e.wt <= 0) {
        e.wander = rnd.range(0, 6.28);
        e.wt = rnd.range(0.8, 2);
      }
      vx = Math.cos(e.wander) * def.speed * 0.4;
      vy = Math.sin(e.wander) * def.speed * 0.4;
    }
    const hop = Math.max(0, Math.sin(e.anim * 6));
    slide(e, vx * dt * hop * 1.6 * mul, vy * dt * hop * 1.6 * mul);
  } else if (e.type === "bat") {
    // swoops at you, weaving side to side; flies over trees and water
    const wob = Math.sin(e.anim * 5) * 0.8, nx = -dy / d, ny = dx / d;
    const sp = def.speed * mul * (chase ? 1 : 0.4);
    const tx = chase ? dx / d : Math.cos(e.wander), ty = chase ? dy / d : Math.sin(e.wander);
    e.x += (tx + nx * wob) * sp * dt;
    e.y += (ty + ny * wob) * sp * dt;
    e.x = Math.max(16, Math.min(MAP_W * TILE - 16, e.x));
    e.y = Math.max(24, Math.min(MAP_H * TILE - 8, e.y));
    e.z = 10 + Math.sin(e.anim * 9) * 2;
  } else if (e.type === "archer") {
    // keeps its distance and shoots
    let vx = 0, vy = 0;
    if (chase) {
      const clear = lineOfSight(e.x, e.y - 1, p.x, p.y - 1);
      if (d > def.range + 10 || !clear) [vx, vy] = steer(e.x, e.y, dx, dy, d);
      else if (d < def.range - 30) (vx = -dx / d), (vy = -dy / d);
      else (vx = (-dy / d) * 0.5 * Math.sign(Math.sin(e.wander))), (vy = (dx / d) * 0.5 * Math.sign(Math.sin(e.wander)));
      e.shootCd -= dt;
      if (e.shootCd <= 0 && d < def.range + 40 && clear) {
        e.shootCd = def.shootEvery * rnd.range(0.85, 1.15);
        const ax = p.x - e.x, ay = p.y - 8 - (e.y - 9), l = Math.hypot(ax, ay) || 1;
        G.arrows.push({ x: e.x, y: e.y - 9, vx: (ax / l) * def.arrowSpeed, vy: (ay / l) * def.arrowSpeed, life: 2.2, dmg: def.arrowDamage });
        e.draw = 0.25;
        sfx.arrow();
      }
    }
    e.draw = Math.max(0, (e.draw ?? 0) - dt);
    slide(e, vx * def.speed * mul * dt, vy * def.speed * mul * dt);
  } else if (e.type === "king") {
    updateKing(e, dt, dx, dy, d, def);
  }

  // a straggler stuck far off-screen (behind a lake, round a tree line) is brought back so the wave can end
  if (chase && d > 280 && e.type !== "king") {
    e.far = (e.far ?? 0) + dt;
    if (e.far > 6) {
      const at = spawnPoint(e.type === "bat");
      if (at) Object.assign(e, at, { far: 0, spawnT: 0 });
    }
  } else e.far = 0;

  const reach = e.type === "king" ? 18 : 11;
  if (chase && d < reach && e.touchCd <= 0 && e.z < 4) {
    e.touchCd = 0.8;
    hurtPlayer(def.touch, e.x, e.y);
  }
}

// King Slime: crawls after you, then crouches, leaps to where you stood and slams down, calling more slimes
function updateKing(e, dt, dx, dy, d, def) {
  e.timer -= dt;
  if (e.state === "walk") {
    const hop = Math.max(0, Math.sin(e.anim * 4)), [sx, sy] = steer(e.x, e.y, dx, dy, d);
    slide(e, sx * def.speed * dt * hop * 1.8, sy * def.speed * dt * hop * 1.8, 10);
    if (e.timer <= 0) {
      e.state = "crouch";
      e.timer = 0.45;
    }
  } else if (e.state === "crouch") {
    if (e.timer <= 0) {
      e.state = "air";
      e.timer = 0.95;
      e.from = { x: e.x, y: e.y };
      e.to = { x: G.player.x, y: G.player.y };
      if (blocked(e.to.x, e.to.y, 10)) e.to = { x: e.x, y: e.y };
      e.marker = addFx(strikeMarker, { x: e.to.x, y: e.to.y, radius: 34, palette: ["#0d1a0c", "#265e18", "#6cb82a", "#a8e04a", "#e0ff8a", "#ffffff"] });
    }
  } else if (e.state === "air") {
    const u = 1 - e.timer / 0.95;
    e.x = e.from.x + (e.to.x - e.from.x) * u;
    e.y = e.from.y + (e.to.y - e.from.y) * u;
    e.z = Math.sin(u * Math.PI) * 60;
    if (e.timer <= 0) {
      e.state = "walk";
      e.timer = rnd.range(3.2, 4.4);
      e.z = 0;
      e.marker?.fx.stop();
      e.jumps = (e.jumps ?? 0) + 1;
      G.shake = 0.4;
      sfx.slam();
      addFx(airBlast, { x: e.x, y: e.y, palette: SLAM_PAL, stone: "#2f6a32" });
      const p = G.player, ex = p.x - e.x, ey = (p.y - e.y) / 0.6;
      if (Math.hypot(ex, ey) < 38) hurtPlayer(18, e.x, e.y);
      if (e.jumps % 2 === 0)
        for (let i = 0; i < 2; i++) {
          const a = rnd.range(0, Math.PI * 2), at = { x: e.x + Math.cos(a) * 26, y: e.y + Math.sin(a) * 16 };
          if (!blocked(at.x, at.y)) spawnEnemy("slime", G.wave.n, false, at);
        }
    }
  }
}

// ---- skills -------------------------------------------------------------------------------------
function nearestEnemy(x, y, range) {
  let best = null, bd = range;
  for (const e of G.enemies) {
    if (e.dead || e.demo) continue;
    const d = Math.hypot(e.x - x, e.y - ENEMIES[e.type].hitY - e.z - y);
    if (d < bd) (bd = d), (best = e);
  }
  return best;
}

function boltAim() {
  const p = G.player, ox = p.x, oy = p.y - 8;
  if (input.bolt.aim) return [input.bolt.aim.x, input.bolt.aim.y];
  if (!input.touch && input.mouse.over) {
    const m = mouseWorld(), dx = m.x - ox, dy = m.y - 8 - oy, l = Math.hypot(dx, dy);
    if (l > 4) return [dx / l, dy / l];
  }
  const t = nearestEnemy(ox, oy, PLAYER.aimAssist);
  if (t && input.touch) {
    const dx = t.x - ox, dy = t.y - ENEMIES[t.type].hitY - t.z - oy, l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  }
  return [p.dx, p.dy];
}

function shootBolts() {
  const p = G.player, s = G.stats;
  const [ax, ay] = boltAim();
  faceFrom(p, ax, ay);
  const base = Math.atan2(ay, ax);
  for (let i = 0; i < s.boltCount; i++) {
    const ang = base + (i - (s.boltCount - 1) / 2) * BOLT.spread;
    const b = { x: p.x + Math.cos(ang) * 8, y: p.y - 8 + Math.sin(ang) * 8, vx: Math.cos(ang) * BOLT.speed, vy: Math.sin(ang) * BOLT.speed, ang, life: BOLT.life, pierce: s.pierce, hitSet: new Set() };
    b.fx = addFx(frostBolt, { x: b.x, y: b.y, angle: ang }, b);
    G.bolts.push(b);
  }
  p.boltCd = s.boltCooldown;
  sfx.bolt();
}

function endBolt(b, x, y) {
  b.done = true;
  b.fx.fx.stop();
  b.fx.follow = null;
  if (x !== undefined) addFx(frostHit, { x, y, aim: b.ang });
}

function castUlt() {
  const p = G.player;
  p.ultCd = G.stats.ultCooldown;
  p.charge = ULT.charge;
  addFx(glacierRing, { x: p.x, y: p.y, reach: ULT.reach });
  sfx.ultCharge();
}

function ultStrike() {
  const p = G.player;
  G.shake = 0.35;
  G.hitstop = 0.05;
  sfx.ultBurst();
  for (const e of G.enemies) {
    if (e.dead || e.demo) continue;
    const dx = e.x - p.x, dy = (e.y - p.y) / ULT.sy;
    if (Math.hypot(dx, dy) < ULT.reach + 4) {
      e.frozen = e.type === "king" ? ULT.freeze * 0.4 : ULT.freeze;
      damageEnemy(e, G.stats.ultDamage);
    }
  }
}

// the densest group of enemies in reach, for a tapped airstrike
function autoStrikeTarget() {
  const p = G.player;
  let best = null, score = -1;
  for (const e of G.enemies) {
    if (e.dead || e.demo || Math.hypot(e.x - p.x, e.y - p.y) > AIR.range + 30) continue;
    let n = 0;
    for (const o of G.enemies) if (!o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 40) n++;
    const sc = n * 100 - Math.hypot(e.x - p.x, e.y - p.y);
    if (sc > score) (score = sc), (best = e);
  }
  return best ? { x: best.x, y: best.y } : { x: p.x + p.dx * 80, y: p.y + p.dy * 80 };
}

export function airTargetFromAim(aim) {
  const p = G.player;
  return { x: p.x + aim.x * aim.k * AIR.range, y: p.y + aim.y * aim.k * AIR.range * 0.8 };
}

function callAirstrike(tx, ty) {
  const p = G.player, s = G.stats;
  const d = Math.hypot(tx - p.x, ty - p.y);
  if (d > AIR.range) {
    tx = p.x + ((tx - p.x) / d) * AIR.range;
    ty = p.y + ((ty - p.y) / d) * AIR.range;
  }
  // the jet comes in from behind you, over the target, so the bombs walk away from you
  let ux = tx - p.x, uy = ty - p.y, l = Math.hypot(ux, uy);
  if (l < 8) (ux = p.dx), (uy = p.dy), (l = Math.hypot(ux, uy) || 1);
  ux /= l;
  uy /= l;
  const n = s.airBombs, bombs = [];
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * AIR.spacing, tHit = (AIR.approach + off) / AIR.jetSpeed;
    bombs.push({ x: tx + ux * off, y: ty + uy * off, tHit, state: "wait" });
  }
  const st = { tx, ty, ux, uy, t: 0, bombs, jx: tx - ux * AIR.approach, jy: ty - uy * AIR.approach, angle: Math.atan2(uy, ux) };
  st.marker = addFx(strikeMarker, { x: tx, y: ty, radius: 18 + n * 4 });
  st.jet = addFx(fighterJet, { x: st.jx, y: st.jy - AIR.altitude, angle: st.angle, lift: AIR.altitude }, null);
  G.strikes.push(st);
  p.airCd = s.airCooldown;
  sfx.jet();
}

function updateStrike(st, dt) {
  st.t += dt;
  st.jx = st.tx - st.ux * AIR.approach + st.ux * AIR.jetSpeed * st.t;
  st.jy = st.ty - st.uy * AIR.approach + st.uy * AIR.jetSpeed * st.t;
  st.jet.fx.options.x = st.jx;
  st.jet.fx.options.y = st.jy - AIR.altitude;
  for (const b of st.bombs) {
    if (b.state === "wait" && st.t >= b.tHit - AIR.fall) b.state = "fall";
    if (b.state === "fall") {
      b.k = Math.max(0, (b.tHit - st.t) / AIR.fall);
      if (st.t >= b.tHit) {
        b.state = "done";
        explode(b.x, b.y);
      }
    }
  }
  if (st.bombs.every((b) => b.state === "done")) st.marker.fx.stop();
  if (st.t > (AIR.approach * 2) / AIR.jetSpeed + 0.2) {
    st.jet.fx.stop();
    st.done = true;
  }
}

function explode(x, y) {
  addFx(airBlast, { x, y });
  G.shake = Math.max(G.shake, 0.22);
  sfx.boom();
  for (const e of G.enemies) {
    if (e.dead || e.demo) continue;
    const dx = e.x - x, dy = (e.y - y) / AIR.sy, d = Math.hypot(dx, dy);
    if (d < AIR.radius + ENEMIES[e.type].rad) damageEnemy(e, G.stats.airDamage, (dx / (d || 1)) * 60, (dy / (d || 1)) * 40);
  }
}

// ---- levels -------------------------------------------------------------------------------------
export function upgradeChoices() {
  const open = UPGRADES.filter((u) => (G.taken[u.id] ?? 0) < u.max);
  const pick = [];
  const pool = [...open];
  while (pick.length < 3 && pool.length) pick.push(pool.splice(Math.floor(rnd.next() * pool.length), 1)[0]);
  return pick;
}
export function takeUpgrade(u) {
  G.taken[u.id] = (G.taken[u.id] ?? 0) + 1;
  u.apply(G.stats, G);
  G.pendingLevels--;
}

function gainXp(v) {
  G.xp += v;
  while (G.xp >= xpForLevel(G.level)) {
    G.xp -= xpForLevel(G.level);
    G.level++;
    G.pendingLevels++;
    sfx.level();
  }
}

// ---- waves --------------------------------------------------------------------------------------
function updateWave(dt) {
  const w = G.wave;
  if (w.state === "break") {
    w.breakTimer -= dt;
    if (w.breakTimer <= 0) {
      w.n++;
      w.queue = waveRoster(w.n);
      w.state = "spawning";
      w.timer = 0;
      w.total = w.queue.length;
      if (w.n % 5 !== 0) banner(`WAVE ${w.n}`, "#9bdcff");
      sfx.wave();
    }
    return;
  }
  if (w.queue.length) {
    w.timer -= dt;
    const alive = G.enemies.length;
    if (w.timer <= 0 && alive < 26) {
      w.timer = Math.max(0.25, 0.6 - w.n * 0.02);
      const type = w.queue.shift();
      if (!spawnEnemy(type, w.n)) w.queue.push(type);
    }
  } else if (G.enemies.length === 0) {
    w.state = "break";
    w.breakTimer = 3.5;
    const bonus = 100 * w.n;
    G.score += bonus;
    const p = G.player;
    p.hp = Math.min(G.stats.maxHp, p.hp + Math.round(G.stats.maxHp * 0.15));
    banner("WAVE CLEAR", "#7ee88a", `+${bonus}`);
  }
}

// ---- the frame ----------------------------------------------------------------------------------
export function update(dt) {
  G.time += dt;
  G.flash = Math.max(0, G.flash - dt);
  updateTexts(dt);
  if (G.hitstop > 0) {
    G.hitstop -= dt;
    return;
  }
  if (G.mode === "dying") {
    G.dyingTimer -= dt;
    updateFx(dt);
    return;
  }
  const demo = G.mode === "title";
  const p = G.player, s = G.stats;
  if (!demo) {
    p.boltCd = Math.max(0, p.boltCd - dt);
    p.ultCd = Math.max(0, p.ultCd - dt);
    p.airCd = Math.max(0, p.airCd - dt);
    p.hurt = Math.max(0, p.hurt - dt);
    if (s.regen) p.hp = Math.min(s.maxHp, p.hp + s.regen * dt);
    updatePlayer(dt);
    updateFlow();
    updateWave(dt);
  }

  // bolts
  for (const b of G.bolts) {
    b.life -= dt;
    const n = Math.max(1, Math.ceil((BOLT.speed * dt) / 3));
    for (let i = 0; i < n && !b.done; i++) {
      b.x += (b.vx * dt) / n;
      b.y += (b.vy * dt) / n;
      for (const e of G.enemies) {
        if (e.dead || e.demo || b.hitSet.has(e)) continue;
        const def = ENEMIES[e.type];
        if (Math.abs(e.x - b.x) < def.rad && Math.abs(e.y - def.hitY - e.z - b.y) < def.rad + 2) {
          const crit = rnd.chance(BOLT.crit);
          damageEnemy(e, s.boltDamage * (crit ? 2 : 1), Math.cos(b.ang) * 40, Math.sin(b.ang) * 40, crit);
          crit ? sfx.crit() : sfx.hit();
          e.frozen = Math.max(e.frozen, e.type === "king" ? 0 : 0.35);
          b.hitSet.add(e);
          if (b.pierce-- <= 0) {
            endBolt(b, b.x, b.y);
            break;
          }
          addFx(frostHit, { x: b.x, y: b.y, aim: b.ang });
        }
      }
      if (!b.done && isSolidAt(world, b.x, b.y + 8) && !isWaterAt(b.x, b.y + 8)) endBolt(b, b.x, b.y);
    }
    if (!b.done && b.life <= 0) endBolt(b);
  }
  G.bolts = G.bolts.filter((b) => !b.done);

  // arrows
  for (const a of G.arrows) {
    a.life -= dt;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    if (Math.hypot(a.x - p.x, a.y - (p.y - 8)) < 7) {
      hurtPlayer(a.dmg, a.x - a.vx, a.y - a.vy);
      a.life = 0;
    }
    if (isSolidAt(world, a.x, a.y + 9) && !isWaterAt(a.x, a.y + 9)) a.life = 0;
  }
  G.arrows = G.arrows.filter((a) => a.life > 0);

  for (const st of G.strikes) updateStrike(st, dt);
  G.strikes = G.strikes.filter((st) => !st.done);

  for (const e of G.enemies) updateEnemy(e, dt);
  G.enemies = G.enemies.filter((e) => !e.dead);

  // gems fly to you once you're close enough
  for (const g of G.gems) {
    g.t += dt;
    const dx = p.x - g.x, dy = p.y - 6 - g.y, d = Math.hypot(dx, dy);
    // inside the magnet, after a wave is cleared, or once it has lain about for a while, it comes to you
    if (!demo && (g.pull || d < s.magnet || g.t > 8 || G.wave.state === "break")) {
      g.pull = true;
      const sp = 60 + g.t * 120;
      g.vx = (dx / (d || 1)) * sp;
      g.vy = (dy / (d || 1)) * sp;
    } else {
      g.vx *= 0.9;
      g.vy *= 0.9;
    }
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    if (!demo && d < 7) {
      g.taken = true;
      gainXp(g.v);
      sfx.gem();
    }
  }
  G.gems = G.gems.filter((g) => !g.taken && g.t < 40);
  for (const h of G.hearts) {
    h.t += dt;
    if (!demo && Math.hypot(h.x - p.x, h.y - p.y) < 11) {
      h.taken = true;
      p.hp = Math.min(s.maxHp, p.hp + 20);
      text("+20", p.x, p.y - 22, "#7ee88a");
      sfx.heart();
    }
  }
  G.hearts = G.hearts.filter((h) => !h.taken && h.t < 20);

  updateFx(dt);
}

function isWaterAt(x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  return tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && world.tiles[ty * MAP_W + tx] === 2;
}

function updatePlayer(dt) {
  const p = G.player, s = G.stats;
  // the airstrike target follows the drag while aiming on a touch screen
  if (input.air.aim && p.airCd <= 0) {
    const t = airTargetFromAim(input.air.aim);
    if (!G.preview) G.preview = addFx(strikeMarker, { x: t.x, y: t.y, radius: 18 + s.airBombs * 4, palette: ["#2a0a0a", "#5a1a14", "#a8361e", "#d86a2a", "#f0a04a", "#ffe6a0"] });
    G.preview.fx.options.x = t.x;
    G.preview.fx.options.y = t.y;
  } else if (G.preview) {
    G.preview.fx.stop();
    G.preview = null;
  }

  if (p.charge > 0) {
    p.charge -= dt;
    p.moving = false;
    if (p.charge <= 0) ultStrike();
    return;
  }
  let ix = (down("KeyD", "ArrowRight") ? 1 : 0) - (down("KeyA", "ArrowLeft") ? 1 : 0);
  let iy = (down("KeyS", "ArrowDown") ? 1 : 0) - (down("KeyW", "ArrowUp") ? 1 : 0);
  let speed = 1;
  if (input.stick.x || input.stick.y) {
    ix = input.stick.x;
    iy = input.stick.y;
    speed = Math.min(1, Math.hypot(ix, iy)) * 0.5 + 0.5;
  }
  p.moving = ix !== 0 || iy !== 0;
  if (p.moving) {
    const l = Math.hypot(ix, iy);
    p.dx = ix / l;
    p.dy = iy / l;
    faceFrom(p, p.dx, p.dy);
    slide(p, p.dx * s.speed * speed * dt, p.dy * s.speed * speed * dt);
    p.walk += dt * speed;
  }
  const firing = down("KeyJ", "Space") || input.mouse.down || input.bolt.held;
  if (firing && p.boltCd <= 0) shootBolts();
  if ((tappedKey("KeyK", "KeyR") || input.ultTap) && p.ultCd <= 0) castUlt();

  if (p.airCd <= 0) {
    let target = null;
    if (input.air.release === "auto") target = autoStrikeTarget();
    else if (input.air.release) target = airTargetFromAim(input.air.release);
    else if (input.mouse.rightTap) target = mouseWorld();
    else if (tappedKey("KeyE", "KeyL")) target = !input.touch && input.mouse.over ? mouseWorld() : autoStrikeTarget();
    if (target) callAirstrike(target.x, target.y);
  }
}

function updateFx(dt) {
  for (const e of G.fxs) {
    if (e.follow) {
      e.fx.options.x = e.follow.x;
      e.fx.options.y = e.follow.y;
    }
    e.fx.update(dt);
  }
  G.fxs = G.fxs.filter((e) => !e.fx.done());
  G.shake = Math.max(0, G.shake - dt);
}

function updateTexts(dt) {
  for (const t of G.texts) {
    t.t += dt;
    t.y -= 16 * dt;
  }
  G.texts = G.texts.filter((t) => t.t < 0.9);
  for (const b of G.banners) b.t += dt;
  G.banners = G.banners.filter((b) => b.t < 2.2);
}
