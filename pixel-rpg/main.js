// Frost Wizard: a tiny top-down pixel RPG to try the pixelfx effects in a real game loop.
// The four effects (frost-bolt, frost-hit, glacier-ring, slime-pop) live in vendor/pixelfx/src/fx/rpg.

import { createFrame, clearFrame, createFx, composite, painterFor, Rng, hex } from "./vendor/pixelfx/src/core/index.js";
import * as frostBolt from "./vendor/pixelfx/src/fx/rpg/frost-bolt.js";
import * as frostHit from "./vendor/pixelfx/src/fx/rpg/frost-hit.js";
import * as glacierRing from "./vendor/pixelfx/src/fx/rpg/glacier-ring.js";
import * as slimePop from "./vendor/pixelfx/src/fx/rpg/slime-pop.js";
import { makeSprite, tint, SPRITES, drawTree, drawRock } from "./sprites.js";
import { buildWorld, isSolidAt, TILE, MAP_W, MAP_H } from "./world.js";

const W = 320, H = 180;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// ---- tuning -------------------------------------------------------------------------------------
const PLAYER_SPEED = 62, PLAYER_HP = 100;
const BOLT_SPEED = 190, BOLT_LIFE = 0.85, BOLT_DAMAGE = 12, BOLT_COOLDOWN = 0.28;
const ULT_REACH = 52, ULT_DAMAGE = 45, ULT_COOLDOWN = 10, ULT_FREEZE = 2.6, ULT_CHARGE = 0.4;
const ULT_ELLIPSE = 0.62; // the floor ring is an ellipse: the effect's SY
const SLIME_HP = 30, SLIME_SPEED = 26, SLIME_CHASE = 90, SLIME_TOUCH = 8, MAX_SLIMES = 8;

// ---- world --------------------------------------------------------------------------------------
const world = buildWorld(20260105);
const groundCanvas = world.ground;

// ---- frames the effects draw into (world coordinates, scrolled by ox/oy) -------------------------
const back = createFrame(W, H), front = createFrame(W, H), hud = createFrame(W, H);
const backImg = new ImageData(W, H), frontImg = new ImageData(W, H), hudImg = new ImageData(W, H);
const layerCanvas = () => Object.assign(document.createElement("canvas"), { width: W, height: H });
const backCv = layerCanvas(), frontCv = layerCanvas(), hudCv = layerCanvas();
const backCtx = backCv.getContext("2d"), frontCtx = frontCv.getContext("2d"), hudCtx = hudCv.getContext("2d");

// ---- state --------------------------------------------------------------------------------------
const keys = new Set(), tapped = new Set(); // tapped: pressed since the last update, so a quick tap is never lost
let state, time = 0;
const down = (...codes) => codes.some((c) => keys.has(c) || tapped.has(c));

function reset() {
  const start = world.spawn;
  state = {
    player: { x: start.x, y: start.y, dx: 1, dy: 0, face: "down", hp: PLAYER_HP, hurt: 0, boltCd: 0, ultCd: 0, charge: 0, walk: 0, moving: false },
    slimes: [],
    bolts: [],
    fxs: [],
    pickups: [],
    texts: [],
    shake: 0,
    kills: 0,
    spawnTimer: 0.5,
    over: false,
    seed: 1,
  };
  for (let i = 0; i < 4; i++) spawnSlime();
}

function nextSeed() {
  return (state.seed = (state.seed * 1103515245 + 12345) & 0x7fffffff) % 1000;
}
const rnd = new Rng(99);

function spawnSlime() {
  const p = state.player;
  for (let tries = 0; tries < 40; tries++) {
    const x = rnd.range(24, MAP_W * TILE - 24), y = rnd.range(24, MAP_H * TILE - 24), d = Math.hypot(x - p.x, y - p.y);
    if (d < 110 || d > 260 || isSolidAt(world, x, y) || isSolidAt(world, x - 6, y) || isSolidAt(world, x + 6, y)) continue;
    state.slimes.push({ x, y, hp: SLIME_HP, vx: 0, vy: 0, wander: rnd.range(0, 6.28), wt: 0, frozen: 0, hit: 0, touch: 0, anim: rnd.range(0, 2), kx: 0, ky: 0 });
    return;
  }
}

