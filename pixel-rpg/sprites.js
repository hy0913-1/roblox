// Hand-made pixel sprites, drawn from strings at startup. No image files.

export function makeSprite(rows, pal) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const cv = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const g = cv.getContext("2d");
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]];
      if (!c) continue;
      g.fillStyle = c;
      g.fillRect(x, y, 1, 1);
    }
  });
  return cv;
}

// a copy of a sprite with every opaque pixel mixed towards a colour
export function tint(src, color, alpha) {
  const cv = Object.assign(document.createElement("canvas"), { width: src.width, height: src.height });
  const g = cv.getContext("2d");
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.fillRect(0, 0, cv.width, cv.height);
  return cv;
}

const WIZ_PAL = { k: "#1b1326", p: "#7a46c9", P: "#5a31a0", y: "#f2c14e", s: "#f3c49d", e: "#1b1326", w: "#ece8f4", b: "#4a3020" };
const WIZ_FRONT = [
  "......kk......",
  ".....kppk.....",
  "....kppppk....",
  "...kppPpppk...",
  "...kppppppk...",
  "..kkyyyyyykk..",
  "...kksssskk...",
  "...ksessesk...",
  "...kswwwwsk...",
  "..kpwwwwwwpk..",
  ".kpppwwwwpppk.",
  ".kpPpwwwwpPpk.",
  ".kpPppwwppPpk.",
  ".kppppppppppk.",
  ".kyyyyyyyyyyk.",
  "..kbbk..kbbk..",
  "..kkkk..kkkk..",
];
const WIZ_STEP = [...WIZ_FRONT.slice(0, 15), ".kbbk....kbbk.", ".kkkk....kkkk."];
const WIZ_BACK = [
  ...WIZ_FRONT.slice(0, 6),
  "...kppppppk...",
  "...kppPPppk...",
  "...kppppppk...",
  "..kppppppppk..",
  ".kpppPPPPpppk.",
  ".kpPppppppPpk.",
  ".kpPppppppPpk.",
  ".kppppppppppk.",
  ".kyyyyyyyyyyk.",
  "..kbbk..kbbk..",
  "..kkkk..kkkk..",
];
const WIZ_BACK_STEP = [...WIZ_BACK.slice(0, 15), ".kbbk....kbbk.", ".kkkk....kkkk."];
const WIZ_SIDE = WIZ_FRONT.map((r, i) => (i === 7 ? "...kssssesk..." : i === 8 ? "...ksswwwsk..." : r));
const WIZ_SIDE_STEP = [...WIZ_SIDE.slice(0, 15), ".kbbk....kbbk.", ".kkkk....kkkk."];

const SLIME_PAL = { k: "#133018", g: "#5dc050", G: "#a6e86e", d: "#3a8a36", e: "#133018", w: "#ffffff" };
const SLIME_TALL = [
  "....kkkkkk....",
  "...kGGGgggk...",
  "..kGGgggggdk..",
  "..kgggggggdk..",
  ".kgewgggewgdk.",
  ".kgeegggeegdk.",
  ".kgggggggggdk.",
  ".kdgggggggddk.",
  "..kdddddddddk.",
  "...kkkkkkkk...",
];
const SLIME_FLAT = [
  "...kkkkkkkk...",
  "..kGGgggggdk..",
  ".kGggggggggdk.",
  "kgewgggewgggdk",
  "kgeegggeegggdk",
  "kdgggggggggddk",
  ".kdddddddddddk",
  "..kkkkkkkkkk..",
];
const slime = { tall: makeSprite(SLIME_TALL, SLIME_PAL), flat: makeSprite(SLIME_FLAT, SLIME_PAL) };

// nearest-neighbour upscale of a sprite canvas
function upscale(src, k) {
  const cv = Object.assign(document.createElement("canvas"), { width: src.width * k, height: src.height * k });
  const g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, cv.width, cv.height);
  return cv;
}

const BAT_PAL = { k: "#1a0f24", p: "#6b4a9a", P: "#4a2f72", e: "#ff4a5a", w: "#ffffff" };
const BAT_UP = [
  "k...........k",
  "kPk.k...k.kPk",
  "kPPkpkkkpkPPk",
  ".kPPpepepPPk.",
  "..kPpppppPk..",
  "...kkpwpkk...",
  ".....kkk.....",
];
const BAT_DOWN = [
  ".....k.k.....",
  "....kpkpk....",
  "....kpepek...",
  "kkkkkpppkkkkk",
  "kPPPPpwpPPPPk",
  ".kPPkkkkkPPk.",
  "..kk.....kk..",
];

