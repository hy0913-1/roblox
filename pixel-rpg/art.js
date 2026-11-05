// More hand-made pixel art, all drawn from strings or whole-pixel shapes at startup: the knight and ranger, the
// villagers, the Lich, buildings and props, dungeon furniture, chests and item icons. No image files.

import { makeSprite, tint } from "./sprites.js";

const cv = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });
function disc(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    const dy = y + 0.5 - cy, hw = Math.sqrt(Math.max(0, r * r - dy * dy));
    if (hw > 0) g.fillRect(Math.round(cx - hw), y, Math.max(1, Math.round(hw * 2)), 1);
  }
}
const rect = (g, x, y, w, h, c) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};
const step = (rows) => [...rows.slice(0, rows.length - 2), ".kbbk....kbbk.", ".kkkk....kkkk."];
const side = (rows, eyeRow, eyes, mouthRow, mouth) => rows.map((r, i) => (i === eyeRow ? eyes : i === mouthRow && mouth ? mouth : r));
function dirSet(front, back, sideRows, pal) {
  const f = [makeSprite(front, pal), makeSprite(step(front), pal)];
  const b = [makeSprite(back, pal), makeSprite(step(back), pal)];
  const s = [makeSprite(sideRows, pal), makeSprite(step(sideRows), pal)];
  return { down: f, up: b, right: s, left: s };
}

// ---- heroes ----------------------------------------------------------------------------------------
const KNIGHT_PAL = { k: "#1b1326", m: "#8a96ac", M: "#d0d8e6", s: "#f3c49d", e: "#1b1326", b: "#2f5fae", y: "#f2c14e", B: "#4a3020" };
const KNIGHT = [
  "....kkkkkk....",
  "...kmmmmmmk...",
  "..kmMMmmmmmk..",
  "..kmmmmmmmmk..",
  "..kkkkkkkkkk..",
  "..kmksssskmk..",
  "...ksessesk...",
  "...kssssssk...",
  "..kbbbyybbbk..",
  ".kmbbyyyybbmk.",
  ".kmbbbyybbbmk.",
  ".kmbbbbbbbbmk.",
  ".kkbbbbbbbbkk.",
  "..kmmmmmmmmk..",
  "..kBBk..kBBk..",
  "..kkkk..kkkk..",
];
const KNIGHT_BACK = [...KNIGHT.slice(0, 4), "..kmmmmmmmmk..", "..kmmMmmmmmk..", "...kmmmmmmk...", "...kmmmmmmk...", "..kbbbbbbbbk..", ".kmbbbbbbbbmk.", ...KNIGHT.slice(10)];
const KNIGHT_SIDE = side(KNIGHT, 6, "...ksssseek...", 5, "..kmkssssskk..");

const RANGER_PAL = { k: "#1b1326", g: "#3f8a42", G: "#6cbb55", s: "#f3c49d", e: "#1b1326", l: "#8e5c2c", b: "#4a3020", p: "#38334a" };
const RANGER = [
  "....kkkkkk....",
  "...kggGgggk...",
  "..kggGGggggk..",
  "..kgkkkkkkgk..",
  "..kgksssskgk..",
  "...ksessesk...",
  "...kssssssk...",
  "..kgllllllgk..",
  ".kgglllllllgk.",
  ".kglbbbbbblgk.",
  ".kgllllllllgk.",
  ".kkllllllllkk.",
  "..kllllllllk..",
  "..kppk..kppk..",
  "..kbbk..kbbk..",
  "..kkkk..kkkk..",
];
const RANGER_BACK = [...RANGER.slice(0, 3), "..kggggggggk..", "..kggGggggggk.", "...kggggggk...", "...kggggggk...", "..kgggggggggk.", ".kggggggggggk.", ...RANGER.slice(9)];
const RANGER_SIDE = side(RANGER, 5, "...ksssseek...");

export const HEROES = {
  knight: dirSet(KNIGHT, KNIGHT_BACK, KNIGHT_SIDE, KNIGHT_PAL),
  ranger: dirSet(RANGER, RANGER_BACK, RANGER_SIDE, RANGER_PAL),
};

