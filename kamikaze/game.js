// 경덕 특공대: a one-button arena game. Dash into the middle of the monster swarm and blow yourself up.
// Every explosion, pop and sparkle is a pixelfx effect (vendor/pixelfx); every sprite is drawn from strings below.

import { createFrame, clearFrame, createFx, composite } from "./vendor/pixelfx/src/core/index.js";
import * as smallBoom from "./vendor/pixelfx/src/fx/explosions/small-explosion.js";
import * as plasmaBoom from "./vendor/pixelfx/src/fx/explosions/plasma-explosion.js";
import * as bigBoom from "./vendor/pixelfx/src/fx/explosions/big-explosion.js";
import * as cartoonPow from "./vendor/pixelfx/src/fx/explosions/cartoon-pow.js";
import * as blinkIn from "./vendor/pixelfx/src/fx/arcane/blink-in.js";
import * as slimePop from "./vendor/pixelfx/src/fx/rpg/slime-pop.js";
import * as levelUp from "./vendor/pixelfx/src/fx/rpg/level-up.js";
import * as fighterJet from "./vendor/pixelfx/src/fx/rpg/fighter-jet.js";

const W = 384, H = 216;
const $ = (id) => document.getElementById(id);
const canvas = $("c"), stage = $("stage"), ctx = canvas.getContext("2d");
canvas.width = W;
canvas.height = H;
ctx.imageSmoothingEnabled = false;

const rnd = Math.random, rr = (a, b) => a + rnd() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---- sprites -------------------------------------------------------------------------------------------
function makeSprite(rows, pal) {
  const w = Math.max(...rows.map((r) => r.length)), c = Object.assign(document.createElement("canvas"), { width: w, height: rows.length });
  const g = c.getContext("2d");
  rows.forEach((row, y) => [...row].forEach((ch, x) => pal[ch] && ((g.fillStyle = pal[ch]), g.fillRect(x, y, 1, 1))));
  return c;
}
function flashed(src, color = "#ffffff", a = 0.85) {
  const c = Object.assign(document.createElement("canvas"), { width: src.width, height: src.height }), g = c.getContext("2d");
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.globalAlpha = a;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
// 경덕: a leather flight cap, goggles, a red scarf and a vest of dynamite
const KD_PAL = { k: "#1b1326", b: "#8e5c2c", B: "#c4894a", g: "#7fe0ff", w: "#ffffff", s: "#f3c49d", m: "#8a1a24", r: "#e0364a", t: "#c9a46a", y: "#d8362e", p: "#3a4a8a", o: "#5a3a20" };
const KD_HEAD = ["...kkkkkk...", "..kbBBbbbk..", ".kbbbbbbbbk.", ".kgwgbbgwgk.", ".kssssssssk.", "..kssmmssk..", "..krrrrrrk..", ".kttyttyttk.", "ksttyttyttsk", "ksttyttyttsk", ".kttttttttk.", "..kppppppk.."];
const KD = {
  a: makeSprite([...KD_HEAD, "..kppkkppk..", "..koo..ook..", "..kkk..kkk.."], KD_PAL),
  b: makeSprite([...KD_HEAD, ".kppk..kppk.", ".kook..kook.", ".kkkk..kkkk."], KD_PAL),
};
KD.aFlash = flashed(KD.a);
const SLIME_T = ["....kkkkkk....", "...kGGGgggk...", "..kGGgggggdk..", "..kgggggggdk..", ".kgewgggewgdk.", ".kgeegggeegdk.", ".kgggggggggdk.", ".kdgggggggddk.", "..kdddddddddk.", "...kkkkkkkk..."];
const SLIME_F = ["...kkkkkkkk...", "..kGGgggggdk..", ".kGggggggggdk.", "kgewgggewgggdk", "kgeegggeegggdk", "kdgggggggggddk", ".kdddddddddddk", "..kkkkkkkkkk.."];
const slimePal = { k: "#1a0a08", g: "#4ea84a", G: "#8ee070", d: "#2d6a34", e: "#1a0a08", w: "#ffffff" };
const BAT_UP = ["k...........k", "kPk.k...k.kPk", "kPPkpkkkpkPPk", ".kPPpepepPPk.", "..kPpppppPk..", "...kkpwpkk...", ".....kkk....."];
const BAT_DOWN = [".....k.k.....", "....kpkpk....", "....kpepek...", "kkkkkpppkkkkk", "kPPPPpwpPPPPk", ".kPPkkkkkPPk.", "..kk.....kk.."];
const batPal = { k: "#1a0f24", p: "#6b4a9a", P: "#4a2f72", e: "#ff4a5a", w: "#ffffff" };
const ORC_A = ["....kkkkk.....", "...kgggggk....", "..kgekgekgk...", "..kgggwggwk...", "...kgwwwgk....", "..kbbbbbbbk...", ".kgbbybbbbgk..", ".kgbbbbbbbgk..", ".kgkbbbbbkgk..", "..kkllllkk....", "...kllkllk....", "..kkkk.kkkk..."];
const ORC_B = [...ORC_A.slice(0, 10), "...kllkllk....", "...kkk.kkk...."];
const orcPal = { k: "#141a10", g: "#5a8a3a", e: "#ff4a3a", w: "#ece8d4", b: "#6a4426", y: "#ffd84a", l: "#3a3040" };
const BARREL = ["..kkkkkk..", ".krrhrrrk.", "kRrrhrrrRk", "kyyyyyyyyk", "kRrrrrrrRk", "kRrhrrrrRk", "kRrrrrrrRk", "kyyyyyyyyk", "kRrrrrrrRk", ".kRrrrrRk.", "..kkkkkk.."];
const barrelPal = { k: "#1a0a08", R: "#8a1a24", r: "#d8362e", h: "#ff7a6a", y: "#f2c14e" };
const pair = (a, b) => ({ a, b, aF: flashed(a), bF: flashed(b) });
const ART = {
  slime: pair(makeSprite(SLIME_T, slimePal), makeSprite(SLIME_F, slimePal)),
  bat: pair(makeSprite(BAT_UP, batPal), makeSprite(BAT_DOWN, batPal)),
  brute: pair(makeSprite(ORC_A, orcPal), makeSprite(ORC_B, orcPal)),
  barrel: pair(makeSprite(BARREL, barrelPal), makeSprite(BARREL, barrelPal)),
};

// ---- the floor: painted once ---------------------------------------------------------------------------
const floor = (() => {
  const c = Object.assign(document.createElement("canvas"), { width: W, height: H }), g = c.getContext("2d");
  const px = (x, y, col) => ((g.fillStyle = col), g.fillRect(x, y, 1, 1));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const r = hash(x, y), d = Math.hypot(x - W / 2, y - H / 2);
      const dirt = d < 36 + hash(x >> 2, y >> 2, 4) * 10;
      px(x, y, dirt ? (r < 0.1 ? "#8a6c40" : r < 0.16 ? "#c9a977" : "#b08f5c") : r < 0.07 ? "#2a5a2e" : r < 0.12 ? "#58a050" : "#3f7f3f");
    }
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(hash(i, 1, 7) * (W - 6)) + 3, y = Math.floor(hash(i, 2, 7) * (H - 6)) + 3;
    if (Math.hypot(x - W / 2, y - H / 2) < 52) continue;
    px(x, y, "#5fae55");
    px(x - 1, y - 1, "#5fae55");
    px(x + 1, y - 1, "#5fae55");
    if (i % 5 === 0) {
      px(x + 3, y + 2, ["#ffffff", "#ffd84a", "#ff8ac8", "#9bdcff"][i % 4]);
      px(x + 3, y + 3, "#2f6a32");
    }
  }
  // a fence of stones round the arena so the edge reads
  g.fillStyle = "rgba(0,0,0,.28)";
  g.fillRect(0, 0, W, 4);
  g.fillRect(0, H - 4, W, 4);
  g.fillRect(0, 0, 4, H);
  g.fillRect(W - 4, 0, 4, H);
  return c;
})();

