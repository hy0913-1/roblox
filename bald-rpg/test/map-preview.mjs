import { createFrame, composite } from '../vendor/pixelfx/core/index.js';
import { loadMap, composeBg, SW, SH, MAP_ORDER } from '../src/maps.js';
import { drawHero, POSE } from '../src/hero.js';
import { encodePNG } from '/home/user/patch-gg/pixelfx/tools/lib/png.mjs';
import { writeFileSync } from 'node:fs';
const k = 2, cols = 2, rows = 3, big = new Uint8ClampedArray(SW * k * cols * SH * k * rows * 4);
const t0 = Date.now();
MAP_ORDER.forEach((id, n) => {
  const m = loadMap(id), bg = new Uint32Array(SW * SH), f = createFrame(SW, SH);
  const camX = Math.min(m.w - SW, [80, 250, 300, 500, 150][n]), camY = m.h - SH;
  composeBg(m, camX, camY, bg);
  f.ox = camX; f.oy = camY;
  drawHero(f, camX + 150, m.h - 3 * 16 - (n === 0 ? 0 : 0) - (m.g.h - 1 - [12, 15, 17, 17, 11][n] - 2) * 16 + 0, POSE.idle(0));
  const out = new Uint8ClampedArray(SW * SH * 4);
  composite(f, out, bg);
  const X0 = (n % cols) * SW * k, Y0 = Math.floor(n / cols) * SH * k, BW = SW * k * cols;
  for (let y = 0; y < SH * k; y++) for (let x = 0; x < SW * k; x++) { const s = ((y / k | 0) * SW + (x / k | 0)) * 4, d = ((Y0 + y) * BW + X0 + x) * 4; big[d] = out[s]; big[d + 1] = out[s + 1]; big[d + 2] = out[s + 2]; big[d + 3] = 255; }
});
console.log('ms', Date.now() - t0);
writeFileSync(process.argv[2], encodePNG(SW * k * cols, SH * k * rows, big));
