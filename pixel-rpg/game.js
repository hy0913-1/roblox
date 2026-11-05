// The rules: scenes and travel, the hero and their stats, enemies and their AI, projectiles, loot, levels, quests,
// interaction and saving. Skills are in skills.js, drawing in render.js, menus in ui.js.

import { createFx, Rng, PAL } from "./vendor/pixelfx/src/core/index.js";
import * as frostHit from "./vendor/pixelfx/src/fx/rpg/frost-hit.js";
import * as slimePop from "./vendor/pixelfx/src/fx/rpg/slime-pop.js";
import * as airBlast from "./vendor/pixelfx/src/fx/rpg/airstrike-blast.js";
import * as strikeMarker from "./vendor/pixelfx/src/fx/rpg/strike-marker.js";
import * as frostBolt from "./vendor/pixelfx/src/fx/rpg/frost-bolt.js";
import * as levelUpFx from "./vendor/pixelfx/src/fx/rpg/level-up.js";
import * as chestBurst from "./vendor/pixelfx/src/fx/rpg/chest-burst.js";
import * as healFx from "./vendor/pixelfx/src/fx/rpg/heal.js";
import * as portalFx from "./vendor/pixelfx/src/fx/rpg/portal.js";
import * as blinkFx from "./vendor/pixelfx/src/fx/rpg/blink.js";
import { W, H, TILE, CLASSES, SKILLS, ENEMIES, enemyScale, xpForLevel, MAX_LEVEL, GEAR, RARITY, POTIONS, KEY_ITEMS, QUESTS, START_QUESTS, BAG_SIZE, NPCS } from "./config.js";
import { getScene, isSolidAt, isWaterAt } from "./world.js";
import { sfx } from "./audio.js";
import { castSkill, updateSkills, skillReady } from "./skills.js";

export const G = { mode: "title" };
export const rnd = new Rng(Date.now() % 100000);
let uid = 1;

export const SHADOW_PAL = ["#050308", "#1c1230", "#2c1a4a", "#432468", "#6b2cc0", "#9a48ec", "#c684ff", "#ecc8ff"];
const SLAM_PAL = ["#0d1a0c", "#173a14", "#265e18", "#3f8a1e", "#6cb82a", "#a8e04a", "#e0ff8a", "#ffffff"];
const POP_PAL = { bat: ["#1a0f24", "#2e1a46", "#4a2f72", "#6b4a9a", "#9a72d0", "#c4a4f0", "#ecdcff", "#ffffff"], archer: [...PAL.bone, "#ffffff"], skeleton: [...PAL.bone, "#ffffff"], lich: SHADOW_PAL };
const PORTAL_PAL = { green: ["#08201a", "#17663e", "#24924e", "#3ec466", "#7ee88a", "#c8ffc4", "#ffffff"], purple: undefined, shadow: SHADOW_PAL.slice(1) };
export const RARITY_FX = [
  ["#1e1e26", "#5c5c6b", "#a4a4b2", "#d0d0da", "#f0f0f6", "#ffffff"],
  ["#08201a", "#17663e", "#3ec466", "#7ee88a", "#c8ffc4", "#ffffff"],
  ["#0c1430", "#1f4f94", "#3f8cff", "#7cc8ff", "#c8f0ff", "#ffffff"],
  ["#140a26", "#481c88", "#9a48ec", "#c684ff", "#ecc8ff", "#ffffff"],
  ["#1e1206", "#86520c", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
];

// ---- effects & feedback ------------------------------------------------------------------------------
let fxSeed = 1;
export function addFx(mod, opts, follow) {
  const o = { seed: (fxSeed = (fxSeed * 1103515245 + 12345) & 0x7fffffff) % 1000 };
  for (const k in opts) if (opts[k] !== undefined) o[k] = opts[k];
  const e = { fx: createFx(mod, o), follow };
  G.fxs.push(e);
  return e;
}
export function text(str, x, y, color, big = false) {
  G.texts.push({ str, x, y, color, t: 0, big });
}
export function toast(msg, color = "#eaf2ff") {
  G.toasts.push({ msg, color, t: 0 });
}
export const shake = (k) => (G.shake = Math.max(G.shake, k));

// ---- new game, saving ----------------------------------------------------------------------------
export function newGame(cls) {
  Object.assign(G, {
    mode: "play",
    time: 0,
    cls,
    player: { x: 0, y: 0, dx: 0, dy: 1, face: "down", hp: 1, mp: 1, hurt: 0, walk: 0, moving: false, lv: 1, xp: 0, gold: 30, cds: {}, calm: 0 },
    bag: [],
    equip: { weapon: null, armor: null, trinket: null },
    potions: { hp: 3, mp: 2 },
    keys: { wing: 0, doll: 0, radio: 0 },
    quests: {},
    flags: {},
    opened: [],
  });
  for (const q of START_QUESTS) G.quests[q] = { state: "available", n: 0 };
  const starter = { mage: "staff1", knight: "sword1", ranger: "bow1" }[cls];
  G.equip.weapon = makeItem(starter, 0);
  G.equip.armor = makeItem("armor1", 0);
  recalcStats();
  G.player.hp = G.stats.maxHp;
  G.player.mp = G.stats.maxMp;
  enterScene("town", "start");
  toast(`${CLASSES[cls].title}의 모험이 시작됩니다`, CLASSES[cls].color);
}

const SAVE_KEY = "frostwizard.rpg.save";
export function saveGame() {
  if (!G.cls || G.mode === "title") return;
  const p = G.player;
  const data = { v: 1, cls: G.cls, time: G.time, p: { x: p.x, y: p.y, hp: p.hp, mp: p.mp, lv: p.lv, xp: p.xp, gold: p.gold }, scene: G.scene.id, bag: G.bag, equip: G.equip, potions: G.potions, keys: G.keys, quests: G.quests, flags: G.flags, opened: G.opened };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {}
}
export function hasSave() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}
export function loadGame() {
  let d;
  try {
    d = JSON.parse(localStorage.getItem(SAVE_KEY));
  } catch {}
  if (!d) return false;
  newGame(d.cls);
  Object.assign(G, { time: d.time, bag: d.bag, equip: d.equip, potions: d.potions, keys: d.keys, quests: d.quests, flags: d.flags, opened: d.opened });
  Object.assign(G.player, d.p);
  for (const it of [...G.bag, ...Object.values(G.equip)]) if (it) uid = Math.max(uid, it.id + 1);
  recalcStats();
  G.toasts.length = 0;
  enterScene(d.scene, null, { x: d.p.x, y: d.p.y });
  return true;
}
export function deleteSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {}
}