// ---- pixelfx -----------------------------------------------------------------------------------------------
const frames = new Map();
let fxSeed = 7;
const fxs = [];
function addFx(mod, o = {}) {
  const { x, y, scale = 1, stopAt = null, follow = null, lift = 0, keep = false, ...rest } = o;
  const e = { fx: createFx(mod, { ...rest, x: 0, y: 0, seed: (fxSeed = (fxSeed * 1103515245 + 12345) & 0x7fffffff) % 1000 }), x, y, scale, stopAt, follow, lift, keep, hidden: false };
  if (rest.angle) e.fx.options.angle = rest.angle;
  fxs.push(e);
  // never let the effects pile up: the oldest go first
  // (the jets are kept: they are the player's plane and the squadron)
  while (fxs.length > 26) {
    const i = fxs.findIndex((f) => !f.keep);
    if (i < 0) break;
    fxs.splice(i, 1);
  }
  return e;
}
// effects are drawn at their own size into a private frame, then scaled onto the screen
function drawFx(e, layer) {
  if (e.hidden) return;
  const fx = e.fx, m = fx.meta, o = fx.options, rot = !!o.angle;
  const ow = m.size[0], oh = m.size[1];
  const side = rot ? Math.ceil(2 * Math.hypot(Math.max(m.origin[0], ow - m.origin[0]), Math.max(m.origin[1], oh - m.origin[1]))) : 0;
  const w = rot ? side : ow, h = rot ? side : oh, ox = rot ? side / 2 : m.origin[0], oy = rot ? side / 2 : m.origin[1];
  const key = w + "x" + h;
  let f = frames.get(key);
  if (!f) {
    f = { frame: createFrame(w, h), img: new ImageData(w, h), cv: Object.assign(document.createElement("canvas"), { width: w, height: h }) };
    frames.set(key, f);
  }
  clearFrame(f.frame);
  o.x = ox;
  o.y = oy;
  fx.draw(f.frame, layer);
  composite(f.frame, f.img.data, null);
  f.cv.getContext("2d").putImageData(f.img, 0, 0);
  const k = e.scale, px = e.follow ? e.follow.x : e.x, py = (e.follow ? e.follow.y : e.y) - e.lift;
  ctx.drawImage(f.cv, Math.round(px - ox * k), Math.round(py - oy * k), Math.round(w * k), Math.round(h * k));
}

// ---- sound: a few synthesised thumps -----------------------------------------------------------------------
let ac = null;
function audio() {
  try {
    ac ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
  } catch {}
  return ac;
}
function sfxBoom(k = 1) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime, len = 0.45 + Math.min(0.6, k * 0.05), buf = a.createBuffer(1, (a.sampleRate * len) | 0, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), o = a.createOscillator(), og = a.createGain();
  s.buffer = buf;
  f.type = "lowpass";
  f.frequency.setValueAtTime(2600, t);
  f.frequency.exponentialRampToValueAtTime(110, t + len);
  g.gain.value = 0.4 + Math.min(0.4, k * 0.03);
  s.connect(f).connect(g).connect(a.destination);
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(28, t + 0.4);
  og.gain.setValueAtTime(0.55, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  o.connect(og).connect(a.destination);
  s.start(t);
  o.start(t);
  o.stop(t + 0.5);
}
function sfxBlip(f0, f1, dur, type = "square", vol = 0.12) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// ---- game state --------------------------------------------------------------------------------------------
const TYPES = {
  slime: { hp: 1, r: 5, speed: 26, pts: 10 },
  bat: { hp: 1, r: 4, speed: 54, pts: 15 },
  brute: { hp: 3, r: 7, speed: 22, pts: 40 },
  barrel: { hp: 1, r: 5, speed: 0, pts: 5 },
  king: { hp: 26, r: 16, speed: 13, pts: 600 },
};
// the plasma blast is blue-violet by design; ours burns orange like the rest
const FIRE_PLASMA = { palette: ["#3a0e0a", "#8a1a10", "#d8361e", "#ff7a1a", "#ffc23c", "#fff07a", "#ffffff"], accent: ["#3a0e0a", "#c9281f", "#ff7a1a", "#ffc23d", "#fff3a6"] };
const RAID_CD = 20, RAID_SPEED = 300, RAID_LEAD = 0.55;
const DASH_SPEED = 390, DASH_MAX = 215, CRASH = 1.15, WALK = 104;
let best = 0;
try {
  best = +localStorage.getItem("kyungdeok.best") || 0;
} catch {}

