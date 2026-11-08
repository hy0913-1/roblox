// 코드로 그린 도트 그림: 캐릭터 8종(16x16), 스킬/하트/에너지 아이콘(8x8).
// 글자 하나가 픽셀 하나. '.'은 투명. 팔레트 글자: k 외곽선, a 주색, b 밝은색, c 강조색, p 볼, w 흰색

const K = '#241b2f';

const BODY = [
  '..kaaaaaaaaaak..',
  '.kaaaaaaaaaaaak.',
  '.kaaaaaaaaaaaak.',
  '.kaakwaaaakwaak.',
  '.kaakkaaaakkaak.',
  '.kappaaccaappak.',
  '.kaaaaaaaaaaaak.',
  '..kabbbbbbbbak..',
  '..kabbbbbbbbak..',
  '...kaaaaaaaak...',
  '...kaak..kaak...',
  '...kkk....kkk...',
];

export const CHARS = [
  {
    name: '고양이',
    pal: { a: '#f2a65a', b: '#ffdcb0', c: '#e8687a', p: '#ff9eb0' },
    map: ['................', '..k..........k..', '..kk........kk..', '..kpk......kpk..', ...BODY],
  },
  {
    name: '토끼',
    pal: { a: '#f4f1ec', b: '#ffffff', c: '#e8687a', p: '#ffbfd2' },
    map: ['...kk......kk...', '...kpk....kpk...', '...kpk....kpk...', '...kak....kak...', ...BODY],
  },
  {
    name: '곰',
    pal: { a: '#a8693f', b: '#e3b88c', c: '#4a2c1a', p: '#d98a6a' },
    map: ['................', '..kkk......kkk..', '.kbbak....kabbk.', '.kbaak....kaabk.', ...BODY],
  },
  {
    name: '개구리',
    pal: { a: '#6cc35c', b: '#c9f0a6', c: '#d8505c', p: '#ff9eb0' },
    map: [
      '................',
      '..kkkk....kkkk..',
      '.kwwwkk..kkwwwk.',
      '.kwkkak..kakkwk.',
      '..kaaaaaaaaaak..',
      '.kaaaaaaaaaaaak.',
      '.kaaaaaaaaaaaak.',
      '.kaaaaaaaaaaaak.',
      '.kppaaaaaaaappk.',
      '.kakaaaaaaaakak.',
      '.kaakkkkkkkkaak.',
      '..kabbbbbbbbak..',
      '..kabbbbbbbbak..',
      '...kaaaaaaaak...',
      '...kaak..kaak...',
      '...kkk....kkk...',
    ],
  },
  {
    name: '로봇',
    pal: { a: '#8ea4c4', b: '#cddbee', c: '#ffcc33', p: '#ff7a5a' },
    map: [
      '.......kk.......',
      '.......cc.......',
      '..kkkkkkkkkkkk..',
      '..kaaaaaaaaaak..',
      '..kabbbbbbbbak..',
      '..kabkwbbkwbak..',
      '..kabkkbbkkbak..',
      '..kabbbbbbbbak..',
      '..kabbkkkkbbak..',
      '..kaaaaaaaaaak..',
      '..kkkkkkkkkkkk..',
      '...kacaaaacak...',
      '...kaaaaaaaak...',
      '...kaak..kaak...',
      '...kkk....kkk...',
      '................',
    ],
  },
  {
    name: '유령',
    pal: { a: '#e9ecff', b: '#ffffff', c: '#6d6fc4', p: '#ffc4dc' },
    map: [
      '................',
      '.....kkkkkk.....',
      '....kaaaaaak....',
      '...kaaaaaaaak...',
      '..kaaaaaaaaaak..',
      '..kaakwaakwaak..',
      '..kaakkaakkaak..',
      '..kappaaaappak..',
      '..kaaaackaaaak..',
      '..kaaaakkaaaak..',
      '..kaaaaaaaaaak..',
      '..kaaaaaaaaaak..',
      '..kaaaaaaaaaak..',
      '..kakaakkaakak..',
      '..kk.kk..kk.kk..',
      '................',
    ],
  },
  {
    name: '슬라임',
    pal: { a: '#4fb6ff', b: '#bfe8ff', c: '#1f6fb0', p: '#ff9eb0' },
    map: [
      '................',
      '................',
      '................',
      '.......kk.......',
      '......kbak......',
      '.....kbaaak.....',
      '....kbaaaaak....',
      '...kbaaaaaaak...',
      '..kbaakwakwaak..',
      '..kaaakkakkaak..',
      '.kaappaaaappaak.',
      '.kaaaaaccaaaaak.',
      'kaaaaaaaaaaaaaak',
      'kaaaaaaaaaaaaaak',
      '.kkkkkkkkkkkkkk.',
      '................',
    ],
  },
  {
    name: '병아리',
    pal: { a: '#ffd63d', b: '#fff2a6', c: '#ff8a3d', p: '#ffb3a0' },
    map: [
      '.......k........',
      '......kak.......',
      '.....kkakkk.....',
      '...kkaaaaaakk...',
      '..kaaaaaaaaaak..',
      '.kaaaaaaaaaaaak.',
      '.kaakwaaaakwaak.',
      '.kaakkaaaakkaak.',
      '.kappackkcappak.',
      '.kaaaakcckaaaak.',
      '.kaaaaakkaaaaak.',
      '..kabbbbbbbbak..',
      '...kbbbbbbbbk...',
      '....kkaaaakk....',
      '.....kc..ck.....',
      '....kcc..cck....',
    ],
  },
];

