// Drawing: the scene's floor, effects behind and in front, depth-sorted things on the ground, the dark of the
// dungeons with their torches, the sky (the airstrike), the HUD, and the minimap.

import { createFrame, clearFrame, composite, painterFor, hex } from "./vendor/pixelfx/src/core/index.js";
import { W, H, TILE, ENEMIES, xpForLevel, SKILLS } from "./config.js";
import { G, camera, npcMarker } from "./game.js";
import { AIR, slotSkill } from "./skills.js";
import { input } from "./input.js";
import { SPRITES, drawTree, drawRock } from "./sprites.js";
import { HEROES, NPC_ART, LICH_ART, HOUSES, WELL, FENCE, SIGN, GRAVES, PILLAR, CAVE_MOUTH, CRYPT_GATE, BONES, CHESTS, COIN, LOOT_BAG, ICONS } from "./art.js";
import { T } from "./world.js";

let ctx, canvasEl, back, front, hud;
const imgs = new Map(), cvs = new Map();
export function initRender(canvas) {
  canvasEl = canvas;
  ctx = canvas.getContext("2d");
}
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
    cvs.set(frame, Object.assign(document.createElement("canvas"), { width: W, height: H }));
  }
  const img = imgs.get(frame), cv = cvs.get(frame);
  composite(frame, img.data, null);
  cv.getContext("2d").putImageData(img, 0, 0);
  ctx.drawImage(cv, 0, 0);
}
const C = { white: hex("#ffffff"), dark: hex("#0b0a10"), gold: hex("#ffd84a"), ice: hex("#9bdcff") };
const shadow = (x, y, w) => {
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(Math.round(x - w / 2), Math.round(y - 1), Math.round(w), 3);
};
const img = (im, x, y) => ctx.drawImage(im, Math.round(x), Math.round(y));