function addFx(mod, opts, follow) {
  const fx = createFx(mod, { seed: nextSeed(), ...opts });
  const entry = { fx, follow };
  state.fxs.push(entry);
  return entry;
}

function floatText(str, x, y, color) {
  state.texts.push({ str, x, y, color, t: 0 });
}

// ---- movement helpers ---------------------------------------------------------------------------
// the feet box is 8 wide: check both corners so nothing walks into trees, rocks or water
function blocked(x, y) {
  return isSolidAt(world, x - 4, y) || isSolidAt(world, x + 4, y) || isSolidAt(world, x - 4, y - 3) || isSolidAt(world, x + 4, y - 3);
}
function moveWithCollision(e, mx, my) {
  if (!blocked(e.x + mx, e.y)) e.x += mx;
  if (!blocked(e.x, e.y + my)) e.y += my;
}

// ---- actions ------------------------------------------------------------------------------------
function shootBolt() {
  const p = state.player;
  const ang = Math.atan2(p.dy, p.dx);
  const bolt = { x: p.x + p.dx * 8, y: p.y - 8 + p.dy * 8, vx: Math.cos(ang) * BOLT_SPEED, vy: Math.sin(ang) * BOLT_SPEED, ang, life: BOLT_LIFE };
  bolt.fxEntry = addFx(frostBolt, { x: bolt.x, y: bolt.y, angle: ang }, bolt);
  state.bolts.push(bolt);
  p.boltCd = BOLT_COOLDOWN;
}

function impact(bolt, x, y) {
  bolt.fxEntry.fx.stop();
  bolt.fxEntry.follow = null;
  addFx(frostHit, { x, y, aim: bolt.ang });
  state.shake = Math.max(state.shake, 0.12);
}

function castUltimate() {
  const p = state.player;
  p.ultCd = ULT_COOLDOWN;
  p.charge = ULT_CHARGE;
  addFx(glacierRing, { x: p.x, y: p.y, reach: ULT_REACH });
  p.ultAt = ULT_CHARGE;
}

function ultimateStrike() {
  const p = state.player;
  state.shake = 0.35;
  for (const s of state.slimes) {
    const dx = s.x - p.x, dy = (s.y - p.y) / ULT_ELLIPSE;
    if (Math.hypot(dx, dy) < ULT_REACH + 4) {
      damageSlime(s, ULT_DAMAGE, 0, 0);
      s.frozen = ULT_FREEZE;
    }
  }
}

function damageSlime(s, dmg, kx, ky) {
  s.hp -= dmg;
  s.hit = 0.12;
  s.kx = kx;
  s.ky = ky;
  floatText(String(dmg), s.x, s.y - 14, "#9bdcff");
  if (s.hp <= 0) killSlime(s);
}

function killSlime(s) {
  if (s.dead) return;
  s.dead = true;
  state.kills++;
  addFx(slimePop, { x: s.x, y: s.y });
  if (rnd.chance(0.35)) state.pickups.push({ x: s.x, y: s.y, t: 0 });
}

function hurtPlayer(dmg, fromX, fromY) {
  const p = state.player;
  if (p.hurt > 0 || state.over) return;
  p.hp -= dmg;
  p.hurt = 0.7;
  state.shake = 0.25;
  const l = Math.hypot(p.x - fromX, p.y - fromY) || 1;
  moveWithCollision(p, ((p.x - fromX) / l) * 9, ((p.y - fromY) / l) * 9);
  floatText(String(dmg), p.x, p.y - 18, "#ff6a6a");
  if (p.hp <= 0) {
    p.hp = 0;
    state.over = true;
  }
}

