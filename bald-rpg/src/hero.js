// 주인공 "빛나리": pixelfx의 뼈대 캐릭터(rig)에 옷을 입혀 그린다. 포즈만 주면 팔다리는 뼈대가 알아서 푼다.
import { posed, hex } from '../vendor/pixelfx/core/index.js';

const ramp = (...cs) => cs.map((c) => hex(c) >>> 0);
// 밝은 쪽 → 어두운 쪽 4단계
const SKIN = ramp('#ffe2c4', '#f6c49c', '#d99a74', '#a9694f');
const SUIT = ramp('#ff6b5e', '#e23d44', '#b0243a', '#7a1730'); // 빨간 추리닝
const PANT = ramp('#5d7bd6', '#4059b0', '#2f3f85', '#222b5c');
const SHOE = ramp('#fff4d6', '#e8d2a0', '#b89a68', '#7d6442');
const BELT = ramp('#ffe07a', '#f2b93b', '#b9811f', '#7a5212');
const INK = hex('#1b1226') >>> 0;
const SEAMK = 0.55;

// rig.js의 PART 번호
const P = { pelvis: 1, waist: 2, chest: 3, neck: 4, head: 5, face: 6, upperN: 7, elbowN: 8, foreN: 9, handN: 10, upperF: 11, elbowF: 12, foreF: 13, handF: 14, thighN: 15, kneeN: 16, shinN: 17, footN: 18, thighF: 19, kneeF: 20, shinF: 21, footF: 22 };
const RAMP_OF = [];
for (const k of ['neck', 'head', 'face', 'foreN', 'handN', 'foreF', 'handF']) RAMP_OF[P[k]] = SKIN;
for (const k of ['chest', 'upperN', 'elbowN', 'upperF', 'elbowF']) RAMP_OF[P[k]] = SUIT;
for (const k of ['pelvis', 'thighN', 'kneeN', 'shinN', 'thighF', 'kneeF', 'shinF']) RAMP_OF[P[k]] = PANT;
RAMP_OF[P.waist] = BELT;
RAMP_OF[P.footN] = SHOE;
RAMP_OF[P.footF] = SHOE;

const darken = (c, k) => {
  const r = (c & 255) * k, g = ((c >>> 8) & 255) * k, b = ((c >>> 16) & 255) * k;
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
};
const WHITE = 0xffffffff;

/**
 * 포즈를 프레임에 그린다. (x, y)는 발 위치(화면 좌표), face: 1 오른쪽 / -1 왼쪽.
 * o: { flash: 흰색 번쩍, tint: [color, k], alpha(0..1, 깜빡임용) }
 */
export function drawHero(frame, x, y, pose, face = 1, o = {}) {
  const r = posed(pose);
  const RO = o.ramps || RAMP_OF;
  let fx1 = -99, fy0 = 99, fy1 = -99, hy0 = 99, hx0 = 99, hx1 = -99;
  const { w, h, color: C } = frame;
  const X = Math.round(x) - frame.ox, Y = Math.round(y) - frame.oy;
  for (let i = 0; i < r.n; i++) {
    const px = X + (face < 0 ? -r.xs[i] - 1 : r.xs[i]), py = Y + r.ys[i];
    if (px < 0 || py < 0 || px >= w || py >= h) continue;
    let c;
    if (r.ink[i]) c = INK;
    else {
      const part = r.part[i], tone = r.tone[i];
      if (part >= 23) c = r.color[i]; // 무기는 원래 색
      else {
        const R = RO[part] || SUIT;
        if (part === 6) { if (r.xs[i] > fx1) fx1 = r.xs[i]; if (r.ys[i] < fy0) fy0 = r.ys[i]; if (r.ys[i] > fy1) fy1 = r.ys[i]; }
        if (part === 5 || part === 6) { if (r.ys[i] < hy0) hy0 = r.ys[i]; if (r.xs[i] < hx0) hx0 = r.xs[i]; if (r.xs[i] > hx1) hx1 = r.xs[i]; }
        c = tone === 4 ? darken(R[2], SEAMK + 0.25) : R[Math.min(3, tone >= 5 ? tone - 5 + 1 : tone)];
      }
    }
    if (o.flash) c = WHITE;
    else if (o.tint) {
      const [t, k] = o.tint;
      const rr = (c & 255) * (1 - k) + (t & 255) * k, gg = ((c >>> 8) & 255) * (1 - k) + ((t >>> 8) & 255) * k, bb = ((c >>> 16) & 255) * (1 - k) + ((t >>> 16) & 255) * k;
      c = ((255 << 24) | (bb << 16) | (gg << 8) | rr) >>> 0;
    }
    C[py * w + px] = c;
  }
  // 얼굴: 눈 한 점과, 반짝이는 민머리 광택
  const put = (lx, ly, c) => {
    const px = X + (face < 0 ? -lx - 1 : lx), py = Y + ly;
    if (px >= 0 && py >= 0 && px < w && py < h) C[py * w + px] = c;
  };
  if (fx1 > -99 && !o.flash && !o.noFace) {
    const ey = Math.round((fy0 + fy1) / 2);
    put(fx1 - 1, ey, INK);
    if (o.brow) put(fx1 - 1, ey - 1, o.brow);
    put(Math.round((hx0 + hx1) / 2) - 1, hy0 + 1, WHITE);
    put(Math.round((hx0 + hx1) / 2), hy0 + 1, WHITE);
  }
  r.headX = (hx0 + hx1) / 2; r.headY = hy0;
  return r;
}

