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

// =====================================================================================================
// v4 additions: the thief, more villagers and props, the highland/volcano/ice/tower monsters and bosses
// =====================================================================================================
function up(src, k) {
  const c = cv(src.width * k, src.height * k), g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
// an enemy's two frames plus hit-flash and frozen variants
function set2(a, b) {
  return { a, b, aFlash: tint(a, "#ffffff", 0.85), bFlash: tint(b, "#ffffff", 0.85), aIce: tint(a, "#9bdcff", 0.6), bIce: tint(b, "#9bdcff", 0.6) };
}

const THIEF_PAL = { k: "#1b1326", h: "#2a1f3a", H: "#4a3a66", s: "#f3c49d", e: "#1b1326", m: "#6b2a4a", p: "#3a2f4a", P: "#5a4a72", b: "#20182a", r: "#c684ff" };
const THIEF = [
  "....kkkkkk....",
  "...khhhhhhk...",
  "..khHhhhhhhk..",
  "..khkkkkkkhk..",
  "..khksssskhk..",
  "...kmmmmmmk...",
  "...kmmmmmmk...",
  "..kppppppppk..",
  ".kpPpprrppPpk.",
  ".kpppbbbbpppk.",
  ".kpPppppppPpk.",
  ".kkppppppppkk.",
  "..kppppppppk..",
  "..kbbk..kbbk..",
  "..kbbk..kbbk..",
  "..kkkk..kkkk..",
];
const THIEF_FACE = THIEF.map((r, i) => (i === 4 ? "..khksesekhk.." : r));
const THIEF_BACK = [...THIEF.slice(0, 3), "..khhhhhhhhk..", "..khhHhhhhhk..", "...khhhhhhk...", "...khhhhhhk...", ...THIEF.slice(7)];
const THIEF_SIDE = THIEF.map((r, i) => (i === 4 ? "..khksssekk.." : r));
HEROES.thief = dirSet(THIEF_FACE, THIEF_BACK, THIEF_SIDE, THIEF_PAL);

// villagers: the job master (a hooded sage) and the smith (bald, big arms, apron)
const SAGE = [
  "....kkkkkk....", "...kppppppk...", "..kppPPppppk..", "..kpkkkkkkpk..", "..kpksssskpk..", "...ksessesk...", "...kssssssk...",
  "..kppyppyppk..", ".kpppyyyypppk.", ".kpPppyypppPk.", ".kppppppppppk.", ".kppppppppppk.", ".kyyyyyyyyyyk.", "..kbbk..kbbk..", "..kkkk..kkkk..",
];
const SMITH = [
  "....kkkkkk....", "...kssssssk...", "..kssssssssk..", "..ksseessssk..", "..kssssssssk..", "...khhhhhhk...", "..ksswwwwssk..",
  ".ksskwwwwkssk.", ".ksskwwwwkssk.", ".kssklwwlkssk.", "..kkkwwwwkkk..", "...kllllllk...", "...kllllllk...", "..kbbk..kbbk..", "..kkkk..kkkk..",
];
for (const [id, rows, pal] of [
  ["jobmaster", SAGE, { k: "#1b1326", p: "#3a2a6a", P: "#5a4a9a", s: "#f3c49d", e: "#1b1326", y: "#ffd84a", b: "#2a1a10" }],
  ["smith", SMITH, { k: "#1b1326", s: "#d8a07a", e: "#1b1326", h: "#5a3020", w: "#6a5a4a", l: "#3a3040", b: "#2a1a10" }],
]) {
  const a = makeSprite(rows, pal), b = cv(a.width, a.height), g = b.getContext("2d");
  g.drawImage(a, 0, 6, a.width, a.height - 6, 0, 6, a.width, a.height - 6);
  g.drawImage(a, 0, 0, a.width, 6, 0, 1, a.width, 6);
  NPC_ART[id] = [a, b];
}
// the bounty board (an "NPC" you read) and the wandering merchant (the merchant in a travelling cloak)
NPC_ART.board = (() => {
  const c = cv(22, 24), g = c.getContext("2d");
  rect(g, 3, 10, 2, 14, "#4a3020");
  rect(g, 17, 10, 2, 14, "#4a3020");
  rect(g, 0, 2, 22, 14, "#1b1326");
  rect(g, 1, 3, 20, 12, "#8e5c2c");
  for (const [x, y, c2] of [[3, 5, "#ece8f4"], [9, 4, "#f2e6c4"], [15, 6, "#ece8f4"]]) {
    rect(g, x, y, 5, 7, c2);
    rect(g, x + 1, y + 2, 3, 1, "#6a4426");
    rect(g, x + 1, y + 4, 2, 1, "#a8301a");
  }
  return [c, c];
})();
NPC_ART.wanderer = NPC_ART.merchant.map((im) => tint(im, "#6a4a2a", 0.35));

export const PROPS = {
  anvil: (() => {
    const c = cv(18, 14), g = c.getContext("2d");
    rect(g, 2, 11, 14, 3, "rgba(0,0,0,0.3)");
    rect(g, 0, 2, 18, 5, "#1c1c24");
    rect(g, 1, 3, 15, 3, "#7d7d8c");
    rect(g, 1, 3, 15, 1, "#b4b4c4");
    rect(g, 5, 7, 8, 5, "#1c1c24");
    rect(g, 6, 7, 6, 4, "#5c5c6b");
    return c;
  })(),
  stake: (() => {
    const c = cv(8, 20), g = c.getContext("2d");
    rect(g, 2, 3, 4, 17, "#2a1a10");
    rect(g, 3, 2, 2, 17, "#8e5c2c");
    rect(g, 3, 0, 2, 3, "#c9a46a");
    return c;
  })(),
  tent: (() => {
    const c = cv(52, 40), g = c.getContext("2d");
    rect(g, 4, 36, 44, 4, "rgba(0,0,0,0.3)");
    for (let i = 0; i < 20; i++) rect(g, 26 - i * 1.2 - 1, 16 + i, i * 2.4 + 2, 1, "#1b1326");
    for (let i = 0; i < 19; i++) rect(g, 26 - i * 1.2, 17 + i, i * 2.4, 1, i % 4 < 2 ? "#8a5a2a" : "#6a4420");
    rect(g, 22, 26, 8, 11, "#1b0e08");
    rect(g, 25, 2, 2, 16, "#4a3020");
    rect(g, 27, 2, 10, 6, "#a8301a");
    rect(g, 29, 4, 3, 2, "#1b1326");
    return c;
  })(),
  crystal: (() => {
    const c = cv(10, 16), g = c.getContext("2d");
    rect(g, 2, 14, 7, 2, "rgba(0,0,0,0.3)");
    for (let i = 0; i < 12; i++) rect(g, 5 - Math.ceil(i / 4), 2 + i, Math.ceil(i / 4) * 2 + 1, 1, i < 4 ? "#dcf2ff" : "#7cc8ff");
    rect(g, 4, 3, 1, 9, "#ffffff");
    return c;
  })(),
};
export const CAVE_MOUTHS = {
  volcano: tint(CAVE_MOUTH, "#a8301a", 0.45),
  ice: tint(CAVE_MOUTH, "#9bdcff", 0.5),
};
export const TOWER_GATE = [tint(CRYPT_GATE[0], "#5e3290", 0.45), tint(CRYPT_GATE[1], "#5e3290", 0.45)];

// ---- monsters ----------------------------------------------------------------------------------------
const WOLF_A = ["..........kk..", ".........kgGk.", "kk......kgggek", "kgk..kkkggggkk", ".kgkkgggggggk.", "..kggGggggggk.", "..kgggggggggk.", "..kgkkgkkkgk..", "..kk..k...kk..", ".............."];
const WOLF_B = ["..........kk..", ".........kgGk.", "k.......kgggek", "kgkkkkkkggggkk", ".kggggggggggk.", "..kgGgggggggk.", "..kgggggggggk.", "...kgk..kgk...", "..kk.....kk...", ".............."];
const ORC_A = ["....kkkkk.....", "...kgggggk....", "..kgekgekgk...", "..kgggwggwk...", "...kgwwwgk....", "..kbbbbbbbk...", ".kgbbybbbbgk..", ".kgbbbbbbbgk..", ".kgkbbbbbkgk..", "..kkllllkk....", "...kllkllk....", "..kkkk.kkkk..."];
const ORC_B = [...ORC_A.slice(0, 10), "...kllkllk....", "...kkk.kkk...."];
const GOLEM_A = ["...kkkkkk....", "..kssSsssk...", "..ksekssek...", "..kssssssk...", ".kkssssssskk.", "kssksssssksk.", "ksskSsssskssk", "ksskssSsskssk", ".kkkssssskkk.", "...ksskssk...", "..kkssksskk..", "..kkk...kkk.."];
const GOLEM_B = [...GOLEM_A.slice(0, 10), "..kssk.kssk..", "..kkk...kkk.."];
const IMP_A = ["k..........k", "kk..kkkk..kk", ".kkkrrrrkkk.", "..krryyrrk..", "..kryrryrk..", "...krrrrk...", "..kkrrrrkk..", ".k.krrrrk.k.", "...krrrrk...", "....krrk....", "....k..k...."];
const IMP_B = ["............", "k...kkkk...k", "kkkkrrrrkkkk", "..krryyrrk..", "..kryrryrk..", "...krrrrk...", "...krrrrk...", "..kkrrrrkk..", "...krrrrk...", "....krrk....", "...k....k..."];
const YETI_A = ["...kkkkkk....", "..kwwwwwwk...", ".kwwkbbkwwk..", ".kwwbebebwk..", ".kwwbbbbbwk..", "kwwwwbbwwwwk.", "kwkwwwwwwkwk.", "kwkwwwwwwkwk.", "kbkwwwwwwkbk.", ".kkwwwwwwkk..", "..kwwk.kwwk..", "..kkkk.kkkk.."];
const YETI_B = [...YETI_A.slice(0, 10), "..kwwkkwwk...", "..kkkk.kkk..."];
const DEMON_A = ["k...kkkk...k.", "kk.krrrrk.kk.", ".kkrkrrkrkk..", "..krerrerk...", "..krrrrrrk...", "...krwwrk....", "..kkrrrrkk...", ".krrkrrkrrk..", ".krkrrrrkrk..", "..kkrrrrkk...", "...krrkrrk...", "..kkk..kkk..."];
const DEMON_B = [...DEMON_A.slice(0, 10), "...krkkrk....", "...kk..kk...."];
const GARG_A = ["k.....kk.....k", "kk...kssk...kk", "ksk.kssssk.ksk", "kssksesseskssk", ".ksssssssssk..", "..kssssssssk..", "...kssssssk...", "...ksk..ksk...", "...kk....kk..."];
const GARG_B = [".....kk.......", "....kssk......", "kkkkssssskkkkk", "kssksesseskssk", ".kssssssssssk.", "...kssssssk...", "...kssssssk...", "...ksk..ksk...", "...kk....kk..."];
const GOBLIN_A = ["...kkkkk.....", "..kgggggk....", "kkgekggekgkk.", "kggggwwgggk..", ".kggggggggk..", "..kbbbbbbk.yy", ".kgbyyybbgkyy", ".kgbbbbbbgkyk", "..kkbbbbkk...", "...kbk.kbk...", "...kk...kk..."];
const GOBLIN_B = [...GOBLIN_A.slice(0, 9), "...kbkkbk....", "...kk..kk...."];
const SLIME_ROWS_TALL = ["....kkkkkk....", "...kGGGgggk...", "..kGGgggggdk..", "..kgggggggdk..", ".kgewgggewgdk.", ".kgeegggeegdk.", ".kgggggggggdk.", ".kdgggggggddk.", "..kdddddddddk.", "...kkkkkkkk..."];
const SLIME_ROWS_FLAT = ["...kkkkkkkk...", "..kGGgggggdk..", ".kGggggggggdk.", "kgewgggewgggdk", "kgeegggeegggdk", "kdgggggggggddk", ".kdddddddddddk", "..kkkkkkkkkk.."];
const slimeColor = (g, G, d) => ({ k: "#1a0a08", g, G, d, e: "#1a0a08", w: "#ffffff" });

export const ENEMY_ART = {
  wolf: set2(makeSprite(WOLF_A, { k: "#1a1620", g: "#6e6a7a", G: "#a4a0b4", e: "#ffd84a" }), makeSprite(WOLF_B, { k: "#1a1620", g: "#6e6a7a", G: "#a4a0b4", e: "#ffd84a" })),
  orc: set2(makeSprite(ORC_A, { k: "#141a10", g: "#5a8a3a", e: "#ff4a3a", w: "#ece8d4", b: "#6a4426", y: "#ffd84a", l: "#3a3040" }), makeSprite(ORC_B, { k: "#141a10", g: "#5a8a3a", e: "#ff4a3a", w: "#ece8d4", b: "#6a4426", y: "#ffd84a", l: "#3a3040" })),
  golem: set2(makeSprite(GOLEM_A, { k: "#1c1c24", s: "#7d7d8c", S: "#a4a4b2", e: "#ffb04a" }), makeSprite(GOLEM_B, { k: "#1c1c24", s: "#7d7d8c", S: "#a4a4b2", e: "#ffb04a" })),
  icegolem: set2(makeSprite(GOLEM_A, { k: "#1c2a3c", s: "#8cc4f4", S: "#dcf2ff", e: "#3f8cff" }), makeSprite(GOLEM_B, { k: "#1c2a3c", s: "#8cc4f4", S: "#dcf2ff", e: "#3f8cff" })),
  imp: set2(makeSprite(IMP_A, { k: "#1a0606", r: "#d8361e", y: "#ffd84a" }), makeSprite(IMP_B, { k: "#1a0606", r: "#d8361e", y: "#ffd84a" })),
  yeti: set2(makeSprite(YETI_A, { k: "#1c2a3c", w: "#ecf4ff", b: "#4a6a9a", e: "#ff4a3a" }), makeSprite(YETI_B, { k: "#1c2a3c", w: "#ecf4ff", b: "#4a6a9a", e: "#ff4a3a" })),
  demon: set2(makeSprite(DEMON_A, { k: "#120610", r: "#8a1a3a", e: "#ffd84a", w: "#ece8d4" }), makeSprite(DEMON_B, { k: "#120610", r: "#8a1a3a", e: "#ffd84a", w: "#ece8d4" })),
  gargoyle: set2(makeSprite(GARG_A, { k: "#141418", s: "#5c5c6b", e: "#ff4a4a" }), makeSprite(GARG_B, { k: "#141418", s: "#5c5c6b", e: "#ff4a4a" })),
  goblin: set2(makeSprite(GOBLIN_A, { k: "#141a10", g: "#7aa83a", e: "#ffd84a", w: "#ffffff", b: "#6a4426", y: "#ffd84a" }), makeSprite(GOBLIN_B, { k: "#141a10", g: "#7aa83a", e: "#ffd84a", w: "#ffffff", b: "#6a4426", y: "#ffd84a" })),
  magma: set2(makeSprite(SLIME_ROWS_TALL, slimeColor("#d8361e", "#ffb04a", "#8a1a10")), makeSprite(SLIME_ROWS_FLAT, slimeColor("#d8361e", "#ffb04a", "#8a1a10"))),
  goldslime: set2(makeSprite(SLIME_ROWS_TALL, slimeColor("#f0b424", "#fff6c4", "#a8700c")), makeSprite(SLIME_ROWS_FLAT, slimeColor("#f0b424", "#fff6c4", "#a8700c"))),
};

// ---- bosses ------------------------------------------------------------------------------------------
function boss(base, k, decorate) {
  const big = up(base, k), c = cv(big.width + 8, big.height + 10), g = c.getContext("2d");
  g.drawImage(big, 4, 10);
  decorate?.(g, c);
  return c;
}
const chiefA = boss(ENEMY_ART.orc.a, 2, (g, c) => {
  rect(g, 8, 4, c.width - 20, 8, "#1c1c24");
  rect(g, 9, 5, c.width - 22, 6, "#8a96ac");
  for (const x of [8, c.width - 14]) rect(g, x, 0, 3, 7, "#ece8d4");
});
const chiefB = boss(ENEMY_ART.orc.b, 2, (g, c) => {
  rect(g, 8, 4, c.width - 20, 8, "#1c1c24");
  rect(g, 9, 5, c.width - 22, 6, "#8a96ac");
  for (const x of [8, c.width - 14]) rect(g, x, 0, 3, 7, "#ece8d4");
});
const giantA = boss(ENEMY_ART.yeti.a, 2, (g) => {
  rect(g, 10, 2, 26, 4, "#3f8cff");
  for (const x of [10, 18, 26, 34]) rect(g, x, 0, 2, 4, "#dcf2ff");
});
const giantB = boss(ENEMY_ART.yeti.b, 2, (g) => {
  rect(g, 10, 2, 26, 4, "#3f8cff");
  for (const x of [10, 18, 26, 34]) rect(g, x, 0, 2, 4, "#dcf2ff");
});
const kingDemon = (src) =>
  boss(src, 2, (g, c) => {
    // a cape behind, a crown of horns
    g.globalCompositeOperation = "destination-over";
    rect(g, 6, 22, c.width - 12, c.height - 26, "#3a0a1a");
    g.globalCompositeOperation = "source-over";
    for (const [x, h] of [[10, 9], [16, 6], [c.width / 2 - 1, 10], [c.width - 18, 6], [c.width - 12, 9]]) rect(g, Math.round(x), 10 - h, 2, h, "#ffd84a");
  });
const demonA = kingDemon(ENEMY_ART.demon.a), demonB = kingDemon(ENEMY_ART.demon.b);
// the drake: drawn from shapes, 56x40, wings up and down
function drake(wingsUp) {
  const c = cv(60, 44), g = c.getContext("2d"), body = "#a8301a", belly = "#ffb04a", dark = "#3d1012", hi = "#e8501a";
  const wing = (dir) => {
    for (let i = 0; i < 16; i++) {
      const y = wingsUp ? 6 + i * 0.6 : 18 + i * 0.4, h = wingsUp ? 18 - i : 10 + i * 0.3;
      rect(g, 30 + dir * (6 + i), Math.round(y), 1, Math.round(h), i % 4 === 0 ? dark : "#7a1f1a");
    }
  };
  wing(-1);
  wing(1);
  disc(g, 30, 28, 12, dark);
  disc(g, 30, 28, 11, body);
  disc(g, 30, 31, 7, belly);
  disc(g, 30, 14, 7, dark);
  disc(g, 30, 14, 6, body);
  rect(g, 26, 12, 3, 2, "#ffe066");
  rect(g, 32, 12, 3, 2, "#ffe066");
  rect(g, 27, 18, 7, 2, dark);
  for (const x of [24, 35]) rect(g, x, 6, 2, 5, "#ece8d4");
  rect(g, 21, 38, 5, 4, dark);
  rect(g, 34, 38, 5, 4, dark);
  rect(g, 25, 22, 10, 1, hi);
  return c;
}
const drakeA = drake(true), drakeB = drake(false);
export const BOSS_ART = {
  chief: set2(chiefA, chiefB),
  giant: set2(giantA, giantB),
  demonking: set2(demonA, demonB),
  drake: set2(drakeA, drakeB),
};

// ---- more item icons -----------------------------------------------------------------------------------
Object.assign(ICON_ROWS, {
  dagger: ["............", ".........kk.", "........kWk.", ".......kWk..", "......kWk...", ".....kWk....", "...k.kk.....", "...kkyk.....", "....kbk.....", "...kbk......", "..kbk.......", "..kk........"],
  helmet: ["............", "...kkkkkk...", "..kMMMMMMk..", ".kMWMMMMMMk.", ".kMMMMMMMMk.", ".kMkkkkkkMk.", ".kMk....kMk.", ".kMk....kMk.", "..kk....kk..", "............", "............", "............"],
  armor: ["..kk....kk..", ".kmmk..kmmk.", "kmMmmmkmmMmk", "kmmkmMmMmkmk", ".kkmMmMmmkk.", "..kmmMmMmk..", "..kmMmMmMmk.", "..kmmMmMmmk.", "..kmMmMmMmk.", "..kmmmmmmmk.", "..kkkkkkkkk.", "............"],
  boots: ["............", "..kkk.......", "..kbk.......", "..kbk..kkk..", "..kbk..kbk..", "..kbbk.kbk..", "..kbbbkkbk..", "..kkkkkkbbk.", ".......kbbbk", ".......kkkkk", "............", "............"],
  elixir: ["....kkk.....", "....kyk.....", "...kkkkk....", "..krrrrrk...", ".krWrrrrrk..", ".kryyyyyrk..", ".kryrrryrk..", ".kryyyyyrk..", ".krrrrrrrk..", "..kkkkkkk...", "............", "............"],
  scroll: ["............", ".kkkkkkkkk..", "kwwwwwwwwwk.", "kwkkkkkkwwk.", "kwwwwwwwwwk.", "kwkkkkkwwwk.", "kwwwwwwwwwk.", "kwkkkkkkwwk.", "kwwwwwwwwwk.", ".kkkkkkkkk..", "............", "............"],
  ore: ["............", "....kkkk....", "..kkmmMmkk..", ".kmmMmmmmmk.", ".kmyMmmymmk.", "kmmmmmmmMmk.", "kmMmmymmmmk.", ".kmmmmmMmk..", "..kkkkkkk...", "............", "............", "............"],
  token: ["....kkkk....", "...kyyyyk...", "..kyrrrryk..", ".kyrkyykryk.", ".kyrykkyryk.", ".kyrkyykryk.", "..kyrrrryk..", "...kyyyyk...", "....kkkk....", "....k..k....", "...k....k...", "............"],
});
for (const [k, rows] of Object.entries(ICON_ROWS)) if (!ICONS[k]) ICONS[k] = makeSprite(rows, ICON_PAL);
