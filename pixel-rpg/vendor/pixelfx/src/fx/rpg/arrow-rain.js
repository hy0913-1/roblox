import { Particles, P, Rng, fit, clamp, burst, WHITE, TAU, hex } from "../../core/index.js";

export const meta = {
  name: "Arrow rain",
  desc: "A volley falling on one spot at 3/4: arrows streak down at an angle in quick succession, punch into the floor with a spark and a puff of dust, stand quivering and fade.",
  tags: ["rpg", "projectile", "arrow", "volley", "aoe", "one-shot"],
  size: [112, 112],
  origin: [56, 76],
  duration: 2.0,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#2a2f3a", "#6e7a90", "#d0d8e6", "#ffffff"], radius: 30, count: 16, seed: 6 },
};

const SY = 0.58, FALL = 0.22, H = 70;
export function create(o) {
  const C = fit(o.palette, 4), R = new Rng(o.seed), ps = new Particles({ rng: R, ground: () => 1e9, sparks: [C[3], C[2], C[1], C[1]] });
  const arrows = Array.from({ length: o.count }, (_, i) => {
    const a = R.range(0, TAU), d = Math.sqrt(R.next()) * o.radius;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d * SY, t0: (i / o.count) * 0.6 + R.range(0, 0.05), hit: false };
  });
  const WOOD = hex("#8e5c2c"), FEATHER = hex("#d8362e"), DUST = hex("#b89f78");
  let t = 0;
  return {
    update(dt) {
      t += dt;
      for (const a of arrows)
        if (!a.hit && t >= a.t0 + FALL) {
          a.hit = true;
          for (let i = 0; i < 3; i++) ps.spawn(P.SPARK, a.x, a.y, R.range(-50, 50), -R.range(20, 70), R.range(0.1, 0.2));
          ps.spawn(P.DUST, a.x, a.y, R.range(-12, 12), -R.range(2, 8), R.range(0.3, 0.6), DUST, R.range(1.5, 2.6));
        }
      ps.update(dt);
    },
    draw(p) {
      for (const a of arrows) {
        const u = (t - a.t0) / FALL;
        if (u < 0) continue;
        if (u < 1) {
          // falling: a streak coming down from up-left
          const h = H * (1 - u), x = a.x - h * 0.45, y = a.y - h;
          for (let i = 0; i < 9; i++) p.px(Math.round(x - i * 0.45), Math.round(y - i), i < 2 ? C[2] : i > 6 ? FEATHER : WOOD);
          p.dot(Math.round(x - 10 * 0.45), Math.round(y - 11), C[2], 0.4);
        } else {
          // stuck in the floor, quivering, then fading
          const age = t - a.t0 - FALL, fade = 1 - clamp((age - 0.6) / 0.5);
          if (fade <= 0) continue;
          const q = age < 0.25 ? Math.round(Math.sin(age * 90) * (1 - age / 0.25)) : 0;
          for (let i = 1; i < 7; i++) p.dot(Math.round(a.x - i * 0.45 + (i > 3 ? q : 0)), Math.round(a.y - i), i > 4 ? FEATHER : WOOD, fade);
          if (age < 0.06) p.glow(a.x, a.y, 8, C[3], 0.7);
        }
      }
      ps.draw(p);
    },
  };
}
