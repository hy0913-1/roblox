import { fit, clamp, ease, burst, band, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Heal",
  desc: "Drinking a potion at 3/4: a soft ring opens on the floor, little crosses and bubbles float up round the body and the glow fades; green for health, blue for mana.",
  tags: ["rpg", "heal", "potion", "buff", "holy", "one-shot"],
  size: [64, 80],
  origin: [32, 66],
  duration: 1.3,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#08201a", "#17663e", "#3ec466", "#7ee88a", "#c8ffc4", "#ffffff"], seed: 2 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6), k = clamp(t / 0.5);
  if (k < 1) band(p, 0, 0, 4 + 12 * ease.outCubic(k), 0.55, Math.max(1, 2 * (1 - k)), 1 - k, C, () => true);
  burst(12, o.seed, (r) => {
    const t0 = r.range(0, 0.5), life = r.range(0.5, 0.7), age = t - t0;
    if (age < 0 || age > life) return;
    const x = Math.round(r.range(-10, 10) + Math.sin(age * 8 + r.next() * 6) * 1.5), y = Math.round(-r.range(2, 18) - age * 36), f = 1 - age / life;
    if (r.chance(0.6)) {
      // a plus
      p.dot(x, y, C[4], f);
      p.dot(x - 1, y, C[3], f);
      p.dot(x + 1, y, C[3], f);
      p.dot(x, y - 1, C[3], f);
      p.dot(x, y + 1, C[3], f);
    } else p.dot(x, y, WHITE, f);
    p.light(x, y, C[3], 0.4 * f);
  });
  p.glow(0, -14, 26, C[3], 0.4 * (1 - clamp(t / meta.duration)));
}
