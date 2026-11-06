import { PAL, fit, cycle, at, WHITE, TAU, hex } from "../../core/index.js";

export const meta = {
  name: "Fighter jet",
  desc: "A delta-wing fighter seen from above, flying right: lit metal, a glinting canopy, flickering afterburners, nav lights and vapour trails off the wingtips.",
  tags: ["rpg", "vehicle", "jet", "airstrike", "military", "loop"],
  size: [150, 72],
  origin: [96, 36],
  duration: 0.4,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: PAL.metal, fire: ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#fff3a6", "#ffffff"], seed: 2 },
};

const mirror = (pts) => pts.map(([x, y]) => [x, -y]);
const OUT = hex("#0c0e14");

export function draw(p, t, o) {
  const C = fit(o.palette, 8), Fi = fit(o.fire, 7), ph = t / meta.duration, flick = 0.5 + 0.5 * Math.sin(ph * TAU * 3);

  // vapour trails off the wingtips and a heat wake behind the engines
  for (const s of [-1, 1]) {
    for (let i = 0; i < 70; i++) {
      const k = i / 70, x = -20 - i * 1.1, y = s * (24 + k * 1.5);
      p.dot(x, y, k < 0.25 ? WHITE : C[6], (1 - k) * 0.75);
    }
  }
  cycle(t, meta.duration, 14, o.seed, 0.4, (age, life, r) => {
    const k = age / life;
    p.dot(Math.round(-36 - age * r.range(80, 140)), Math.round(r.range(-4, 4) * (1 + k)), at([Fi[1], Fi[2], Fi[3]], 1 - k), 0.8 * (1 - k));
  });

  // afterburners: two flickering cones behind the nozzles
  for (const s of [-1, 1]) {
    const L = 9 + flick * 5 + (s > 0 ? 1 : 0);
    p.poly([[-32, s * 2.2 - 2], [-32 - L, s * 2.2], [-32, s * 2.2 + 2]], Fi[3]);
    p.poly([[-32, s * 2.2 - 1.2], [-32 - L * 0.62, s * 2.2], [-32, s * 2.2 + 1.2]], Fi[5]);
    p.px(-33, s * 2.2, WHITE);
    p.glow(-34 - L * 0.4, s * 2.2, 12, Fi[4], 0.45);
  }

  // outline, then the body built up dark to light: lit from the top-left
  const wing = [[12, -4], [-14, -26], [-22, -26], [-20, -4]];
  const tail = [[-20, -4], [-30, -13], [-34, -13], [-32, -4]];
  const body = [[34, 0], [26, -3], [6, -5], [-32, -5], [-34, -3], [-34, 3], [-32, 5], [6, 5], [26, 3]];
  for (const poly of [wing, mirror(wing), tail, mirror(tail), body]) p.poly(poly.map(([x, y]) => [x + Math.sign(x) * 0.8, y + Math.sign(y) * 0.8]), OUT);
  p.poly(mirror(wing), C[3]);
  p.poly(wing, C[4]);
  p.poly([[8, -5], [-14, -24], [-17, -24], [-4, -5]], C[5]);
  p.poly(mirror(tail), C[3]);
  p.poly(tail, C[4]);
  p.poly(body, C[4]);
  p.poly([[33, 0], [26, -2.5], [6, -4.4], [-32, -4.4], [-32, 0]], C[5]);
  p.line(-30, -2, 28, -1, C[6], 0.8);
  p.line(-30, 3, 26, 2, C[2], 0.9);
  // panel lines and a roundel on each wing
  for (const x of [-8, -20]) p.line(x, -4, x, 4, C[2], 0.7);
  for (const s of [-1, 1]) {
    p.circle(-10, s * 15, 2.6, hex("#1f3f8a"));
    p.circle(-10, s * 15, 1.4, WHITE);
    p.px(-10, s * 15, hex("#c9281f"));
  }
  // canopy with a moving glint
  p.ellipse(16, -0.5, 6, 2.2, hex("#13243e"));
  p.ellipse(17, -1, 4, 1.2, hex("#2f5f9a"));
  p.px(Math.round(13 + ph * 8), -1, WHITE);
  // nav lights: red port (left wing, -y when flying right), green starboard, blinking
  const blink = ph < 0.5 ? 1 : 0.35;
  p.px(-21, -26, hex("#ff4a4a"));
  p.px(-21, 26, hex("#4aff7a"));
  p.glow(-21, -26, 5, hex("#ff4a4a"), 0.6 * blink);
  p.glow(-21, 26, 5, hex("#4aff7a"), 0.6 * blink);
}