const BONE_PAL = { k: "#1c1a22", w: "#e4dcc8", W: "#b8ad96", e: "#ff5a3a" };
const ARCHER = [
  "....kkkk....",
  "...kwwwwk...",
  "..kwwwwwwk..",
  "..kwekkewk..",
  "..kwwwwwWk..",
  "...kwkwkk...",
  "....kwwk....",
  "..kkwwwwkk..",
  ".kwkwkkwkwk.",
  ".kWkwwwwkWk.",
  "..kkwkkwkk..",
  "....kwWk....",
  "...kwkkwk...",
  "...kwk.kwk..",
  "..kwk...kwk.",
  "..kkk...kkk.",
];
const ARCHER_STEP = [...ARCHER.slice(0, 13), "...kwkkwk...", "...kwkkwk...", "...kkk.kkk.."];

const CROWN = makeSprite(
  ["..y...y...y..", ".kyk.kyk.kyk.", ".kyykyyykyyk.", ".kyryyyyyyryk", ".kyyyyyyyyyyk", "..kkkkkkkkkk."],
  { k: "#3a2408", y: "#ffd84a", r: "#e0364a" }
);
function king(rows) {
  const big = upscale(makeSprite(rows, SLIME_PAL), 2);
  const cv = Object.assign(document.createElement("canvas"), { width: big.width, height: big.height + 5 });
  const g = cv.getContext("2d");
  g.drawImage(big, 0, 5);
  g.drawImage(CROWN, Math.round(cv.width / 2 - CROWN.width / 2), 0);
  return cv;
}
const kingTall = king(SLIME_TALL), kingFlat = king(SLIME_FLAT);

export const SPRITES = {
  wizard: {
    down: [makeSprite(WIZ_FRONT, WIZ_PAL), makeSprite(WIZ_STEP, WIZ_PAL)],
    up: [makeSprite(WIZ_BACK, WIZ_PAL), makeSprite(WIZ_BACK_STEP, WIZ_PAL)],
    right: [makeSprite(WIZ_SIDE, WIZ_PAL), makeSprite(WIZ_SIDE_STEP, WIZ_PAL)],
    left: [makeSprite(WIZ_SIDE, WIZ_PAL), makeSprite(WIZ_SIDE_STEP, WIZ_PAL)],
  },
  slime,
  slimeFlash: { tall: tint(slime.tall, "#ffffff", 0.9), flat: tint(slime.flat, "#ffffff", 0.9) },
  slimeIce: { tall: tint(slime.tall, "#9bdcff", 0.7), flat: tint(slime.flat, "#9bdcff", 0.7) },
  bat: { up: makeSprite(BAT_UP, BAT_PAL), down: makeSprite(BAT_DOWN, BAT_PAL) },
  batFlash: { up: tint(makeSprite(BAT_UP, BAT_PAL), "#ffffff", 0.9), down: tint(makeSprite(BAT_DOWN, BAT_PAL), "#ffffff", 0.9) },
  batIce: { up: tint(makeSprite(BAT_UP, BAT_PAL), "#9bdcff", 0.7), down: tint(makeSprite(BAT_DOWN, BAT_PAL), "#9bdcff", 0.7) },
  archer: { tall: makeSprite(ARCHER, BONE_PAL), flat: makeSprite(ARCHER_STEP, BONE_PAL) },
  archerFlash: { tall: tint(makeSprite(ARCHER, BONE_PAL), "#ffffff", 0.9), flat: tint(makeSprite(ARCHER_STEP, BONE_PAL), "#ffffff", 0.9) },
  archerIce: { tall: tint(makeSprite(ARCHER, BONE_PAL), "#9bdcff", 0.65), flat: tint(makeSprite(ARCHER_STEP, BONE_PAL), "#9bdcff", 0.65) },
  king: { tall: kingTall, flat: kingFlat },
  kingFlash: { tall: tint(kingTall, "#ffffff", 0.85), flat: tint(kingFlat, "#ffffff", 0.85) },
  kingIce: { tall: tint(kingTall, "#9bdcff", 0.6), flat: tint(kingFlat, "#9bdcff", 0.6) },
  gem: makeSprite(["..k..", ".kCk.", "kCcck", "kccbk", ".kbk.", "..k.."], { k: "#0c1a3a", C: "#ffffff", c: "#7fe0ff", b: "#3a8bd8" }),
  bigGem: makeSprite(["...k...", "..kCk..", ".kCcck.", "kCcccbk", ".kccbk.", "..kbk..", "...k..."], { k: "#2a0c3a", C: "#ffffff", c: "#e08aff", b: "#9a48ec" }),
  bomb: makeSprite([".kkk.", "kgGgk", "kgGgk", "kgggk", "kgggk", "kgggk", ".kgk.", "k.k.k"], { k: "#101114", g: "#4a4f5a", G: "#8a90a0" }),
  heart: makeSprite(
    [".kk..kk.", "kRRkkRRk", "kRWRRRRk", "kRRRRRRk", ".kRRRRk.", "..kRRk..", "...kk..."],
    { k: "#3a0a14", R: "#e0364a", W: "#ffd0d4" }
  ),
};

