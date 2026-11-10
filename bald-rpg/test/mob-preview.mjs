import { createFrame, composite, hex } from '../vendor/pixelfx/core/index.js';
import { bake, blit } from '../src/sprites.js';
import { MOBS } from '../src/mobs-data.js';
import { drawHero, POSE } from '../src/hero.js';
import { encodePNG } from '/home/user/patch-gg/pixelfx/tools/lib/png.mjs';
import { writeFileSync } from 'node:fs';
const W = 640, H = 150, f = createFrame(W, H);
let x = 30;
drawHero(f, x, 130, POSE.idle(0));
x += 40;
const t0 = Date.now();
for (const [k, m] of Object.entries(MOBS)) {
  const s = bake(m.mod, m.opts);
  console.log(k, 'size', s.w, s.h, 'box', JSON.stringify(s.box), 'frames', s.frames.length);
  const sc = m.scale || 1;
  x += (s.box.x1 - s.box.x0) * sc / 2 + 6;
  blit(f, s, 0.3, x, 130, { scale: sc, flip: k === 'snake' });
  x += (s.box.x1 - s.box.x0) * sc / 2 + 6;
}
console.log('bake ms', Date.now() - t0);
const k = 3, out = new Uint8ClampedArray(W * H * 4);
composite(f, out, hex('#3a4a6a'));
const big = new Uint8ClampedArray(W * k * H * k * 4);
for (let y = 0; y < H * k; y++) for (let xx = 0; xx < W * k; xx++) { const s = ((y / k | 0) * W + (xx / k | 0)) * 4, d = (y * W * k + xx) * 4; big[d] = out[s]; big[d + 1] = out[s + 1]; big[d + 2] = out[s + 2]; big[d + 3] = 255; }
writeFileSync(process.argv[2], encodePNG(W * k, H * k, big));