// ---- stats ---------------------------------------------------------------------------------------
export function recalcStats() {
  const c = CLASSES[G.cls], lv = G.player.lv, s = {};
  for (const k in c.base) s[k] = c.base[k] + (c.grow[k] ?? 0) * (lv - 1);
  for (const it of Object.values(G.equip)) if (it) for (const k in it.stats) s[k] = (s[k] ?? 0) + it.stats[k];
  s.maxHp = Math.round(s.maxHp);
  s.maxMp = Math.round(s.maxMp);
  s.atk = Math.round(s.atk);
  s.def = Math.round(s.def);
  G.stats = s;
  if (G.player.hp > s.maxHp) G.player.hp = s.maxHp;
  if (G.player.mp > s.maxMp) G.player.mp = s.maxMp;
}

export function gainXp(v) {
  const p = G.player;
  if (p.lv >= MAX_LEVEL) return;
  p.xp += v;
  while (p.xp >= xpForLevel(p.lv) && p.lv < MAX_LEVEL) {
    p.xp -= xpForLevel(p.lv);
    p.lv++;
    recalcStats();
    p.hp = G.stats.maxHp;
    p.mp = G.stats.maxMp;
    addFx(levelUpFx, { x: p.x, y: p.y }, p);
    sfx.level();
    toast(`레벨 업! Lv ${p.lv}`, "#ffd84a");
    for (const id of CLASSES[G.cls].skills) if (SKILLS[id].level === p.lv) toast(`새 스킬: ${SKILLS[id].name}`, CLASSES[G.cls].color);
  }
}

// ---- items ---------------------------------------------------------------------------------------
export function makeItem(base, rarity) {
  const b = GEAR.find((g) => g.base === base), r = RARITY[rarity], stats = {};
  for (const k in b.stats) stats[k] = k === "crit" ? +(b.stats[k] * r.mult).toFixed(3) : k === "speed" && b.stats[k] < 0 ? b.stats[k] : Math.round(b.stats[k] * r.mult);
  const value = Math.round((12 + b.tier * 22) * r.mult * r.mult);
  return { id: uid++, base, slot: b.slot, cls: b.cls, name: b.name, icon: b.icon, rarity, stats, value };
}
// random gear for this hero: mostly their own weapon class, rarer the deeper you go
export function rollItem(tier, minRarity = 0) {
  const pool = GEAR.filter((g) => g.tier <= tier + 1 && g.tier >= tier - 1 && (!g.cls || g.cls === G.cls));
  const b = rnd.pick(pool);
  let r = minRarity;
  while (r < 4 && rnd.chance(0.33)) r++;
  return makeItem(b.base, r);
}
export function giveItem(it) {
  if (G.bag.length >= BAG_SIZE) {
    toast("가방이 가득 찼어요", "#ff8a6a");
    return false;
  }
  G.bag.push(it);
  toast(`${it.name} 획득`, RARITY[it.rarity].color);
  return true;
}
export function equipItem(id) {
  const i = G.bag.findIndex((it) => it.id === id);
  if (i < 0) return;
  const it = G.bag[i];
  if (it.cls && it.cls !== G.cls) return toast(`${CLASSES[it.cls].name} 전용 장비예요`, "#ff8a6a");
  G.bag.splice(i, 1);
  if (G.equip[it.slot]) G.bag.push(G.equip[it.slot]);
  G.equip[it.slot] = it;
  recalcStats();
  sfx.click();
}
export function unequip(slot) {
  const it = G.equip[slot];
  if (!it || slot === "weapon") return;
  if (G.bag.length >= BAG_SIZE) return toast("가방이 가득 찼어요", "#ff8a6a");
  G.equip[slot] = null;
  G.bag.push(it);
  recalcStats();
}
export function drinkPotion(kind) {
  const p = G.player, s = G.stats;
  if (!G.potions[kind]) return toast(`${POTIONS[kind].name}이 없어요`, "#ff8a6a");
  if (kind === "hp" && p.hp >= s.maxHp) return;
  if (kind === "mp" && p.mp >= s.maxMp) return;
  G.potions[kind]--;
  if (kind === "hp") p.hp = Math.min(s.maxHp, p.hp + POTIONS.hp.heal);
  else p.mp = Math.min(s.maxMp, p.mp + POTIONS.mp.mana);
  addFx(healFx, { x: p.x, y: p.y, palette: kind === "mp" ? ["#0c1430", "#1f4f94", "#3f8cff", "#7cc8ff", "#c8f0ff", "#ffffff"] : undefined }, p);
  sfx.heart();
}