export function draw() {
  ensureFrames();
  const s = G.scene;
  let [cx, cy] = camera();
  if (G.shake > 0) {
    cx += Math.round(Math.sin(G.time * 90) * G.shake * 14);
    cy += Math.round(Math.cos(G.time * 77) * G.shake * 14);
  }
  ctx.fillStyle = s.dark ? "#050308" : "#0b0a10";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(s.ground, -cx, -cy);
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

  // flat things on the floor, shadows of things in the air, aim lines
  for (const o of s.objects)
    if (o.flat && o.kind === "bones") img(BONES, o.x - cx - 6, o.y - cy - 8);
    else if (o.flat) {
      ctx.fillStyle = "#2a221b";
      for (const [dx, dy] of [[-4, -3], [1, -5], [3, -2], [-1, -1]]) ctx.fillRect(Math.round(o.x - cx + dx), Math.round(o.y - cy + dy - 4), 2, 1);
    }
  for (const st of G.strikes ?? []) jetShadow(st.jx - cx + 10, st.jy - cy + 6, st.angle);
  for (const st of G.strikes ?? [])
    for (const b of st.bombs)
      if (b.state === "fall") {
        ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.3 * (1 - b.k)})`;
        const r = 2 + (1 - b.k) * 3;
        ctx.fillRect(Math.round(b.x - cx - r), Math.round(b.y - cy - 1), Math.round(r * 2), 2);
      }
  aimLines(cx, cy);

  const items = [];
  const vis = (x, y) => x > cx - 40 && x < cx + W + 40 && y > cy - 20 && y < cy + H + 60;
  for (const o of s.objects) if (!o.flat && vis(o.x, o.y)) items.push({ y: o.y, d: () => drawObject(o, cx, cy) });
  for (const c of s.chests) if (vis(c.x, c.y)) items.push({ y: c.y, d: () => drawChest(c, cx, cy) });
  for (const n of s.npcs) items.push({ y: n.y, d: () => drawNpc(n, cx, cy) });
  for (const k of G.pickups) items.push({ y: k.y, d: () => drawPickup(k, cx, cy) });
  for (const e of G.enemies) if (vis(e.x, e.y)) items.push({ y: e.y, d: () => drawEnemy(e, cx, cy) });
  for (const pr of G.projectiles) if (pr.owner === "enemy" && pr.kind === "arrow") items.push({ y: pr.y + 9, d: () => drawArrow(pr, cx, cy) });
  for (const d of G.dashes ?? []) items.push({ y: d.y - 0.1, d: () => drawHero(d.x - cx, d.y - cy, d.face, false, 0.25 * (d.t / 0.25)) });
  if (G.mode !== "title" && G.mode !== "class") items.push({ y: G.player.y, d: () => drawPlayer(cx, cy) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.d();

  for (const st of G.strikes ?? [])
    for (const b of st.bombs)
      if (b.state === "fall") {
        const h = AIR.altitude * b.k;
        img(SPRITES.bomb, b.x - st.ux * 30 * b.k - cx - 2, b.y - st.uy * 30 * b.k - cy - h - 8);
      }

  // torches: a flickering flame on the wall, its light added after the dark
  for (const t of s.torches) {
    const x = Math.round(t.x - cx), y = Math.round(t.y - cy);
    if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
    ctx.fillStyle = "#3a2410";
    ctx.fillRect(x - 1, y, 3, 4);
    const f = Math.floor(G.time * 10 + t.x) % 3;
    ctx.fillStyle = "#f2701f";
    ctx.fillRect(x - 1, y - 3 - (f === 1 ? 1 : 0), 3, 3);
    ctx.fillStyle = "#ffe27a";
    ctx.fillRect(x, y - 2 - (f === 2 ? 1 : 0), 1, 2);
  }
  if (s.dark) darkness(cx, cy);
  const g = painterFor(front).place(0, 0, false, 0);
  if (s.dark) {
    for (const t of s.torches) g.glow(t.x, t.y - 2, 38, hex("#f2701f"), 0.3 + 0.06 * Math.sin(G.time * 13 + t.x));
    g.glow(G.player.x, G.player.y - 10, 30, hex("#ffc46a"), 0.12);
  }
  blit(front);
  if (G.mode !== "title" && G.mode !== "class") drawHud(cx, cy);
}

function darkness(cx, cy) {
  const p = G.player, x = p.x - cx, y = p.y - 10 - cy;
  const gr = ctx.createRadialGradient(x, y, 40, x, y, Math.max(W, H) * 0.75);
  gr.addColorStop(0, "rgba(4,3,10,0)");
  gr.addColorStop(0.35, "rgba(4,3,10,0.45)");
  gr.addColorStop(1, "rgba(4,3,10,0.85)");
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, W, H);
}

function jetShadow(x, y, ang) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(ang);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  for (const [px, py] of [[30, 0], [8, -4], [-12, -22], [-18, -22], [-16, -4], [-28, -11], [-30, 0], [-28, 11], [-16, 4], [-18, 22], [-12, 22], [8, 4]]) ctx.lineTo(px, py);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// a dotted line for a direction skill being dragged on a touch screen
function aimLines(cx, cy) {
  if (G.mode !== "play") return;
  const p = G.player;
  for (let i = 0; i <= 4; i++) {
    const a = input.slots[i].aim, id = slotSkill(i);
    if (!a || !id || SKILLS[id].aim !== "dir") continue;
    const ox = p.x - cx, oy = p.y - 8 - cy, L = id === "blink" ? 72 : id === "dash" ? 84 : 70;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (let d = 10; d < L; d += 4) ctx.fillRect(Math.round(ox + a.x * d), Math.round(oy + a.y * d), 1, 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(Math.round(ox + a.x * L) - 1, Math.round(oy + a.y * L) - 1, 3, 3);
  }
}

function drawObject(o, cx, cy) {
  const x = o.x - cx, y = o.y - cy;
  switch (o.kind) {
    case "tree": return drawTree(ctx, x, y, o.v);
    case "rock": return drawRock(ctx, x, y, o.v);
    case "house": return img(HOUSES[o.v], x - 28, y - 50);
    case "well": return img(WELL, x - 12, y - 28);
    case "fence": return img(FENCE, x - 8, y - 12);
    case "sign": return img(SIGN, x - 8, y - 18);
    case "grave": return img(GRAVES[o.v], x - 7, y - 15);
    case "pillar": return img(PILLAR, x - 7, y - 29);
    case "cave": return img(CAVE_MOUTH, x - 20, y - 28);
    case "gate": return img(CRYPT_GATE[G.quests?.q2?.state === "complete" ? 1 : 0], x - 22, y - 38);
  }
}
function drawChest(c, cx, cy) {
  const open = G.opened?.includes(c.id);
  img(open ? (c.gold ? CHESTS.goldOpen : CHESTS.woodOpen) : c.gold ? CHESTS.gold : CHESTS.wood, c.x - cx - 8, c.y - cy - 14);
  if (!open && Math.floor(G.time * 2 + c.x) % 4 === 0) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(Math.round(c.x - cx + 4), Math.round(c.y - cy - 13), 1, 1);
  }
}
function drawNpc(n, cx, cy) {
  const frames = NPC_ART[n.id], im = frames[Math.floor(G.time * 1.5 + n.x) % 2];
  const x = n.x - cx, y = n.y - cy;
  shadow(x, y, 12);
  img(im, x - (im.width >> 1), y - im.height + 1);
  if (n.id === "elder") {
    ctx.fillStyle = "#5a3a20";
    ctx.fillRect(Math.round(x + 7), Math.round(y - 14), 1, 14);
  } else if (n.id === "guard") {
    ctx.fillStyle = "#5a3a20";
    ctx.fillRect(Math.round(x + 8), Math.round(y - 22), 1, 22);
    ctx.fillStyle = "#d0d8e6";
    ctx.fillRect(Math.round(x + 7), Math.round(y - 25), 3, 3);
  }
}
function drawPickup(k, cx, cy) {
  const x = k.x - cx, y = k.y - cy, bob = Math.round(Math.sin(k.t * 5) * 1);
  if (k.kind === "coin") return img(COIN, x - 2, y - 6 + bob);
  shadow(x, y, 6);
  if (k.kind === "potion") return img(ICONS[k.potion === "hp" ? "potionRed" : "potionBlue"], x - 6, y - 13 + bob);
  if (k.kind === "key") return img(ICONS[k.key], x - 6, y - 13 + bob);
  img(LOOT_BAG, x - 3, y - 8 + bob);
  // rare loot glows in its colour
  if (k.item.rarity >= 2 && Math.floor(G.time * 4) % 2) {
    ctx.fillStyle = ["#d8dce8", "#7ee88a", "#6ab4ff", "#c684ff", "#ffb04a"][k.item.rarity];
    ctx.fillRect(Math.round(x), Math.round(y - 11 + bob), 1, 1);
  }
}

function pick(set, e, frame) {
  const s = e.hit > 0 ? SPRITES[set + "Flash"] : e.frozen > 0 ? SPRITES[set + "Ice"] : SPRITES[set];
  return s[frame];
}
function drawEnemy(e, cx, cy) {
  const x = Math.round(e.x - cx), y = Math.round(e.y - cy), def = ENEMIES[e.type];
  if (e.spawnT < 0.4 && Math.floor(e.spawnT * 16) % 2 === 0) return;
  const shiver = e.frozen > 0 ? Math.round(Math.sin(G.time * 70) * 0.6) : 0;
  let im;
  if (e.type === "slime") {
    im = pick("slime", e, Math.sin(e.anim * 6) > 0.2 ? "tall" : "flat");
    shadow(x, y, 12);
    img(im, x - (im.width >> 1) + shiver, y - im.height + 1);
  } else if (e.type === "bat") {
    im = pick("bat", e, Math.sin(e.anim * 16) > 0 ? "up" : "down");
    shadow(x, y, 8);
    img(im, x - (im.width >> 1) + shiver, y - e.z - im.height);
  } else if (e.type === "archer" || e.type === "skeleton") {
    im = pick("archer", e, Math.floor(e.anim * 6) % 2 ? "flat" : "tall");
    shadow(x, y, 10);
    img(im, x - (im.width >> 1) + shiver, y - im.height + 1);
    const side = G.player.x >= e.x ? 1 : -1;
    if (e.type === "archer") {
      const bx = x + side * 6, by = y - 9;
      ctx.fillStyle = "#6a4426";
      for (let i = -4; i <= 4; i++) ctx.fillRect(bx + side * Math.round(2 - (i * i) / 8), by + i, 1, 1);
      ctx.fillStyle = "#d8d0c0";
      ctx.fillRect(bx + side * (e.draw > 0 ? -2 : 0), by - 4, 1, 9);
    } else {
      // a rusty sword, raised when winding up, and a round shield
      ctx.fillStyle = "#4a3020";
      ctx.fillRect(x - side * 7 - 2, y - 11, 4, 6);
      ctx.fillStyle = "#8a6a3e";
      ctx.fillRect(x - side * 7 - 1, y - 10, 2, 4);
      ctx.fillStyle = "#b8ad96";
      if (e.state === "swing") ctx.fillRect(x + side * 6, y - 22, 1, 10);
      else if (e.swung > 0) ctx.fillRect(x + side * 6, y - 9, side * 9, 1);
      else ctx.fillRect(x + side * 6, y - 16, 1, 8);
    }
  } else if (e.type === "king") {
    const frame = e.state === "crouch" ? "flat" : e.state === "air" ? "tall" : Math.sin(e.anim * 4) > 0.2 ? "tall" : "flat";
    im = pick("king", e, frame);
    shadow(x, y, 26 * (1 - Math.min(0.6, e.z / 100)));
    img(im, x - (im.width >> 1) + shiver, y - e.z - im.height + 1);
  } else if (e.type === "lich") {
    im = e.hit > 0 ? LICH_ART.flash : e.frozen > 0 ? LICH_ART.ice : LICH_ART.base;
    shadow(x, y, 14);
    img(im, x - (im.width >> 1) + shiver, y - e.z - im.height + 1);
  }
  if (e.stun > 0) {
    ctx.fillStyle = "#ffd84a";
    const a = G.time * 8;
    for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(x + Math.cos(a + i * 2.1) * 6), Math.round(y - def.hitY * 2 - 6 - e.z + Math.sin(a + i * 2.1) * 2), 1, 1);
  }
  if (!def.boss && e.hp < e.max) {
    const by = Math.round(y - e.z - def.hitY * 2 - 6);
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
  ctx.fillStyle = "#e0364a";
  ctx.fillRect(Math.round(x - ux * 6), Math.round(y - uy * 6), 1, 1);
}

// ---- the hero ------------------------------------------------------------------------------------
function heroSprite(face, stepFrame) {
  const set = G.cls === "mage" ? SPRITES.wizard : HEROES[G.cls];
  return set[face][stepFrame];
}
function drawHero(x, y, face, step, alpha = 1) {
  x = Math.round(x);
  y = Math.round(y);
  const sp = heroSprite(face, step ? 1 : 0), sx = x - (sp.width >> 1), sy = y - sp.height + 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (face === "left") {
    ctx.translate(x * 2, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(sp, sx, sy);
  ctx.restore();
}
function drawPlayer(cx, cy) {
  const p = G.player, x = Math.round(p.x - cx), y = Math.round(p.y - cy);
  if (p.hurt > 0 && !p.dash && Math.floor(G.time * 20) % 2 === 0) return;
  if (G.mode === "dead") ctx.globalAlpha = 0.4;
  shadow(x, y, 12);
  const step = p.moving && Math.floor(p.walk * 8) % 2 === 1, bob = p.moving && !step ? 1 : 0;
  const behind = p.face === "up", wx = p.face === "left" ? x - 8 : p.face === "right" ? x + 7 : x + 8, sy = y - 16 - bob;
  const weapon = () => drawWeapon(wx, sy, p);
  if (behind) weapon();
  drawHero(x, y - bob, p.face, step, G.mode === "dead" ? 0.4 : 1);
  if (!behind) weapon();
  ctx.globalAlpha = 1;
}
function drawWeapon(wx, sy, p) {
  const busy = p.charge > 0 || (G.strikes ?? []).some((s) => s.t < 0.4);
  if (G.cls === "mage") {
    ctx.fillStyle = "#17121f";
    ctx.fillRect(wx - 1, sy + (busy ? 0 : 4) - 1, 3, 15 + (busy ? 3 : 0));
    ctx.fillStyle = "#9a6a3a";
    ctx.fillRect(wx, sy + (busy ? 0 : 4), 1, 14 + (busy ? 3 : 0));
    ctx.fillStyle = busy && Math.floor(G.time * 24) % 2 ? "#ffffff" : "#7fe0ff";
    ctx.fillRect(wx - 1, sy + (busy ? -2 : 2), 3, 3);
  } else if (G.cls === "knight") {
    const swinging = (p.cds.slash ?? 0) > 0.28 || (p.cds.spin ?? 0) > 5.7 || p.dash;
    const dir = p.face === "left" ? -1 : 1;
    ctx.fillStyle = "#5a3a20";
    ctx.fillRect(wx - 1, sy + 10, 3, 2);
    ctx.fillStyle = "#e8ecf4";
    if (swinging) ctx.fillRect(wx + (dir > 0 ? 1 : -11), sy + 10, 11, 1);
    else ctx.fillRect(wx, sy + 1, 1, 9);
    ctx.fillStyle = "#f2c14e";
    ctx.fillRect(wx - 1, sy + 9, 3, 1);
  } else {
    const dir = p.face === "left" ? -1 : 1, bx = wx + dir * 1, by = sy + 8, drawn = (p.cds.arrow ?? 0) > 0.2 || (p.cds.pierce ?? 0) > 3.8;
    ctx.fillStyle = "#6a4426";
    for (let i = -5; i <= 5; i++) ctx.fillRect(bx + dir * Math.round(2 - (i * i) / 12), by + i, 1, 1);
    ctx.fillStyle = "#d8d0c0";
    ctx.fillRect(bx - dir * (drawn ? 2 : 0), by - 5, 1, 11);
  }
}

// ---- HUD -----------------------------------------------------------------------------------------
function bar(x, y, w, h, k, bg, fg) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fg;
  const fw = Math.round(w * Math.max(0, Math.min(1, k)));
  ctx.fillRect(x, y, fw, h);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(x, y, fw, 1);
}
function drawHud(cx, cy) {
  const p = G.player, s = G.stats;
  const red = Math.max(G.flash * 1.6, p.hp / s.maxHp < 0.3 ? 0.16 + 0.1 * Math.sin(G.time * 6) : 0);
  if (red > 0) {
    ctx.fillStyle = `rgba(220,30,40,${Math.min(0.5, red)})`;
    ctx.fillRect(0, 0, W, 3);
    ctx.fillRect(0, H - 3, W, 3);
    ctx.fillRect(0, 0, 3, H);
    ctx.fillRect(W - 3, 0, 3, H);
  }
  ctx.fillStyle = "rgba(10,8,18,0.75)";
  ctx.fillRect(4, 4, 92, 31);
  bar(8, 8, 84, 6, p.hp / s.maxHp, "#3a1018", "#d8364a");
  bar(8, 17, 84, 4, p.mp / s.maxMp, "#10244a", "#3f8cff");
  bar(8, 24, 84, 2, p.xp / xpForLevel(p.lv), "#2a2410", "#ffd84a");
  img(COIN, 8, 28);
  if (G.boss?.aggro) {
    const bw = Math.min(150, W - 30), by = 44;
    ctx.fillStyle = "rgba(10,8,18,0.75)";
    ctx.fillRect(W / 2 - bw / 2 - 2, by, bw + 4, 9);
    bar(W / 2 - bw / 2, by + 2, bw, 5, G.boss.hp / G.boss.max, "#2a0a20", G.boss.type === "lich" ? "#9a48ec" : "#7ee88a");
  }

  clearFrame(hud);
  hud.ox = hud.oy = 0;
  const g = painterFor(hud).place(0, 0, false, 0);
  g.lightK = 0;
  const o = { font: "mini", outline: C.dark };
  g.text(`${Math.ceil(p.hp)}/${s.maxHp}`, 10, 9, C.white, o);
  g.text(`LV ${p.lv}`, 92, 28, C.gold, { ...o, align: "right" });
  g.text(`${p.gold}`, 15, 28, C.gold, o);
  for (const n of G.scene.npcs) {
    const m = npcMarker(n.id);
    if (m) g.text(m, Math.round(n.x - cx), Math.round(n.y - cy - 30 + Math.sin(G.time * 4) * 1.5), m === "?" ? C.gold : hex("#ffe066"), { font: "big", align: "center", outline: C.dark });
  }
  for (const t of G.texts) {
    const k = 1 - t.t / 0.9;
    g.text(t.str, Math.round(t.x - cx), Math.round(t.y - cy), hex(t.color), { font: "mini", scale: t.big ? 2 : 1, align: "center", outline: C.dark, a: Math.min(1, k * 2) });
  }
  if (!input.touch && input.mouse.over && G.mode === "play" && !G.scene.safe) {
    const mx = Math.round(input.mouse.x), my = Math.round(input.mouse.y);
    for (const [dx, dy] of [[-3, 0], [-2, 0], [2, 0], [3, 0], [0, -3], [0, -2], [0, 2], [0, 3]]) g.px(mx + dx, my + dy, C.white);
  }
  blit(hud);
}

// ---- minimap (a DOM canvas) ----------------------------------------------------------------------
const MAP_COL = { [T.GRASS]: "#2f5f30", [T.PATH]: "#8a6c40", [T.WATER]: "#2a5fa8", [T.CAVE]: "#5a4c3e", [T.CAVE_WALL]: "#15110d", [T.CRYPT]: "#48445a", [T.CRYPT_WALL]: "#100e16", [T.COBBLE]: "#6e6e7e" };
let mapScene = null, mapBase = null;
export function drawMinimap(el) {
  const s = G.scene;
  if (!s || !el) return;
  if (el.width !== s.w * 2 || el.height !== s.h * 2) {
    el.width = s.w * 2;
    el.height = s.h * 2;
  }
  const g = el.getContext("2d");
  if (mapScene !== s) {
    mapScene = s;
    mapBase = document.createElement("canvas");
    mapBase.width = s.w * 2;
    mapBase.height = s.h * 2;
    const b = mapBase.getContext("2d");
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) {
        b.fillStyle = s.solid[y * s.w + x] && s.tiles[y * s.w + x] === T.GRASS ? "#1d3f20" : MAP_COL[s.tiles[y * s.w + x]];
        b.fillRect(x * 2, y * 2, 2, 2);
      }
  }
  g.clearRect(0, 0, el.width, el.height);
  g.drawImage(mapBase, 0, 0);
  if (s.explored) {
    g.fillStyle = "#050308";
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (!s.explored[y * s.w + x]) g.fillRect(x * 2, y * 2, 2, 2);
  }
  const dot = (x, y, c, r = 2) => {
    const tx = (x / TILE) * 2, ty = (y / TILE) * 2;
    if (s.explored && !s.explored[Math.floor(y / TILE) * s.w + Math.floor(x / TILE)]) return;
    g.fillStyle = c;
    g.fillRect(Math.round(tx - r / 2), Math.round(ty - r / 2), r, r);
  };
  for (const pt of [...s.portals, ...(s.activeExit ? [s.activeExit] : [])]) dot(pt.x, pt.y, "#c684ff", 3);
  for (const c of s.chests) if (!G.opened.includes(c.id)) dot(c.x, c.y, "#ffd84a");
  for (const n of s.npcs) dot(n.x, n.y, npcMarker(n.id) ? "#ffe066" : "#9be07a", 3);
  for (const e of G.enemies) if (ENEMIES[e.type].boss) dot(e.x, e.y, "#ff4a5a", 4);
  if (Math.floor(G.time * 3) % 2) dot(G.player.x, G.player.y, "#ffffff", 3);
  else dot(G.player.x, G.player.y, "#9bdcff", 3);
}
