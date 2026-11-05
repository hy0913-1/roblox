import { fit, cycle, at, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Shuriken",
  desc: "A throwing star flying right, spinning fast: four steel points round a dark hub, a glint on the leading blade and a thin violet wake.",
  tags: ["rpg", "projectile", "shuriken", "thief", "ninja", "loop"],
  size: [48, 24],
  origin: [32, 12],
  duration: 0.2,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: ["#1c1c24", "#5c5c6b", "#a4a4b2", "#e8ecf4"], trail: ["#2b1252", "#6b2cc0", "#c684ff"], seed: 3 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 4), Tr = fit(o.trail, 3), ph = t / meta.duration, spin = ph * TAU * (1 / 4) * 4;
  cycle(t, meta.duration, 8, o.seed, 0.2, (age, life, r) => {
    const k = age / life;
    p.dot(Math.round(-4 - age * r.range(80, 140)), Math.round(r.range(-1.5, 1.5)), at(Tr, 1 - k), 0.8 * (1 - k));
  });
  for (let i = 0; i < 4; i++) {
    const a = spin + (i * TAU) / 4, ca = Math.cos(a), sa = Math.sin(a);
    p.poly([[ca * 6, sa * 6], [Math.cos(a + 0.9) * 2, Math.sin(a + 0.9) * 2], [Math.cos(a - 0.9) * 2, Math.sin(a - 0.9) * 2]], i === 0 ? C[3] : C[2]);
    p.px(Math.round(ca * 5), Math.round(sa * 5), i === 0 ? WHITE : C[3]);
  }
  p.circle(0, 0, 1.6, C[0]);
  p.px(0, 0, C[1]);
  p.glow(0, 0, 10, Tr[2], 0.25);
}