export const ICONS = {
  ink: { pal: { k: '#15121c', a: '#2d2a3d', w: '#8a86a8' }, map: ['...k....', '..kak...', '..kak...', '.kaaak..', 'kaawaak.', 'kaaaaak.', '.kaaak..', '..kkk...'] },
  mess: { pal: { k: '#3b2a5c', a: '#b48cff', w: '#ffffff' }, map: ['.kkkkk..', 'k.....k.', 'k.kkk.k.', 'k.k.k.k.', 'k.k...k.', 'k.kkkkk.', 'k.......', '.kkkkkk.'] },
  swap: { pal: { k: '#1d3557', a: '#ffd166', w: '#ffffff' }, map: ['..k.....', '.kak....', 'kaaaaak.', '.kak....', '....kak.', '.kaaaaak', '....kak.', '.....k..'] },
  ice: { pal: { k: '#1d4e89', a: '#9fe2ff', w: '#ffffff' }, map: ['...k....', '.k.k.k..', '..kwk...', 'kkwawkk.', '..kwk...', '.k.k.k..', '...k....', '........'] },
  push: { pal: { k: '#5c2a1d', a: '#ff9a5a', w: '#ffffff' }, map: ['....k...', '....kk..', 'kk.kkak.', '...kaaak', 'kk.kkak.', '....kk..', '....k...', '........'] },
  shield: { pal: { k: '#2b3a55', a: '#7fd1ff', w: '#ffffff' }, map: ['kkkkkkk.', 'kawaaak.', 'kawaaak.', 'kaaaaak.', '.kaaak..', '.kaaak..', '..kak...', '...k....'] },
  heart: { pal: { k: '#5a1020', a: '#ff4d6d', w: '#ffc2cf' }, map: ['.kk.kk..', 'kwakaak.', 'kaaaaak.', 'kaaaaak.', '.kaaak..', '..kak...', '...k....', '........'] },
  heartEmpty: { pal: { k: '#5a5070', a: '#2a2438', w: '#3a3350' }, map: ['.kk.kk..', 'kwakaak.', 'kaaaaak.', 'kaaaaak.', '.kaaak..', '..kak...', '...k....', '........'] },
  bolt: { pal: { k: '#6b4a00', a: '#ffd23f', w: '#fff6c2' }, map: ['...kkk..', '..kak...', '.kaak...', 'kawaakk.', '.kkaak..', '..kak...', '.kak....', '.kk.....'] },
  crown: { pal: { k: '#6b4a00', a: '#ffd23f', w: '#fff6c2' }, map: ['........', 'k..k..k.', 'kk.k.kk.', 'kakakak.', 'kaaaaak.', 'kawawak.', 'kkkkkkk.', '........'] },
};