const G = { mode: "title", t: 0, score: 0, wave: 0, standby: 5, R: 40, kills: 0, shake: 0, freeze: 0, raidCd: 8 };
const P = { x: W / 2, y: H / 2 + 24, face: 1, state: "walk", dashT: 0, tx: 0, ty: 0, dx: 0, dy: 0, inv: 0, respawn: 0, walk: 0, moving: false, trail: [] };
let raid = null, bombs = [], rings = [], lastBoomSfx = 0;
let enemies = [], queue = [], parts = [], texts = [], timers = [], combos = [], waveCooldown = 0, overT = 0, bossBanner = false;
const later = (t, fn) => timers.push({ t, fn });

function newGame() {
  Object.assign(G, { mode: "play", t: 0, score: 0, wave: 0, standby: 5, R: 40, kills: 0, shake: 0, freeze: 0, raidCd: 8 });
  Object.assign(P, { x: W / 2, y: H / 2 + 24, state: "walk", inv: 1.2, face: 1, trail: [] });
  enemies = [];
  queue = [];
  parts = [];
  texts = [];
  timers = [];
  combos = [];
  fxs.length = 0;
  raid = null;
  bombs = [];
  rings = [];
  spawnJet();
  waveCooldown = 0.5;
  overT = 0;
  $("title").hidden = true;
  $("over").hidden = true;
  addFx(blinkIn, { x: P.x, y: P.y, scale: 0.45, stopAt: 1.2 });
  sfxBlip(300, 900, 0.3, "triangle", 0.15);
}

// ---- waves -------------------------------------------------------------------------------------------------
function beginWave(w) {
  G.wave = w;
  const clusters = 3 + Math.floor(w / 2);
  let t = 0.5;
  queue = [];
  for (let i = 0; i < clusters; i++) {
    const roll = rnd();
    const type = w >= 3 && roll < 0.28 ? "brute" : w >= 2 && roll < 0.55 ? "bat" : "slime";
    const n = type === "slime" ? 5 + Math.floor(rnd() * 4) + Math.floor(w / 2) : type === "bat" ? 4 + Math.floor(w / 3) : 2 + Math.floor(w / 4);
    queue.push({ t, type, n, side: Math.floor(rnd() * 4) });
    t += Math.max(0.9, 1.9 - w * 0.06);
  }
  if (w % 5 === 0) queue.push({ t: t + 1.2, type: "king", n: 1, side: Math.floor(rnd() * 4) });
  // powder kegs lying about: shoot a blast at them to set off a chain
  for (let i = 0, nb = Math.min(4, 1 + Math.floor(w / 3)); i < nb; i++) {
    const x = rr(30, W - 30), y = rr(26, H - 26);
    if (Math.hypot(x - P.x, y - P.y) > 50) spawn("barrel", x, y);
  }
  banner(w % 5 === 0 ? `WAVE ${w}  보스 등장!` : `WAVE ${w}`);
}
function spawn(type, x, y) {
  const d = TYPES[type];
  const e = { type, x, y, hp: d.hp, max: d.hp, r: d.r, speed: d.speed * rr(0.9, 1.1), flash: 0, anim: rnd() * 6, kx: 0, ky: 0, ph: rnd() * 6, dead: false, tier: 0 };
  enemies.push(e);
  return e;
}
function spawnCluster(c) {
  const m = 14, [cx, cy] = [() => rr(30, W - 30), () => rr(24, H - 24)];
  const x0 = c.side === 0 ? -m : c.side === 1 ? W + m : cx(), y0 = c.side === 2 ? -m : c.side === 3 ? H + m : cy();
  for (let i = 0; i < c.n; i++) {
    if (enemies.length > 90) break;
    const a = rnd() * 6.283, d = Math.sqrt(rnd()) * (8 + c.n * 1.6);
    spawn(c.type, x0 + Math.cos(a) * d, y0 + Math.sin(a) * d);
  }
}

