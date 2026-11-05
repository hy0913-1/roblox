import { PAL, fit, at, cycle, sparkle, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Frost bolt",
  desc: "A faceted ice shard flying right: a white-hot core pulses inside it, three tapering streaks and a few cold motes trail behind, flakes orbit it and a pale light rides along.",
  tags: ["rpg", "ice", "projectile", "bolt", "magic", "loop"],
  size: [88, 40],
  origin: [60, 20],
  duration: 0.4,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: PAL.ice, seed: 3 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 8), ph = t / meta.duration, pulse = 0.5 + 0.5 * Math.sin(ph * TAU);
  const WAKE = [C[1], C[2], C[3], C[4], C[5], C[6]];

  // three streaks tapering off behind: long in the middle, short on the flanks, each flickering in length
  [[0, 34, 0], [-3.4, 20, 1.7], [3.4, 20, 3.4]].forEach(([y, len, off]) => {
    const L = len * (0.82 + 0.18 * Math.sin(ph * TAU + off));
    for (let x = 0; x < L; x++) {
      const k = x / L, yy = y * (1 - k * 0.55) + Math.sin(ph * TAU * 2 - x * 0.3 + off) * k * 0.9;
      p.dot(-9 - x, Math.round(yy), at(WAKE, 1 - k * 0.95), 1 - k * 0.85);
      if (Math.abs(y) < 1 && k < 0.55) p.dot(-9 - x, Math.round(yy) + (x % 2 ? 1 : -1), at(WAKE, 0.55 - k), 0.7 - k);
    }
  });
  // a few cold motes break off and fall behind
  cycle(t, meta.duration, 9, o.seed, 0.4, (age, life, r) => {
    const k = age / life, x = -12 - age * r.range(50, 110), y = r.range(-5, 5) + k * 5;
    p.px(Math.round(x), Math.round(y), at([C[3], C[4], C[5], C[6]], 1 - k));
  });

  // the shard: dark rim, lit upper facet, shaded lower facet, white ridge, pulsing core, forked tail
  const L = 16 + pulse * 0.8, W = 6.4;
  p.poly([[-8, 0], [-15, -3.4], [-11.5, 0], [-15, 3.4]], C[2]);
  p.poly([[L + 0.7, 0], [1, -W - 0.8], [-8.5, 0], [1, W + 0.8]], C[1]);
  p.poly([[L - 0.5, 0], [1.2, -W], [-7.5, 0]], C[6]);
  p.poly([[L - 0.5, 0], [1.2, W], [-7.5, 0]], C[3]);
  p.poly([[L - 4, 0], [2.4, -W + 2], [-4, 0]], C[5]);
  p.poly([[L - 4, 0], [2.4, W - 2], [-4, 0]], C[4]);
  p.line(-6, 0, L, 0, WHITE, 1);
  p.ellipse(3.5, 0, 3.6 + pulse * 0.9, 2.2 + pulse * 0.5, WHITE);
  p.px(L, 0, WHITE);

  // flakes circling it, bright when passing in front
  for (let i = 0; i < 3; i++) {
    const a = ph * TAU * 2 + (i * TAU) / 3, x = 3 + Math.cos(a) * 10.5, y = Math.sin(a) * 8.5, z = Math.sin(a);
    p.px(Math.round(x), Math.round(y), z > 0 ? WHITE : C[5]);
    if (z > 0.3) p.dot(Math.round(x) - 1, Math.round(y), C[6], 0.8);
  }
  sparkle(p, L + 2, 0, 2.2 + pulse * 1.2, WHITE, C[6], 0.9);

  p.glow(2, 0, 34, C[3], 0.2);
  p.glow(4, 0, 17, C[5], 0.32);
  p.glow(L, 0, 8, WHITE, 0.3);
}
