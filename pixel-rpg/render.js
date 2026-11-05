// Drawing: ground, effects (behind and in front), depth-sorted things on the ground, the sky, the HUD.

import { createFrame, clearFrame, composite, painterFor, hex } from "./vendor/pixelfx/src/core/index.js";
import { W, H, AIR, ENEMIES, xpForLevel } from "./config.js";
import { G, world, camera } from "./game.js";
import { input } from "./input.js";
import { SPRITES, drawTree, drawRock } from "./sprites.js";

let ctx;
let back, front, hud, canvasEl;
const imgs = new Map();
const layer = () => Object.assign(document.createElement("canvas"), { width: W, height: H });
const cvs = new Map();

export function initRender(canvas) {
  canvasEl = canvas;
  ctx = canvas.getContext("2d");
}

// frames follow the view size; resizing a canvas also resets its context, so smoothing is switched off again
function ensureFrames() {
  if (back && back.w === W && back.h === H && canvasEl.width === W && canvasEl.height === H) return;
  canvasEl.width = W;
  canvasEl.height = H;
  ctx.imageSmoothingEnabled = false;
  back = createFrame(W, H);
  front = createFrame(W, H);
  hud = createFrame(W, H);
  imgs.clear();
  cvs.clear();
}

function blit(frame) {
  if (!imgs.has(frame)) {
    imgs.set(frame, new ImageData(W, H));
    cvs.set(frame, layer());
  }
  const img = imgs.get(frame), cv = cvs.get(frame);
  composite(frame, img.data, null);
  cv.getContext("2d").putImageData(img, 0, 0);
  ctx.drawImage(cv, 0, 0);
}

const C = {
  white: hex("#ffffff"), dark: hex("#0b0a10"), ice: hex("#9bdcff"), dim: hex("#6f84b0"), red: hex("#ff6a6a"),
  gold: hex("#ffd84a"), green: hex("#7ee88a"), ember: hex("#ffb04a"),
};