// ---- the blast ---------------------------------------------------------------------------------------------
function newCombo(x, y) {
  const c = { kills: 0, base: 0, t: 0.55, pending: 0, x, y, done: false };
  combos.push(c);
  return c;
}
function blast(x, y, R, o = {}) {
  const cb = o.combo, hurtPlayer = o.hurtPlayer;
  let kills = 0, hits = 0;
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
    if (d > R + e.r) continue;
    hits++;
    const dmg = (d < R * 0.45 ? 3 : d < R * 0.8 ? 2 : 1) * (o.power ?? 1) * (e.type === "king" ? (o.bossMul ?? 1) : 1);
    e.hp -= dmg;
    e.flash = 0.12;
    const k = 150 / Math.max(d, 4);
    e.kx += (dx / Math.max(d, 1)) * k * 0.7;
    e.ky += (dy / Math.max(d, 1)) * k * 0.7;
    if (e.hp <= 0) {
      kills++;
      kill(e, cb);
    }
  }
  if (hurtPlayer && P.state === "walk" && P.inv <= 0 && Math.hypot(P.x - x, P.y - y) < R * 0.7) playerDie("keg");
  // the picture, picked by how much it caught
  const K = o.kind ?? "player";
  if (K === "raid") {
    // bombs are cheap: a flash ring and a puff, with a real pixelfx blast now and then
    rings.push({ x, y, t: 0 });
    burst(x, y - 2, ["#ffd84a", "#ff7a1a", "#5c5c6b", "#3a3040"], 7);
    if (o.big) addFx(smallBoom, { x, y: y + 8, scale: 0.6, stopAt: 1.0 });
  } else if (K === "barrel") addFx(smallBoom, { x, y: y + 8, scale: 0.72, stopAt: 1.4 });
  else if (K === "mini") addFx(smallBoom, { x, y: y + 6, scale: 0.28, stopAt: 1.0 });
  else if (kills >= 12) addFx(bigBoom, { x, y: y + 8, scale: R / 62, stopAt: 2.4 });
  else if (kills >= 5) addFx(plasmaBoom, { x, y, scale: R / 52, stopAt: 1.6, ...FIRE_PLASMA });
  else addFx(smallBoom, { x, y: y + 8, scale: R / 46, stopAt: 1.7 });
  const kk = Math.min(kills, 20);
  if (K === "raid") {
    G.shake = Math.max(G.shake, 1.6);
    if (G.t - lastBoomSfx > 0.09) (lastBoomSfx = G.t), sfxBoom(0.35);
  } else {
    G.shake = Math.max(G.shake, K === "mini" ? 2 : Math.min(9, 3 + kk * 0.5));
    G.freeze = Math.max(G.freeze, K === "mini" ? 0.03 : 0.05 + kk * 0.005);
    sfxBoom(K === "mini" ? 0.5 : 1 + kk * 0.4);
  }
  if (cb) {
    cb.t = 0.55;
    cb.x = x;
    cb.y = y;
  }
  return { kills, hits };
}
function kill(e, cb) {
  e.dead = true;
  const d = TYPES[e.type];
  G.kills++;
  if (!cb?.raid) G.raidCd = Math.max(0, G.raidCd - 0.3);
  if (cb) {
    cb.kills++;
    cb.base += d.pts;
  } else G.score += d.pts;
  if (e.type === "slime") addFx(slimePop, { x: e.x, y: e.y + 4, scale: 0.38 });
  else if (e.type !== "barrel") burst(e.x, e.y - 3, e.type === "bat" ? ["#6b4a9a", "#4a2f72", "#ff4a5a"] : ["#5a8a3a", "#6a4426", "#ece8d4"], e.type === "king" ? 40 : 9);
  if (e.type === "barrel") {
    if (cb) cb.pending++;
    later(0.13, () => {
      blast(e.x, e.y, 38, { combo: cb, kind: "barrel", hurtPlayer: true });
      if (cb) cb.pending--;
    });
  }
  if (e.type === "king") {
    G.shake = 12;
    addFx(bigBoom, { x: e.x, y: e.y + 10, scale: 0.8, stopAt: 2.8 });
    banner("보스 격파!");
    for (const o of enemies) if (!o.dead && o.type !== "barrel" && o !== e) (o.dead = true), burst(o.x, o.y - 3, ["#8ee070", "#4ea84a"], 6), (G.score += 5);
  }
}
function burst(x, y, cols, n) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.283, s = rr(30, 110);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rr(0.4, 0.9), c: cols[i % cols.length], s: rnd() < 0.3 ? 2 : 1 });
  }
}
function finishCombos(dt) {
  for (const c of combos) {
    c.t -= dt;
    if (c.t > 0 || c.pending > 0 || c.done) continue;
    c.done = true;
    if (c.kills <= 0) continue;
    const add = c.base * (c.raid ? Math.ceil(c.kills / 3) : c.kills);
    G.score += add;
    const big = c.kills >= 8;
    pop(c.x, c.y - 14, c.raid ? `공습 ${c.kills}킬! +${add}` : c.kills >= 2 ? `${c.kills}연쇄! +${add}` : `+${add}`, big ? "#ffd84a" : "#fff6dc", big);
    if (c.raid) continue;
    if (c.kills >= 6) addFx(cartoonPow, { x: c.x, y: c.y - 8, scale: 0.34, text: c.kills >= 12 ? "KABOOM!" : c.kills >= 8 ? "BOOM!" : "CRASH!" });
    const bonus = c.kills >= 15 ? 2 : c.kills >= 8 ? 1 : 0;
    if (bonus) {
      G.standby += bonus;
      banner(c.kills >= 15 ? "초대박! 경덕 +2" : "대박! 경덕 +1");
      sfxBlip(500, 1400, 0.35, "triangle", 0.18);
    }
  }
  combos = combos.filter((c) => !c.done);
}
function pop(x, y, str, color, big) {
  texts.push({ x, y, str, color, t: 0, big });
}

// ---- the air raid: a flight of fighters sweeps the lane and carpet-bombs it ----------------------------------
function callRaid() {
  if (G.mode !== "play" || raid || G.raidCd > 0) return;
  // the lane: where the aim points, or the row with most enemies
  let y = usingTouch || !aim.has ? null : aim.y;
  if (y == null) {
    const t = bestTarget();
    y = t ? t.y : P.y;
    if (!t) {
      let bs = 0;
      for (const e of enemies) {
        const n = enemies.filter((o) => Math.abs(o.y - e.y) < 22).length;
        if (n > bs) (bs = n), (y = e.y);
      }
    }
  }
  y = clamp(y, 40, H - 36);
  const dir = rnd() < 0.5 ? 1 : -1, form = [[0, 0], [22, -15], [22, 15], [44, -30], [44, 30]];
  raid = { t: 0, dir, y, combo: null, jets: form.map(([back, side]) => ({ back, x: -99, y: y + side, drop: rr(0, 0.1) })) };
  G.raidCd = RAID_CD;
  banner("공군 출격! 공습 개시");
  sfxBlip(700, 160, 1.5, "sawtooth", 0.07);
}
function raidStep(dt) {
  if (!raid) return;
  raid.t += dt;
  const s = (raid.t - RAID_LEAD) * RAID_SPEED, hx = raid.dir > 0 ? -50 + s : W + 50 - s;
  if (raid.t < RAID_LEAD) return;
  if (!raid.combo) {
    raid.combo = newCombo(W / 2, raid.y);
    raid.combo.raid = true;
    raid.combo.pending = 1; // held open while the flight is overhead
    for (const j of raid.jets) j.fx = addFx(fighterJet, { follow: j, lift: 22, scale: 0.48, angle: raid.dir > 0 ? 0 : Math.PI, keep: true });
  }
  for (const j of raid.jets) {
    j.x = hx - raid.dir * j.back;
    if (j.x > 6 && j.x < W - 6) {
      j.drop -= dt;
      if (j.drop <= 0) {
        j.drop = rr(0.13, 0.2);
        bombs.push({ x: j.x + raid.dir * 6, y: j.y + rr(-5, 5), t: 0, fall: 0.38, n: (raid.n = (raid.n ?? 0) + 1) });
      }
    }
  }
  const out = raid.dir > 0 ? hx - raid.jets[raid.jets.length - 1].back * raid.dir > W + 60 : hx + 44 < -60;
  if (out) {
    for (const j of raid.jets) {
      const i = fxs.indexOf(j.fx);
      if (i >= 0) fxs.splice(i, 1);
    }
    raid.combo.pending = 0;
    raid = null;
  }
}
function bombsStep(dt) {
  for (const b of bombs) {
    b.t += dt;
    if (b.t >= b.fall && !b.hit) {
      b.hit = true;
      blast(b.x, b.y, 22, { combo: raid?.combo ?? combos.find((c) => c.raid && !c.done), kind: "raid", power: 0.75, bossMul: 0.3, big: b.n % 4 === 0, hurtPlayer: false });
    }
  }
  bombs = bombs.filter((b) => !b.hit);
  for (const r of rings) r.t += dt;
  rings = rings.filter((r) => r.t < 0.3);
}

