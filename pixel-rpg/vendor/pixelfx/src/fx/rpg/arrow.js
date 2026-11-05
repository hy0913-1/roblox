import { fit, cycle, WHITE, hex } from "../../core/index.js";

export const meta = {
  name: "Arrow",
  desc: "An arrow in flight, facing right: a steel head, a wooden shaft and red fletching, a thin wake of cut air behind it; recolour it to make it glow.",
  tags: ["rpg", "projectile", "arrow", "bow", "loop"],
  size: [56, 20],
  origin: [36, 10],
  duration: 0.3,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: ["#2a2f3a", "#6e7a90", "#d0d8e6", "#ffffff"], glow: 0, seed: 2 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 4), WOOD = hex("#8e5c2c"), WOOD2 = hex("#5a3a1a"), FEATHER = hex("#d8362e"), FEATHER2 = hex("#ff8a6a");
  cycle(t, meta.duration, 10, o.seed, 0.3, (age, life, r) => {
    const k = age / life;
    p.dot(Math.round(-14 - age * r.range(60, 120)), Math.round(r.range(-1.5, 1.5)), k < 0.3 ? C[3] : C[2], 0.6 * (1 - k));
  });
  for (let x = -12; x <= 5; x++) p.px(x, 0, x % 3 ? WOOD : WOOD2);
  p.line(-13, -2, -9, 0, FEATHER);
  p.line(-13, 2, -9, 0, FEATHER);
  p.px(-12, -2, FEATHER2);
  p.px(-12, 2, FEATHER2);
  p.poly([[10, 0], [5, -2.4], [6, 0], [5, 2.4]], C[1]);
  p.line(6, 0, 10, 0, C[2]);
  p.px(10, 0, C[3]);
  if (o.glow) {
    p.glow(2, 0, 18, C[2], 0.5 * o.glow);
    p.glowLine?.(-12, 0, 10, 0, C[2], 0.3 * o.glow);
  }
}
