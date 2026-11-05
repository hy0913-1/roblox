// A playtest bot that plays the real game logic faster than real time (no drawing). Load it in the page:
//   const bot = await import('./tools/bot.js'); bot.start('mage'); bot.stage({ ... }); ...
// tools/playtest.mjs drives it through the whole game and prints what happened. It plays like a careful but
// not clever player: walks (BFS on tiles) to the nearest enemy, keeps range with ranged classes, casts every
// skill that is ready, drinks potions at 40 % HP, goes home to restock when potions run out, equips better
// gear, enhances weapon and armour, buys potions, hands in quests.

import { G, update, newGame, enterScene, acceptQuest, completeQuest, equipItem, enhance, advanceJob, respawnInTown, itemStats, recalcStats } from "../game.js";
import { input, endFrame, releaseAll } from "../input.js";
import { isSolidAt } from "../world.js";
import { TILE, QUESTS, ENEMIES, POTIONS, ENHANCE, CLASSES } from "../config.js";
import { skillReady, slotSkill, SLOT_COUNT } from "../skills.js";
import { show } from "../ui.js";

const DT = 1 / 30;
const RANGED = { mage: 70, ranger: 85, knight: 0, thief: 0 };
export const log = [];
let st = null;

const W = { atk: 3, def: 2.2, maxHp: 0.35, maxMp: 0.1, crit: 260, speed: 0.8, lifesteal: 300 };
const score = (it) => (it ? Object.entries(itemStats(it)).reduce((a, [k, v]) => a + (W[k] ?? 0) * v, 0) : -1);

export function start(cls, branchPick = 0) {
  newGame(cls);
  show("pause"); // stops main.js's own frame loop from updating; we drive update() ourselves
  G.mode = "play";
  input.touch = true; // skills auto-aim
  st = { cls, branchPick, deaths: 0, recalls: 0, potions: 0, t: 0, stuck: 0, last: { x: 0, y: 0 }, path: null, pathT: 0, nudge: null };
  log.length = 0;
}

// ---- town: quests, shop, gear, smith -------------------------------------------------------------------
function quests() {
  for (const [id, q] of Object.entries(G.quests)) {
    const def = QUESTS[id];
    if (q.state === "available" && (def.minLevel ?? 0) <= G.player.lv) acceptQuest(id);
    if (q.state === "ready") {
      const r = completeQuest(id);
      if (r === "job2") advanceJob(Object.keys(CLASSES[G.cls].branches)[st.branchPick]);
      log.push({ ev: "quest", id, lv: G.player.lv, t: Math.round(st.t) });
    }
  }
}
function gear() {
  for (const it of [...G.bag]) if ((!it.cls || it.cls === G.cls) && score(it) > score(G.equip[it.slot])) equipItem(it.id);
  // sell everything else
  for (const it of [...G.bag]) {
    G.player.gold += Math.round(it.value / 2);
    G.bag.splice(G.bag.indexOf(it), 1);
  }
}
function shop() {
  const p = G.player, buy = (k, n) => {
    while ((G.potions[k] ?? 0) < n && p.gold >= POTIONS[k].price + 40) (p.gold -= POTIONS[k].price), G.potions[k]++;
  };
  if (p.lv >= 10) buy("hp2", 8), buy("mp2", 4);
  buy("hp", 10), buy("mp", 5);
}
function smith() {
  const p = G.player;
  for (let n = 0; n < 40; n++) {
    const it = ["weapon", "armor", "helmet", "boots", "trinket"].map((s) => G.equip[s]).filter((x) => x && x.plus < 7).sort((a, b) => a.plus - b.plus)[0];
    if (!it || p.gold < ENHANCE.cost(it) + 250) break;
    enhance(it);
  }
}
export function town() {
  if (G.scene.id !== "town") enterScene("town", "start");
  quests();
  gear();
  shop();
  smith();
  quests();
  recalcStats();
  G.player.hp = G.stats.maxHp;
  G.player.mp = G.stats.maxMp;
}