// ---- 경덕 -------------------------------------------------------------------------------------------------
// 경덕 is always at the controls of his fighter
function spawnJet() {
  killJet();
  P.heading = P.face > 0 ? 0 : Math.PI;
  P.jet = addFx(fighterJet, { follow: P, lift: 9, scale: 0.44, angle: P.heading || 1e-4, keep: true });
}
function killJet() {
  if (!P.jet) return;
  const i = fxs.indexOf(P.jet);
  if (i >= 0) fxs.splice(i, 1);
  P.jet = null;
}
function launch(tx, ty) {
  if (P.state !== "walk") return;
  let dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy);
  if (d < 12) {
    dx = P.face;
    dy = 0;
    d = 70;
  }
  d = Math.min(d, DASH_MAX);
  P.dx = dx / Math.hypot(dx, dy);
  P.dy = dy / Math.hypot(dx, dy);
  P.dashT = d / DASH_SPEED;
  P.state = "dash";
  P.age = 0;
  P.trail = [];
  if (Math.abs(P.dx) > 0.2) P.face = Math.sign(P.dx);
  // nose down on the target
  P.heading = Math.atan2(P.dy, P.dx);
  burst(P.x, P.y - 6, ["#fff6dc", "#ffd84a"], 8);
  sfxBlip(180, 1500, Math.max(0.2, P.dashT), "sawtooth", 0.1);
}
function detonate() {
  if (P.state !== "dash") return;
  const cb = newCombo(P.x, P.y);
  P.state = "down";
  killJet();
  // the fighter hits the ground nose first
  burst(P.x, P.y - 8, ["#9aa6ba", "#5c6578", "#3a4254", "#ffb04a", "#ece8d4"], 26);
  blast(P.x, P.y, G.R * CRASH, { combo: cb, kind: "player", power: 1.25 });
  loseOne("blast");
}
function playerDie(cause) {
  if (P.state !== "walk" || P.inv > 0) return;
  P.state = "down";
  killJet();
  const cb = newCombo(P.x, P.y);
  blast(P.x, P.y, 20, { combo: cb, kind: "mini", power: 0.7 });
  burst(P.x, P.y - 6, ["#c9a46a", "#e0364a", "#8e5c2c", "#f3c49d"], 12);
  loseOne(cause);
}
function loseOne() {
  if (G.standby > 0) {
    G.standby--;
    P.respawn = 1.0;
  } else {
    G.mode = "dying";
    overT = 1.6;
  }
}
function respawn() {
  P.state = "walk";
  P.x = W / 2;
  P.y = H / 2 + 24;
  P.inv = 2.0;
  spawnJet();
  addFx(blinkIn, { x: P.x, y: P.y, scale: 0.45, stopAt: 1.2 });
  sfxBlip(300, 900, 0.25, "triangle", 0.12);
}
// the fullest spot within dash range, for the touch button (and the aim guide)
function bestTarget() {
  let best = null, bs = 0;
  for (const e of enemies) {
    if (e.dead || Math.hypot(e.x - P.x, e.y - P.y) > DASH_MAX + 10) continue;
    let s = 0, sx = 0, sy = 0;
    for (const o of enemies) {
      if (o.dead || Math.hypot(o.x - e.x, o.y - e.y) > G.R * 0.8) continue;
      const w = o.type === "barrel" ? 1.4 : o.type === "brute" ? 1.6 : 1;
      s += w;
      sx += o.x * w;
      sy += o.y * w;
    }
    const dd = Math.hypot(e.x - P.x, e.y - P.y);
    s -= dd * 0.002;
    if (s > bs) (bs = s), (best = { x: sx / Math.max(1, Math.round(s)), y: sy / Math.max(1, Math.round(s)), n: s });
  }
  if (best) {
    best.x = (best.x + (best.x - P.x) * 0) | 0;
    best.y = best.y | 0;
  }
  return best;
}

// ---- input -----------------------------------------------------------------------------------------------------
const keys = new Set();
const aim = { x: W / 2, y: H / 2, has: false };
let stickId = null, stickO = null, stickV = { x: 0, y: 0 }, usingTouch = false;
addEventListener("keydown", (e) => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === "Space" || e.code === "Enter") act();
  if (e.code === "KeyF" || e.code === "ShiftLeft" || e.code === "KeyE") callRaid();
});
addEventListener("keyup", (e) => keys.delete(e.code));
function toWorld(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
}
function act() {
  audio();
  if (G.mode === "title") return newGame();
  if (G.mode === "over" && overT <= 0) return newGame();
  if (G.mode !== "play") return;
  if (P.state === "walk") {
    if (usingTouch) {
      const t = bestTarget();
      launch(t ? t.x : P.x + P.face * 80, t ? t.y : P.y);
    } else launch(aim.x, aim.y);
  } else if (P.state === "dash" && P.age > 0.1) detonate();
}
stage.addEventListener("pointermove", (ev) => {
  if (ev.pointerType === "mouse") {
    Object.assign(aim, toWorld(ev), { has: true });
    usingTouch = false;
  }
  if (ev.pointerId === stickId) {
    const dx = ev.clientX - stickO.x, dy = ev.clientY - stickO.y, d = Math.hypot(dx, dy), k = Math.min(1, d / 48);
    stickV = d > 6 ? { x: (dx / d) * k, y: (dy / d) * k } : { x: 0, y: 0 };
    $("stick").firstElementChild.style.transform = `translate(${(stickV.x * 40).toFixed(0)}px,${(stickV.y * 40).toFixed(0)}px)`;
  }
});
stage.addEventListener("pointerdown", (ev) => {
  if (ev.target.closest("button")) return;
  if (ev.target.closest("#raid")) {
    if (ev.pointerType === "touch") (usingTouch = true), document.body.classList.add("touch");
    audio();
    return callRaid();
  }
  if (ev.pointerType !== "touch" && ev.button === 2) {
    Object.assign(aim, toWorld(ev), { has: true });
    usingTouch = false;
    return callRaid();
  }
  if (ev.pointerType === "touch") {
    usingTouch = true;
    document.body.classList.add("touch");
    if (ev.target.id === "fire") {
      $("fire").classList.add("down");
      return act();
    }
    const r = stage.getBoundingClientRect();
    if (stickId === null && ev.clientX < r.left + r.width * 0.6) {
      stickId = ev.pointerId;
      stickO = { x: ev.clientX, y: ev.clientY };
      stage.setPointerCapture?.(ev.pointerId);
      Object.assign($("stick").style, { display: "block", left: ev.clientX - r.left + "px", top: ev.clientY - r.top + "px" });
    } else act();
  } else {
    Object.assign(aim, toWorld(ev), { has: true });
    usingTouch = false;
    if (ev.button === 0) act();
  }
});
const endPointer = (ev) => {
  $("fire").classList.remove("down");
  if (ev.pointerId === stickId) {
    stickId = null;
    stickV = { x: 0, y: 0 };
    $("stick").style.display = "none";
  }
};
stage.addEventListener("pointerup", endPointer);
stage.addEventListener("pointercancel", endPointer);
$("start").addEventListener("click", () => newGame());
$("again").addEventListener("click", () => newGame());
addEventListener("contextmenu", (e) => e.preventDefault());