// ---------- 포즈 ----------
const S = Math.sin, C0 = Math.cos, TAU = Math.PI * 2;
export const POSE = {
  idle(t) {
    const b = S(t * 2.2);
    return { crouch: 0.6 + b * 0.6, fx: -4, fy: -15 + b * 0.5, bx: 6, by: -15 + b * 0.5, hy: b * 0.3 };
  },
  walk(t, speed = 1) {
    const ph = t * 9 * speed, s = S(ph), c = C0(ph);
    return {
      crouch: 1.2 + Math.abs(c) * 0.8, lean: 2,
      ffx: s * 7, ffy: -Math.max(0, c) * 4, fbx: -s * 7, fby: -Math.max(0, -c) * 4,
      fx: -2 - s * 7, fy: -17 + Math.abs(s) * 2, bx: 4 + s * 7, by: -17 + Math.abs(s) * 2,
    };
  },
  jump() {
    return { crouch: 1, lean: 1, ffx: 3, ffy: -7, fbx: -4, fby: -3, fx: -8, fy: -30, bx: 9, by: -29, turn: 0.6 };
  },
  fall(t) {
    const w = S(t * 18) * 1.2;
    return { lean: -1, ffx: 5, ffy: -2, fbx: -5, fby: -5, fx: -11 + w, fy: -24, bx: 12 - w, by: -25, turn: 0.8 };
  },
  hurt() {
    return { lean: -6, crouch: 2, hx: -1, fx: -9, fy: -22, bx: 2, by: -24, ffx: 5, fbx: -4 };
  },
  dead() {
    return { crouch: 13, lean: 24, hy: 3, fx: 12, fy: -3, bx: 9, by: -2, ffx: -8, fbx: -11 };
  },
  // 평타: 주먹 지르기 (u: 0..1)
  punch(u) {
    if (u < 0.25) return { crouch: 3, lean: -3, fx: -8, fy: -22, bx: 8, by: -20, ffx: 5, fbx: -6 };
    if (u < 0.6) return { crouch: 3, lean: 6, fx: 15, fy: -23, bx: -2, by: -19, ffx: 9, fbx: -8, ghost: 1 };
    return { crouch: 2, lean: 2, fx: 9, fy: -21, bx: 3, by: -19, ffx: 6, fbx: -6 };
  },
  // 탈모빔: 머리를 숙여 정수리를 겨눈다
  beam(u) {
    if (u < 0.2) return { crouch: 2, lean: -4, fx: -6, fy: -30, bx: 8, by: -30, turn: 0.8 };
    return { crouch: 5, lean: 13, hy: 2.2, hx: 1, fx: -9, fy: -14, bx: -4, by: -12, ffx: 8, fbx: -9 };
  },
  // 3톤 어택: 공중에서 엉덩이로 내리찍기
  slamUp() {
    return { crouch: 6, lean: -2, ffx: 6, ffy: -9, fbx: -3, fby: -9, fx: -9, fy: -31, bx: 10, by: -31, turn: 1 };
  },
  slamDown() {
    return { crouch: 9, lean: -5, ffx: 9, ffy: -6, fbx: 3, fby: -6, fx: -12, fy: -27, bx: 13, by: -27, turn: 1 };
  },
  slamLand() {
    return { crouch: 11, lean: 4, ffx: 9, fbx: -9, fx: -12, fy: -8, bx: 13, by: -8, turn: 1 };
  },
  // 진동 폭발: 웅크려 떨다가 팔을 벌려 터뜨린다
  quakeCharge(t) {
    const j = S(t * 70) * 1.3;
    return { crouch: 8, lean: 3, fx: 2 + j, fy: -18, bx: 5 - j, by: -18, ffx: 6, fbx: -6, armsFront: true };
  },
  quakeBurst() {
    return { crouch: 1, lean: -3, fx: -13, fy: -30, bx: 14, by: -30, ffx: 8, fbx: -8, turn: 1, toeF: 1, toeB: 1 };
  },
  // 공군 폭격: 하늘을 가리키며 호출
  call(u) {
    if (u < 0.3) return { crouch: 2, fx: 6, fy: -22, bx: 4, by: -18 };
    return { lean: -3, fx: 6, fy: -43, bx: 6, by: -14, ffx: 5, fbx: -5, hy: -1.5 };
  },
};

// 마을 사람들: 같은 뼈대에 옷 색만 다르게
export function outfit(suit, pant, shoe = ['#fff4d6', '#e8d2a0', '#b89a68', '#7d6442'], skin) {
  const R = RAMP_OF.slice(), su = ramp(...suit), pa = ramp(...pant), sh = ramp(...shoe), sk = skin ? ramp(...skin) : SKIN;
  for (const k of ['chest', 'upperN', 'elbowN', 'upperF', 'elbowF']) R[P[k]] = su;
  for (const k of ['pelvis', 'thighN', 'kneeN', 'shinN', 'thighF', 'kneeF', 'shinF']) R[P[k]] = pa;
  for (const k of ['neck', 'head', 'face', 'foreN', 'handN', 'foreF', 'handF']) R[P[k]] = sk;
  R[P.footN] = sh; R[P.footF] = sh;
  return R;
}
