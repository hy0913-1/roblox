import { fit, clamp, ease, band, burst, fly, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Spin slash",
  desc: "A whirlwind spin on the floor at 3/4: a blade trail circles once and a quarter round the body, its far half behind, a dust ring kicks out and sparks fly off.",
  tags: ["rpg", "melee", "spin", "whirlwind", "aoe", "one-shot"],
  size: [112, 84],
  origin: [56, 50],
  duration: 0.55,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#0e1a33", "#24457a", "#4a7cc0", "#8cc0f0", "#d8f0ff", "#ffffff"], radius: 30, seed: 5 },
};

const SY = 0.6, Y = -8;
function trail(p, t, o, back) {
  const C = fit(o.palette, 6), R = o.radius, SPIN = 0.32, fade = 1 - clamp((t - SPIN) / (meta.duration - SPIN));
  if (fade <= 0) return;
  const head = -Math.PI / 2 + TAU * 1.25 * ease.outQuad(clamp(t / SPIN)), tail = head - 2.6;
  for (let a = tail; a <= head; a += 0.025) {
    const s = Math.sin(a);
    if (s < 0 !== back) continue;
    const u = (a - tail) / 2.6, w = 1 + 4 * u;
    for (let k = -w / 2; k <= w / 2; k += 0.5) {
      const x = Math.cos(a) * (R + k), y = Y + s * (R + k) * SY, c = u > 0.9 ? WHITE : u > 0.6 ? C[4] : u > 0.3 ? C[3] : C[2];
      p.dot(x, y, back ? C[Math.max(1, (u * 4) | 0)] : c, (0.3 + u) * fade);
    }
  }
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 6), k = clamp(t / 0.4);
  if (k < 1) band(p, 0, 0, 6 + o.radius * 1.2 * ease.outCubic(k), SY, Math.max(1, 3 * (1 - k)), 1 - k, ["#3a3026", "#6e5a40", "#b89f78", "#dcc8a2"], (g) => Math.sin(g) < 0);
  trail(p, t, o, true);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), k = clamp(t / 0.4);
  if (k < 1) band(p, 0, 0, 6 + o.radius * 1.2 * ease.outCubic(k), SY, Math.max(1, 3 * (1 - k)), 1 - k, ["#3a3026", "#6e5a40", "#b89f78", "#dcc8a2"], (g) => Math.sin(g) >= 0);
  trail(p, t, o, false);
  p.glow(0, Y, o.radius * 1.6, C[3], 0.3 * (1 - clamp(t / meta.duration)));
  burst(16, o.seed, (r) => {
    const t0 = r.range(0.05, 0.3), age = t - t0;
    if (age < 0 || age > 0.25) return;
    const a = -Math.PI / 2 + TAU * 1.25 * ease.outQuad(t0 / 0.32), sp = r.range(70, 150);
    const [x, y] = fly(Math.cos(a) * o.radius, Y + Math.sin(a) * o.radius * SY, -Math.sin(a) * sp, Math.cos(a) * sp * SY - 30, age, 300, 3);
    p.px(Math.round(x), Math.round(y), age < 0.1 ? WHITE : C[4]);
  });
}
