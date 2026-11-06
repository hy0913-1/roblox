import { fit, clamp, ease, cycle, burst, fly, band, sparkle, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Level up",
  desc: "A level-up at 3/4: a ring of gold spreads on the floor, a pillar of light shoots up and thins, motes and stars rise around the body and a last glint winks at the top.",
  tags: ["rpg", "ui", "level-up", "buff", "holy", "one-shot"],
  size: [80, 104],
  origin: [40, 88],
  duration: 1.6,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#2a1c08", "#9a6c18", "#d8a428", "#ffd84a", "#fff09a", "#fffbe6", "#ffffff"], seed: 9 },
};

export function drawBack(p, t, o) {
  const C = fit(o.palette, 7), k = clamp(t / 0.6);
  if (k < 1) band(p, 0, 0, 5 + 18 * ease.outCubic(k), 0.55, Math.max(1, 3 * (1 - k)), 1 - k * 0.8, C, (g) => Math.sin(g) < 0, k < 0.15);
}
export function draw(p, t, o) {
  const C = fit(o.palette, 7), k = clamp(t / 0.6);
  if (k < 1) band(p, 0, 0, 5 + 18 * ease.outCubic(k), 0.55, Math.max(1, 3 * (1 - k)), 1 - k * 0.8, C, (g) => Math.sin(g) >= 0, k < 0.15);
  // the pillar
  const pk = clamp(t / 0.9);
  if (pk < 1) {
    const w = 10 * (1 - ease.inQuad(pk)), h = 84 * ease.outCubic(clamp(t / 0.2));
    p.rect(-w / 2, -h, w, h, C[3], 0.55 * (1 - pk));
    p.rect(-w / 5, -h, (w * 2) / 5, h, WHITE, 0.8 * (1 - pk));
    p.glow(0, -30, 40, C[3], 0.5 * (1 - pk));
  }
  burst(22, o.seed, (r) => {
    const t0 = r.range(0, 0.6), life = r.range(0.6, 1), age = t - t0;
    if (age < 0 || age > life) return;
    const a = r.range(0, TAU), x = Math.cos(a) * r.range(4, 14), y = Math.sin(a) * 5 - age * r.range(30, 60);
    p.dot(Math.round(x), Math.round(y), age / life < 0.4 ? WHITE : C[4], 1 - age / life);
    if (r.chance(0.25)) p.light(x, y, C[4], 0.5 * (1 - age / life));
  });
  if (t > 0.35 && t < 0.7) sparkle(p, 0, -80, 6 * Math.sin(((t - 0.35) / 0.35) * Math.PI), WHITE, C[4], 1);
}
