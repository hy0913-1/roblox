// 기본 이미지는 전부 코드로 그린 16x16 도트다. (외부 이미지 파일 없음)
// IMAGE_OVERRIDES에 같은 키가 있으면 이 함수는 그 키를 건너뛴다.
import Phaser from 'phaser';

const OUT = '#0c0b12';

function makeTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return; // 외부 이미지로 대체된 경우
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  const r = (color, x, y, ww = 1, hh = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, ww, hh);
  };
  draw(r, ctx);
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

// 결정적인 난수(타일 무늬가 매번 같게)
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function outlineRects(r, rects) {
  for (const [x, y, w, h] of rects) r(OUT, x - 1, y - 1, w + 2, h + 2);
}

// ---------- 수감자(타워) ----------
function drawSinner(r, o) {
  const body = [
    [5, 1, 6, 3], [4, 3, 1, 3], [11, 3, 1, 3], [5, 4, 6, 3],
    [4, 7, 8, 5], [3, 8, 1, 4], [12, 8, 1, 4], [5, 12, 2, 3], [9, 12, 2, 3],
  ];
  outlineRects(r, body);
  // 무기 외곽선
  if (o.weapon === 'sword') outlineRects(r, [[14, 2, 1, 8], [13, 10, 3, 1], [14, 11, 1, 2]]);
  if (o.weapon === 'lance') outlineRects(r, [[14, 0, 1, 15]]);
  if (o.weapon === 'staff') outlineRects(r, [[14, 5, 1, 10], [13, 2, 3, 3]]);

  // 머리카락/얼굴
  r(o.hair, 5, 1, 6, 3);
  r(o.hair, 4, 3, 1, 3);
  r(o.hair, 11, 3, 1, 3);
  r(o.hair2, 6, 1, 2, 1);
  r(o.skin, 5, 4, 6, 3);
  r(o.eye, 6, 5, 1, 1);
  r(o.eye, 9, 5, 1, 1);
  // 몸
  r(o.coat, 4, 7, 8, 5);
  r(o.coat2, 7, 7, 2, 5);
  r(o.accent, 4, 11, 8, 1);
  r(o.coat, 3, 8, 1, 4);
  r(o.coat, 12, 8, 1, 4);
  r(o.skin, 3, 11, 1, 1);
  r(o.skin, 12, 11, 1, 1);
  r(o.pants, 5, 12, 2, 3);
  r(o.pants, 9, 12, 2, 3);
  // 무기
  if (o.weapon === 'sword') {
    r('#dfe7f2', 14, 2, 1, 8);
    r('#ffffff', 14, 2, 1, 2);
    r(o.accent, 13, 10, 3, 1);
    r('#6b4a2b', 14, 11, 1, 2);
  } else if (o.weapon === 'lance') {
    r('#7a5632', 14, 3, 1, 12);
    r('#e6edf5', 14, 0, 1, 3);
    r(o.accent, 13, 3, 1, 2);
    r(o.accent, 15, 3, 1, 1);
  } else if (o.weapon === 'staff') {
    r('#7a5632', 14, 5, 1, 10);
    r(o.accent, 13, 2, 3, 3);
    r('#ffffff', 14, 3, 1, 1);
  }
}

function drawShade(r) {
  const rows = [[6, 9, 3], [5, 10, 4], [4, 11, 5], [3, 12, 6], [3, 12, 7], [3, 12, 8], [3, 12, 9], [3, 12, 10], [3, 12, 11]];
  for (const [x0, x1, y] of rows) r(OUT, x0 - 1, y - 1, x1 - x0 + 3, 3);
  r(OUT, 2, 11, 12, 2);
  for (const [x0, x1, y] of rows) r('#3c2a5a', x0, y, x1 - x0 + 1, 1);
  r('#54397d', 5, 5, 4, 1);
  r('#54397d', 4, 6, 2, 3);
  r('#3c2a5a', 3, 12, 2, 2);
  r('#3c2a5a', 7, 12, 2, 1);
  r('#3c2a5a', 11, 12, 2, 2);
  r(OUT, 3, 14, 2, 1);
  r(OUT, 11, 14, 2, 1);
  r('#ffd84a', 5, 7, 2, 2);
  r('#ffd84a', 9, 7, 2, 2);
  r(OUT, 6, 10, 4, 1);
}