// ---- quests --------------------------------------------------------------------------------------
export function questProgress(id) {
  const q = QUESTS[id], st = G.quests[id];
  if (!st) return 0;
  if (q.type === "collect" || q.type === "find") return Math.min(q.count, G.keys[q.target] ?? 0);
  return Math.min(q.count, st.n);
}
function checkQuests() {
  for (const id in G.quests) {
    const st = G.quests[id], q = QUESTS[id];
    if (st.state === "active" && questProgress(id) >= q.count) {
      st.state = "ready";
      toast(`퀘스트 완료: ${q.name}. ${NPCS[q.giver].name}에게 돌아가세요`, "#ffd84a");
      sfx.quest();
    }
  }
}
export function acceptQuest(id) {
  G.quests[id] = { state: "active", n: 0 };
  toast(`새 퀘스트: ${QUESTS[id].name}`, "#9bdcff");
  checkQuests();
  saveGame();
}
export function completeQuest(id) {
  const q = QUESTS[id], r = q.reward, p = G.player;
  G.quests[id].state = "complete";
  if (q.type === "collect" || q.type === "find") G.keys[q.target] = Math.max(0, (G.keys[q.target] ?? 0) - q.count);
  p.gold += r.gold ?? 0;
  for (const k in r.potions ?? {}) G.potions[k] += r.potions[k];
  if (r.item) {
    G.keys[r.item] = 1;
    toast(`${KEY_ITEMS[r.item].name} 획득! 공습 스킬이 열렸어요 (F / AIR)`, "#ffb04a");
  }
  if (r.gear) giveItem(r.gear.base ? makeItem(r.gear.base, r.gear.rarity) : rollItem(r.gear.tier, r.gear.rarity));
  for (const u of q.unlocks) if (!G.quests[u]) G.quests[u] = { state: "available", n: 0 };
  sfx.quest();
  toast(`보상: ${r.xp} 경험치, ${r.gold ?? 0} 골드`, "#ffd84a");
  gainXp(r.xp);
  saveGame();
  return q.ending;
}
function onKill(type) {
  for (const id in G.quests) {
    const st = G.quests[id], q = QUESTS[id];
    if (st.state === "active" && (q.type === "kill" || q.type === "boss") && q.target === type) st.n++;
  }
  checkQuests();
}
export function giveKey(k, n = 1) {
  G.keys[k] = (G.keys[k] ?? 0) + n;
  toast(`${KEY_ITEMS[k].name} +${n}`, "#c8f0ff");
  checkQuests();
}
// a marker over an NPC: "!" has a quest for you, "?" is waiting for one you finished
export function npcMarker(npc) {
  let mark = null;
  for (const id in G.quests) {
    if (QUESTS[id].giver !== npc) continue;
    const st = G.quests[id].state;
    if (st === "ready") return "?";
    if (st === "available") mark = "!";
  }
  return mark;
}

// ---- scenes --------------------------------------------------------------------------------------
export function enterScene(id, entry, at = null) {
  const s = getScene(id);
  G.scene = s;
  Object.assign(G, { enemies: [], projectiles: [], zones: [], strikes: [], fxs: [], pickups: [], texts: [], dashes: [], shake: 0, hitstop: 0, flash: 0, preview: null, boss: null, portalCd: 0.8, respawn: 0 });
  G.toasts ??= [];
  const pos = at ?? s.entries[entry] ?? s.entries.start ?? Object.values(s.entries)[0];
  Object.assign(G.player, { x: pos.x, y: pos.y, charge: 0, dash: null });
  flowFrom = -1;
  for (const pt of s.portals) pt.fx = addFx(portalFx, { x: pt.x, y: pt.y, palette: PORTAL_PAL[pt.color] });
  s.activeExit = null;
  if (s.boss && G.flags[s.boss.flag]) openBossExit(s);
  if (s.zones.length) for (const z of s.zones) for (let i = 0; i < z.count; i++) spawnInZone(z, true);
  for (const sp of s.spawns) spawnEnemy(sp.type, sp.lv, { x: sp.x, y: sp.y });
  if (s.boss && !G.flags[s.boss.flag]) spawnEnemy(s.boss.type, s.boss.lv, { x: s.boss.x, y: s.boss.y });
  G.banner = { name: s.name, t: 0 };
  sfx.portal();
  saveGame();
}
function openBossExit(s) {
  const pt = s.bossExit;
  s.activeExit = pt;
  pt.fx = addFx(portalFx, { x: pt.x, y: pt.y, palette: PORTAL_PAL.green });
}

function spawnInZone(z, initial) {
  const s = G.scene, p = G.player;
  for (let tries = 0; tries < 30; tries++) {
    const x = (z.x0 + rnd.next() * (z.x1 - z.x0)) * TILE, y = (z.y0 + rnd.next() * (z.y1 - z.y0)) * TILE;
    if (Math.hypot(x - p.x, y - p.y) < (initial ? 120 : 170)) continue;
    const type = rnd.pick(z.types);
    if (!ENEMIES[type].flying && blocked(x, y, 6)) continue;
    const e = spawnEnemy(type, rnd.int(z.lv[0], z.lv[1]), { x, y });
    e.zone = z;
    return e;
  }
}

export function spawnEnemy(type, lv, pos) {
  const def = ENEMIES[type], sc = enemyScale(lv);
  // bosses grow more slowly with level than regular monsters, or the late ones take forever
  const hp = Math.round(def.hp * (def.boss ? 1 + 0.12 * (lv - 1) : sc.hp));
  const e = { type, lv, x: pos.x, y: pos.y, home: { ...pos }, hp, max: hp, atk: Math.round(def.atk * sc.atk), kx: 0, ky: 0, hit: 0, frozen: 0, stun: 0, slow: 0, anim: rnd.range(0, 2), touchCd: 0, wander: rnd.range(0, 6.28), wt: 0, z: 0, state: "walk", timer: rnd.range(2.5, 4), shootCd: rnd.range(1, 2.5), spawnT: 0, aggro: false };
  G.enemies.push(e);
  if (def.boss) G.boss = e;
  return e;
}

