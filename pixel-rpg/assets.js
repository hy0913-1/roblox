// Image art from assets/manifest.json (made by tools/make_assets.py from SpriteCook sheets).  Every entry REPLACES the
// code-drawn sprite of the same name, in place; anything not in the manifest keeps its code-drawn fallback, so the game
// always runs, with or without the PNGs.  The single-file build inlines the PNGs as data: URLs in window.__ASSETS.

import { SPRITES, tint, OVERRIDE } from "./sprites.js";
import { HEROES, NPC_ART, ENEMY_ART, BOSS_ART, LICH_ART, HOUSES, WELL, CHESTS } from "./art.js";

const FLASH = ["#ffffff", 0.88], ICE = ["#9bdcff", 0.62];
// which SPRITES entries are { name1, name2 } pairs, in manifest order (frame a, frame b)
const SPRITE_FRAMES = { slime: ["tall", "flat"], bat: ["up", "down"], archer: ["tall", "flat"], skeleton: ["tall", "flat"], king: ["tall", "flat"] };

const loaded = new Map();
function loadImage(src) {
  return new Promise((ok, no) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => no(new Error("image " + src.slice(0, 60)));
    im.src = src;
  });
}
async function canvasOf(name) {
  if (loaded.has(name)) return loaded.get(name);
  const inline = window.__ASSETS?.files?.[name];
  const im = await loadImage(inline ?? "assets/" + name);
  const cv = Object.assign(document.createElement("canvas"), { width: im.width, height: im.height });
  cv.getContext("2d").drawImage(im, 0, 0);
  loaded.set(name, cv);
  return cv;
}
const variants = (a, b) => ({ a, b, aFlash: tint(a, ...FLASH), bFlash: tint(b, ...FLASH), aIce: tint(a, ...ICE), bIce: tint(b, ...ICE) });

// a sprite scaled up by whole pixels, with room above for decoration (bosses are made from the new monsters)
function bigger(src, k, decorate) {
  const w = src.width * k, h = src.height * k, c = Object.assign(document.createElement("canvas"), { width: w + 8, height: h + 10 });
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, src.width, src.height, 4, 10, w, h);
  decorate?.(g, c);
  return c;
}
const rect = (g, x, y, w, h, col) => {
  g.fillStyle = col;
  g.fillRect(x, y, w, h);
};

