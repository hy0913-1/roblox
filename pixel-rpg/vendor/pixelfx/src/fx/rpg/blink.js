import { fit, clamp, ease, burst, fly, sparkle, band, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Blink",
  desc: "A short-range teleport: the body folds into a column of cold light that snaps shut, a flat ring flashes on the floor and flakes scatter.",
  tags: ["rpg", "magic", "teleport", "blink", "ice", "one-shot"],
  size: [72, 72],
  origin: [36, 56],
  duration: 0.75,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#0c1430", "#1f4f94", "#2f7fcc", "#58b4ec", "#9bdcff", "#d8f4ff", "#ffffff"], seed: 4 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 7);
  // the column: tall and thin, pinched shut
  const k = clamp(t / 0.22), w = 6 * (1 - ease.inQuad(k)), h = 30 + 10 * k;
  if (w > 0.4) {
    p.rect(-w / 2, -h, w, h, C[4], 0.8);
    p.rect(-w / 4, -h, w / 2, h, WHITE, 0.9);
    p.glow(0, -h / 2, 26, C[4], 0.6 * (1 - k));
  }
  if (t > 0.18 && t < 0.3) sparkle(p, 0, -16, 8 * (1 - (t - 0.18) / 0.12), WHITE, C[5], 1);
  const r = clamp(t / 0.35);
  if (r < 1) band(p, 0, 0, 4 + 16 * ease.outCubic(r), 0.55, Math.max(1, 2.5 * (1 - r)), 1 - r, C, () => true, r < 0.2);
  burst(14, o.seed, (q) => {
    const a = q.range(0, TAU), sp = q.range(20, 70), life = q.range(0.3, 0.55), t0 = 0.12;
    const age = t - t0;
    if (age < 0 || age > life) return;
    const [x, y] = fly(Math.cos(a) * 3, -16 + Math.sin(a) * 8, Math.cos(a) * sp, Math.sin(a) * sp * 0.6 - 20, age, 60, 3);
    p.dot(Math.round(x), Math.round(y), age / life < 0.5 ? WHITE : C[5], 1 - age / life);
  });
}
