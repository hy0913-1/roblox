import { fit, clamp, ease, burst, fly, sparkle, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Sword arc",
  desc: "A sword swing facing right: a crescent of steel light sweeps from top to bottom, white on its leading edge, its trail thinning to blue, with sparks thrown off the tip.",
  tags: ["rpg", "melee", "slash", "sword", "one-shot"],
  size: [80, 72],
  origin: [28, 36],
  duration: 0.34,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#0e1a33", "#24457a", "#4a7cc0", "#8cc0f0", "#d8f0ff", "#ffffff"], radius: 22, seed: 3 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6), R = o.radius, SWEEP = 0.16;
  const head = -1.55 + 3.1 * ease.outCubic(clamp(t / SWEEP)), fade = 1 - clamp((t - SWEEP) / (meta.duration - SWEEP));
  if (fade <= 0) return;
  // the crescent: from the trailing end (thin, dim) to the head (fat, white)
  const tail = Math.max(-1.55, head - 2.2);
  for (let a = tail; a <= head; a += 0.03) {
    const u = (a - tail) / Math.max(0.01, head - tail), w = 1 + 6 * Math.pow(u, 1.4) * (0.6 + 0.4 * fade);
    for (let r = R - w * 0.6; r <= R + w * 0.4; r += 0.5) {
      const edge = r > R + w * 0.4 - 1.2, c = edge && u > 0.7 ? WHITE : u > 0.85 ? C[5] : u > 0.55 ? C[4] : u > 0.3 ? C[3] : C[2];
      p.dot(Math.cos(a) * r, Math.sin(a) * r, c, Math.min(1, (0.25 + u) * fade * 1.2));
    }
  }
  const hx = Math.cos(head) * R, hy = Math.sin(head) * R;
  if (t < SWEEP + 0.04) sparkle(p, Math.round(hx), Math.round(hy), 3, WHITE, C[4], fade);
  p.glow(hx * 0.6, hy * 0.6, 26, C[3], 0.35 * fade);
  // sparks off the tip once it lands
  burst(8, o.seed, (r) => {
    const t0 = r.range(0.06, SWEEP), age = t - t0;
    if (age < 0 || age > 0.2) return;
    const a0 = -1.55 + 3.1 * ease.outCubic(t0 / SWEEP), sp = r.range(60, 140), da = a0 + Math.PI / 2;
    const [x, y] = fly(Math.cos(a0) * R, Math.sin(a0) * R, Math.cos(da) * sp, Math.sin(da) * sp, age, 200, 4);
    p.px(Math.round(x), Math.round(y), age < 0.08 ? WHITE : C[4]);
  });
}
