import { fit, cycle, at, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Blizzard",
  desc: "A storm on one patch of floor at 3/4: frost spreads under it, snow drives in on the wind, streaks of gale cut across and flakes glint as they land.",
  tags: ["rpg", "ice", "weather", "zone", "aoe", "loop"],
  size: [128, 96],
  origin: [64, 60],
  duration: 1,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#0c1430", "#1f4f94", "#2f7fcc", "#58b4ec", "#9bdcff", "#d8f4ff", "#ffffff"], radius: 40, seed: 8 },
};

const SY = 0.58;
export function drawBack(p, t, o) {
  const C = fit(o.palette, 7), R = o.radius, ph = t / meta.duration;
  // frost on the floor: translucent, a pale rim
  for (let y = Math.floor(-R * SY); y <= R * SY; y++)
    for (let x = -R; x <= R; x++) {
      const e = Math.hypot(x / R, y / (R * SY));
      if (e > 1) continue;
      if (e > 0.93) p.dot(x, y, ((x * 7 + y * 13) & 3) ? C[4] : C[6], ((x + y) & 1) ? 0.55 : 0.2);
      else p.blend(x, y, e > 0.5 ? C[4] : C[3], 0.16 + 0.06 * Math.sin(ph * TAU + x * 0.2));
    }
}
export function draw(p, t, o) {
  const C = fit(o.palette, 7), R = o.radius, ph = t / meta.duration;
  // flakes driving down and across on the wind; they land inside the ellipse
  cycle(t, meta.duration, 60, o.seed, 0.7, (age, life, r) => {
    const k = age / life, a = r.range(0, TAU), d = Math.sqrt(r.next()) * R, lx = Math.cos(a) * d, ly = Math.sin(a) * d * SY;
    const h = 46 * (1 - k), x = lx - 18 * (1 - k), y = ly - h;
    p.dot(Math.round(x), Math.round(y), k > 0.85 ? WHITE : at([C[4], C[5], C[6]], r.next()), 0.9);
    if (r.chance(0.3)) p.dot(Math.round(x) - 1, Math.round(y) - 1, C[4], 0.6);
    if (k > 0.9) p.light(lx, ly, C[5], 0.6);
  });
  // gale streaks
  cycle(t, meta.duration, 8, o.seed + 1, 0.35, (age, life, r) => {
    const k = age / life, y = r.range(-R * SY - 20, R * SY - 6), x0 = -R + k * R * 2.2 - 12, L = r.range(8, 16);
    for (let i = 0; i < L; i++) p.dot(Math.round(x0 - i), Math.round(y + i * 0.35), i < 3 ? WHITE : C[5], (1 - i / L) * Math.sin(k * Math.PI) * 0.8);
  });
  p.glow(0, -6, R * 1.3, C[4], 0.14);
}