export function draw() {
  ensureFrames();
  let [cx, cy] = camera();
  if (G.shake > 0) {
    cx += Math.round(Math.sin(G.time * 90) * G.shake * 14);
    cy += Math.round(Math.cos(G.time * 77) * G.shake * 14);
  }
  ctx.fillStyle = "#0b0a10";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(world.ground, -cx, -cy);

  for (const f of [back, front]) {
    clearFrame(f);
    f.ox = cx;
    f.oy = cy;
  }
  for (const e of G.fxs) {
    e.fx.draw(back, "back");
    e.fx.draw(front, "front");
  }
  blit(back);

  // shadows of things in the air, under everything that stands
  for (const st of G.strikes) jetShadow(st.jx - cx + 10, st.jy - cy + 6, st.angle);
  for (const st of G.strikes)
    for (const b of st.bombs)
      if (b.state === "fall") {
        ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.3 * (1 - b.k)})`;
        const r = 2 + (1 - b.k) * 3;
        ctx.fillRect(Math.round(b.x - cx - r), Math.round(b.y - cy - 1), Math.round(r * 2), 2);
      }
  boltAimLine(cx, cy);

  const items = [];
  for (const o of world.objects) {
    if (o.x + 20 < cx || o.x - 20 > cx + W || o.y < cy || o.y - 40 > cy + H) continue;
    items.push({ y: o.y, d: () => (o.kind === "tree" ? drawTree(ctx, o.x - cx, o.y - cy, o.v) : drawRock(ctx, o.x - cx, o.y - cy, o.v)) });
  }
  for (const g of G.gems) items.push({ y: g.y, d: () => drawGem(g, cx, cy) });
  for (const h of G.hearts) items.push({ y: h.y, d: () => drawHeart(h, cx, cy) });
  for (const e of G.enemies) items.push({ y: e.y, d: () => drawEnemy(e, cx, cy) });
  for (const a of G.arrows) items.push({ y: a.y + 9, d: () => drawArrow(a, cx, cy) });
  if (G.mode !== "over" && G.mode !== "dying") items.push({ y: G.player.y, d: () => drawPlayer(cx, cy) });
  else if (G.mode === "dying") items.push({ y: G.player.y, d: () => drawPlayer(cx, cy, true) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.d();

  // bombs falling (above the things on the ground)
  for (const st of G.strikes)
    for (const b of st.bombs)
      if (b.state === "fall") {
        const h = AIR.altitude * b.k, x = b.x - st.ux * 30 * b.k, y = b.y - st.uy * 30 * b.k;
        ctx.drawImage(SPRITES.bomb, Math.round(x - cx - 2), Math.round(y - cy - h - 8));
      }

  blit(front);
  if (G.mode !== "title") drawHud(cx, cy);
}

function jetShadow(x, y, ang) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(ang);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(8, -4);
  ctx.lineTo(-12, -22);
  ctx.lineTo(-18, -22);
  ctx.lineTo(-16, -4);
  ctx.lineTo(-28, -11);
  ctx.lineTo(-30, 0);
  ctx.lineTo(-28, 11);
  ctx.lineTo(-16, 4);
  ctx.lineTo(-18, 22);
  ctx.lineTo(-12, 22);
  ctx.lineTo(8, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function boltAimLine(cx, cy) {
  const a = input.bolt.aim;
  if (!a || G.mode !== "play") return;
  const p = G.player, ox = p.x - cx, oy = p.y - 8 - cy;
  ctx.fillStyle = "rgba(155,220,255,0.8)";
  for (let d = 10; d < 70; d += 4) ctx.fillRect(Math.round(ox + a.x * d), Math.round(oy + a.y * d), 1, 1);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(Math.round(ox + a.x * 72) - 1, Math.round(oy + a.y * 72) - 1, 3, 3);
}

function shadow(x, y, w) {
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(Math.round(x - w / 2), Math.round(y - 1), Math.round(w), 3);
}

function pick(set, e, frame) {
  const s = e.hit > 0 ? SPRITES[set + "Flash"] : e.frozen > 0 ? SPRITES[set + "Ice"] : SPRITES[set];
  return s[frame];
}

function drawEnemy(e, cx, cy) {
  const x = Math.round(e.x - cx), y = Math.round(e.y - cy);
  if (x < -40 || x > W + 40 || y < -40 || y > H + 80) return;
  const shiver = e.frozen > 0 ? Math.round(Math.sin(G.time * 70) * 0.6) : 0;
  // a fresh spawn blinks in
  if (e.spawnT < 0.5 && Math.floor(e.spawnT * 16) % 2 === 0) return;
  let img;
  if (e.type === "slime") {
    img = pick("slime", e, Math.sin(e.anim * 6) > 0.2 ? "tall" : "flat");
    shadow(x, y, 12);
    ctx.drawImage(img, x - (img.width >> 1) + shiver, y - img.height + 1);
  } else if (e.type === "bat") {
    img = pick("bat", e, Math.sin(e.anim * 16) > 0 ? "up" : "down");
    shadow(x, y, 8);
    ctx.drawImage(img, x - (img.width >> 1) + shiver, Math.round(y - e.z - img.height));
  } else if (e.type === "archer") {
    img = pick("archer", e, e.moving !== false && Math.floor(e.anim * 6) % 2 ? "flat" : "tall");
    shadow(x, y, 10);
    ctx.drawImage(img, x - (img.width >> 1) + shiver, y - img.height + 1);
    // the bow, on the side facing you, string drawn back when shooting
    const side = G.player.x >= e.x ? 1 : -1, bx = x + side * 6, by = y - 9;
    ctx.fillStyle = "#6a4426";
    for (let i = -4; i <= 4; i++) ctx.fillRect(bx + side * Math.round(2 - (i * i) / 8), by + i, 1, 1);
    ctx.fillStyle = "#d8d0c0";
    const pull = e.draw > 0 ? -2 : 0;
    ctx.fillRect(bx + side * pull - (side < 0 ? 0 : 0), by - 4, 1, 9);
  } else if (e.type === "king") {
    const frame = e.state === "crouch" ? "flat" : e.state === "air" ? "tall" : Math.sin(e.anim * 4) > 0.2 ? "tall" : "flat";
    img = pick("king", e, frame);
    shadow(x, y, 26 * (1 - Math.min(0.6, e.z / 100)));
    ctx.drawImage(img, x - (img.width >> 1) + shiver, Math.round(y - e.z - img.height + 1));
  }
  // small health bar on hurt enemies (the boss has the big one)
  if (e.type !== "king" && e.hp < e.max) {
    const by = Math.round(y - e.z - ENEMIES[e.type].hitY * 2 - 6);
    ctx.fillStyle = "#1a0a10";
    ctx.fillRect(x - 6, by, 12, 2);
    ctx.fillStyle = "#ff5a5a";
    ctx.fillRect(x - 6, by, Math.max(1, Math.round((12 * e.hp) / e.max)), 2);
  }
}

function drawArrow(a, cx, cy) {
  const x = a.x - cx, y = a.y - cy, l = Math.hypot(a.vx, a.vy) || 1, ux = a.vx / l, uy = a.vy / l;
  ctx.fillStyle = "#d8d0c0";
  for (let i = 0; i < 7; i++) ctx.fillRect(Math.round(x - ux * i), Math.round(y - uy * i), 1, 1);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  ctx.fillStyle = "#e0364a";
  ctx.fillRect(Math.round(x - ux * 6), Math.round(y - uy * 6), 1, 1);
}

function drawGem(g, cx, cy) {
  const img = g.v > 1 ? SPRITES.bigGem : SPRITES.gem, bob = g.pull ? 0 : Math.round(Math.sin(g.t * 4) * 1);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(Math.round(g.x - cx - 2), Math.round(g.y - cy), 4, 1);
  ctx.drawImage(img, Math.round(g.x - cx - img.width / 2), Math.round(g.y - cy - img.height - 2 + bob));
}

function drawHeart(h, cx, cy) {
  const bob = Math.sin(h.t * 5) * 1.5;
  if (h.t > 16 && Math.floor(h.t * 8) % 2) return;
  shadow(h.x - cx, h.y - cy, 6);
  ctx.drawImage(SPRITES.heart, Math.round(h.x - cx - 4), Math.round(h.y - cy - 9 + bob));
}

function drawPlayer(cx, cy, dying = false) {
  const p = G.player, x = Math.round(p.x - cx), y = Math.round(p.y - cy);
  if (!dying && p.hurt > 0 && Math.floor(G.time * 20) % 2 === 0) return;
  shadow(x, y, 12);
  const step = p.moving && Math.floor(p.walk * 8) % 2 === 1, bob = p.moving && !step ? 1 : 0;
  const sprite = SPRITES.wizard[p.face][step ? 1 : 0];
  const sx = x - (sprite.width >> 1), sy = y - sprite.height + 1 - bob;
  const raised = p.charge > 0 || G.strikes.some((s) => s.t < 0.4);
  const staffX = p.face === "left" ? x - 8 : p.face === "right" ? x + 7 : x + 8, behind = p.face === "up";
  const staff = () => {
    ctx.fillStyle = "#17121f";
    ctx.fillRect(staffX - 1, sy + (raised ? 0 : 4) - 1, 3, 15 + (raised ? 3 : 0));
    ctx.fillStyle = "#9a6a3a";
    ctx.fillRect(staffX, sy + (raised ? 0 : 4), 1, 14 + (raised ? 3 : 0));
    ctx.fillStyle = raised && Math.floor(G.time * 24) % 2 ? "#ffffff" : "#7fe0ff";
    ctx.fillRect(staffX - 1, sy + (raised ? -2 : 2), 3, 3);
  };
  if (dying) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, G.dyingTimer / 1.4);
  }
  if (behind) staff();
  if (p.face === "left") {
    ctx.save();
    ctx.translate(x * 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, sx, sy);
    ctx.restore();
  } else ctx.drawImage(sprite, sx, sy);
  if (!behind) staff();
  if (dying) ctx.restore();
}

// ---- HUD ----------------------------------------------------------------------------------------
function bar(x, y, w, h, k, bg, fg, shine = true) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fg;
  ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, k))), h);
  if (shine) {
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, k))), 1);
  }
}

function drawHud(cx, cy) {
  const p = G.player, s = G.stats;
  // hurt flash and low-health pulse round the edges
  const low = p.hp / s.maxHp < 0.3 ? 0.18 + 0.12 * Math.sin(G.time * 6) : 0;
  const red = Math.max(G.flash * 1.6, low);
  if (red > 0) {
    ctx.fillStyle = `rgba(220,30,40,${Math.min(0.5, red)})`;
    ctx.fillRect(0, 0, W, 3);
    ctx.fillRect(0, H - 3, W, 3);
    ctx.fillRect(0, 0, 3, H);
    ctx.fillRect(W - 3, 0, 3, H);
  }
  ctx.fillStyle = "rgba(10,8,18,0.72)";
  ctx.fillRect(5, 5, 86, 21);
  bar(9, 9, 78, 6, p.hp / s.maxHp, "#3a1018", p.hp / s.maxHp > 0.3 ? "#d8364a" : "#ff6a2a");
  bar(9, 18, 78, 3, G.xp / xpForLevel(G.level), "#10244a", "#7fe0ff", false);

  const desk = !input.touch;
  const slots = desk ? [["ULT", "K", p.ultCd, s.ultCooldown, "#9bdcff"], ["AIR", "E", p.airCd, s.airCooldown, "#ffb04a"]] : [];
  slots.forEach(([, , cd, max, color], i) => slot(6 + i * 34, H - 24, cd / max, color));
  if (G.boss) {
    ctx.fillStyle = "rgba(10,8,18,0.72)";
    const by = W < 260 ? 46 : 26, bw = Math.min(120, W - 24);
    ctx.fillRect(W / 2 - bw / 2 - 2, by, bw + 4, 9);
    bar(W / 2 - bw / 2, by + 2, bw, 5, G.boss.hp / G.boss.max, "#1a3010", "#7ee88a");
  }

  clearFrame(hud);
  hud.ox = hud.oy = 0;
  const g = painterFor(hud).place(0, 0, false, 0);
  g.lightK = 0;
  const o = { font: "mini", outline: C.dark };
  g.text(`${Math.ceil(p.hp)}`, 9, 10, C.white, { ...o });
  g.text(`LV ${G.level}`, 9, 23, C.ice, o);
  const w = G.wave;
  // a narrow (portrait) view has no room beside the health panel, so wave and score go under it
  const narrow = W < 260;
  if (narrow) {
    g.text(w.n ? `WAVE ${w.n}` : "READY", 9, 31, C.white, o);
    g.text(`${G.score}`, 9, 39, C.gold, o);
  } else {
    g.text(w.n ? `WAVE ${w.n}` : "READY", W / 2, 6, C.white, { ...o, align: "center" });
    g.text(`${G.score}`, W / 2, 14, C.gold, { ...o, align: "center" });
  }
  if (G.boss) g.text("KING SLIME", W / 2, narrow ? 57 : 37, C.green, { ...o, align: "center" });
  slots.forEach(([name, key, cd], i) => {
    const x = 6 + i * 34;
    g.text(name, x + 15, H - 20, cd <= 0 ? C.dark : C.white, { font: "mini", align: "center" });
    g.text(cd > 0 ? `${Math.ceil(cd)}` : key, x + 15, H - 12, cd <= 0 ? C.dark : C.dim, { font: "mini", align: "center" });
  });
  for (const t of G.texts) {
    const k = 1 - t.t / 0.9;
    g.text(t.str, Math.round(t.x - cx), Math.round(t.y - cy), hex(t.color), { font: "mini", scale: t.big ? 2 : 1, align: "center", outline: C.dark, a: Math.min(1, k * 2) });
  }
  for (const b of G.banners) {
    const k = b.t < 0.2 ? b.t / 0.2 : b.t > 1.8 ? (2.2 - b.t) / 0.4 : 1;
    const top = narrow ? 92 : 62;
    g.text(b.str, W / 2, top - (1 - k) * 6, hex(b.color), { font: "big", scale: 2, align: "center", outline: C.dark, a: k });
    if (b.sub && /^[\x20-\x7e]*$/.test(b.sub)) g.text(b.sub, W / 2, top + 20, C.white, { font: "mini", align: "center", outline: C.dark, a: k });
  }
  // a crosshair at the mouse
  if (desk && input.mouse.over && G.mode === "play") {
    const mx = Math.round(input.mouse.x), my = Math.round(input.mouse.y);
    for (const [dx, dy] of [[-3, 0], [-2, 0], [2, 0], [3, 0], [0, -3], [0, -2], [0, 2], [0, 3]]) g.px(mx + dx, my + dy, C.white);
  }
  blit(hud);
}

// a skill slot: lit when ready, filling up from the bottom while it recharges
function slot(x, y, cd, color) {
  ctx.fillStyle = "#0b0a10";
  ctx.fillRect(x, y, 30, 19);
  ctx.fillStyle = cd <= 0 ? color : "#1c2440";
  ctx.fillRect(x + 1, y + 1, 28, 17);
  if (cd > 0) {
    const h = Math.round(17 * (1 - cd));
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x + 1, y + 18 - h, 28, h);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(x + 1, y + 1, 28, 1);
  }
}
