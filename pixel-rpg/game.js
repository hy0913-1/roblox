// The rules: scenes and travel, the hero, jobs and stats, items, projectiles, loot, levels, quests, bounties,
// world events, day and night, and saving. Monster AI is in enemies.js, skills in skills.js.

import { createFx, Rng, PAL } from "./vendor/pixelfx/src/core/index.js";
import * as frostHit from "./vendor/pixelfx/src/fx/rpg/frost-hit.js";
import * as slimePop from "./vendor/pixelfx/src/fx/rpg/slime-pop.js";
import * as airBlast from "./vendor/pixelfx/src/fx/rpg/airstrike-blast.js";
import * as frostBolt from "./vendor/pixelfx/src/fx/rpg/frost-bolt.js";
import * as levelUpFx from "./vendor/pixelfx/src/fx/rpg/level-up.js";
import * as chestBurst from "./vendor/pixelfx/src/fx/rpg/chest-burst.js";
import * as healFx from "./vendor/pixelfx/src/fx/rpg/heal.js";
import * as portalFx from "./vendor/pixelfx/src/fx/rpg/portal.js";
import * as holyPillar from "./vendor/pixelfx/src/fx/holy/holy-pillar.js";
import { W, H, TILE, CLASSES, SKILLS, ENEMIES, enemyScale, xpForLevel, MAX_LEVEL, GEAR, RARITY, AFFIXES, UNIQUES, POTIONS, KEY_ITEMS, QUESTS, START_QUESTS, LEVEL_QUESTS, BOUNTIES, BAG_SIZE, NPCS, JOB_BONUS, ENHANCE, SLOTS } from "./config.js";
import { getScene, isSolidAt, isWaterAt, tileAt, T } from "./world.js";
import { sfx } from "./audio.js";
import { updateSkills } from "./skills.js";
import { updateEnemy } from "./enemies.js";

export const G = { mode: "title" };
export const rnd = new Rng(Date.now() % 100000);
let uid = 1;