// ---- trees and rocks: drawn with whole-pixel spans so nothing is anti-aliased --------------------
function disc(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    const dy = y + 0.5 - cy, hw = Math.sqrt(Math.max(0, r * r - dy * dy));
    if (hw > 0) g.fillRect(Math.round(cx - hw), y, Math.max(1, Math.round(hw * 2)), 1);
  }
}

const TREES = [0, 1, 2].map((v) => {
  const cv = Object.assign(document.createElement("canvas"), { width: 26, height: 34 });
  const g = cv.getContext("2d");
  g.fillStyle = "rgba(0,0,0,0.28)";
  g.fillRect(5, 30, 16, 4);
  g.fillStyle = "#14301a";
  g.fillRect(10, 22, 6, 11);
  g.fillStyle = v === 1 ? "#6a4426" : "#5a3a20";
  g.fillRect(11, 22, 4, 10);
  g.fillStyle = "#7a5430";
  g.fillRect(11, 22, 1, 10);
  const dark = ["#14301a", "#14301a", "#10281e"][v], base = ["#2d6a34", "#33743a", "#285f3a"][v], mid = ["#3f8a42", "#459648", "#38804a"][v], hi = ["#6cbb55", "#7ccc60", "#5eb070"][v];
  for (const [cx, cy, r] of [[13, 12, 11], [7, 17, 7.5], [19, 17, 7.5]]) disc(g, cx, cy, r + 1, dark);
  for (const [cx, cy, r] of [[13, 12, 11], [7, 17, 7.5], [19, 17, 7.5]]) disc(g, cx, cy, r, base);
  for (const [cx, cy, r] of [[11, 9, 7], [6, 15, 4.5], [17, 14, 4.5]]) disc(g, cx, cy, r, mid);
  for (const [x, y] of [[9, 6], [10, 6], [14, 8], [6, 13], [16, 12], [17, 12], [11, 11]]) {
    g.fillStyle = hi;
    g.fillRect(x, y, 2, 1);
  }
  g.fillStyle = dark;
  for (const [x, y] of [[8, 19], [14, 21], [19, 20], [13, 16]]) g.fillRect(x, y, 3, 1);
  return cv;
});

const ROCKS = [0, 1, 2].map((v) => {
  const cv = Object.assign(document.createElement("canvas"), { width: 16, height: 12 });
  const g = cv.getContext("2d");
  g.fillStyle = "rgba(0,0,0,0.28)";
  g.fillRect(2, 9, 12, 3);
  const w = [6, 7, 5][v];
  disc(g, 8, 7, w + 0.8, "#1c1c24");
  disc(g, 8, 7, w, "#6a6a7c");
  disc(g, 7, 5.5, w * 0.7, "#8c8c9e");
  disc(g, 6, 4.5, w * 0.35, "#b4b4c4");
  g.fillStyle = "#42424f";
  g.fillRect(9, 9, 4, 1);
  g.fillRect(3, 8, 2, 1);
  return cv;
});

// image art (assets.js) swaps these in; the code-drawn trees stay as the fallback
export const OVERRIDE = { trees: null, well: null, held: false };
export function drawTree(ctx, x, y, v) {
  const t = OVERRIDE.trees;
  if (t) {
    const im = t[v % t.length];
    return ctx.drawImage(im, Math.round(x - (im.width >> 1)), Math.round(y - im.height + 1));
  }
  ctx.drawImage(TREES[v % 3], Math.round(x - 13), Math.round(y - 33));
}
export function drawRock(ctx, x, y, v) {
  ctx.drawImage(ROCKS[v % 3], Math.round(x - 8), Math.round(y - 12));
}