function drawRunner(r) {
  outlineRects(r, [[5, 4, 6, 8], [10, 2, 2, 3], [3, 11, 3, 3], [10, 11, 3, 3], [4, 6, 1, 2]]);
  r('#7a1f2f', 5, 4, 6, 8);
  r('#a12a3e', 5, 4, 3, 2);
  r('#4f1320', 10, 2, 2, 3);
  r('#4f1320', 4, 6, 1, 2);
  r('#7a1f2f', 3, 11, 3, 3);
  r('#7a1f2f', 10, 11, 3, 3);
  r('#fff2f2', 6, 6, 2, 2);
  r('#fff2f2', 9, 6, 1, 2);
  r('#ff3b3b', 7, 7, 1, 1);
  r(OUT, 6, 9, 4, 1);
}

function drawCarapace(r) {
  outlineRects(r, [[2, 4, 12, 9], [4, 3, 8, 1], [3, 13, 2, 2], [11, 13, 2, 2]]);
  r('#59606b', 2, 5, 12, 8);
  r('#59606b', 4, 4, 8, 1);
  r('#7a838f', 4, 4, 8, 1);
  r('#7a838f', 3, 5, 3, 2);
  r('#3d434d', 5, 6, 1, 6);
  r('#3d434d', 8, 5, 1, 7);
  r('#3d434d', 11, 6, 1, 6);
  r('#3d434d', 3, 12, 10, 1);
  r('#59606b', 3, 13, 2, 2);
  r('#59606b', 11, 13, 2, 2);
  r('#6ee7f5', 3, 8, 1, 1);
  r('#6ee7f5', 12, 8, 1, 1);
}

function drawBoss(r) {
  outlineRects(r, [[3, 4, 10, 10], [2, 1, 2, 4], [12, 1, 2, 4], [1, 8, 2, 4], [13, 8, 2, 4]]);
  r('#5a1220', 3, 4, 10, 10);
  r('#7d1a2d', 4, 4, 4, 2);
  r('#3d0c16', 3, 12, 10, 2);
  r('#d9b44a', 2, 1, 2, 4);
  r('#d9b44a', 12, 1, 2, 4);
  r('#5a1220', 1, 8, 2, 4);
  r('#5a1220', 13, 8, 2, 4);
  r('#ffd84a', 5, 7, 2, 2);
  r('#ffd84a', 9, 7, 2, 2);
  r('#ff5a3a', 7, 5, 2, 2);
  r(OUT, 5, 11, 6, 2);
  r('#efe6c8', 5, 11, 1, 1);
  r('#efe6c8', 7, 11, 1, 1);
  r('#efe6c8', 9, 11, 1, 1);
}

function drawBus(r) {
  outlineRects(r, [[1, 4, 14, 8], [3, 12, 3, 2], [10, 12, 3, 2]]);
  r('#d9b44a', 1, 4, 14, 8);
  r('#f0cf6a', 1, 4, 14, 1);
  r('#b8923a', 1, 10, 14, 2);
  r('#2b3a55', 2, 6, 3, 3);
  r('#2b3a55', 6, 6, 3, 3);
  r('#2b3a55', 10, 6, 3, 3);
  r('#c0392b', 1, 9, 14, 1);
  r('#fff8d6', 14, 9, 1, 1);
  r('#14141a', 3, 12, 3, 2);
  r('#14141a', 10, 12, 3, 2);
  r('#8c8a99', 4, 13, 1, 1);
  r('#8c8a99', 11, 13, 1, 1);
}

function drawPortal(r) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      const a = Math.atan2(y - 7.5, x - 7.5);
      if (d > 7.6) continue;
      let c;
      if (d > 6.4) c = '#2a1650';
      else if (d > 4.2) c = (Math.sin(a * 3 + d) > 0) ? '#5b34a8' : '#3b2275';
      else if (d > 2.2) c = (Math.sin(a * 2 - d) > 0) ? '#9a6af0' : '#6d44c9';
      else c = '#e9dcff';
      r(c, x, y);
    }
  }
}

// ---------- 타일 ----------
function drawGround(seed) {
  return (r) => {
    const rand = rng(seed);
    r('#1b1c26', 0, 0, 16, 16);
    for (let i = 0; i < 18; i++) r(rand() > 0.5 ? '#222331' : '#15151d', Math.floor(rand() * 16), Math.floor(rand() * 16));
    r('#171821', 0, 15, 16, 1);
    r('#171821', 15, 0, 1, 16);
  };
}

