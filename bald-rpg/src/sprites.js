// pixelfx 이펙트(생물·아이템 등 반복되는 것)를 처음에 한 번 프레임들로 구워 두고, 게임에서는 빠르게 찍어 낸다.
import { createFrame, clearFrame, createFx } from '../vendor/pixelfx/core/index.js';

/** 반복 이펙트를 fps 장/초로 굽는다. 결과: { w, h, ax, ay(원점), frames:[{c,l}], dur, box:{x0,y0,x1,y1}(원점 기준 몸통 범위) } */
export function bake(mod, opts = {}, fps = 16) {
  const [W, H] = mod.meta.size, [OX, OY] = mod.meta.origin, dur = mod.meta.duration;
  const n = Math.max(1, Math.round(dur * fps)), f = createFrame(W, H);
  const raw = [], cores = [];
  let x0 = W, y0 = H, x1 = -1, y1 = -1, bx0 = W, by0 = H, bx1 = -1, by1 = -1;
  const fx = createFx(mod, { ...opts, x: OX, y: OY });
  for (let i = 0; i < n; i++) {
    clearFrame(f);
    fx.draw(f);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const k = y * W + x, c = f.color[k];
        if (c || f.light[k] & 0xffffff) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        if (c >>> 24 === 255) {
          if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
        }
      }
    // 몸통 범위: 불투명 픽셀이 3개 이상인 줄/칸만 센다(튀는 물방울 제외)
    {
      const rows = new Uint16Array(H), cols = new Uint16Array(W);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (f.color[y * W + x] >>> 24 === 255) { rows[y]++; cols[x]++; }
      let a0 = -1, a1 = -1, b0 = -1, b1 = -1;
      for (let y = 0; y < H; y++) if (rows[y] >= 3) { if (a0 < 0) a0 = y; a1 = y; }
      for (let x = 0; x < W; x++) if (cols[x] >= 3) { if (b0 < 0) b0 = x; b1 = x; }
      if (a0 >= 0 && b0 >= 0) cores.push([b0 - OX, a0 - OY, b1 - OX, a1 - OY]);
    }
    raw.push({ c: f.color.slice(), l: f.light.slice() });
    fx.update(dur / n);
  }
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const frames = raw.map(({ c, l }) => {
    const cc = new Uint32Array(w * h), ll = new Uint32Array(w * h);
    let lit = false;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const s = (y + y0) * W + x + x0;
        cc[y * w + x] = c[s];
        const lv = l[s] & 0xffffff;
        ll[y * w + x] = lv;
        if (lv) lit = true;
      }
    return { c: cc, l: lit ? ll : null };
  });
  const med = (i) => { const v = cores.map((c) => c[i]).sort((p, q) => p - q); return v.length ? v[v.length >> 1] : 0; };
  return { w, h, ax: OX - x0, ay: OY - y0, frames, dur, fps: n / dur, box: { x0: bx0 - OX, y0: by0 - OY, x1: bx1 - OX, y1: by1 - OY }, core: { x0: med(0), y0: med(1), x1: med(2), y1: med(3) } };
}

const WHITE = 0xffffffff;
/**
 * 구운 그림 한 장을 프레임에 찍는다. (x, y)는 원점(보통 발밑)의 월드 좌표.
 * o: { flip, flash(흰색), tint:[color,k], scale(정수), light(빛 세기 0..1), dither(0..1 투명도) }
 */
export function blit(frame, spr, t, x, y, o = {}) {
  const fr = spr.frames[((Math.floor(t * spr.fps) % spr.frames.length) + spr.frames.length) % spr.frames.length];
  const S = o.scale || 1, { w, h } = spr, FW = frame.w, FH = frame.h, C = frame.color, L = frame.light;
  const X0 = Math.round(x) - frame.ox, Y0 = Math.round(y) - frame.oy;
  const flip = !!o.flip, tint = o.tint, lk = o.light ?? 1;
  if (X0 + spr.w * S < -spr.w * S || X0 - spr.w * S > FW + spr.w * S) return;
  for (let sy = 0; sy < h; sy++) {
    const dy0 = Y0 + (sy - spr.ay) * S;
    if (dy0 + S <= 0 || dy0 >= FH) continue;
    for (let sx = 0; sx < w; sx++) {
      const k = sy * w + sx;
      let c = fr.c[k];
      const l = fr.l ? fr.l[k] : 0;
      if (!c && !l) continue;
      const lx = flip ? spr.ax - sx - 1 : sx - spr.ax, dx0 = X0 + lx * S;
      if (dx0 + S <= 0 || dx0 >= FW) continue;
      const a = c >>> 24;
      if (c) {
        if (o.flash && a === 255) c = WHITE;
        else if (tint && a === 255) {
          const [tc, tk] = tint;
          const r = (c & 255) * (1 - tk) + (tc & 255) * tk, g = ((c >>> 8) & 255) * (1 - tk) + ((tc >>> 8) & 255) * tk, b = ((c >>> 16) & 255) * (1 - tk) + ((tc >>> 16) & 255) * tk;
          c = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
        }
      }
      for (let j = 0; j < S; j++) {
        const py = dy0 + j;
        if (py < 0 || py >= FH) continue;
        for (let i = 0; i < S; i++) {
          const px = dx0 + i;
          if (px < 0 || px >= FW) continue;
          const d = py * FW + px;
          if (c) {
            if (o.dither !== undefined && (((px + py * 2) & 3) / 4 >= o.dither)) continue;
            if (a === 255) C[d] = c;
            else if (a > 8) {
              // 반투명(연기 등): 아래 색과 섞는다
              const u = C[d], f = a / 255, ua = u >>> 24;
              if (!ua) C[d] = c;
              else {
                const r = (c & 255) * f + (u & 255) * (1 - f), g = ((c >>> 8) & 255) * f + ((u >>> 8) & 255) * (1 - f), b = ((c >>> 16) & 255) * f + ((u >>> 16) & 255) * (1 - f);
                C[d] = ((Math.max(a, ua) << 24) | (b << 16) | (g << 8) | r) >>> 0;
              }
            }
          }
          if (l && lk > 0) {
            const u = L[d];
            const r = Math.min(255, (u & 255) + (l & 255) * lk), g = Math.min(255, ((u >>> 8) & 255) + ((l >>> 8) & 255) * lk), b = Math.min(255, ((u >>> 16) & 255) + ((l >>> 16) & 255) * lk);
            L[d] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
          }
        }
      }
    }
  }
}
