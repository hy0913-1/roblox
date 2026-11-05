import { fit, cycle, at, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Portal",
  desc: "A way out drawn on the floor at 3/4: a spinning spiral of light in a ring, motes rising out of it and a steady glow; recolour it per destination.",
  tags: ["rpg", "portal", "door", "magic", "loop"],
  size: [64, 64],
  origin: [32, 44],
  duration: 1.2,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#140a26", "#481c88", "#6b2cc0", "#9a48ec", "#c684ff", "#ecc8ff", "#ffffff"], radius: 14, seed: 5 },
};

const SY = 0.55;
export function drawBack(p, t, o) {
  const C = fit(o.palette, 7), R = o.radius, ph = t / meta.duration;
  for (let i = 0; i < 3; i++)
    for (let a = 0; a < TAU * 1.6; a += 0.06) {
      const r = (a / (TAU * 1.6)) * R, g = a + ph * TAU + (i * TAU) / 3;
      p.dot(Math.round(Math.cos(g) * r), Math.round(Math.sin(g) * r * SY), at(C.slice(2), r / R), 0.9);
    }
  for (let a = 0; a < TAU; a += 0.05) p.px(Math.round(Math.cos(a) * R), Math.round(Math.sin(a) * R * SY), a % 0.6 < 0.3 ? C[5] : C[3]);
}
export function draw(p, t, o) {
  const C = fit(o.palette, 7), R = o.radius;
  cycle(t, meta.duration, 14, o.seed, 0.9, (age, life, r) => {
    const k = age / life, a = r.range(0, TAU), d = r.range(0, R);
    p.dot(Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d * SY - k * 26), k < 0.4 ? WHITE : C[4], 1 - k);
  });
  p.glow(0, -4, R * 2.2, C[3], 0.35);
}