// ---- villagers -------------------------------------------------------------------------------------
const ELDER = [
  "....kkkkkk....",
  "...kwwwwwwk...",
  "..kwwwwwwwwk..",
  "..kwksssskwk..",
  "...ksessesk...",
  "...kswwwwsk...",
  "..kgwwwwwwgk..",
  ".kgggwwwwgggk.",
  ".kgGgwwwwgGgk.",
  ".kggggwwggggk.",
  ".kggggggggggk.",
  ".kggggggggggk.",
  ".kyyyyyyyyyyk.",
  "..kbbk..kbbk..",
  "..kkkk..kkkk..",
];
const MERCHANT = [
  "....kkkkkk....",
  "...khhhhhhk...",
  "..khhhhhhhhk..",
  "..khksssskhk..",
  "...ksessesk...",
  "...kssssssk...",
  "..krrrrrrrrk..",
  ".kpprrrrrrppk.",
  ".kppwwwwwwppk.",
  ".kppwwwwwwppk.",
  ".kppwwwwwwppk.",
  ".kppppppppppk.",
  "..kppppppppk..",
  "..kbbk..kbbk..",
  "..kkkk..kkkk..",
];
const KID = ["..kkkkkk..", ".khhhhhhk.", "khhhhhhhhk", "khseesesk.", ".kssssssk.", "..kbbbbk..", ".kbbyybbk.", ".kbbbbbbk.", "..kppppk..", "..kpkkpk..", "..kk..kk.."];
const NPC_SETS = {
  elder: { rows: ELDER, pal: { k: "#1b1326", w: "#ece8f4", s: "#f3c49d", e: "#1b1326", g: "#2d6a34", G: "#4f9a3a", y: "#f2c14e", b: "#5a3a20" } },
  merchant: { rows: MERCHANT, pal: { k: "#1b1326", h: "#7a4128", s: "#f3c49d", e: "#1b1326", r: "#d8362e", p: "#6b4a9a", w: "#ece8f4", b: "#4a3020" } },
  guard: { rows: KNIGHT, pal: { ...KNIGHT_PAL, b: "#a8301a", y: "#ffd84a" } },
  kid: { rows: KID, pal: { k: "#1b1326", h: "#e0a040", s: "#f3c49d", e: "#1b1326", b: "#3a8bd8", y: "#ffffff", p: "#4a3020" } },
};
export const NPC_ART = Object.fromEntries(
  Object.entries(NPC_SETS).map(([id, { rows, pal }]) => {
    const a = makeSprite(rows, pal);
    // idle: the second frame breathes down a pixel at the shoulders
    const b = cv(a.width, a.height);
    const g = b.getContext("2d");
    g.drawImage(a, 0, 0, a.width, 6, 0, 0, a.width, 6);
    g.drawImage(a, 0, 6, a.width, a.height - 6, 0, 6, a.width, a.height - 6);
    g.drawImage(a, 0, 0, a.width, 6, 0, 1, a.width, 6);
    return [id, [a, b]];
  })
);

// ---- the Lich --------------------------------------------------------------------------------------
const LICH = [
  "......kkkk......",
  ".....kyyyyk.....",
  "....kyrryryk....",
  "....kwwwwwwk....",
  "...kwkkwwkkwk...",
  "...kwkekwkekk...",
  "...kwwwwwwwwk...",
  "....kwkwkwkk....",
  "...kppppppppk...",
  "..kpPppppppPpk..",
  ".kppPppwwppPppk.",
  ".kpppppwwpppppk.",
  ".kppppppppppppk.",
  "..kppppppppppk..",
  "..kpPpPpPpPpk...",
  "...kpkpkpkpk....",
  "....k.k.k.k.....",
];
const LICH_PAL = { k: "#120a1c", y: "#ffd84a", r: "#e0364a", w: "#e4dcc8", e: "#7affb0", p: "#3a1f5a", P: "#5e3290" };
const lich = makeSprite(LICH, LICH_PAL);
export const LICH_ART = { base: lich, flash: tint(lich, "#ffffff", 0.85), ice: tint(lich, "#9bdcff", 0.6) };