function drawPath(seed) {
  return (r) => {
    const rand = rng(seed);
    r('#4a4252', 0, 0, 16, 16);
    for (let i = 0; i < 26; i++) r(rand() > 0.5 ? '#564d5e' : '#3f3847', Math.floor(rand() * 16), Math.floor(rand() * 16));
    r('#3a3340', 0, 0, 16, 1);
    r('#3a3340', 0, 15, 16, 1);
  };
}

function drawRock(r) {
  drawGround(77)(r);
  outlineRects(r, [[3, 6, 10, 7], [5, 4, 6, 2]]);
  r('#5b5b6b', 3, 6, 10, 7);
  r('#5b5b6b', 5, 4, 6, 2);
  r('#7a7a8c', 5, 4, 4, 1);
  r('#7a7a8c', 3, 6, 3, 1);
  r('#43434f', 3, 11, 10, 2);
  r('#2d2d37', 8, 8, 1, 3);
}

// ---------- 기타 ----------
function drawPad(r) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 7.6) continue;
      r(d > 6.2 ? '#0c0b12' : d > 5.2 ? '#6e6a7c' : '#22222d', x, y);
    }
  }
}

function drawDot(r) {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const d = Math.hypot(x - 3.5, y - 3.5);
      if (d <= 3.6) r(d > 2.4 ? '#cfcfcf' : '#ffffff', x, y);
    }
  }
}

function drawSlash(r) {
  // 초승달 모양 베기 탄
  const px = [[1, 1], [2, 1], [3, 2], [4, 3], [5, 4], [5, 5], [2, 2], [3, 3], [4, 4], [1, 2], [2, 3], [3, 4]];
  for (const [x, y] of px) r('#ffffff', x, y);
  r('#9fd6ff', 0, 1);
  r('#9fd6ff', 6, 5);
}

export function generateTextures(scene) {
  const sinners = {
    tower_yisang: { hair: '#2b2b3a', hair2: '#4b4b66', skin: '#f2d6bf', eye: '#1a1a24', coat: '#e9e3d0', coat2: '#bdb5a0', accent: '#d9b44a', pants: '#2a2a35', weapon: 'sword' },
    tower_donquixote: { hair: '#c0553a', hair2: '#e07a52', skin: '#f2d6bf', eye: '#1a1a24', coat: '#7a2b2b', coat2: '#a23a3a', accent: '#d9b44a', pants: '#2a2a35', weapon: 'lance' },
    tower_faust: { hair: '#e58fb8', hair2: '#f6b3d2', skin: '#f2d6bf', eye: '#3a1a3a', coat: '#2d2f4f', coat2: '#45487a', accent: '#e58fb8', pants: '#1f2038', weapon: 'staff' },
  };
  for (const [key, o] of Object.entries(sinners)) makeTex(scene, key, 16, 16, (r) => drawSinner(r, o));

  makeTex(scene, 'enemy_shade', 16, 16, drawShade);
  makeTex(scene, 'enemy_runner', 16, 16, drawRunner);
  makeTex(scene, 'enemy_carapace', 16, 16, drawCarapace);
  makeTex(scene, 'enemy_boss', 16, 16, drawBoss);

  makeTex(scene, 'bus', 16, 16, drawBus);
  makeTex(scene, 'portal', 16, 16, drawPortal);
  // 타일 변형(2)은 기본 타일을 외부 이미지로 바꾼 경우엔 만들지 않는다. (GameScene이 없으면 기본 키를 쓴다)
  const groundOverridden = scene.textures.exists('tile_ground');
  const pathOverridden = scene.textures.exists('tile_path');
  makeTex(scene, 'tile_ground', 16, 16, drawGround(11));
  if (!groundOverridden) makeTex(scene, 'tile_ground2', 16, 16, drawGround(29));
  makeTex(scene, 'tile_path', 16, 16, drawPath(5));
  if (!pathOverridden) makeTex(scene, 'tile_path2', 16, 16, drawPath(41));
  makeTex(scene, 'tile_rock', 16, 16, drawRock);

  makeTex(scene, 'pad', 16, 16, drawPad);
  makeTex(scene, 'dot', 8, 8, drawDot);
  makeTex(scene, 'proj_slash', 8, 8, drawSlash);
}

// 외부 이미지로 대체되는 키는 선형 필터(부드럽게)로 쓴다.
export function smoothOverrides(scene, keys) {
  for (const k of keys) {
    if (scene.textures.exists(k)) scene.textures.get(k).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}