// ---- layout -------------------------------------------------------------------------------------------------------
function fit() {
  const s0 = Math.min(innerWidth / W, innerHeight / H), s = s0 >= 2 ? Math.floor(s0) : s0;
  stage.style.width = Math.round(W * s) + "px";
  stage.style.height = Math.round(H * s) + "px";
}
addEventListener("resize", fit);
addEventListener("orientationchange", () => setTimeout(fit, 150));
fit();

// ---- text on screen -------------------------------------------------------------------------------------------
let bannerT = 0;
function banner(str) {
  const b = $("banner");
  b.textContent = str;
  b.classList.remove("show");
  void b.offsetWidth;
  b.classList.add("show");
}

// ---- update --------------------------------------------------------------------------------------------------------
function update(dt) {
  G.t += dt;
  for (const e of fxs) {
    e.fx.update(dt);
    if (e.stopAt != null && e.fx.t >= e.stopAt) (e.fx.stop(), (e.stopAt = null));
  }
  for (let i = fxs.length - 1; i >= 0; i--) if (fxs[i].fx.done()) fxs.splice(i, 1);
  for (const p of parts) {
    p.life -= dt;
    p.vy += 260 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  parts = parts.filter((p) => p.life > 0);
  for (const t of texts) t.t += dt;
  texts = texts.filter((t) => t.t < 1.4);
  G.shake = Math.max(0, G.shake - dt * 22);
  if (G.freeze > 0) return void (G.freeze -= dt);
  for (const t of timers) t.t -= dt;
  const due = timers.filter((t) => t.t <= 0);
  timers = timers.filter((t) => t.t > 0);
  due.forEach((t) => t.fn());
  finishCombos(dt);

  if (G.mode === "dying" || G.mode === "over") {
    // the last blast plays out, then the result
    if (G.mode === "dying") {
      overT -= dt;
      stepEnemies(dt, false);
      if (overT <= 0) gameOver();
    } else overT = Math.max(0, overT - dt);
    return;
  }
  if (G.mode !== "play") return;

  // player
  P.inv = Math.max(0, P.inv - dt);
  P.moving = false;
  G.raidCd = Math.max(0, G.raidCd - dt);
  raidStep(dt);
  bombsStep(dt);
  if (P.state === "walk") {
    let mx = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) + stickV.x;
    let my = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) + stickV.y;
    const l = Math.hypot(mx, my);
    if (l > 0.05) {
      mx /= Math.max(1, l);
      my /= Math.max(1, l);
      P.x = clamp(P.x + mx * WALK * dt, 8, W - 8);
      P.y = clamp(P.y + my * WALK * dt, 14, H - 6);
      if (Math.abs(mx) > 0.15) P.face = Math.sign(mx);
      P.moving = true;
      P.walk += dt * 9;
      // bank the nose round to where we are going
      let da = Math.atan2(my, mx) - P.heading;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      P.heading += da * Math.min(1, dt * 9);
    }
  } else if (P.state === "dash") {
    P.age += dt;
    P.x = clamp(P.x + P.dx * DASH_SPEED * dt, 6, W - 6);
    P.y = clamp(P.y + P.dy * DASH_SPEED * dt, 12, H - 4);
    P.trail.unshift({ x: P.x, y: P.y });
    P.trail.length = Math.min(P.trail.length, 5);
    P.dashT -= dt;
    if (P.dashT <= 0) detonate();
  } else if (P.state === "down") {
    P.respawn -= dt;
    if (P.respawn <= 0 && G.mode === "play") respawn();
  }

  // waves
  if (G.wave === 0) {
    waveCooldown -= dt;
    if (waveCooldown <= 0) (waveCooldown = 0), beginWave(1);
  }
  if (queue.length) {
    queue[0].t -= dt;
    if (queue[0].t <= 0) spawnCluster(queue.shift());
  }
  if (P.jet) {
    P.jet.fx.options.angle = P.heading || 1e-4;
    P.jet.lift = 9 + Math.sin(G.t * 3) * 1.2;
    P.jet.hidden = P.inv > 0 && Math.floor(G.t * 14) % 2 === 1;
  }
  stepEnemies(dt, true);
  const live = enemies.filter((e) => !e.dead && e.type !== "barrel").length;
  if (G.wave > 0 && !queue.length && live === 0 && waveCooldown <= 0 && !combos.length && !raid && !bombs.length) {
    waveCooldown = 2.6;
    G.standby++;
    G.R = Math.min(58, G.R + 2);
    banner(`WAVE ${G.wave} 클리어!  경덕 +1`);
    addFx(levelUp, { x: P.x, y: P.y + 6, scale: 0.5 });
    sfxBlip(520, 1560, 0.4, "triangle", 0.16);
    enemies = enemies.filter((e) => e.type !== "barrel");
    later(waveCooldown - 0.2, () => G.mode === "play" && beginWave(G.wave + 1));
  } else if (waveCooldown > 0 && !queue.length) waveCooldown -= dt;
}
function stepEnemies(dt, hurt) {
  for (const e of enemies) {
    if (e.dead) continue;
    e.anim += dt;
    e.flash = Math.max(0, e.flash - dt);
    const d = TYPES[e.type];
    if (d.speed) {
      let tx = P.state === "down" || !hurt ? W / 2 : P.x, ty = P.state === "down" || !hurt ? H / 2 : P.y;
      let dx = tx - e.x, dy = ty - e.y;
      const l = Math.hypot(dx, dy) || 1;
      dx /= l;
      dy /= l;
      let sp = e.speed;
      if (e.type === "bat") {
        const w = Math.sin(e.anim * 5 + e.ph) * 0.9;
        const ndx = dx - dy * w, ndy = dy + dx * w;
        dx = ndx;
        dy = ndy;
      }
      if (e.type === "brute" && Math.sin(e.anim * 1.4 + e.ph) > 0.8) sp *= 2.2;
      e.x += dx * sp * dt;
      e.y += dy * sp * dt;
      if (Math.abs(dx) > 0.2) e.face = Math.sign(dx);
    }
    e.x += e.kx * dt;
    e.y += e.ky * dt;
    e.kx *= 0.88;
    e.ky *= 0.88;
    if (e.type === "king") {
      const q = e.hp > 17 ? 0 : e.hp > 9 ? 1 : 2;
      if (q > e.tier) {
        e.tier = q;
        for (let i = 0; i < 5; i++) spawn("slime", e.x + rr(-24, 24), e.y + rr(-20, 20));
        banner("왕 슬라임이 새끼를 낳았다!");
      }
    }
  }
  // keep clusters a little apart, not scattered
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    if (a.dead || a.type === "barrel") continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j];
      if (b.dead || b.type === "barrel") continue;
      const dx = b.x - a.x, dy = b.y - a.y, m = (a.r + b.r) * 0.55;
      if (Math.abs(dx) > m || Math.abs(dy) > m) continue;
      const d = Math.hypot(dx, dy) || 0.01;
      if (d < m) {
        const push = ((m - d) / d) * 0.5;
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
      }
    }
  }
  if (hurt && P.state === "walk" && P.inv <= 0) for (const e of enemies) if (!e.dead && e.type !== "barrel" && Math.hypot(e.x - P.x, (e.y - P.y) * 1.1) < e.r + 4) return playerDie("touch");
  enemies = enemies.filter((e) => !e.dead);
}
function gameOver() {
  G.mode = "over";
  raid = null;
  bombs = [];
  const isBest = G.score > best;
  if (isBest) {
    best = G.score;
    try {
      localStorage.setItem("kyungdeok.best", String(best));
    } catch {}
  }
  $("result").innerHTML = `웨이브 <b>${G.wave}</b>까지 · 처치 <b>${G.kills}</b> · 점수 <b>${G.score}</b>${isBest ? "<br>🎉 최고 기록!" : `<br>최고 기록 ${best}`}`;
  $("over").hidden = false;
  overT = 0.6;
}