// ---- moving: BFS over the tile grid ----------------------------------------------------------------------
function solid(tx, ty) {
  const s = G.scene;
  return tx < 0 || ty < 0 || tx >= s.w || ty >= s.h || isSolidAt(s, tx * TILE + 8, ty * TILE + 8) || nearPortal(tx * TILE + 8, ty * TILE + 12);
}
// portals take you out of the scene (and a dungeon resets when you come back): the bot keeps off them
function nearPortal(x, y, r = 22) {
  const s = G.scene;
  return [...s.portals, ...(s.activeExit ? [s.activeExit] : [])].some((pt) => Math.hypot(pt.x - x, (pt.y - y) / 0.6) < r);
}
function bfs(fx, fy, tx, ty) {
  const s = G.scene, w = s.w, h = s.h, prev = new Int32Array(w * h).fill(-1), q = [fy * w + fx];
  prev[q[0]] = q[0];
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi], cx = c % w, cy = (c / w) | 0;
    if (cx === tx && cy === ty) {
      const path = [];
      for (let k = c; k !== q[0]; k = prev[k]) path.push(k);
      return path.reverse().map((k) => ({ x: (k % w) * TILE + 8, y: ((k / w) | 0) * TILE + 12 }));
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx, ny = cy + dy, n = ny * w + nx;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || prev[n] >= 0 || solid(nx, ny)) continue;
      if (dx && dy && (solid(cx + dx, cy) || solid(cx, cy + dy))) continue;
      prev[n] = c;
      q.push(n);
    }
  }
  return null;
}
function steerTo(x, y) {
  const p = G.player;
  st.pathT -= DT;
  if (!st.path || st.pathT <= 0 || Math.hypot(st.path.gx - x, st.path.gy - y) > 24) {
    const pts = bfs(Math.floor(p.x / TILE), Math.floor((p.y - 4) / TILE), Math.floor(x / TILE), Math.floor((y - 4) / TILE));
    st.path = { pts: pts ?? [], gx: x, gy: y };
    st.pathT = 0.4;
  }
  const pts = st.path.pts;
  while (pts.length > 1 && Math.hypot(pts[0].x - p.x, pts[0].y - p.y) < 6) pts.shift();
  const t = pts.length > 1 ? pts[0] : { x, y };
  return [t.x - p.x, t.y - p.y];
}

// ---- one frame of play ------------------------------------------------------------------------------------
export function think(focus) {
  const p = G.player, s = G.stats, live = G.enemies.filter((e) => !e.dead && !(ENEMIES[e.type].event && ENEMIES[e.type].flee && false));
  if (p.hp < s.maxHp * 0.4 && (G.potions.hp || G.potions.hp2)) (input.potion.hp = true), st.potions++;
  if (p.mp < s.maxMp * 0.2 && (G.potions.mp || G.potions.mp2)) input.potion.mp = true;
  let tgt = null, best = 1e9;
  for (const e of live) {
    let d = Math.hypot(e.x - p.x, e.y - p.y);
    if (focus && e.type === focus) d -= 2000; // go for the boss
    if (d < best) (best = d), (tgt = e);
  }
  let mx = 0, my = 0;
  if (tgt) {
    const d = Math.hypot(tgt.x - p.x, tgt.y - p.y), keep = RANGED[st.cls];
    if (keep && d < keep * 0.6) {
      mx = p.x - tgt.x;
      my = p.y - tgt.y;
    } else if (d > (keep || 10)) [mx, my] = steerTo(tgt.x, tgt.y);
    const reach = keep ? 140 : 34;
    input.slots[0].held = d < reach;
    if (d < 120) for (let i = 1; i < SLOT_COUNT; i++) if (!window.__botSkip?.includes(i) && slotSkill(i) && skillReady(slotSkill(i))) input.slots[i].release = "auto";
  } else {
    input.slots[0].held = false;
    const k = G.pickups.find((k) => k.kind !== "coin");
    if (k) [mx, my] = steerTo(k.x, k.y);
  }
  // stuck: push sideways for a moment
  if (st.nudge && (st.nudge.t -= DT) > 0) [mx, my] = [st.nudge.x, st.nudge.y];
  else if (mx || my) {
    if (Math.hypot(p.x - st.last.x, p.y - st.last.y) < 0.3) st.stuck += DT;
    else st.stuck = 0;
    if (st.stuck > 1) {
      const a = Math.random() * 6.28;
      st.nudge = { t: 0.6, x: Math.cos(a), y: Math.sin(a) };
      st.stuck = 0;
      st.path = null;
    }
  }
  st.last = { x: p.x, y: p.y };
  let l = Math.hypot(mx, my);
  // never step onto a portal: turn aside
  for (let k = 0; k < 4 && l > 1 && nearPortal(p.x + (mx / l) * 10, p.y + (my / l) * 10, 16); k++) [mx, my] = [-my, mx];
  l = Math.hypot(mx, my);
  input.stick.x = l > 1 ? mx / l : 0;
  input.stick.y = l > 1 ? my / l : 0;
  return tgt;
}

