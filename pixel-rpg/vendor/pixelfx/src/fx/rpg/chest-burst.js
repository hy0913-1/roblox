import { fit, clamp, ease, burst, fly, sparkle, WHITE, TAU, hex } from "../../core/index.js";

export const meta = {
  name: "Chest burst",
  desc: "A chest opening: a beam of light leaps out of the lid, coins and sparkles burst up and fall back, a soft glow lingers; the palette is the loot's rarity.",
  tags: ["rpg", "pickup", "chest", "loot", "treasure", "one-shot"],
  size: [80, 96],
  origin: [40, 76],
  duration: 1.4,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#1e1206", "#86520c", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"], seed: 3 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6), GOLD = hex("#ffd84a"), GOLD2 = hex("#b8860b");
  const bk = clamp(t / 0.7);
  if (bk < 1) {
    const w = 12 * (1 - bk) + 2, h = 60 * ease.outCubic(clamp(t / 0.15));
    p.poly([[-w / 2, -6], [w / 2, -6], [w, -6 - h], [-w, -6 - h]], C[3], 0.4 * (1 - bk));
    p.rect(-w / 4, -6 - h, w / 2, h, WHITE, 0.6 * (1 - bk));
    p.glow(0, -20, 36, C[3], 0.6 * (1 - bk));
  }
  burst(14, o.seed, (r) => {
    const a = -Math.PI / 2 + r.range(-0.9, 0.9), sp = r.range(70, 140), life = r.range(0.7, 1.1), t0 = r.range(0, 0.15), age = t - t0;
    if (age < 0 || age > life) return;
    const [x, y] = fly(0, -8, Math.cos(a) * sp * 0.5, Math.sin(a) * sp, age, 300, 1);
    if (y > 4) return;
    const spin = Math.floor(age * 16 + r.next() * 4) % 4;
    p.px(Math.round(x), Math.round(y), spin === 0 ? WHITE : GOLD);
    if (spin !== 2) p.px(Math.round(x) + 1, Math.round(y), GOLD2);
  });
  burst(10, o.seed + 9, (r) => {
    const t0 = r.range(0.05, 0.6), age = t - t0;
    if (age < 0 || age > 0.4) return;
    sparkle(p, Math.round(r.range(-14, 14)), Math.round(-r.range(10, 44)), 2.5 * Math.sin((age / 0.4) * Math.PI), WHITE, C[3], 1);
  });
  p.glow(0, -6, 28, C[3], 0.25 * (1 - clamp(t / meta.duration)));
}