async function apply(m) {
  const get = (files) => Promise.all(files.map(canvasOf));
  for (const [cls, dirs] of Object.entries(m.hero ?? {})) {
    const set = {};
    for (const [d, files] of Object.entries(dirs)) set[d] = await get(files);
    if (set.right) set.left = set.right;
    const target = cls === "mage" ? SPRITES.wizard : (HEROES[cls] ??= {});
    Object.assign(target, set);
  }
  for (const [key, files] of Object.entries(m.sprite ?? {})) {
    const names = SPRITE_FRAMES[key];
    if (!names) continue;
    const [a, b] = await get(files);
    const mk = (f) => ({ [names[0]]: f(a), [names[1]]: f(b) });
    SPRITES[key] = mk((x) => x);
    SPRITES[key + "Flash"] = mk((x) => tint(x, ...FLASH));
    SPRITES[key + "Ice"] = mk((x) => tint(x, ...ICE));
  }
  for (const [key, files] of Object.entries(m.enemy ?? {})) ENEMY_ART[key] = variants(...(await get(files)));
  for (const [key, files] of Object.entries(m.boss ?? {})) BOSS_ART[key] = variants(...(await get(files)));
  for (const [id, files] of Object.entries(m.npc ?? {})) NPC_ART[id] = await get(files);
  if (m.npc?.merchant) NPC_ART.wanderer = NPC_ART.merchant.map((im) => tint(im, "#6a4a2a", 0.35));
  if (m.sprite?.archer && m.sprite?.skeleton && m.npc?.elder) OVERRIDE.held = true; // weapons and staffs are part of the art
  const prop = async (k) => (m.prop?.[k] ? (await get(m.prop[k]))[0] : null);
  if (m.prop?.lich) {
    const l = await prop("lich");
    LICH_ART.base = l;
    LICH_ART.flash = tint(l, ...FLASH);
    LICH_ART.ice = tint(l, ...ICE);
  }
  for (const [i, k] of ["house0", "house1", "house2"].entries()) if (m.prop?.[k]) HOUSES[i] = await prop(k);
  if (m.prop?.house0) for (let i = 1; i < 3; i++) if (!m.prop["house" + i]) HOUSES[i] = recolour(HOUSES[0], i);
  for (const k of ["wood", "woodOpen", "gold", "goldOpen"]) if (m.prop?.["chest_" + k]) CHESTS[k] = await prop("chest_" + k);
  if (!m.prop?.chest_gold && CHESTS.wood && m.prop?.chest_wood) {
    CHESTS.gold = tint(CHESTS.wood, "#ffd84a", 0.4);
    if (m.prop.chest_woodOpen) CHESTS.goldOpen = tint(CHESTS.woodOpen, "#ffd84a", 0.3);
  }
  if (m.prop?.well) OVERRIDE.well = await prop("well");
  const trees = [];
  for (const k of ["tree0", "tree1"]) if (m.prop?.[k]) trees.push(await prop(k));
  if (trees.length) OVERRIDE.trees = trees;
  // bosses from the new monsters, unless the manifest has its own
  if (m.enemy?.orc && !m.boss?.chief) {
    const deco = (g, c) => {
      for (const x of [6, c.width - 12]) rect(g, x, 1, 3, 9, "#ece8d4");
      rect(g, 8, 7, c.width - 16, 4, "#8a96ac");
    };
    BOSS_ART.chief = variants(bigger(ENEMY_ART.orc.a, 2, deco), bigger(ENEMY_ART.orc.b, 2, deco));
  }
  if (m.enemy?.yeti && !m.boss?.giant) {
    const deco = (g, c) => {
      rect(g, 10, 6, c.width - 20, 3, "#3f8cff");
      for (let x = 10; x < c.width - 12; x += 7) rect(g, x, 1, 2, 6, "#dcf2ff");
    };
    BOSS_ART.giant = variants(bigger(ENEMY_ART.yeti.a, 2, deco), bigger(ENEMY_ART.yeti.b, 2, deco));
  }
  if (m.enemy?.demon && !m.boss?.demonking) {
    const deco = (g, c) => {
      g.globalCompositeOperation = "destination-over";
      rect(g, 6, 24, c.width - 12, c.height - 28, "#3a0a1a");
      g.globalCompositeOperation = "source-over";
      for (const [x, h] of [[8, 8], [14, 5], [c.width / 2 - 1, 9], [c.width - 16, 5], [c.width - 10, 8]]) rect(g, Math.round(x), 9 - h, 2, h, "#ffd84a");
    };
    BOSS_ART.demonking = variants(bigger(ENEMY_ART.demon.a, 2, deco), bigger(ENEMY_ART.demon.b, 2, deco));
  }
  // King Slime is drawn from SPRITES.king (see render.js); nothing more to do
}

// roof colour variants of the one generated house: swap red for blue / green
function recolour(src, v) {
  const c = Object.assign(document.createElement("canvas"), { width: src.width, height: src.height });
  const g = c.getContext("2d");
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], gg = p[i + 1], b = p[i + 2];
    if (p[i + 3] && r > gg * 1.5 && r > b * 1.5) [p[i], p[i + 1], p[i + 2]] = v === 1 ? [b + (r - b) * 0.2, gg + (r - gg) * 0.35, r] : [gg + (r - gg) * 0.3, r, b + (r - b) * 0.2];
  }
  g.putImageData(d, 0, 0);
  return c;
}

export async function loadAssets() {
  let manifest = window.__ASSETS?.manifest;
  try {
    manifest ??= await (await fetch("assets/manifest.json")).json();
  } catch {
    return false; // no assets folder: code-drawn art stays
  }
  try {
    await apply(manifest);
    return true;
  } catch (err) {
    console.warn("assets:", err);
    return false;
  }
}