// Play one stage. done(): stop condition. Returns a summary.
export function stage({ name, scene, entry = "start", done, focus = null, focusLv = 0, maxMin = 25 }) {
  town();
  const lv0 = G.player.lv, d0 = st.deaths, r0 = st.recalls, p0 = st.potions, t0 = st.t;
  enterScene(scene, entry);
  let bossT = null, bossMax = 0, taken = 0, hits = 0, lowest = 1;
  const limit = t0 + maxMin * 60;
  while (!done() && st.t < limit) {
    if (G.mode === "dead") {
      st.deaths++;
      respawnInTown();
      town();
      enterScene(scene, entry);
      continue;
    }
    if (G.scene.id !== scene) enterScene(scene, entry); // walked through a portal by accident
    const outOf = !G.potions.hp && !G.potions.hp2;
    if (outOf && G.player.hp < G.stats.maxHp * 0.35 && !G.boss?.aggro) {
      st.recalls++;
      town();
      enterScene(scene, entry);
      continue;
    }
    const f = focus && G.player.lv >= focusLv ? focus : null;
    think(f);
    if (G.boss && !G.boss.dead && G.boss.hp < G.boss.max && bossT == null) (bossT = st.t), (bossMax = G.boss.max), (taken = 0), (hits = 0), (lowest = 1);
    const hp0 = G.player.hp;
    update(DT, input);
    if (bossT != null && G.boss && !G.boss.dead && G.player.hp < hp0) (taken += hp0 - G.player.hp), hits++;
    if (bossT != null && G.boss && !G.boss.dead) lowest = Math.min(lowest, G.player.hp / G.stats.maxHp);
    endFrame();
    st.t += DT;
    if (G.quests && Math.floor(st.t) !== Math.floor(st.t - DT)) quests();
  }
  releaseAll();
  const r = {
    name, ok: done(), lvIn: lv0, lvOut: G.player.lv, min: +((st.t - t0) / 60).toFixed(1), deaths: st.deaths - d0, recalls: st.recalls - r0,
    potions: st.potions - p0, bossHp: bossMax, bossTaken: Math.round(taken), bossHits: hits, bossLow: Math.round(lowest * 100), bossSec: bossT == null ? null : Math.round(st.t - bossT), job: `${G.job.rank}${G.job.branch ? ":" + G.job.branch : ""}`,
    atk: G.stats.atk, def: G.stats.def, hp: G.stats.maxHp, gold: G.player.gold, gear: Object.values(G.equip).filter(Boolean).map((it) => `${it.tier}/${it.rarity}+${it.plus}`).join(" "),
  };
  log.push(r);
  town();
  return r;
}
export const state = () => st;