// ---- buildings & props -----------------------------------------------------------------------------
const ROOFS = [
  ["#7a1f1a", "#a8301a", "#d8483a"],
  ["#1f3f7a", "#2f5fae", "#4a7cc0"],
  ["#2d5a2a", "#3f8a42", "#6cbb55"],
];
// a house 56x52: plank walls, a tiled roof, a lit window and a door. Its footprint is the bottom 3x2 tiles.
export const HOUSES = ROOFS.map(([dark, mid, light], v) => {
  const c = cv(56, 52), g = c.getContext("2d");
  rect(g, 6, 48, 44, 4, "rgba(0,0,0,0.28)");
  rect(g, 6, 22, 44, 27, "#1b1326");
  rect(g, 7, 23, 42, 25, "#c9a46a");
  for (let y = 25; y < 48; y += 4) rect(g, 7, y, 42, 1, "#a8834e");
  rect(g, 7, 23, 42, 2, "#8a6a3e");
  // roof: stepped rows of tiles
  for (let i = 0; i < 12; i++) {
    const w = 52 - i * 2.6, x = 28 - w / 2, y = 23 - i * 1.9;
    rect(g, Math.round(x) - 1, Math.round(y) - 1, Math.round(w) + 2, 3, "#1b1326");
  }
  for (let i = 0; i < 12; i++) {
    const w = 52 - i * 2.6, x = 28 - w / 2, y = 23 - i * 1.9;
    rect(g, Math.round(x), Math.round(y), Math.round(w), 2, i % 3 === 0 ? dark : i % 3 === 1 ? mid : light);
  }
  rect(g, 38, 2, 6, 10, "#1b1326");
  rect(g, 39, 3, 4, 9, "#7a6a6a");
  // door and windows
  rect(g, 24, 33, 9, 15, "#1b1326");
  rect(g, 25, 34, 7, 14, "#6a4426");
  rect(g, 30, 41, 1, 1, "#f2c14e");
  for (const x of [11, 38]) {
    rect(g, x, 30, 8, 8, "#1b1326");
    rect(g, x + 1, 31, 6, 6, "#ffd27a");
    rect(g, x + 1, 34, 6, 1, "#1b1326");
    rect(g, x + 4, 31, 1, 6, "#1b1326");
  }
  return c;
});
export const WELL = (() => {
  const c = cv(24, 30), g = c.getContext("2d");
  rect(g, 3, 26, 18, 4, "rgba(0,0,0,0.28)");
  rect(g, 4, 6, 2, 16, "#4a3020");
  rect(g, 18, 6, 2, 16, "#4a3020");
  for (let i = 0; i < 5; i++) rect(g, 2 + i, 6 - i, 20 - i * 2, 1, i % 2 ? "#a8301a" : "#7a1f1a");
  disc(g, 12, 22, 9, "#1b1326");
  disc(g, 12, 22, 8, "#7d7d8c");
  disc(g, 12, 21, 6, "#1b1326");
  disc(g, 12, 21, 5, "#2a5fa8");
  rect(g, 8, 19, 3, 1, "#8cc4f4");
  return c;
})();
export const FENCE = (() => {
  const c = cv(16, 12), g = c.getContext("2d");
  rect(g, 0, 4, 16, 2, "#5a3a20");
  rect(g, 0, 8, 16, 2, "#5a3a20");
  for (const x of [1, 8]) {
    rect(g, x, 1, 3, 11, "#1b1326");
    rect(g, x + 1, 2, 1, 9, "#a8834e");
  }
  return c;
})();
export const SIGN = (() => {
  const c = cv(16, 18), g = c.getContext("2d");
  rect(g, 7, 8, 2, 10, "#4a3020");
  rect(g, 1, 2, 14, 8, "#1b1326");
  rect(g, 2, 3, 12, 6, "#c9a46a");
  rect(g, 4, 5, 8, 1, "#6a4426");
  rect(g, 4, 7, 6, 1, "#6a4426");
  return c;
})();
export const GRAVES = [0, 1, 2].map((v) => {
  const c = cv(14, 16), g = c.getContext("2d");
  rect(g, 2, 13, 10, 3, "rgba(0,0,0,0.3)");
  if (v === 1) {
    rect(g, 6, 1, 3, 13, "#1c1c24");
    rect(g, 2, 4, 11, 3, "#1c1c24");
    rect(g, 7, 2, 1, 11, "#9a9aaa");
    rect(g, 3, 5, 9, 1, "#9a9aaa");
  } else {
    disc(g, 7, 6, 5, "#1c1c24");
    rect(g, 2, 6, 11, 8, "#1c1c24");
    disc(g, 7, 6, 4, "#7d7d8c");
    rect(g, 3, 6, 9, 7, "#7d7d8c");
    rect(g, 5, 7, 5, 1, "#4a4a58");
    rect(g, 5, 9, 4, 1, "#4a4a58");
    if (v === 2) rect(g, 3, 10, 2, 3, "#3f6a3a");
  }
  return c;
});
export const PILLAR = (() => {
  const c = cv(14, 30), g = c.getContext("2d");
  rect(g, 1, 27, 12, 3, "rgba(0,0,0,0.3)");
  rect(g, 1, 0, 12, 4, "#1c1c24");
  rect(g, 2, 1, 10, 2, "#9a9aaa");
  rect(g, 2, 4, 10, 22, "#1c1c24");
  rect(g, 3, 4, 8, 22, "#6e6e80");
  rect(g, 3, 4, 2, 22, "#9a9aaa");
  rect(g, 1, 25, 12, 3, "#1c1c24");
  rect(g, 2, 25, 10, 2, "#5c5c6b");
  return c;
})();
export const CAVE_MOUTH = (() => {
  const c = cv(40, 30), g = c.getContext("2d");
  disc(g, 20, 20, 19, "#1c1712");
  disc(g, 20, 20, 17, "#5a4a3a");
  disc(g, 16, 16, 9, "#7a6650");
  rect(g, 0, 26, 40, 4, "#1c1712");
  disc(g, 20, 24, 10, "#050308");
  rect(g, 10, 24, 20, 6, "#050308");
  return c;
})();
export const CRYPT_GATE = [false, true].map((open) => {
  const c = cv(44, 40), g = c.getContext("2d");
  rect(g, 2, 8, 40, 32, "#1c1c24");
  rect(g, 4, 10, 36, 30, "#6e6e80");
  for (let y = 12; y < 40; y += 5) rect(g, 4, y, 36, 1, "#4a4a58");
  for (let i = 0; i < 8; i++) rect(g, 6 + i * 2, 8 - i, 32 - i * 4, 1, "#9a9aaa");
  disc(g, 22, 26, 9, "#1c1c24");
  rect(g, 13, 26, 18, 14, "#1c1c24");
  disc(g, 22, 26, 8, open ? "#120a1c" : "#2a2a34");
  rect(g, 14, 26, 16, 14, open ? "#120a1c" : "#2a2a34");
  if (!open) for (let x = 15; x < 30; x += 3) rect(g, x, 19, 1, 21, "#9aa6ba");
  else {
    disc(g, 22, 30, 5, "#3a1f5a");
    rect(g, 18, 30, 8, 10, "#3a1f5a");
  }
  rect(g, 20, 1, 4, 6, "#9a9aaa");
  return c;
});
export const BONES = (() => {
  const c = cv(12, 6), g = c.getContext("2d");
  rect(g, 1, 3, 9, 1, "#d8d0c0");
  rect(g, 0, 2, 2, 3, "#d8d0c0");
  rect(g, 9, 2, 2, 3, "#d8d0c0");
  disc(g, 6, 2, 2, "#e4dcc8");
  return c;
})();