// ---- movement & pathfinding ----------------------------------------------------------------------
export function blocked(x, y, hw = 4) {
  const s = G.scene;
  return isSolidAt(s, x - hw, y) || isSolidAt(s, x + hw, y) || isSolidAt(s, x - hw, y - 3) || isSolidAt(s, x + hw, y - 3);
}
export function slide(e, mx, my, hw = 4) {
  if (!blocked(e.x + mx, e.y, hw)) e.x += mx;
  if (!blocked(e.x, e.y + my, hw)) e.y += my;
}
export function faceFrom(p, dx, dy) {
  if (Math.abs(dx) + Math.abs(dy) < 1e-6) return;
  p.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}
export function camera() {
  const p = G.player, s = G.scene;
  let cx = Math.round(p.x - W / 2), cy = Math.round(p.y - 12 - H / 2);
  cx = s.w * TILE <= W ? Math.round((s.w * TILE - W) / 2) : Math.max(0, Math.min(s.w * TILE - W, cx));
  cy = s.h * TILE <= H ? Math.round((s.h * TILE - H) / 2) : Math.max(0, Math.min(s.h * TILE - H, cy));
  return [cx, cy];
}
export function lineOfSight(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 5);
  for (let i = 1; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
    if (isSolidAt(G.scene, x, y) && !isWaterAt(G.scene, x, y)) return false;
  }
  return true;
}
let flow = null, flowFrom = -1;
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const open = (s, tx, ty) => tx >= 0 && ty >= 0 && tx < s.w && ty < s.h && !s.solid[ty * s.w + tx];
function updateFlow() {
  const s = G.scene, p = G.player, tx = Math.floor(p.x / TILE), ty = Math.floor((p.y - 2) / TILE), start = ty * s.w + tx;
  if (start === flowFrom && flow?.length === s.w * s.h) return;
  flowFrom = start;
  if (flow?.length !== s.w * s.h) flow = new Int16Array(s.w * s.h);
  flow.fill(-1);
  if (!open(s, tx, ty)) return;
  const q = [start];
  flow[start] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % s.w, y = (i / s.w) | 0;
    if (flow[i] > 40) continue;
    for (const [dx, dy] of NB) {
      const nx = x + dx, ny = y + dy;
      if (!open(s, nx, ny) || (dx && dy && (!open(s, x + dx, y) || !open(s, x, y + dy)))) continue;
      const j = ny * s.w + nx;
      if (flow[j] === -1) (flow[j] = flow[i] + 1), q.push(j);
    }
  }
}
function steer(x, y, dx, dy, d) {
  const s = G.scene, tx = Math.floor(x / TILE), ty = Math.floor((y - 2) / TILE), here = open(s, tx, ty) ? flow[ty * s.w + tx] : -1;
  if (d < 28 || here <= 1) return [dx / d, dy / d];
  let best = here, bx = 0, by = 0;
  for (const [ox, oy] of NB) {
    const nx = tx + ox, ny = ty + oy;
    if (!open(s, nx, ny) || (ox && oy && (!open(s, tx + ox, ty) || !open(s, tx, ty + oy)))) continue;
    const v = flow[ny * s.w + nx];
    if (v >= 0 && v < best) (best = v), (bx = ox), (by = oy);
  }
  if (best === here) return [dx / d, dy / d];
  const cx = (tx + bx + 0.5) * TILE - x, cy = (ty + by + 0.5) * TILE + 4 - y, l = Math.hypot(cx, cy) || 1;
  return [cx / l, cy / l];
}

// ---- combat --------------------------------------------------------------------------------------
// the hero's hit on an enemy: base damage, a crit roll, knockback
export function hitEnemy(e, base, kx = 0, ky = 0, opts = {}) {
  if (e.dead) return;
  const crit = rnd.chance(G.stats.crit + (opts.critBonus ?? 0)), dmg = Math.max(1, Math.round(base * (crit ? 1.8 : 1) * rnd.range(0.9, 1.1)));
  e.hp -= dmg;
  e.hit = 0.1;
  e.aggro = true;
  const heavy = ENEMIES[e.type].boss ? 0.12 : 1;
  e.kx += kx * heavy;
  e.ky += ky * heavy;
  text(String(dmg), e.x, e.y - ENEMIES[e.type].hitY - e.z - 8, crit ? "#ffd84a" : "#ffffff", crit);
  crit ? sfx.crit() : sfx.hit();
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  const def = ENEMIES[e.type], sc = enemyScale(e.lv);
  sfx.pop();
  gainXp(Math.round(def.xp * (1 + 0.2 * (e.lv - 1))));
  onKill(e.type);
  const gold = Math.round(rnd.range(def.gold[0], def.gold[1] + 1) * (1 + 0.15 * (e.lv - 1)));
  for (let i = 0; i < Math.min(6, Math.ceil(gold / 5)); i++) dropCoin(e.x, e.y, Math.ceil(gold / Math.min(6, Math.ceil(gold / 5))));
  if (e.type === "bat" && G.quests.s1?.state === "active" && rnd.chance(0.6)) G.pickups.push({ kind: "key", key: "wing", x: e.x, y: e.y, t: 0, vx: 0, vy: 0 });
  if (rnd.chance(0.06)) G.pickups.push({ kind: "potion", potion: rnd.chance(0.5) ? "hp" : "mp", x: e.x + 4, y: e.y, t: 0, vx: 0, vy: 0 });
  if (rnd.chance(def.boss ? 1 : 0.035)) dropLoot(e.x, e.y, rollItem(Math.min(4, Math.ceil(e.lv / 2.5)), def.boss ? 2 : 0));
  if (def.boss) {
    G.boss = null;
    G.hitstop = 0.25;
    shake(0.5);
    for (let i = 0; i < 5; i++) addFx(slimePop, { x: e.x + rnd.range(-16, 16), y: e.y + rnd.range(-8, 8), palette: POP_PAL[e.type] });
    addFx(airBlast, { x: e.x, y: e.y, palette: e.type === "lich" ? SHADOW_PAL : SLAM_PAL, stone: e.type === "lich" ? "#3a1f5a" : "#2f6a32" });
    G.flags[G.scene.boss.flag] = true;
    openBossExit(G.scene);
    toast(`${def.name} 처치!`, "#ffd84a");
    saveGame();
    return;
  }
  addFx(slimePop, { x: e.x, y: def.flying ? e.y - 8 : e.y, palette: POP_PAL[e.type] });
}
function dropCoin(x, y, v) {
  const a = rnd.range(0, Math.PI * 2), sp = rnd.range(20, 50);
  G.pickups.push({ kind: "coin", v, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, t: 0 });
}
function dropLoot(x, y, item) {
  const a = rnd.range(0, Math.PI * 2);
  G.pickups.push({ kind: "item", item, x, y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 18, t: 0 });
}