// 도트 하나를 scale 픽셀로 그린다
export function drawMap(ctx, map, pal, x, y, scale = 1, flip = false) {
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      ctx.fillStyle = ch === 'k' ? pal.k || K : ch === 'w' ? pal.w || '#ffffff' : pal[ch] || '#ff00ff';
      const cx = flip ? row.length - 1 - c : c;
      ctx.fillRect(x + cx * scale, y + r * scale, scale, scale);
    }
  }
}

const cache = new Map();
// 캐릭터를 미리 그려 둔 캔버스(16*scale 정사각형)
export function charCanvas(i, scale = 3, tint = null) {
  const key = `${i}|${scale}|${tint}`;
  if (cache.has(key)) return cache.get(key);
  const ch = CHARS[((i % CHARS.length) + CHARS.length) % CHARS.length];
  const cv = document.createElement('canvas');
  cv.width = 16 * scale;
  cv.height = 16 * scale;
  const ctx = cv.getContext('2d');
  const pal = tint ? Object.fromEntries(Object.entries(ch.pal).map(([k, v]) => [k, tint])) : ch.pal;
  drawMap(ctx, ch.map, { k: tint ? '#1a1626' : K, w: tint ? tint : '#ffffff', ...pal }, 0, 0, scale);
  cache.set(key, cv);
  return cv;
}

export function iconCanvas(name, scale = 3) {
  const key = `icon|${name}|${scale}`;
  if (cache.has(key)) return cache.get(key);
  const ic = ICONS[name];
  const cv = document.createElement('canvas');
  cv.width = 8 * scale;
  cv.height = 8 * scale;
  drawMap(cv.getContext('2d'), ic.map, ic.pal, 0, 0, scale);
  cache.set(key, cv);
  return cv;
}

const urls = new Map();

// 큰 O/X 마크(12x12). w 자리를 원하는 색으로 칠한다
export const MARKS = {
  O: ['....kkkk....', '..kkwwwwkk..', '.kwwwwwwwwk.', '.kwwkkkkwwk.', 'kwwk....kwwk', 'kwwk....kwwk', 'kwwk....kwwk', 'kwwk....kwwk', '.kwwkkkkwwk.', '.kwwwwwwwwk.', '..kkwwwwkk..', '....kkkk....'],
  X: ['kkk......kkk', 'kwwk....kwwk', 'kwwwk..kwwwk', '.kwwwkkwwwk.', '..kwwwwwwk..', '...kwwwwk...', '...kwwwwk...', '..kwwwwwwk..', '.kwwwkkwwwk.', 'kwwwk..kwwwk', 'kwwk....kwwk', 'kkk......kkk'],
};

export function markURL(kind, color = '#ffffff', scale = 4) {
  const key = `m|${kind}|${color}|${scale}`;
  if (!urls.has(key)) {
    const cv = document.createElement('canvas');
    cv.width = 12 * scale;
    cv.height = 12 * scale;
    drawMap(cv.getContext('2d'), MARKS[kind], { k: '#0b0916', w: color }, 0, 0, scale);
    urls.set(key, cv.toDataURL());
  }
  return urls.get(key);
}

export function iconURL(name, scale = 3) {
  const k = `i|${name}|${scale}`;
  if (!urls.has(k)) urls.set(k, iconCanvas(name, scale).toDataURL());
  return urls.get(k);
}

export function charURL(i, scale = 3) {
  const k = `c|${i}|${scale}`;
  if (!urls.has(k)) urls.set(k, charCanvas(i, scale).toDataURL());
  return urls.get(k);
}