export const SHADOW_PAL = ["#050308", "#1c1230", "#2c1a4a", "#432468", "#6b2cc0", "#9a48ec", "#c684ff", "#ecc8ff"];
export const FIRE_PAL = ["#1f0b10", "#4a1118", "#8c1d1c", "#cc3a1a", "#f2701f", "#ffae35", "#ffe27a", "#fff8d6"];
const SLAM_PAL = ["#0d1a0c", "#173a14", "#265e18", "#3f8a1e", "#6cb82a", "#a8e04a", "#e0ff8a", "#ffffff"];
const BONE = [...PAL.bone, "#ffffff"];
const POP_PAL = {
  bat: ["#1a0f24", "#2e1a46", "#4a2f72", "#6b4a9a", "#9a72d0", "#c4a4f0", "#ecdcff", "#ffffff"], archer: BONE, skeleton: BONE, lich: SHADOW_PAL,
  wolf: [...PAL.stone], orc: [...PAL.leaf], golem: [...PAL.stone], icegolem: [...PAL.ice], imp: FIRE_PAL, magma: FIRE_PAL, yeti: [...PAL.ice],
  demon: [...PAL.blood, "#ffffff"], gargoyle: [...PAL.stone], goldslime: [...PAL.gold], goblin: [...PAL.gold], chief: [...PAL.leaf], drake: FIRE_PAL, giant: [...PAL.ice], demonking: SHADOW_PAL,
};
const PORTAL_PAL = { green: ["#08201a", "#17663e", "#24924e", "#3ec466", "#7ee88a", "#c8ffc4", "#ffffff"], purple: undefined, shadow: SHADOW_PAL.slice(1), fire: FIRE_PAL.slice(1), ice: [...PAL.ice].slice(1) };
export const RARITY_FX = [
  ["#1e1e26", "#5c5c6b", "#a4a4b2", "#d0d0da", "#f0f0f6", "#ffffff"], ["#08201a", "#17663e", "#3ec466", "#7ee88a", "#c8ffc4", "#ffffff"],
  ["#0c1430", "#1f4f94", "#3f8cff", "#7cc8ff", "#c8f0ff", "#ffffff"], ["#140a26", "#481c88", "#9a48ec", "#c684ff", "#ecc8ff", "#ffffff"],
  ["#1e1206", "#86520c", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
];
export const DAY = 300; // seconds in a full day

// ---- effects & feedback --------------------------------------------------------------------------
let fxSeed = 1;
// opts.scale draws a library effect smaller (they are made for a character twice the size of ours)
export function addFx(mod, opts, follow) {
  const o = { seed: (fxSeed = (fxSeed * 1103515245 + 12345) & 0x7fffffff) % 1000 };
  for (const k in opts) if (opts[k] !== undefined && k !== "scale" && k !== "lift") o[k] = opts[k];
  const e = { fx: createFx(mod, o), follow, scale: opts.scale ?? 1, lift: opts.lift ?? 0 };
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
export const later = (t, fn) => G.timers.push({ t, fn });

// ---- new game, saving ----------------------------------------------------------------------------
function fresh(cls) {
  return {
    mode: "play", time: 0, cls, clock: DAY * 0.3, bloodMoon: false,
    player: { x: 0, y: 0, dx: 0, dy: 1, face: "down", hp: 1, mp: 1, hurt: 0, walk: 0, moving: false, lv: 1, xp: 0, gold: 30, cds: {}, calm: 0, stealth: 0 },
    job: { rank: 1, branch: null },
    bag: [], equip: { weapon: null, helmet: null, armor: null, boots: null, trinket: null },
    potions: { hp: 3, mp: 2, hp2: 0, mp2: 0, elixir: 0, scroll: 1 },
    keys: { wing: 0, doll: 0, radio: 0, ore: 0, token: 0 },
    quests: {}, flags: {}, opened: [], buffs: [], bounty: null, kills: 0,
    events: { goblin: 70, wanderer: 140, raid: 360 }, wanderer: null, raid: null,
    toasts: [], texts: [], fxs: [], timers: [],
  };
}
export function newGame(cls) {
  Object.assign(G, fresh(cls));
  for (const q of START_QUESTS) G.quests[q] = { state: "available", n: 0 };
  G.equip.weapon = makeItem(`${CLASSES[cls].weapon}1`, 0);
  G.equip.armor = makeItem("armor1", 0);
  recalcStats();
  G.player.hp = G.stats.maxHp;
  G.player.mp = G.stats.maxMp;
  newBounty();
  enterScene("town", "start");
  toast(`${CLASSES[cls].title}의 모험이 시작됩니다`, CLASSES[cls].color);
}

const SAVE_KEY = "frostwizard.rpg.save";
export function saveGame() {
  if (!G.cls || G.mode === "title") return;
  const p = G.player;
  const keep = ["time", "clock", "job", "bag", "equip", "potions", "keys", "quests", "flags", "opened", "bounty", "kills"];
  const data = { v: 4, cls: G.cls, p: { x: p.x, y: p.y, hp: p.hp, mp: p.mp, lv: p.lv, xp: p.xp, gold: p.gold }, scene: G.scene.id };
  for (const k of keep) data[k] = G[k];
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
// older saves miss newer fields: start from a fresh game of the same class and lay the save over it
export function loadGame() {
  let d;
  try {
    d = JSON.parse(localStorage.getItem(SAVE_KEY));
  } catch {}
  if (!d || !CLASSES[d.cls]) return false;
  Object.assign(G, fresh(d.cls));
  for (const k of ["time", "clock", "job", "bag", "opened", "bounty", "kills"]) if (d[k] !== undefined) G[k] = d[k];
  for (const k of ["equip", "potions", "keys", "quests", "flags"]) Object.assign(G[k], d[k] ?? {});
  Object.assign(G.player, d.p);
  for (const it of [...G.bag, ...Object.values(G.equip)]) if (it) (it.plus ??= 0), (it.affixes ??= []), (uid = Math.max(uid, it.id + 1));
  if (G.quests.q3?.state === "complete" && !G.quests.q4) G.quests.q4 = { state: "available", n: 0 };
  if (!G.bounty) newBounty();
  recalcStats();
  enterScene(getSceneSafe(d.scene), null, d.scene === getSceneSafe(d.scene) ? { x: d.p.x, y: d.p.y } : null);
  return true;
}
const getSceneSafe = (id) => (["town", "forest", "cave", "crypt", "highlands", "volcano", "icecave", "tower"].includes(id) ? id : "town");
export function deleteSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {}
}

// ---- jobs & stats --------------------------------------------------------------------------------
export function jobTitle() {
  const c = CLASSES[G.cls];
  return G.job.rank === 1 ? c.title : c.branches[G.job.branch].name[G.job.rank - 2];
}
export function advanceJob(branch) {
  const p = G.player;
  if (branch) G.job.branch = branch;
  G.job.rank++;
  recalcStats();
  p.hp = G.stats.maxHp;
  p.mp = G.stats.maxMp;
  addFx(holyPillar, { x: p.x, y: p.y, scale: 0.5 });
  addFx(levelUpFx, { x: p.x, y: p.y }, p);
  shake(0.3);
  sfx.quest();
  const sk = CLASSES[G.cls].branches[G.job.branch].skills[G.job.rank - 2];
  toast(`${jobTitle()}(으)로 전직했습니다!`, CLASSES[G.cls].branches[G.job.branch].tint);
  toast(`새 스킬: ${SKILLS[sk].name}`, "#ffd84a");
  saveGame();
}
export function recalcStats() {
  const c = CLASSES[G.cls], lv = G.player.lv, s = { lifesteal: 0 };
  for (const k in c.base) s[k] = c.base[k] + (c.grow[k] ?? 0) * (lv - 1);
  for (const it of Object.values(G.equip)) if (it) for (const [k, v] of Object.entries(itemStats(it))) s[k] = (s[k] ?? 0) + v;
  // job passives: each advancement toughens and quickens the hero
  if (G.job.rank >= 2) (s.maxHp *= 1.12), (s.maxMp *= 1.1), (s.def += 4);
  if (G.job.rank >= 3) (s.maxHp *= 1.12), (s.maxMp *= 1.1), (s.def += 6), (s.crit += 0.04);
  let atkMul = JOB_BONUS[G.job.rank - 1], spdMul = 1;
  s.guard = 0;
  for (const b of G.buffs) {
    atkMul *= 1 + (b.atk ?? 0);
    spdMul *= 1 + (b.speed ?? 0);
    s.guard = Math.max(s.guard, b.guard ?? 0);
  }
  if (G.player.stealth > 0) spdMul *= 1.25;
  s.atk *= atkMul;
  s.speed *= spdMul;
  for (const k of ["maxHp", "maxMp", "atk", "def"]) s[k] = Math.round(s[k]);
  G.stats = s;
  if (G.player.hp > s.maxHp) G.player.hp = s.maxHp;
  if (G.player.mp > s.maxMp) G.player.mp = s.maxMp;
}
export function addBuff(id, b, dur, fx) {
  const old = G.buffs.find((x) => x.id === id);
  if (old) old.fx?.fx.stop();
  G.buffs = G.buffs.filter((x) => x.id !== id);
  G.buffs.push({ id, ...b, t: dur, max: dur, fx });
  recalcStats();
}

export function gainXp(v) {
  const p = G.player;
  if (p.lv >= MAX_LEVEL) return;
  p.xp += Math.round(v * (G.bloodMoon ? 1.5 : 1));
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
    for (const id of LEVEL_QUESTS) if (!G.quests[id] && p.lv >= QUESTS[id].minLevel) {
      G.quests[id] = { state: "available", n: 0 };
      toast(`${NPCS[QUESTS[id].giver].name}이(가) 당신을 찾습니다`, "#9bdcff");
    }
  }
}

// ---- items ---------------------------------------------------------------------------------------
export function itemStats(it) {
  const out = {}, k = 1 + 0.08 * (it.plus ?? 0);
  for (const [s, v] of Object.entries(it.stats)) out[s] = s === "crit" || s === "lifesteal" ? +(v * k).toFixed(3) : Math.round(v * k);
  return out;
}
export function itemName(it) {
  return `${it.plus ? `+${it.plus} ` : ""}${it.affixes?.length ? it.affixes.join(" ") + " " : ""}${it.name}`;
}
export function makeItem(base, rarity) {
  const b = GEAR.find((g) => g.base === base), r = RARITY[rarity], stats = {};
  for (const k in b.stats) {
    const v = b.stats[k];
    if (!v) continue;
    stats[k] = k === "crit" ? +(v * r.mult).toFixed(3) : Math.round(v * r.mult);
  }
  const affixes = [], pool = [...AFFIXES];
  for (let i = 0; i < r.affixes; i++) {
    const a = pool.splice(Math.floor(rnd.next() * pool.length), 1)[0];
    const v = a.v(b.tier);
    stats[a.stat] = +((stats[a.stat] ?? 0) + (a.stat === "crit" || a.stat === "lifesteal" ? +v.toFixed(3) : Math.round(v))).toFixed(3);
    affixes.push(a.name);
  }
  const value = Math.round((12 + b.tier * b.tier * 14) * r.mult * r.mult);
  return { id: uid++, base, slot: b.slot, cls: b.cls, name: b.name, icon: b.icon, tier: b.tier, rarity, stats, affixes, plus: 0, value };
}
export function makeUnique(name) {
  const u = UNIQUES.find((x) => x.name === name);
  return { id: uid++, base: "unique", slot: u.slot, cls: u.cls, name: u.name, icon: u.icon, tier: u.tier, rarity: 4, stats: { ...u.stats }, affixes: [], plus: 0, value: 2500, unique: true };
}
// random gear for this hero: their own weapon type, rarer the deeper you go
export function rollItem(tier, minRarity = 0, slot = null) {
  tier = Math.max(1, Math.min(6, tier));
  const pool = GEAR.filter((g) => g.tier <= tier + 1 && g.tier >= tier - 1 && (!g.cls || g.cls === G.cls) && (!slot || g.slot === slot));
  const b = rnd.pick(pool);
  let r = minRarity;
  while (r < 4 && rnd.chance(0.3)) r++;
  return makeItem(b.base, r);
}
export function giveItem(it) {
  if (G.bag.length >= BAG_SIZE) {
    toast("가방이 가득 찼어요", "#ff8a6a");
    return false;
  }
  G.bag.push(it);
  toast(`${itemName(it)} 획득`, RARITY[it.rarity].color);
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
// the blacksmith: success raises the item by one; failure only costs the gold
export function enhance(it) {
  if (it.plus >= ENHANCE.max) return "max";
  const cost = ENHANCE.cost(it);
  if (G.player.gold < cost) return "gold";
  G.player.gold -= cost;
  const ok = rnd.chance(ENHANCE.rate(it.plus));
  if (ok) {
    it.plus++;
    it.value = Math.round(it.value * 1.15);
    sfx.chest();
  } else sfx.hurt();
  recalcStats();
  saveGame();
  return ok ? "ok" : "fail";
}
export function usePotion(kind) {
  const p = G.player, s = G.stats, pt = POTIONS[kind];
  if (!G.potions[kind]) return toast(`${pt.name}이 없어요`, "#ff8a6a");
  if (pt.heal && p.hp >= s.maxHp) return;
  if (pt.mana && p.mp >= s.maxMp) return;
  if (kind === "scroll") {
    if (G.scene.id === "town") return toast("이미 마을이에요", "#9bdcff");
    G.potions.scroll--;
    toast("귀환 주문서를 읽었다", "#c8f0ff");
    return enterScene("town", "start");
  }
  G.potions[kind]--;
  if (pt.heal) p.hp = Math.min(s.maxHp, p.hp + pt.heal);
  if (pt.mana) p.mp = Math.min(s.maxMp, p.mp + pt.mana);
  if (pt.buff) addBuff("elixir", pt.buff, pt.dur);
  addFx(healFx, { x: p.x, y: p.y, palette: pt.mana ? ["#0c1430", "#1f4f94", "#3f8cff", "#7cc8ff", "#c8f0ff", "#ffffff"] : pt.buff ? FIRE_PAL.slice(2) : undefined }, p);
  sfx.heart();
}
// the quick potion buttons use the strongest you have that isn't wasted
export function drinkPotion(kind) {
  const p = G.player, s = G.stats;
  if (kind === "hp") usePotion(G.potions.hp2 > 0 && s.maxHp - p.hp > 120 ? "hp2" : G.potions.hp > 0 ? "hp" : "hp2");
  else usePotion(G.potions.mp2 > 0 && s.maxMp - p.mp > 100 ? "mp2" : G.potions.mp > 0 ? "mp" : "mp2");
}

// ---- quests & bounties ---------------------------------------------------------------------------
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
// returns what the UI should do next: "ending", "job2" (pick a branch), or nothing
export function completeQuest(id) {
  const q = QUESTS[id], r = q.reward, p = G.player;
  G.quests[id].state = "complete";
  if (q.type === "collect" || q.type === "find") G.keys[q.target] = Math.max(0, (G.keys[q.target] ?? 0) - q.count);
  p.gold += r.gold ?? 0;
  for (const k in r.potions ?? {}) G.potions[k] += r.potions[k];
  if (r.item) {
    G.keys[r.item] = 1;
    toast(`${KEY_ITEMS[r.item].name} 획득! 공습 스킬이 열렸어요`, "#ffb04a");
  }
  if (r.gear) giveItem(rollItem(r.gear.tier, r.gear.rarity, r.gear.slot));
  if (r.unique) giveItem(makeUnique(r.unique));
  for (const u of q.unlocks) if (!G.quests[u] && (QUESTS[u].needs ?? []).every((n) => G.quests[n]?.state === "complete")) G.quests[u] = { state: "available", n: 0 };
  sfx.quest();
  toast(`보상: ${r.xp} 경험치, ${r.gold ?? 0} 골드`, "#ffd84a");
  gainXp(r.xp);
  saveGame();
  if (q.job === 2) return "job2";
  if (q.job === 3) return advanceJob(), "job3";
  return q.ending ? "ending" : null;
}
function onKill(e) {
  const region = G.scene.region;
  for (const id in G.quests) {
    const st = G.quests[id], q = QUESTS[id];
    if (st.state !== "active") continue;
    if ((q.type === "kill" || q.type === "boss") && (q.target === e.type || (q.target === "any" && q.region === region && !ENEMIES[e.type].event))) st.n++;
  }
  const b = G.bounty;
  if (b && b.n < b.count && b.target === e.type) {
    b.n++;
    if (b.n === b.count) toast("현상수배 완료! 게시판에서 보상을 받으세요", "#ffd84a"), sfx.quest();
  }
  checkQuests();
}
export function giveKey(k, n = 1) {
  G.keys[k] = (G.keys[k] ?? 0) + n;
  toast(`${KEY_ITEMS[k].name} +${n}`, "#c8f0ff");
  checkQuests();
}
export function npcMarker(npc) {
  if (npc === "board") return G.bounty && G.bounty.n >= G.bounty.count ? "?" : null;
  let mark = null;
  for (const id in G.quests) {
    if (QUESTS[id].giver !== npc) continue;
    const st = G.quests[id].state;
    if (st === "ready") return "?";
    if (st === "available" && (QUESTS[id].minLevel ?? 0) <= G.player.lv) mark = "!";
  }
  return mark;
}
export function newBounty() {
  const lv = G.player.lv, fit = BOUNTIES.filter((b) => b.lv <= lv + 1 && b.lv >= lv - 8);
  const b = rnd.pick(fit.length ? fit : BOUNTIES.slice(0, 2));
  const def = ENEMIES[b.target];
  G.bounty = { ...b, n: 0, gold: Math.round(def.gold[1] * b.count * (1 + lv * 0.2)), xp: Math.round(def.xp * b.count * (1 + lv * 0.12) * 1.6) };
}
export function claimBounty() {
  const b = G.bounty;
  G.player.gold += b.gold;
  sfx.quest();
  toast(`현상금 ${b.gold} 골드!`, "#ffd84a");
  gainXp(b.xp);
  if (rnd.chance(0.35)) giveItem(rollItem(Math.ceil(G.player.lv / 4), 1));
  newBounty();
  saveGame();
}

// ---- scenes --------------------------------------------------------------------------------------
export function enterScene(id, entry, at = null) {
  const s = getScene(id);
  G.scene = s;
  Object.assign(G, { enemies: [], projectiles: [], zones: [], strikes: [], fxs: [], pickups: [], texts: [], dashes: [], timers: [], shake: 0, hitstop: 0, flash: 0, preview: null, boss: null, portalCd: 0.8, respawn: 0 });
  const pos = at ?? s.entries[entry] ?? s.entries.start ?? Object.values(s.entries)[0];
  Object.assign(G.player, { x: pos.x, y: pos.y, charge: 0, dash: null });
  flowFrom = -1;
  for (const pt of s.portals) pt.fx = addFx(portalFx, { x: pt.x, y: pt.y, palette: PORTAL_PAL[pt.color] });
  s.activeExit = null;
  if (s.boss && G.flags[s.boss.flag]) openBossExit(s);
  for (const z of s.zones) for (let i = 0; i < z.count; i++) spawnInZone(z, true);
  for (const sp of s.spawns) spawnEnemy(sp.type, sp.lv, { x: sp.x, y: sp.y });
  if (s.boss && !G.flags[s.boss.flag]) spawnEnemy(s.boss.type, s.boss.lv, { x: s.boss.x, y: s.boss.y });
  if (s.fieldBoss && !G.flags[s.fieldBoss.flag] && G.quests.q4?.state === "active") spawnEnemy(s.fieldBoss.type, s.fieldBoss.lv, { x: s.fieldBoss.x, y: s.fieldBoss.y });
  if (G.wanderer && G.wanderer.scene !== id) G.wanderer = null;
  G.raid = null;
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
  const p = G.player;
  for (let tries = 0; tries < 30; tries++) {
    const x = (z.x0 + rnd.next() * (z.x1 - z.x0)) * TILE, y = (z.y0 + rnd.next() * (z.y1 - z.y0)) * TILE;
    if (Math.hypot(x - p.x, y - p.y) < (initial ? 120 : 170)) continue;
    let type = rnd.pick(z.types);
    if (type === "slime" && rnd.chance(0.03)) type = "goldslime";
    if (!ENEMIES[type].flying && blocked(x, y, 6)) continue;
    const e = spawnEnemy(type, rnd.int(z.lv[0], z.lv[1]), { x, y });
    e.zone = z;
    if (type === "goldslime") toast("황금 슬라임이 나타났다!", "#ffd84a");
    return e;
  }
}
export function spawnEnemy(type, lv, pos) {
  const def = ENEMIES[type], sc = enemyScale(lv), night = isNight() && !G.scene.dark ? 1.15 : 1, moon = G.bloodMoon ? 1.4 : 1;
  const hp = Math.round(def.hp * (def.boss ? 1 + 0.09 * (lv - 1) : sc.hp) * night * moon);
  const e = { type, lv, x: pos.x, y: pos.y, home: { ...pos }, hp, max: hp, atk: Math.round(def.atk * sc.atk * (G.bloodMoon ? 1.2 : 1)), kx: 0, ky: 0, hit: 0, frozen: 0, stun: 0, slow: 0, anim: rnd.range(0, 2), touchCd: 0, wander: rnd.range(0, 6.28), wt: 0, z: 0, state: "walk", timer: rnd.range(2.5, 4), shootCd: rnd.range(1, 2.5), spawnT: 0, aggro: false };
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
export function steer(x, y, dx, dy, d) {
  const s = G.scene, tx = Math.floor(x / TILE), ty = Math.floor((y - 2) / TILE), here = open(s, tx, ty) && flow ? flow[ty * s.w + tx] : -1;
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
export function hitEnemy(e, base, kx = 0, ky = 0, opts = {}) {
  if (e.dead) return;
  const p = G.player, s = G.stats;
  const ambush = p.stealth > 0;
  const crit = ambush || rnd.chance(s.crit + (opts.critBonus ?? 0));
  const dmg = Math.max(1, Math.round(base * (crit ? (ambush ? 2.5 : 1.8) : 1) * rnd.range(0.9, 1.1)));
  if (ambush) (p.stealth = 0), recalcStats();
  e.hp -= dmg;
  e.hit = 0.1;
  e.aggro = true;
  const heavy = ENEMIES[e.type].boss ? 0.12 : 1;
  e.kx += kx * heavy;
  e.ky += ky * heavy;
  if (s.lifesteal) p.hp = Math.min(s.maxHp, p.hp + dmg * s.lifesteal);
  text(String(dmg), e.x, e.y - ENEMIES[e.type].hitY - e.z - 8, crit ? "#ffd84a" : "#ffffff", crit);
  crit ? sfx.crit() : sfx.hit();
  // the treasure goblin spills coins when struck
  if (e.type === "goblin" && rnd.chance(0.5)) dropCoin(e.x, e.y, Math.round(3 + p.lv));
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  const def = ENEMIES[e.type];
  G.kills++;
  sfx.pop();
  gainXp(Math.round(def.xp * (1 + 0.22 * (e.lv - 1))));
  onKill(e);
  const gold = Math.round(rnd.range(def.gold[0], def.gold[1] + 1) * (1 + 0.15 * (e.lv - 1)));
  const n = Math.min(8, Math.ceil(gold / 5));
  for (let i = 0; i < n; i++) dropCoin(e.x, e.y, Math.ceil(gold / n));
  if (e.type === "bat" && G.quests.s1?.state === "active" && rnd.chance(0.6)) G.pickups.push({ kind: "key", key: "wing", x: e.x, y: e.y, t: 0, vx: 0, vy: 0 });
  if ((def.ore ?? 0) && G.quests.s4?.state === "active" && rnd.chance(def.ore)) G.pickups.push({ kind: "key", key: "ore", x: e.x, y: e.y, t: 0, vx: 0, vy: 0 });
  if (rnd.chance(0.06)) G.pickups.push({ kind: "potion", potion: rnd.pick(e.lv > 10 ? ["hp2", "mp2", "hp", "mp"] : ["hp", "mp"]), x: e.x + 4, y: e.y, t: 0, vx: 0, vy: 0 });
  const tier = Math.min(6, Math.ceil(e.lv / 4.5));
  if (def.event) for (let i = 0; i < (e.type === "goblin" ? 3 : 1); i++) dropLoot(e.x, e.y, rollItem(tier, 2));
  else if (rnd.chance(def.boss ? 1 : 0.035)) dropLoot(e.x, e.y, rollItem(tier, def.boss ? 2 : 0));
  if (def.boss) {
    G.boss = null;
    G.hitstop = 0.3;
    shake(0.6);
    for (let i = 0; i < 5; i++) addFx(slimePop, { x: e.x + rnd.range(-16, 16), y: e.y + rnd.range(-8, 8), palette: POP_PAL[e.type] });
    addFx(airBlast, { x: e.x, y: e.y, palette: POP_PAL[e.type]?.length === 8 ? POP_PAL[e.type] : SLAM_PAL });
    if (rnd.chance(0.25) || e.type === "demonking") dropLoot(e.x, e.y, makeUnique(rnd.pick(UNIQUES.filter((u) => !u.cls || u.cls === G.cls)).name));
    if ((e.type === "drake" || e.type === "giant") && !G.keys.token && G.quests.j3?.state !== "complete") G.pickups.push({ kind: "key", key: "token", x: e.x, y: e.y + 6, t: 0, vx: 0, vy: 0 });
    const flag = G.scene.boss?.type === e.type ? G.scene.boss.flag : G.scene.fieldBoss?.flag;
    if (flag) G.flags[flag] = true;
    if (G.scene.boss?.type === e.type) openBossExit(G.scene);
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
  const real = Math.max(1, Math.round(((dmg * 30) / (30 + G.stats.def)) * (1 - (G.stats.guard ?? 0))));
  p.hp -= real;
  p.hurt = 0.7;
  p.calm = 0;
  if (p.stealth > 0) (p.stealth = 0), recalcStats();
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
  G.buffs = [];
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
export function enemyShot(x, y, tx, ty, speed, dmg, kind) {
  const dx = tx - x, dy = ty - y, l = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx);
  const pr = { owner: "enemy", kind, x, y, vx: (dx / l) * speed, vy: (dy / l) * speed, ang, life: 2.6, dmg };
  const pal = { shadow: SHADOW_PAL, fire: FIRE_PAL, snow: undefined }[kind];
  if (kind !== "arrow") pr.fx = addFx(frostBolt, { x, y, angle: ang, palette: pal, scale: kind === "snow" ? 1 : 0.9 }, pr);
  G.projectiles.push(pr);
  return pr;
}

// ---- interaction ---------------------------------------------------------------------------------
export function interactable() {
  const p = G.player, s = G.scene;
  let best = null, bd = 1e9;
  const consider = (kind, ref, x, y, r) => {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < r && d < bd) (bd = d), (best = { kind, ref, x, y });
  };
  for (const n of s.npcs) consider("npc", n, n.x, n.y, n.object ? 26 : 24);
  if (G.wanderer?.scene === s.id) consider("npc", G.wanderer, G.wanderer.x, G.wanderer.y, 24);
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
  if (rnd.chance(0.6)) G.pickups.push({ kind: "potion", potion: rnd.pick(tier > 2 ? ["hp2", "mp2", "elixir"] : ["hp", "mp"]), x: c.x - 6, y: c.y + 6, t: 0, vx: -20, vy: 10 });
  saveGame();
}

// ---- time & world events -------------------------------------------------------------------------
export const isNight = () => {
  const c = (G.clock % DAY) / DAY;
  return c > 0.62 || c < 0.08;
};
// how dark the sky is: 0 at noon, ~0.6 at midnight
export function darkness() {
  const c = (G.clock % DAY) / DAY;
  const n = c < 0.08 ? 1 - c / 0.08 * 0.3 : c > 0.62 ? Math.min(1, (c - 0.62) / 0.1) : 0;
  return n * 0.55;
}
function updateWorld(dt) {
  const s = G.scene, field = !!s.zones.length, wasNight = isNight();
  G.clock += dt;
  if (isNight() !== wasNight) {
    if (isNight()) {
      G.bloodMoon = G.player.lv >= 6 && rnd.chance(0.2);
      toast(G.bloodMoon ? "붉은 달이 떴다! 몬스터가 강해지지만 경험치 +50%" : "밤이 되었습니다", G.bloodMoon ? "#ff5a5a" : "#9bb4ff");
    } else {
      G.bloodMoon = false;
      toast("아침이 밝았습니다", "#ffe8a0");
    }
  }
  // weather comes and goes in the open
  G.weatherT = (G.weatherT ?? 60) - dt;
  if (G.weatherT <= 0) {
    G.weatherT = rnd.range(60, 140);
    G.rain = field && rnd.chance(0.35);
  }
  const ev = G.events;
  for (const k in ev) ev[k] -= dt;
  // a treasure goblin turns up near you in the wilds
  if (field && ev.goblin <= 0) {
    ev.goblin = rnd.range(100, 170);
    const a = rnd.range(0, Math.PI * 2), x = G.player.x + Math.cos(a) * 110, y = G.player.y + Math.sin(a) * 70;
    if (!blocked(x, y, 6)) {
      const g = spawnEnemy("goblin", Math.max(2, G.player.lv), { x, y });
      g.aggro = true;
      toast("보물 고블린이 나타났다! 도망치기 전에 잡아라!", "#ffd84a");
    }
  }
  // the wandering merchant sets up somewhere in the wilds for two minutes
  if (field && ev.wanderer <= 0 && !G.wanderer) {
    ev.wanderer = rnd.range(220, 320);
    for (let k = 0; k < 40; k++) {
      const x = rnd.range(4, s.w - 4) * TILE, y = rnd.range(4, s.h - 4) * TILE;
      if (tileAt(s, x, y) === T.PATH && !blocked(x, y, 6)) {
        G.wanderer = { id: "wanderer", scene: s.id, x, y, t: 120, stock: wandererStock() };
        toast("떠돌이 상인이 근처에 자리를 폈다 (지도에 노란 점)", "#ffe066");
        break;
      }
    }
  }
  if (G.wanderer) {
    G.wanderer.t -= dt;
    if (G.wanderer.t <= 0) (G.wanderer = null), toast("떠돌이 상인이 떠났다", "#b89f78");
  }
  // raids on the village, once the kingdom has noticed you
  if (s.id === "town" && G.quests.q2?.state === "complete" && ev.raid <= 0 && !G.raid) {
    ev.raid = rnd.range(420, 600);
    const lv = Math.max(3, G.player.lv - 1), pool = lv < 9 ? ["slime", "bat", "skeleton"] : lv < 15 ? ["wolf", "orc", "skeleton"] : lv < 20 ? ["orc", "imp", "golem"] : ["demon", "gargoyle", "imp"];
    G.raid = { queue: Array.from({ length: 10 + Math.floor(lv / 3) }, () => rnd.pick(pool)), lv, timer: 2, left: 0 };
    toast("마을 습격! 몬스터가 동쪽 문으로 몰려온다!", "#ff5a5a");
    sfx.boss();
  }
  if (G.raid) {
    const r = G.raid;
    r.timer -= dt;
    if (r.queue.length && r.timer <= 0) {
      r.timer = 1.1;
      const e = spawnEnemy(r.queue.shift(), r.lv, { x: 37 * TILE + 8, y: 12 * TILE + rnd.range(0, 30) });
      e.aggro = true;
      e.raid = true;
    }
    if (!r.queue.length && !G.enemies.some((e) => e.raid)) {
      G.raid = null;
      const gold = 80 + G.player.lv * 30;
      G.player.gold += gold;
      gainXp(60 + G.player.lv * 40);
      giveItem(rollItem(Math.ceil(G.player.lv / 4.5), 2));
      toast(`습격을 막아냈다! 보상 ${gold} 골드`, "#ffd84a");
      sfx.quest();
      saveGame();
    }
  }
}
function wandererStock() {
  const lv = G.player.lv, t = Math.min(6, Math.ceil(lv / 4) + 1);
  return [rollItem(t, 2), rollItem(t, 2), rollItem(t, 3)].map((it) => ({ item: it, price: Math.round(it.value * 1.6) }));
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
    if (p.stealth > 0 && (p.stealth -= dt) <= 0) recalcStats();
    for (const k in p.cds) p.cds[k] = Math.max(0, p.cds[k] - dt);
    let buffsChanged = false;
    for (const b of G.buffs) if ((b.t -= dt) <= 0) (buffsChanged = true), b.fx?.fx.stop();
    if (buffsChanged) (G.buffs = G.buffs.filter((b) => b.t > 0)), recalcStats();
    p.mp = Math.min(s.maxMp, p.mp + dt * (1.2 + s.maxMp * 0.012));
    if (p.calm > 5) p.hp = Math.min(s.maxHp, p.hp + dt * (1 + s.maxHp * 0.01));
    // lava burns
    if (G.scene.hazard && tileAt(G.scene, p.x, p.y - 2) === G.scene.hazard && !p.dash) {
      p.burn = (p.burn ?? 0) - dt;
      if (p.burn <= 0) {
        p.burn = 0.5;
        p.hurt = 0;
        hurtPlayer(Math.round(s.maxHp * 0.05 + 4), p.x, p.y + 1);
      }
    }
    updateFlow();
    updateSkills(dt, input);
    updateWorld(dt);
    if (G.scene.explored) reveal();
  }
  for (const tm of G.timers) if ((tm.t -= dt) <= 0 && !tm.done) (tm.done = true), tm.fn();
  G.timers = G.timers.filter((tm) => !tm.done);
  updateProjectiles(dt);
  for (const e of G.enemies) updateEnemy(e, dt);
  G.enemies = G.enemies.filter((e) => !e.dead);
  if (G.scene.zones.length && G.mode === "play") {
    G.respawn -= dt;
    if (G.respawn <= 0) {
      G.respawn = isNight() ? 4 : 6;
      for (const z of G.scene.zones) if (G.enemies.filter((e) => e.zone === z).length < z.count + (isNight() ? 2 : 0)) spawnInZone(z, false);
    }
  }
  updatePickups(dt);
  G.portalCd = Math.max(0, G.portalCd - dt);
  if (G.mode === "play" && G.portalCd <= 0 && !G.raid) {
    const all = [...G.scene.portals, ...(G.scene.activeExit ? [G.scene.activeExit] : [])];
    for (const pt of all)
      if (Math.hypot(pt.x - p.x, (pt.y - p.y) / 0.6) < 11) {
        if (pt.needs && G.quests[pt.needs]?.state !== "complete" && !(pt.needs === "q7" && G.quests.q7)) {
          toast(pt.needs === "q2" ? "봉인된 문이다. 촌장에게 먼저 이야기를 들어 보자" : pt.needs === "q4" ? "길이 막혀 있다. 오크 족장을 먼저 쓰러뜨리자" : "마왕의 결계가 길을 막고 있다", "#c684ff");
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
      } else if (Math.hypot(pr.x - p.x, pr.y - (p.y - 8)) < 7 + (pr.size ?? 1) * 2) {
        hurtPlayer(pr.dmg, pr.x - pr.vx * 0.05, pr.y - pr.vy * 0.05);
        endProjectile(pr, true);
      }
      if (!pr.done && isSolidAt(G.scene, pr.x, pr.y + 8) && !isWaterAt(G.scene, pr.x, pr.y + 8) && tileAt(G.scene, pr.x, pr.y + 8) !== T.LAVA) endProjectile(pr, true);
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
  if (impact) pr.onEnd?.(pr);
  if (impact && pr.hitFx) addFx(pr.hitFx, { x: pr.x, y: pr.y, aim: pr.ang, palette: pr.hitPal });
  const pal = { shadow: SHADOW_PAL, fire: FIRE_PAL, snow: undefined }[pr.kind];
  if (impact && pr.owner === "enemy" && pr.kind !== "arrow") addFx(frostHit, { x: pr.x, y: pr.y, aim: pr.ang, palette: pal });
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
    if (d < 10 && k.t > 0.3 && G.mode === "play") {
      if (k.kind === "coin") {
        p.gold += k.v;
        sfx.coin();
      } else if (k.kind === "potion") {
        G.potions[k.potion] = (G.potions[k.potion] ?? 0) + 1;
        toast(`${POTIONS[k.potion].name} +1`, k.potion.startsWith("hp") ? "#ff8a8a" : "#8ac8ff");
        sfx.heart();
      } else if (k.kind === "key") giveKey(k.key);
      else if (k.kind === "item" && !giveItem(k.item)) continue;
      k.taken = true;
    }
  }
  G.pickups = G.pickups.filter((k) => !k.taken);
}
function reveal() {
  const s = G.scene, p = G.player, tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  for (let y = ty - 6; y <= ty + 6; y++) for (let x = tx - 8; x <= tx + 8; x++) if (x >= 0 && y >= 0 && x < s.w && y < s.h) s.explored[y * s.w + x] = 1;
}