// ---- chests ----------------------------------------------------------------------------------------
function chest(gold, open) {
  const c = cv(16, 15), g = c.getContext("2d"), wood = gold ? ["#6a3a08", "#c48412", "#f0b424"] : ["#3a2410", "#6a4426", "#8e5c2c"], band = gold ? "#fff6c4" : "#9aa6ba";
  rect(g, 1, 12, 14, 3, "rgba(0,0,0,0.3)");
  rect(g, 1, 6, 14, 8, "#1b1326");
  rect(g, 2, 7, 12, 6, wood[1]);
  rect(g, 2, 7, 12, 1, wood[2]);
  if (open) {
    rect(g, 1, 1, 14, 5, "#1b1326");
    rect(g, 2, 2, 12, 3, wood[0]);
    rect(g, 3, 6, 10, 2, "#120a10");
    rect(g, 4, 6, 8, 1, gold ? "#ffe066" : "#c9a46a");
  } else {
    rect(g, 1, 2, 14, 6, "#1b1326");
    rect(g, 2, 3, 12, 4, wood[1]);
    rect(g, 2, 3, 12, 1, wood[2]);
    rect(g, 7, 5, 2, 4, band);
  }
  rect(g, 4, 7, 1, 6, band);
  rect(g, 11, 7, 1, 6, band);
  return c;
}
export const CHESTS = { wood: chest(false, false), woodOpen: chest(false, true), gold: chest(true, false), goldOpen: chest(true, true) };