// ---- update -------------------------------------------------------------------------------------
function update(dt) {
  time += dt;
  if (state.over) {
    updateEffects(dt);
    if (down("Enter")) reset();
    return;
  }
  const p = state.player;
  p.boltCd = Math.max(0, p.boltCd - dt);
  p.ultCd = Math.max(0, p.ultCd - dt);
  p.hurt = Math.max(0, p.hurt - dt);

  if (p.charge > 0) {
    // the caster stands still while the cold gathers, then the nova bursts
    p.charge -= dt;
    p.moving = false;
    if (p.charge <= 0) ultimateStrike();
  } else {
    let ix = (down("KeyD", "ArrowRight") ? 1 : 0) - (down("KeyA", "ArrowLeft") ? 1 : 0);
    let iy = (down("KeyS", "ArrowDown") ? 1 : 0) - (down("KeyW", "ArrowUp") ? 1 : 0);
    p.moving = ix !== 0 || iy !== 0;
    if (p.moving) {
      const l = Math.hypot(ix, iy);
      ix /= l;
      iy /= l;
      p.dx = ix;
      p.dy = iy;
      p.face = Math.abs(ix) > Math.abs(iy) ? (ix > 0 ? "right" : "left") : iy > 0 ? "down" : "up";
      moveWithCollision(p, ix * PLAYER_SPEED * dt, iy * PLAYER_SPEED * dt);
      p.walk += dt;
    }
    if (down("KeyJ", "Space") && p.boltCd <= 0) shootBolt();
    if (down("KeyK", "KeyR") && p.ultCd <= 0) castUltimate();
  }

  // bolts
  for (const b of state.bolts) {
    b.life -= dt;
    const step = Math.hypot(b.vx, b.vy) * dt, n = Math.ceil(step / 3);
    for (let i = 0; i < n && !b.done; i++) {
      b.x += (b.vx * dt) / n;
      b.y += (b.vy * dt) / n;
      for (const s of state.slimes) {
        if (!s.dead && Math.abs(s.x - b.x) < 7 && Math.abs(s.y - 6 - b.y) < 8) {
          damageSlime(s, BOLT_DAMAGE, Math.cos(b.ang) * 40, Math.sin(b.ang) * 40);
          s.frozen = Math.max(s.frozen, 0.5);
          impact(b, b.x, b.y);
          b.done = true;
          break;
        }
      }
      if (!b.done && isSolidAt(world, b.x, b.y + 8)) {
        impact(b, b.x, b.y);
        b.done = true;
      }
    }
    if (!b.done && b.life <= 0) {
      b.fxEntry.fx.stop();
      b.fxEntry.follow = null;
      b.done = true;
    }
  }
  state.bolts = state.bolts.filter((b) => !b.done);

  // slimes
  for (const s of state.slimes) {
    s.anim += dt;
    s.hit = Math.max(0, s.hit - dt);
    s.touch = Math.max(0, s.touch - dt);
    s.frozen = Math.max(0, s.frozen - dt);
    if (s.kx || s.ky) {
      moveWithCollision(s, s.kx * dt * 4, s.ky * dt * 4);
      s.kx *= 0.86;
      s.ky *= 0.86;
      if (Math.abs(s.kx) + Math.abs(s.ky) < 1) s.kx = s.ky = 0;
    }
    if (s.frozen > 0) continue;
    const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy);
    let vx, vy;
    if (d < SLIME_CHASE) {
      vx = (dx / d) * SLIME_SPEED;
      vy = (dy / d) * SLIME_SPEED;
    } else {
      s.wt -= dt;
      if (s.wt <= 0) {
        s.wander = rnd.range(0, 6.28);
        s.wt = rnd.range(0.8, 2);
      }
      vx = Math.cos(s.wander) * SLIME_SPEED * 0.4;
      vy = Math.sin(s.wander) * SLIME_SPEED * 0.4;
    }
    // slimes hop: they only move on the up-beat of their bounce
    const hop = Math.max(0, Math.sin(s.anim * 6));
    moveWithCollision(s, vx * dt * hop * 1.6, vy * dt * hop * 1.6);
    if (d < 11 && s.touch <= 0) {
      s.touch = 0.8;
      hurtPlayer(SLIME_TOUCH, s.x, s.y);
    }
  }
  state.slimes = state.slimes.filter((s) => !s.dead);

  // keep the field stocked
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    state.spawnTimer = 2.8;
    if (state.slimes.length < MAX_SLIMES) spawnSlime();
  }

  // hearts
  for (const h of state.pickups) {
    h.t += dt;
    if (Math.hypot(h.x - p.x, h.y - p.y) < 11) {
      h.taken = true;
      p.hp = Math.min(PLAYER_HP, p.hp + 15);
      floatText("+15", p.x, p.y - 18, "#7ee88a");
    }
  }
  state.pickups = state.pickups.filter((h) => !h.taken && h.t < 14);

  updateEffects(dt);
}

