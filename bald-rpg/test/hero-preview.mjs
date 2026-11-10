import { createFrame, composite, hex } from '../vendor/pixelfx/core/index.js';
import { drawHero, POSE } from '../src/hero.js';
import { encodePNG } from '/home/user/patch-gg/pixelfx/tools/lib/png.mjs';
import { writeFileSync } from 'node:fs';
const list = [['idle', POSE.idle(0)], ['walk', POSE.walk(0.05)], ['walk', POSE.walk(0.2)], ['walk', POSE.walk(0.4)], ['walk', POSE.walk(0.55)], ['jump', POSE.jump()], ['fall', POSE.fall(0)], ['hurt', POSE.hurt()], ['dead', POSE.dead()], ['p0', POSE.punch(0.1)], ['p1', POSE.punch(0.4)], ['beam', POSE.beam(0.5)], ['sUp', POSE.slamUp()], ['sDn', POSE.slamDown()], ['sLd', POSE.slamLand()], ['qC', POSE.quakeCharge(0)], ['qB', POSE.quakeBurst()], ['call', POSE.call(0.8)]];
const W = 9 * 44, H = 2 * 60, f = createFrame(W, H);
list.forEach(([n, p], i) => drawHero(f, 22 + (i % 9) * 44, 54 + Math.floor(i / 9) * 60, p, i === 4 ? -1 : 1));
const k = 4, out = new Uint8ClampedArray(W * H * 4);
composite(f, out, hex('#6fb5e8'));
const big = new Uint8ClampedArray(W * k * H * k * 4);
for (let y = 0; y < H * k; y++) for (let x = 0; x < W * k; x++) { const s = ((y / k | 0) * W + (x / k | 0)) * 4, d = (y * W * k + x) * 4; big[d] = out[s]; big[d + 1] = out[s + 1]; big[d + 2] = out[s + 2]; big[d + 3] = 255; }
writeFileSync(process.argv[2], encodePNG(W * k, H * k, big));