export function hurtPlayer(dmg, fx, fy) {
  const p = G.player;
  if (p.hurt > 0 || G.mode !== "play" || p.dash) return;
  const real = Math.max(1, Math.round((dmg * 30) / (30 + G.stats.def)));
  p.hp -= real;
  p.hurt = 0.7;
  p.calm = 0;
  shake(0.22);
  G.flash = 0.25;
  sfx.hurt();
  const l = Math.hypot(p.x - fx, p.y - fy) || 1;
  slide(p, ((p.x - fx) / l) * 8, ((p.y - fy) / l) * 8);
  text(String(real), p.x, p.y - 22, "#ff6a6a");
  if (p.hp <= 0) {
    p.hp = 0;
    G.mode = "dead";
    sfx.over();
  }
}
export function respawnInTown() {
  const p = G.player, lost = Math.floor(p.gold * 0.1);
  p.gold -= lost;
  recalcStats();
  p.hp = G.stats.maxHp;
  p.mp = G.stats.maxMp;
  G.mode = "play";
  enterScene("town", "start");
  toast(lost ? `마을에서 깨어났습니다. ${lost} 골드를 잃었어요` : "마을에서 깨어났습니다", "#ff8a6a");
}

export function nearestEnemy(x, y, range) {
  let best = null, bd = range;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - x, e.y - ENEMIES[e.type].hitY - e.z - y);
    if (d < bd) (bd = d), (best = e);
  }
  return best;
}
export function bestCluster(range) {
  const p = G.player;
  let best = null, score = -1;
  for (const e of G.enemies) {
    if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > range + 20) continue;
    let n = 0;
    for (const o of G.enemies) if (!o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 40) n++;
    const sc = n * 100 - Math.hypot(e.x - p.x, e.y - p.y);
    if (sc > score) (score = sc), (best = e);
  }
  return best ? { x: best.x, y: best.y } : { x: p.x + p.dx * 60, y: p.y + p.dy * 60 };
}

