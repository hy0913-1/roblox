import { fit, WHITE, TAU, hex } from "../../core/index.js";

export const meta = {
  name: "Strike marker",
  desc: "A target painted on the floor at 3/4: a dashed ring spinning, four chevrons pulsing inward to a blinking centre, a warm glow under it.",
  tags: ["rpg", "ui", "target", "marker", "airstrike", "loop"],
  size: [96, 64],
  origin: [48, 32],
  duration: 1,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#3a0a0a", "#8c1a14", "#d8361e", "#ff6a2a", "#ffb04a", "#ffe6a0"], radius: 26, seed: 1 },
};

const SY = 0.55;

export function draw(p, t, o) {
  const C = fit(o.palette, 6), ph = t / meta.duration, R = o.radius;
  const ell = (a, r) => [Math.cos(a) * r, Math.sin(a) * r * SY];
  // dashed ring, spinning
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * TAU + ph * TAU * 0.25;
    if (i % 4 === 3) continue;
    const [x, y] = ell(a, R);
    p.px(Math.round(x), Math.round(y), i % 4 === 0 ? C[5] : C[3]);
  }
  // inner ring, still
  for (let i = 0; i < 40; i++) {
    const [x, y] = ell((i / 40) * TAU, R * 0.45);
    p.dot(Math.round(x), Math.round(y), C[2], 0.8);
  }
  // chevrons pulse inward
  const pulse = (ph * 2) % 1;
  for (let q = 0; q < 4; q++) {
    const a = (q * TAU) / 4 + TAU / 8, r = R * (1.25 - 0.35 * pulse);
    const [cx, cy] = ell(a, r), [lx, ly] = ell(a - 0.18, r + 5), [rx, ry] = ell(a + 0.18, r + 5);
    p.line(lx, ly, cx, cy, C[4], 1 - pulse * 0.6);
    p.line(rx, ry, cx, cy, C[4], 1 - pulse * 0.6);
  }
  // crosshair and blinking centre
  p.line(-6, 0, -2, 0, C[4]);
  p.line(2, 0, 6, 0, C[4]);
  p.line(0, -3, 0, -1, C[4]);
  p.line(0, 1, 0, 3, C[4]);
  if (ph % 0.5 < 0.25) p.px(0, 0, WHITE);
  p.glow(0, 0, R * 1.1, C[3], 0.18 + 0.08 * Math.sin(ph * TAU * 2));
}