// ---- item icons (12x12) ----------------------------------------------------------------------------
const ICON_ROWS = {
  staff: ["..........cc", ".........cCc", "........kcck", ".......kbk..", "......kbk...", ".....kbk....", "....kbk.....", "...kbk......", "..kbk.......", ".kbk........", "kbk.........", "kk.........."],
  sword: ["..........kk", ".........kWk", "........kWk.", ".......kWk..", "......kWk...", ".....kWk....", "..k.kWk.....", "..kkWk......", "...kyk......", "..kbkkk.....", ".kbk........", ".kk........."],
  bow: ["...kkk......", "..kbbbk...k.", ".kbk..kk.kw.", ".kb....kkw..", "kb.....kw...", "kb....kw....", "kb...kw.....", "kb..kw......", ".kbkw.......", ".kbw.k......", "..kbbk......", "...kk......."],
  cloth: ["..kk....kk..", ".kcck..kcck.", "kccccckcccck", "kcckccccckck", ".kkcccccckk.", "..kcccccck..", "..kcCccccck.", "..kccccccck.", "..kccccccck.", "..kccccccck.", "..kkkkkkkkk.", "............"],
  leather: ["..kk....kk..", ".kbbk..kbbk.", "kbbbbbkbbbbk", "kbbkbbbbbkbk", ".kkbbbbbbkk.", "..kbbybbbk..", "..kbbbbbbbk.", "..kyyyyyyyk.", "..kbbbbbbbk.", "..kbbbbbbbk.", "..kkkkkkkkk.", "............"],
  robe: ["...kkkkkk...", "..kppppppk..", ".kppyppyppk.", ".kpppyyppk..", ".kppppppppk.", ".kpppppppppk", "kppppppppppk", "kpPpppppPppk", "kpppppppppPk", "kppppppppppk", "kkkkkkkkkkkk", "............"],
  chain: ["..kk....kk..", ".kmmk..kmmk.", "kmMmmmkmmMmk", "kmmkmMmMmkmk", ".kkmMmMmmkk.", "..kmmMmMmk..", "..kmMmMmMmk.", "..kmmMmMmmk.", "..kmMmMmMmk.", "..kmmmmmmmk.", "..kkkkkkkkk.", "............"],
  plate: ["..kk....kk..", ".kMMk..kMMk.", "kMMMMMkMMMMk", "kMMkWWWWMkMk", ".kkMWWWWMkk.", "..kMMMMMMk..", "..kMMMMMMMk.", "..kmmmmmmmk.", "..kMMMMMMMk.", "..kMMMMMMMk.", "..kkkkkkkkk.", "............"],
  ring: ["............", "....kkkk....", "...kcCcck...", "...kkkkkk...", "..kyk..kyk..", ".kyk....kyk.", ".kyk....kyk.", ".kyk....kyk.", "..kyk..kyk..", "...kyyyyk...", "....kkkk....", "............"],
  amulet: ["..k......k..", "..ky....yk..", "...ky..yk...", "....kyyk....", "....kyyk....", "...kkkkkk...", "..kcCcccck..", "..kcCccccck.", "..kccccccck.", "...kcccck...", "....kkkk....", "............"],
  charm: ["....kkkk....", "...kyyyyk...", "..kyccccyk..", ".kycCcccyk..", ".kycccccyk..", ".kyccccyk...", "..kyyyyk....", "...kkkk.....", "....k.......", "....k.......", "...kyk......", "....k......."],
  potionRed: ["....kkk.....", "....kbk.....", "....kwk.....", "...kkkkk....", "..krrrrrk...", ".krWrrrrrk..", ".krrrrrrrk..", ".krrrrrrrk..", ".kRrrrrrRk..", "..kRRRRRk...", "...kkkkk....", "............"],
  potionBlue: ["....kkk.....", "....kbk.....", "....kwk.....", "...kkkkk....", "..kccccck...", ".kcWcccccck.", ".kccccccck..", ".kccccccck..", ".kCcccccCk..", "..kCCCCCk...", "...kkkkk....", "............"],
  wing: ["k...........", "kpk.........", "kppk........", "kpPpk.......", "kpPPpk......", "kpPpPpk.....", "kpPpPppk....", ".kpPpPpk....", "..kpkpk.....", "...k.k......", "............", "............"],
  doll: ["...kkkkk....", "..khhhhhk...", "..khwkwhk...", "..khhhhhk...", "...kkkkk....", "..krrrrrk...", ".kkrrrrrkk..", ".kwkrrrkwk..", "..krrrrrk...", "..kwk.kwk...", "..kk...kk...", "............"],
  radio: ["........k...", "........k...", ".kkkkkkkkkk.", ".kgggggggggk", ".kgkkkkgcgk.", ".kgkCCkgggk.", ".kgkkkkgcgk.", ".kgggggggggk", ".kgkgkgkggk.", ".kggggggggk.", ".kkkkkkkkkk.", "............"],
};
const ICON_PAL = { k: "#0b0a10", c: "#7fe0ff", C: "#ffffff", b: "#8e5c2c", W: "#e8ecf4", y: "#f2c14e", w: "#d8d0c0", p: "#6b4a9a", P: "#9a72d0", m: "#8a96ac", M: "#c0c8d8", r: "#e0364a", R: "#8a1a24", h: "#e0a040", g: "#4a5a3a" };
export const ICONS = Object.fromEntries(Object.entries(ICON_ROWS).map(([k, rows]) => [k, makeSprite(rows, ICON_PAL)]));
const iconUrls = new Map();
export function iconUrl(name) {
  if (!iconUrls.has(name)) {
    const src = ICONS[name], c = cv(src.width * 3, src.height * 3), g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, c.width, c.height);
    iconUrls.set(name, c.toDataURL());
  }
  return iconUrls.get(name);
}
// a portrait for the dialogue box: a sprite scaled up
const portraits = new Map();
export function portraitUrl(img) {
  if (!portraits.has(img)) {
    const c = cv(img.width * 4, img.height * 4), g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, 0, c.width, c.height);
    portraits.set(img, c.toDataURL());
  }
  return portraits.get(img);
}

export const COIN = makeSprite([".kkk.", "kyYyk", "kyyyk", "kyyyk", ".kkk."], { k: "#4a2c08", y: "#f0b424", Y: "#fff6c4" });
export const LOOT_BAG = makeSprite(["..kk..", ".kbbk.", "kbbbbk", "kbybbk", "kbbbbk", ".kkkk."], { k: "#1b1326", b: "#8e5c2c", y: "#ffd84a" });