// ---- enemy AI ------------------------------------------------------------------------------------
function updateEnemy(e, dt) {
  const p = G.player, def = ENEMIES[e.type];
  e.anim += dt;
  e.spawnT += dt;
  for (const k of ["hit", "touchCd", "frozen", "stun", "slow"]) e[k] = Math.max(0, e[k] - dt);
  if (e.kx || e.ky) {
    if (def.flying) (e.x += e.kx * dt * 4), (e.y += e.ky * dt * 4);
    else slide(e, e.kx * dt * 4, e.ky * dt * 4, e.type === "king" ? 10 : 4);
    e.kx *= 0.86;
    e.ky *= 0.86;
    if (Math.abs(e.kx) + Math.abs(e.ky) < 1) e.kx = e.ky = 0;
  }
  if (e.frozen > 0 || e.stun > 0) return;
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, safe = G.scene.safe;
  if (!e.aggro && d < def.sight && !safe && (def.flying || lineOfSight(e.x, e.y - 4, p.x, p.y - 4) || d < 50)) e.aggro = true;
  if (e.aggro && d > def.sight * 2.4 && !def.boss) e.aggro = false;
  const sp = def.speed * (e.slow > 0 ? 0.5 : 1);
  const wander = () => {
    e.wt -= dt;
    if (e.wt <= 0) {
      e.wander = rnd.range(0, 6.28);
      e.wt = rnd.range(0.8, 2.2);
      if (Math.hypot(e.x - e.home.x, e.y - e.home.y) > 60) e.wander = Math.atan2(e.home.y - e.y, e.home.x - e.x);
    }
    return [Math.cos(e.wander) * 0.4, Math.sin(e.wander) * 0.4];
  };

  if (e.type === "slime") {
    const [vx, vy] = e.aggro ? steer(e.x, e.y, dx, dy, d) : wander();
    const hop = Math.max(0, Math.sin(e.anim * 6));
    slide(e, vx * sp * dt * hop * 1.6, vy * sp * dt * hop * 1.6);
  } else if (e.type === "bat") {
    const wob = Math.sin(e.anim * 5) * 0.8, nx = -dy / d, ny = dx / d;
    const [tx, ty] = e.aggro ? [dx / d, dy / d] : wander();
    e.x += (tx + (e.aggro ? nx * wob : 0)) * sp * dt;
    e.y += (ty + (e.aggro ? ny * wob : 0)) * sp * dt;
    e.x = Math.max(16, Math.min(G.scene.w * TILE - 16, e.x));
    e.y = Math.max(24, Math.min(G.scene.h * TILE - 8, e.y));
    if (!e.aggro && isSolidAt(G.scene, e.x, e.y) && !isWaterAt(G.scene, e.x, e.y)) e.wander += Math.PI;
    e.z = 10 + Math.sin(e.anim * 9) * 2;
  } else if (e.type === "archer") {
    let vx = 0, vy = 0;
    if (e.aggro) {
      const clear = lineOfSight(e.x, e.y - 1, p.x, p.y - 1);
      if (d > def.range + 10 || !clear) [vx, vy] = steer(e.x, e.y, dx, dy, d);
      else if (d < def.range - 30) (vx = -dx / d), (vy = -dy / d);
      else (vx = (-dy / d) * 0.5 * Math.sign(Math.sin(e.wander))), (vy = (dx / d) * 0.5 * Math.sign(Math.sin(e.wander)));
      e.shootCd -= dt;
      if (e.shootCd <= 0 && d < def.range + 40 && clear) {
        e.shootCd = def.shootEvery * rnd.range(0.85, 1.15);
        enemyShot(e.x, e.y - 9, p.x, p.y - 8, def.arrowSpeed, e.atk, "arrow");
        e.draw = 0.25;
        sfx.arrow();
      }
    } else [vx, vy] = wander();
    e.draw = Math.max(0, (e.draw ?? 0) - dt);
    slide(e, vx * sp * dt, vy * sp * dt);
  } else if (e.type === "skeleton") {
    // walks up, winds up, swings
    if (e.state === "swing") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "walk";
        if (d < 22) hurtPlayer(e.atk, e.x, e.y);
        e.swung = 0.2;
      }
    } else {
      const [vx, vy] = e.aggro ? steer(e.x, e.y, dx, dy, d) : wander();
      slide(e, vx * sp * dt, vy * sp * dt);
      if (e.aggro && d < 18 && e.touchCd <= 0) {
        e.state = "swing";
        e.timer = 0.38;
        e.touchCd = 1.2;
      }
    }
    e.swung = Math.max(0, (e.swung ?? 0) - dt);
  } else if (e.type === "king") updateKing(e, dt, dx, dy, d, def);
  else if (e.type === "lich") updateLich(e, dt, dx, dy, d, def);

  if (e.type !== "skeleton" && e.type !== "lich" && e.aggro && d < (e.type === "king" ? 18 : 11) && e.touchCd <= 0 && e.z < 4) {
    e.touchCd = 0.8;
    hurtPlayer(e.atk, e.x, e.y);
  }
}

export function enemyShot(x, y, tx, ty, speed, dmg, kind) {
  const dx = tx - x, dy = ty - y, l = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx);
  const pr = { owner: "enemy", kind, x, y, vx: (dx / l) * speed, vy: (dy / l) * speed, ang, life: 2.4, dmg };
  if (kind === "shadow") pr.fx = addFx(frostBolt, { x, y, angle: ang, palette: SHADOW_PAL }, pr);
  G.projectiles.push(pr);
  return pr;
}

function updateKing(e, dt, dx, dy, d, def) {
  if (!e.aggro) return;
  e.timer -= dt;
  if (e.state === "walk") {
    const hop = Math.max(0, Math.sin(e.anim * 4)), [sx, sy] = steer(e.x, e.y, dx, dy, d);
    slide(e, sx * def.speed * dt * hop * 1.8, sy * def.speed * dt * hop * 1.8, 10);
    if (e.timer <= 0) (e.state = "crouch"), (e.timer = 0.45);
  } else if (e.state === "crouch") {
    if (e.timer <= 0) {
      e.state = "air";
      e.timer = 0.95;
      e.from = { x: e.x, y: e.y };
      e.to = blocked(G.player.x, G.player.y, 10) ? { x: e.x, y: e.y } : { x: G.player.x, y: G.player.y };
      e.marker = addFx(strikeMarker, { x: e.to.x, y: e.to.y, radius: 34, palette: ["#0d1a0c", "#265e18", "#6cb82a", "#a8e04a", "#e0ff8a", "#ffffff"] });
    }
  } else if (e.state === "air") {
    const u = 1 - e.timer / 0.95;
    e.x = e.from.x + (e.to.x - e.from.x) * u;
    e.y = e.from.y + (e.to.y - e.from.y) * u;
    e.z = Math.sin(u * Math.PI) * 60;
    if (e.timer <= 0) {
      e.state = "walk";
      e.timer = rnd.range(3, 4.2);
      e.z = 0;
      e.marker?.fx.stop();
      e.jumps = (e.jumps ?? 0) + 1;
      shake(0.4);
      sfx.slam();
      addFx(airBlast, { x: e.x, y: e.y, palette: SLAM_PAL, stone: "#2f6a32" });
      const p = G.player;
      if (Math.hypot(p.x - e.x, (p.y - e.y) / 0.6) < 38) hurtPlayer(e.atk * 1.3, e.x, e.y);
      if (e.jumps % 2 === 0 && G.enemies.length < 14)
        for (let i = 0; i < 2; i++) {
          const a = rnd.range(0, Math.PI * 2), at = { x: e.x + Math.cos(a) * 26, y: e.y + Math.sin(a) * 16 };
          if (!blocked(at.x, at.y)) spawnEnemy("slime", e.lv - 1, at).aggro = true;
        }
    }
  }
}

