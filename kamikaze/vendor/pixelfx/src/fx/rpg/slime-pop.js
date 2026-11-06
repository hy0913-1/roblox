import { Particles, Bits, Lights, P, B, Rng, PAL, fit, flare, clamp, smooth, seg, ease, hex, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Slime pop",
  desc: "A slime bursts: a white pop, goo chunks and drips fly out and land as little splats around a spreading puddle that shrinks and dries, green vapour puffs and stars lift away.",
  tags: ["rpg", "death", "slime", "goo", "poison", "one-shot"],
  size: [136, 72],
  origin: [68, 46],
  duration: 1.3,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: PAL.poison.concat(["#f4ffd0"]), seed: 5 },
};

const SY = 0.58, BODY = -7;

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]], haze: C[5] });
  const lights = new Lights();
  lights.add(0, BODY, 46, C[5], 0.7, 0.4);
  lights.add(0, BODY, 22, WHITE, 0.6, 0.1);
  // droplets: ballistic, they land and become splats on the floor
  const drops = Array.from({ length: 13 }, () => {
    const a = R.range(0, TAU), sp = R.range(40, 105);
    return { x: 0, y: BODY, vx: Math.cos(a) * sp, vy: -R.range(60, 150) + Math.sin(a) * 15, vz: Math.sin(a) * sp * 0.5, z: 0, s: R.range(1.4, 3), c: R.pick([C[4], C[5], C[3]]), landed: -1, big: R.chance(0.35) };
  });
  const bits = new Bits({ ground: floor });
  for (let i = 0; i < 7; i++) {
    const a = R.range(-Math.PI, 0), sp = R.range(50, 130);
    bits.add({ kind: B.DRIP, x: R.range(-3, 3), y: BODY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.9, drag: 0.4, bounce: 0.1, life: R.range(0.5, 0.8), s: R.range(1.5, 2.4), c: R.pick([C[5], C[4]]) });
  }
  for (let i = 0; i < 6; i++) {
    const s = R.sign();
    ps.spawn(P.VAPOUR, s * R.range(2, 14), -R.range(2, 8), s * R.range(10, 34), -R.range(8, 26), R.range(0.5, 0.9), R.chance(0.5) ? C[7] : C[6], R.range(2.5, 4.5));
  }
  for (let i = 0; i < 5; i++) ps.spawn(P.STAR, R.range(-10, 10), -R.range(10, 22), 0, -R.range(10, 24), R.range(0.35, 0.6), R.chance(0.5) ? WHITE : C[6], R.range(1, 2));
  let t = 0;

  // a lit goo blob: dark rim, body, brighter top-left, a speck of shine. Hard steps, no dither.
  const blob = (p, x, y, r, k = 1) => {
    if (r < 1) return;
    const ry = Math.max(1, r * SY);
    if (r >= 5) p.ellipse(x, y, r + 1, ry + 1, C[1]);
    p.ellipse(x, y, r, ry, C[2]);
    p.ellipse(x - r * 0.12, y - ry * 0.22, r * 0.78, ry * 0.68, C[3]);
    if (r > 3) p.ellipse(x - r * 0.28, y - ry * 0.38, r * 0.38, ry * 0.3, C[4]);
    if (r > 4.5) p.px(x - r * 0.38, y - ry * 0.5, C[7]);
  };

  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      bits.update(dt);
      lights.update(dt);
      for (const d of drops) {
        if (d.landed >= 0) continue;
        d.vy += 520 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.vy > 0 && d.y >= d.vz * 0.22) {
          d.landed = t;
          d.y = d.vz * 0.22;
        }
      }
    },
    drawBack(p) {
      const k = clamp(t / 0.2), r = 3 + 12 * ease.outBack(k, 1.4), shrink = 1 - smooth(0.7, 1.25, t);
      blob(p, 0, 0, r * shrink);
      for (const d of drops) if (d.landed >= 0) blob(p, d.x, d.y, (d.big ? 3.2 : 2) * (1 - smooth(d.landed + 0.25, 1.2, t)) * (1 + 0.6 * (1 - clamp((t - d.landed) / 0.08))));
      ps.draw(p, "back");
    },
    draw(p) {
      if (t < 0.2) {
        const k = t / 0.2;
        flare(p, 0, BODY, 24 * Math.pow(1 - k, 1.5), 1 - k, C);
        if (t < 0.06) p.circle(0, BODY, 6.5, WHITE);
        p.glow(0, BODY, 30, C[5], 0.4 * (1 - k));
      }
      for (const d of drops) if (d.landed < 0) {
        p.circle(d.x, d.y, d.s * 0.7, d.c);
        p.px(d.x - d.s * 0.3, d.y - d.s * 0.3, C[7]);
      }
      bits.draw(p);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