// ---- draw --------------------------------------------------------------------------------------------------------------
function shadow(x, y, w) {
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(Math.round(x - w / 2), Math.round(y - 1), w, 3);
}
function drawEnemy(e) {
  const x = Math.round(e.x), y = Math.round(e.y), set = ART[e.type === "king" ? "slime" : e.type], fa = Math.floor(e.anim * (e.type === "bat" ? 10 : 4)) % 2;
  const im = e.flash > 0 ? (fa ? set.bF : set.aF) : fa ? set.b : set.a;
  const flip = e.face < 0 && e.type !== "slime" && e.type !== "king";
  if (e.type === "king") {
    const w = im.width * 3, h = im.height * 3;
    shadow(x, y + 1, 36);
    const bob = Math.round(Math.sin(e.anim * 3) * 2);
    ctx.drawImage(im, x - (w >> 1), y - h + 3 - bob, w, h);
    ctx.fillStyle = "#f2c14e";
    for (let i = 0; i < 5; i++) ctx.fillRect(x - 11 + i * 5, y - h - 5 - bob + (i % 2 ? 3 : 0), 3, 8 - (i % 2 ? 3 : 0));
    ctx.fillStyle = "#1a0a08";
    ctx.fillRect(x - 12, y - h + 1 - bob, 24, 2);
    const bw = 40;
    ctx.fillStyle = "#1a0a10";
    ctx.fillRect(x - bw / 2 - 1, y - h - 12, bw + 2, 4);
    ctx.fillStyle = "#ff5a5a";
    ctx.fillRect(x - bw / 2, y - h - 11, Math.max(0, Math.round((bw * e.hp) / e.max)), 2);
    return;
  }
  const w = im.width, h = im.height, lift = e.type === "bat" ? 8 + Math.round(Math.sin(e.anim * 6) * 2) : 0;
  shadow(x, y + 1, Math.max(8, w - 2));
  if (flip) {
    ctx.save();
    ctx.translate(x * 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(im, x - (w >> 1), y - h + 1 - lift);
    ctx.restore();
  } else ctx.drawImage(im, x - (w >> 1), y - h + 1 - lift);
  if (e.type === "barrel") {
    // a lit fuse
    ctx.fillStyle = Math.floor(G.t * 12) % 2 ? "#ffd84a" : "#ff7a2a";
    ctx.fillRect(x + 1, y - h - 1, 1, 1);
    ctx.fillRect(x, y - h + 0, 1, 1);
  }
  if (e.hp < e.max && e.type !== "barrel") {
    ctx.fillStyle = "#1a0a10";
    ctx.fillRect(x - 6, y - h - lift - 3, 12, 2);
    ctx.fillStyle = "#ff5a5a";
    ctx.fillRect(x - 6, y - h - lift - 3, Math.max(1, Math.round((12 * e.hp) / e.max)), 2);
  }
}
function drawPlayer() {
  if (P.state === "down" || (P.inv > 0 && Math.floor(G.t * 14) % 2)) return;
  // the fighter's shadow on the grass; the plane itself is a pixelfx effect drawn on top
  const x = Math.round(P.x), y = Math.round(P.y), c = Math.cos(P.heading), sn = Math.sin(P.heading);
  ctx.fillStyle = "rgba(0,0,0,0.33)";
  for (let i = -9; i <= 9; i++) ctx.fillRect(Math.round(x + c * i), Math.round(y + 2 + sn * i * 0.55), 2, Math.abs(i) < 4 ? 2 : 1);
  ctx.fillRect(Math.round(x - sn * 6), Math.round(y + 2 + c * 3), 3, 1);
  ctx.fillRect(Math.round(x + sn * 6), Math.round(y + 2 - c * 3), 3, 1);
}
function drawRaid() {
  if (raid && raid.t < RAID_LEAD) {
    // a warning band over the lane
    ctx.fillStyle = `rgba(255,70,60,${0.1 + 0.1 * Math.sin(G.t * 24)})`;
    ctx.fillRect(0, Math.round(raid.y - 34), W, 68);
    ctx.fillStyle = "rgba(255,216,74,.9)";
    for (let x = 0; x < W; x += 12) ctx.fillRect(x, Math.round(raid.y - 34), 6, 1), ctx.fillRect(x + 6, Math.round(raid.y + 33), 6, 1);
  }
  if (raid && raid.combo) {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    for (const j of raid.jets) ctx.fillRect(Math.round(j.x - 9), Math.round(j.y + 12), 18, 4);
  }
  for (const b of bombs) {
    const k = clamp(b.t / b.fall, 0, 1), h = (1 - k * k) * 40;
    ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.2 * k})`;
    ctx.fillRect(Math.round(b.x - 1 - k * 2), Math.round(b.y), 3 + Math.round(k * 4), 2);
    ctx.fillStyle = "#2a2f3a";
    ctx.fillRect(Math.round(b.x - 1), Math.round(b.y - h - 4), 3, 5);
    ctx.fillStyle = "#9aa6ba";
    ctx.fillRect(Math.round(b.x), Math.round(b.y - h - 4), 1, 3);
    ctx.fillStyle = "#e0364a";
    ctx.fillRect(Math.round(b.x - 1), Math.round(b.y - h - 6), 3, 1);
  }
  for (const r of rings) {
    ctx.globalAlpha = 1 - r.t / 0.3;
    ctx.strokeStyle = "#ffe26b";
    ctx.beginPath();
    ctx.arc(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, 4 + (r.t / 0.3) * 24, 0, 6.283);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
function drawReticle() {
  if (G.mode !== "play" || P.state !== "walk") return;
  let t = null;
  if (usingTouch) t = bestTarget();
  else if (aim.has) {
    const dx = aim.x - P.x, dy = aim.y - P.y, d = Math.hypot(dx, dy), k = Math.min(1, DASH_MAX / (d || 1));
    t = { x: P.x + dx * k, y: P.y + dy * k };
  }
  if (!t) return;
  ctx.save();
  ctx.globalAlpha = 0.55 + Math.sin(G.t * 8) * 0.15;
  ctx.fillStyle = "#fff6dc";
  const d = Math.hypot(t.x - P.x, t.y - P.y), n = Math.floor(d / 8);
  for (let i = 1; i < n; i++) ctx.fillRect(Math.round(P.x + ((t.x - P.x) * i) / n), Math.round(P.y - 6 + ((t.y - P.y) * i) / n), 1, 1);
  ctx.strokeStyle = "#ff5a5a";
  ctx.setLineDash([2, 3]);
  ctx.lineDashOffset = -G.t * 8;
  ctx.beginPath();
  ctx.arc(Math.round(t.x) + 0.5, Math.round(t.y) + 0.5, G.R, 0, 6.283);
  ctx.stroke();
  ctx.restore();
}
function draw() {
  ctx.save();
  if (G.shake > 0) ctx.translate(Math.round(rr(-G.shake, G.shake) * 0.5), Math.round(rr(-G.shake, G.shake) * 0.5));
  ctx.drawImage(floor, 0, 0);
  for (const e of fxs) drawFx(e, "back");
  drawReticle();
  drawRaid();
  const things = [...enemies.map((e) => ({ y: e.y, f: () => drawEnemy(e) })), { y: P.y, f: drawPlayer }].sort((a, b) => a.y - b.y);
  for (const t of things) t.f();
  for (const e of fxs) drawFx(e, "front");
  for (const p of parts) {
    ctx.fillStyle = p.c;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
  }
  for (const t of texts) {
    const a = t.t < 1 ? 1 : 1 - (t.t - 1) / 0.4, y = t.y - t.t * 14;
    ctx.globalAlpha = a;
    ctx.font = `800 ${t.big ? 13 : 10}px "Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#1b1326";
    ctx.strokeText(t.str, Math.round(t.x), Math.round(y));
    ctx.fillStyle = t.color;
    ctx.fillText(t.str, Math.round(t.x), Math.round(y));
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---- HUD ---------------------------------------------------------------------------------------------------------------------
const hudCache = {};
function setText(id, v) {
  if (hudCache[id] !== v) ((hudCache[id] = v), ($(id).textContent = v));
}
function hud() {
  setText("score", String(G.score));
  setText("best", String(Math.max(best, G.score)));
  setText("wave", G.wave ? `WAVE ${G.wave}` : "준비!");
  const live = enemies.filter((e) => e.type !== "barrel").length + (queue.reduce((s, c) => s + c.n, 0) || 0);
  setText("foes", G.mode === "play" ? `남은 적 ${live}` : "");
  const rp = G.mode === "play" ? Math.round((1 - G.raidCd / RAID_CD) * 100) : 0, ready = G.mode === "play" && G.raidCd <= 0 && !raid;
  const rb = $("raid");
  if (hudCache.rp !== rp) (hudCache.rp = rp), rb.style.setProperty("--p", rp);
  if (hudCache.rr !== ready) (hudCache.rr = ready), rb.classList.toggle("ready", ready);
  const L = $("lives");
  const html = "<i>" + "★".repeat(Math.min(G.standby, 12)) + (G.standby > 12 ? "+" + (G.standby - 12) : "") + (G.standby ? "" : "-") + "</i>";
  if (hudCache.lives !== html) (hudCache.lives = html), (L.innerHTML = html);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (document.hidden) return requestAnimationFrame(frame);
  update(dt);
  draw();
  hud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// title screen: the arena idles behind the menu
G.mode = "title";
window.__kd = { callRaid, get raid() { return raid; }, get bombs() { return bombs; }, addFx, mods: { smallBoom, plasmaBoom, bigBoom, cartoonPow, fighterJet, blinkIn, slimePop, levelUp }, FIRE_PLASMA, G, P, get enemies() { return enemies; }, newGame, launch, detonate, act, beginWave, spawn, blast, fxs };