function updateEffects(dt) {
  for (const e of state.fxs) {
    if (e.follow) {
      e.fx.options.x = e.follow.x;
      e.fx.options.y = e.follow.y;
    }
    e.fx.update(dt);
  }
  state.fxs = state.fxs.filter((e) => !e.fx.done());
  for (const t of state.texts) {
    t.t += dt;
    t.y -= 16 * dt;
  }
  state.texts = state.texts.filter((t) => t.t < 0.9);
  state.shake = Math.max(0, state.shake - dt);
}

// ---- draw ---------------------------------------------------------------------------------------
function camera() {
  const p = state.player;
  let cx = Math.round(p.x - W / 2), cy = Math.round(p.y - 12 - H / 2);
  cx = Math.max(0, Math.min(MAP_W * TILE - W, cx));
  cy = Math.max(0, Math.min(MAP_H * TILE - H, cy));
  if (state.shake > 0) {
    cx += Math.round((Math.sin(time * 90) * state.shake * 14) | 0);
    cy += Math.round((Math.cos(time * 77) * state.shake * 14) | 0);
  }
  return [cx, cy];
}

function blit(frame, img, cv, cctx, cx, cy) {
  composite(frame, img.data, null);
  cctx.putImageData(img, 0, 0);
  ctx.drawImage(cv, 0, 0);
}

function draw() {
  const [cx, cy] = camera();
  ctx.fillStyle = "#0b0a10";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(groundCanvas, -cx, -cy);

  for (const f of [back, front]) {
    clearFrame(f);
    f.ox = cx;
    f.oy = cy;
  }
  for (const e of state.fxs) {
    e.fx.draw(back, "back");
    e.fx.draw(front, "front");
  }
  blit(back, backImg, backCv, backCtx, cx, cy);

  // depth-sorted things standing on the ground: trees, rocks, hearts, slimes, the wizard
  const items = [];
  for (const o of world.objects) {
    if (o.x + 20 < cx || o.x - 20 > cx + W || o.y < cy || o.y - 40 > cy + H) continue;
    items.push({ y: o.y, draw: () => (o.kind === "tree" ? drawTree(ctx, o.x - cx, o.y - cy, o.v) : drawRock(ctx, o.x - cx, o.y - cy, o.v)) });
  }
  for (const h of state.pickups) items.push({ y: h.y, draw: () => drawHeart(h, cx, cy) });
  for (const s of state.slimes) items.push({ y: s.y, draw: () => drawSlime(s, cx, cy) });
  items.push({ y: state.player.y, draw: () => drawPlayer(cx, cy) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  blit(front, frontImg, frontCv, frontCtx, cx, cy);
  drawHud(cx, cy);
}

function drawHeart(h, cx, cy) {
  const bob = Math.sin(h.t * 5) * 1.5;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(Math.round(h.x - cx - 3), Math.round(h.y - cy - 1), 6, 2);
  ctx.drawImage(SPRITES.heart, Math.round(h.x - cx - 4), Math.round(h.y - cy - 9 + bob));
}

function drawSlime(s, cx, cy) {
  const squash = Math.sin(s.anim * 6) > 0.2 ? "tall" : "flat";
  let img = SPRITES.slime[squash];
  if (s.hit > 0) img = SPRITES.slimeFlash[squash];
  else if (s.frozen > 0) img = SPRITES.slimeIce[squash];
  const x = Math.round(s.x - cx), y = Math.round(s.y - cy);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x - 6, y - 1, 12, 3);
  const shiver = s.frozen > 0 ? Math.round(Math.sin(time * 70) * 0.6) : 0;
  ctx.drawImage(img, x - (img.width >> 1) + shiver, y - img.height + 1);
}

function drawPlayer(cx, cy) {
  const p = state.player;
  const x = Math.round(p.x - cx), y = Math.round(p.y - cy);
  if (p.hurt > 0 && Math.floor(time * 20) % 2 === 0) return;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x - 6, y - 1, 12, 3);
  const bob = p.moving && Math.floor(p.walk * 8) % 2 === 0 ? 1 : 0;
  const stepB = p.moving && Math.floor(p.walk * 8) % 2 === 1;
  let sprite = SPRITES.wizard[p.face][stepB ? 1 : 0];
  const flip = p.face === "left";
  const sx = x - (sprite.width >> 1), sy = y - sprite.height + 1 - bob;
  // the staff: held on the side away from the facing, raised while the nova gathers
  const raised = p.charge > 0;
  const staffX = p.face === "left" ? x - 8 : p.face === "right" ? x + 7 : x + 8;
  const behind = p.face === "up";
  const drawStaff = () => {
    ctx.fillStyle = "#17121f";
    ctx.fillRect(staffX - 1, sy + (raised ? 0 : 4) - 1, 3, 15 + (raised ? 3 : 0));
    ctx.fillStyle = "#9a6a3a";
    ctx.fillRect(staffX, sy + (raised ? 0 : 4), 1, 14 + (raised ? 3 : 0));
    ctx.fillStyle = raised && Math.floor(time * 24) % 2 ? "#ffffff" : "#7fe0ff";
    ctx.fillRect(staffX - 1, sy + (raised ? -2 : 2), 3, 3);
  };
  if (behind) drawStaff();
  if (flip) {
    ctx.save();
    ctx.translate(x * 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, sx, sy);
    ctx.restore();
  } else ctx.drawImage(sprite, sx, sy);
  if (!behind) drawStaff();
}