// The Lich: drifts at a distance, casts fans of shadow bolts, calls up skeletons, blinks away when you close in.
// Below half health it casts wider fans and faster.
function updateLich(e, dt, dx, dy, d, def) {
  e.z = 6 + Math.sin(e.anim * 2) * 3;
  if (!e.aggro) return;
  const rage = e.hp < e.max / 2;
  let vx = 0, vy = 0;
  if (d > 110) [vx, vy] = steer(e.x, e.y, dx, dy, d);
  else if (d < 70) (vx = -dx / d), (vy = -dy / d);
  else (vx = -dy / d * 0.6), (vy = dx / d * 0.6);
  slide(e, vx * def.speed * dt, vy * def.speed * dt, 6);
  e.shootCd -= dt;
  if (e.shootCd <= 0) {
    e.shootCd = rage ? 1.3 : 2;
    const n = rage ? 5 : 3, base = Math.atan2(dy - 6, dx);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.28;
      enemyShot(e.x, e.y - 16, e.x + Math.cos(a) * 100, e.y - 16 + Math.sin(a) * 100, 95, e.atk, "shadow");
    }
    e.cast = 0.3;
    sfx.shadow();
  }
  e.cast = Math.max(0, (e.cast ?? 0) - dt);
  e.timer -= dt;
  if (e.timer <= 0) {
    e.timer = rage ? 6 : 8;
    if (G.enemies.filter((o) => o.type === "skeleton").length < 4)
      for (let i = 0; i < 2; i++) {
        const a = rnd.range(0, Math.PI * 2), at = { x: e.x + Math.cos(a) * 30, y: e.y + Math.sin(a) * 18 };
        if (!blocked(at.x, at.y)) {
          spawnEnemy("skeleton", e.lv - 2, at).aggro = true;
          addFx(slimePop, { x: at.x, y: at.y, palette: SHADOW_PAL });
        }
      }
  }
  e.blinkCd = Math.max(0, (e.blinkCd ?? 2) - dt);
  if (d < 40 && e.blinkCd <= 0) {
    e.blinkCd = 5;
    addFx(blinkFx, { x: e.x, y: e.y, palette: SHADOW_PAL.slice(1) });
    for (let k = 0; k < 20; k++) {
      const a = rnd.range(0, Math.PI * 2), r = rnd.range(70, 110), nx = G.player.x + Math.cos(a) * r, ny = G.player.y + Math.sin(a) * r * 0.7;
      if (!blocked(nx, ny, 6) && lineOfSight(nx, ny - 4, G.player.x, G.player.y - 4)) {
        e.x = nx;
        e.y = ny;
        break;
      }
    }
    addFx(blinkFx, { x: e.x, y: e.y, palette: SHADOW_PAL.slice(1) });
  }
}

// ---- interaction ---------------------------------------------------------------------------------
// what's in reach: a villager, a chest or a sign
export function interactable() {
  const p = G.player, s = G.scene;
  let best = null, bd = 1e9;
  const consider = (kind, ref, x, y, r) => {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < r && d < bd) (bd = d), (best = { kind, ref, x, y });
  };
  for (const n of s.npcs) consider("npc", n, n.x, n.y, 24);
  for (const c of s.chests) if (!G.opened.includes(c.id)) consider("chest", c, c.x, c.y, 20);
  for (const o of s.objects) if (o.kind === "sign") consider("sign", o, o.x, o.y + 4, 22);
  return best;
}

export function openChest(c) {
  G.opened.push(c.id);
  const tier = c.tier ?? 1, gold = c.gold ? 2 : 0;
  sfx.chest();
  const item = c.contains === "doll" ? null : rollItem(tier, gold ? 2 : rnd.chance(0.4) ? 1 : 0);
  addFx(chestBurst, { x: c.x, y: c.y, palette: RARITY_FX[item ? item.rarity : 1] });
  if (c.contains === "doll") G.pickups.push({ kind: "key", key: "doll", x: c.x, y: c.y + 6, vx: 0, vy: 12, t: 0 });
  if (item) dropLoot(c.x, c.y + 8, item);
  const coins = Math.round((gold ? 60 : 15) * tier * rnd.range(0.8, 1.3));
  for (let i = 0; i < 5; i++) dropCoin(c.x, c.y + 4, Math.ceil(coins / 5));
  if (rnd.chance(0.6)) G.pickups.push({ kind: "potion", potion: rnd.chance(0.6) ? "hp" : "mp", x: c.x - 6, y: c.y + 6, t: 0, vx: -20, vy: 10 });
  saveGame();
}

// ---- the frame -----------------------------------------------------------------------------------
export function update(dt, input) {
  G.time += dt;
  G.flash = Math.max(0, G.flash - dt);
  for (const t of G.texts) (t.t += dt), (t.y -= 16 * dt);
  G.texts = G.texts.filter((t) => t.t < 0.9);
  for (const t of G.toasts) t.t += dt;
  G.toasts = G.toasts.filter((t) => t.t < 3.4);
  if (G.banner) G.banner.t += dt;
  if (G.hitstop > 0) return void (G.hitstop -= dt);
  const p = G.player, s = G.stats;
  if (G.mode === "play") {
    p.hurt = Math.max(0, p.hurt - dt);
    p.calm += dt;
    for (const k in p.cds) p.cds[k] = Math.max(0, p.cds[k] - dt);
    p.mp = Math.min(s.maxMp, p.mp + dt * (1.2 + s.maxMp * 0.012));
    if (p.calm > 5) p.hp = Math.min(s.maxHp, p.hp + dt * (1 + s.maxHp * 0.01));
    updateFlow();
    updateSkills(dt, input);
    if (G.scene.explored) reveal();
  }
  updateProjectiles(dt);
  for (const e of G.enemies) updateEnemy(e, dt);
  G.enemies = G.enemies.filter((e) => !e.dead);
  // the forest refills slowly, out of sight
  if (G.scene.zones.length && G.mode === "play") {
    G.respawn -= dt;
    if (G.respawn <= 0) {
      G.respawn = 6;
      for (const z of G.scene.zones) if (G.enemies.filter((e) => e.zone === z).length < z.count) spawnInZone(z, false);
    }
  }
  updatePickups(dt);
  // portals: step on one to travel
  G.portalCd = Math.max(0, G.portalCd - dt);
  if (G.mode === "play" && G.portalCd <= 0) {
    const all = [...G.scene.portals, ...(G.scene.activeExit ? [G.scene.activeExit] : [])];
    for (const pt of all)
      if (Math.hypot(pt.x - p.x, (pt.y - p.y) / 0.6) < 11) {
        if (pt.needs && G.quests[pt.needs]?.state !== "complete") {
          toast("봉인된 문이다. 촌장에게 먼저 이야기를 들어 보자", "#c684ff");
          G.portalCd = 2;
          break;
        }
        enterScene(pt.to, pt.entry);
        break;
      }
  }
  for (const e of G.fxs) {
    if (e.follow) (e.fx.options.x = e.follow.x), (e.fx.options.y = e.follow.y - (e.lift ?? 0));
    e.fx.update(dt);
  }
  G.fxs = G.fxs.filter((e) => !e.fx.done());
  G.shake = Math.max(0, G.shake - dt);
}

function updateProjectiles(dt) {
  const p = G.player;
  for (const pr of G.projectiles) {
    pr.life -= dt;
    const steps = Math.max(1, Math.ceil((Math.hypot(pr.vx, pr.vy) * dt) / 3));
    for (let i = 0; i < steps && !pr.done; i++) {
      pr.x += (pr.vx * dt) / steps;
      pr.y += (pr.vy * dt) / steps;
      if (pr.owner === "player") {
        for (const e of G.enemies) {
          if (e.dead || pr.hitSet.has(e)) continue;
          const def = ENEMIES[e.type];
          if (Math.abs(e.x - pr.x) < def.rad + (pr.size ?? 0) && Math.abs(e.y - def.hitY - e.z - pr.y) < def.rad + 2 + (pr.size ?? 0)) {
            pr.hitSet.add(e);
            hitEnemy(e, pr.dmg, Math.cos(pr.ang) * 40, Math.sin(pr.ang) * 40);
            pr.onHit?.(e, pr);
            if (pr.pierce-- <= 0) {
              endProjectile(pr, true);
              break;
            }
          }
        }
      } else if (Math.hypot(pr.x - p.x, pr.y - (p.y - 8)) < 7) {
        hurtPlayer(pr.dmg, pr.x - pr.vx * 0.05, pr.y - pr.vy * 0.05);
        endProjectile(pr, true);
      }
      if (!pr.done && isSolidAt(G.scene, pr.x, pr.y + 8) && !isWaterAt(G.scene, pr.x, pr.y + 8)) endProjectile(pr, true);
    }
    if (!pr.done && pr.life <= 0) endProjectile(pr, false);
  }
  G.projectiles = G.projectiles.filter((pr) => !pr.done);
}
export function endProjectile(pr, impact) {
  pr.done = true;
  if (pr.fx) {
    pr.fx.fx.stop();
    pr.fx.follow = null;
  }
  if (impact && pr.hitFx) addFx(pr.hitFx, { x: pr.x, y: pr.y, aim: pr.ang, palette: pr.hitPal });
  if (impact && pr.kind === "shadow") addFx(frostHit, { x: pr.x, y: pr.y, aim: pr.ang, palette: SHADOW_PAL });
}

function updatePickups(dt) {
  const p = G.player;
  for (const k of G.pickups) {
    k.t += dt;
    k.x += k.vx * dt;
    k.y += k.vy * dt;
    k.vx *= 0.9;
    k.vy *= 0.9;
    const dx = p.x - k.x, dy = p.y - 4 - k.y, d = Math.hypot(dx, dy);
    if (k.kind === "coin" && (d < 36 || k.t > 6) && k.t > 0.3) {
      const sp = 70 + k.t * 80;
      k.vx = (dx / (d || 1)) * sp;
      k.vy = (dy / (d || 1)) * sp;
    }
    if (d < 9 && k.t > 0.3 && G.mode === "play") {
      if (k.kind === "coin") {
        p.gold += k.v;
        sfx.coin();
      } else if (k.kind === "potion") {
        G.potions[k.potion]++;
        toast(`${POTIONS[k.potion].name} +1`, k.potion === "hp" ? "#ff8a8a" : "#8ac8ff");
        sfx.heart();
      } else if (k.kind === "key") giveKey(k.key);
      else if (k.kind === "item" && !giveItem(k.item)) continue;
      k.taken = true;
    }
  }
  G.pickups = G.pickups.filter((k) => !k.taken);
}

// dungeons remember what you've seen, for the map
function reveal() {
  const s = G.scene, p = G.player, tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  for (let y = ty - 6; y <= ty + 6; y++) for (let x = tx - 8; x <= tx + 8; x++) if (x >= 0 && y >= 0 && x < s.w && y < s.h) s.explored[y * s.w + x] = 1;
}

export { castSkill, skillReady };