function drawHud(cx, cy) {
  const p = state.player;
  // bars on the plain canvas
  ctx.fillStyle = "rgba(10,8,18,0.7)";
  ctx.fillRect(6, 6, 76, 22);
  ctx.fillStyle = "#3a1018";
  ctx.fillRect(10, 11, 68, 5);
  ctx.fillStyle = p.hp > 30 ? "#d8364a" : "#ff6a2a";
  ctx.fillRect(10, 11, Math.round((68 * p.hp) / PLAYER_HP), 5);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(10, 11, Math.round((68 * p.hp) / PLAYER_HP), 1);
  const ready = p.ultCd <= 0;
  ctx.fillStyle = "#10244a";
  ctx.fillRect(10, 19, 68, 4);
  ctx.fillStyle = ready ? (Math.floor(time * 6) % 2 ? "#ffffff" : "#9bdcff") : "#3a8bd8";
  ctx.fillRect(10, 19, Math.round(68 * (1 - p.ultCd / ULT_COOLDOWN)), 4);

  // pixelfx's own pixel font for words and numbers
  clearFrame(hud);
  hud.ox = 0;
  hud.oy = 0;
  const g = painterFor(hud).place(0, 0, false, 0);
  g.lightK = 0;
  const white = hex("#ffffff"), dark = hex("#0b0a10");
  g.text(`KILLS ${state.kills}`, W - 8, 8, white, { font: "mini", scale: 1, align: "right", outline: dark });
  g.text(ready ? "ULT READY [K]" : `ULT ${Math.ceil(p.ultCd)}`, 10, 30, ready ? hex("#9bdcff") : hex("#6f84b0"), { font: "mini", outline: dark });
  for (const t of state.texts) {
    const k = 1 - t.t / 0.9;
    g.text(t.str, Math.round(t.x - cx), Math.round(t.y - cy), hex(t.color), { font: "mini", scale: 1, align: "center", outline: dark, a: Math.min(1, k * 2) });
  }
  if (state.over) {
    g.text("GAME OVER", W / 2, 70, hex("#ff6a6a"), { font: "big", scale: 2, align: "center", outline: dark });
    g.text(`KILLS ${state.kills}`, W / 2, 96, white, { font: "mini", scale: 1, align: "center", outline: dark });
    g.text("PRESS ENTER", W / 2, 108, hex("#9bdcff"), { font: "mini", scale: 1, align: "center", outline: dark });
  }
  blit(hud, hudImg, hudCv, hudCtx, 0, 0);
}

// ---- loop & input -------------------------------------------------------------------------------
const GAME_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyJ", "KeyK", "KeyR", "Space", "Enter"]);
addEventListener("keydown", (e) => {
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  keys.add(e.code);
  tapped.add(e.code);
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());

function fit() {
  const s = Math.max(1, Math.min(Math.floor(innerWidth / W), Math.floor((innerHeight - 24) / H)));
  canvas.style.width = W * s + "px";
  canvas.style.height = H * s + "px";
}
addEventListener("resize", fit);
fit();

reset();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  tapped.clear();
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// handy for tests and debugging in the console
window.__game = { get state() { return state; }, keys, castUltimate, shootBolt, update, draw, reset };
